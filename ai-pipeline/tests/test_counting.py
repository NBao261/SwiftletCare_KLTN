from datetime import datetime

import numpy as np
import supervision as sv

from counting import BucketClock, LineCounter, current_session

WINDOWS = {"MORNING_EXIT": ["05:30", "07:00"], "EVENING_ENTRY": ["17:30", "19:00"]}


def _track(cy: float, tid: int = 1) -> sv.Detections:
    return sv.Detections(xyxy=np.array([[90, cy - 10, 110, cy + 10]], dtype=np.float32),
                         confidence=np.array([0.9], dtype=np.float32),
                         class_id=np.array([0]), tracker_id=np.array([tid]))


def _run(counter: LineCounter, ys, tid: int = 1) -> None:
    for y in ys:
        counter.update(_track(y, tid))


def test_crossing_counted_once_per_direction():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200)        # vạch ngang giữa khung 200x200
    _run(c, [40, 60, 80, 120, 140, 160])                   # đi từ trên xuống
    assert c.entry_count + c.exit_count == 1
    first_was_entry = c.entry_count == 1
    _run(c, [140, 120, 80, 60, 40])                        # quay ngược lại
    assert (c.entry_count, c.exit_count) == (1, 1)

    flipped = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200, in_is_entry=False)
    _run(flipped, [40, 60, 80, 120, 140, 160])
    assert (flipped.entry_count == 1) != first_was_entry   # đổi cờ thì đổi chiều


def test_hovering_without_crossing_is_not_counted():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200)
    _run(c, [40, 60, 80, 60, 40, 70])                      # lượn phía trên vạch
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_untracked_detections_are_ignored():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200)
    det = sv.Detections(xyxy=np.array([[90, 30, 110, 50]], dtype=np.float32))   # chưa có tracker_id
    c.update(det)
    c.update(sv.Detections.empty())
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_base_counts_survive_restart():
    c = LineCounter([0.0, 0.5, 1.0, 0.5], 200, 200, base_entry=7, base_exit=3)
    assert (c.entry_count, c.exit_count) == (7, 3)
    _run(c, [40, 60, 80, 120, 140, 160])
    assert c.entry_count + c.exit_count == 11


def test_current_session_bounds():
    at = lambda hhmm: datetime.strptime(f"2026-10-20 {hhmm}", "%Y-%m-%d %H:%M")  # noqa: E731
    assert current_session(WINDOWS, at("05:29")) is None
    assert current_session(WINDOWS, at("05:30")) == "MORNING_EXIT"   # đầu tính
    assert current_session(WINDOWS, at("06:59")) == "MORNING_EXIT"
    assert current_session(WINDOWS, at("07:00")) is None             # cuối không tính
    assert current_session(WINDOWS, at("18:15")) == "EVENING_ENTRY"
    assert current_session(WINDOWS, at("23:00")) is None


def test_bucket_clock_aligns_and_reports_deltas():
    t0 = 1_760_000_000 - 1_760_000_000 % 300 + 42            # 42 giây sau mốc 5 phút
    b = BucketClock(5, t0)
    assert b.start == t0 - 42
    assert b.roll(t0 + 100, (3, 1)) is None                   # chưa hết khoảng
    assert b.roll(t0 - 42 + 300, (5, 2)) == (t0 - 42, 5, 2)   # hết khoảng đầu: số từ đầu
    assert b.roll(t0 - 42 + 610, (9, 2)) == (t0 - 42 + 300, 4, 0)   # khoảng sau chỉ phần tăng thêm
    assert b.start == t0 - 42 + 600


def test_bucket_clock_after_outage_keeps_old_start():
    b = BucketClock(5, 0)
    assert b.roll(1000, (2, 0)) == (0, 2, 0)                  # mất hình 1000 giây: một khoảng dài, mốc đầu cũ
    assert b.start == 900
