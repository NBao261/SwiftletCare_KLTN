import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from counting import MultiRingCounter, RingCounter  # noqa: E402
from counting import current_session  # noqa: E402
from remote_config import RingStore, ScheduleStore, dispatch_config, parse_rings, parse_windows  # noqa: E402

RING = [[0.379, 0.228], [0.527, 0.136], [0.575, 0.277], [0.569, 0.374], [0.427, 0.477], [0.386, 0.334]]
SQUARE = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]


def msg(**ring):
    return {"deviceId": "cam_01", "counting_ring": {"points": RING, "into_ring_is_exit": True, **ring}}


def rings_msg(*rings):
    return {"deviceId": "cam_01", "counting_rings": list(rings)}


def test_ring_from_an_older_backend_is_one_ring():
    [(points, into_exit)] = parse_rings(msg(), "cam_01")
    assert points[0] == (0.379, 0.228) and len(points) == 6 and into_exit is True


def test_two_rings_and_no_ring_are_parsed():
    two = parse_rings(rings_msg({"points": RING, "into_ring_is_exit": True},
                                {"points": SQUARE, "into_ring_is_exit": False}), "cam_01")
    assert [len(points) for points, _ in two] == [6, 4] and [into for _, into in two] == [True, False]
    assert parse_rings(rings_msg(), "cam_01") == []          # deleted: back to the config.yaml ring


def test_other_device_or_no_ring_is_ignored():
    assert parse_rings(msg(), "cam_02") is None
    assert parse_rings({"deviceId": "cam_01", "temp_min": 26}, "cam_01") is None
    assert parse_rings("not a dict", "cam_01") is None


@pytest.mark.parametrize("message", [
    msg(points=RING[:2]),
    msg(points=RING * 3),
    msg(points=[[0.1, 0.1], [1.2, 0.1], [0.5, 0.9]]),
    msg(points=[[0.1], [0.2, 0.2], [0.5, 0.9]]),
    msg(points=[[True, 0.1], [0.2, 0.2], [0.5, 0.9]]),
    msg(into_ring_is_exit="true"),
    rings_msg(*[{"points": RING, "into_ring_is_exit": True}] * 5),
    {"deviceId": "cam_01", "counting_rings": {"points": RING}},
])
def test_malformed_rings_raise(message):
    with pytest.raises(ValueError):
        parse_rings(message, "cam_01")


def test_store_saves_the_rings_and_hands_them_to_the_loop_once(tmp_path):
    path = tmp_path / "state" / "counting_ring.json"
    store = RingStore(path, "cam_01")
    assert store.load() is None

    store.on_message(json.dumps(rings_msg({"points": RING, "into_ring_is_exit": True},
                                          {"points": SQUARE, "into_ring_is_exit": False})).encode())
    assert len(store.take_update()) == 2
    assert store.take_update() is None
    assert RingStore(path, "cam_01").load()[1][0][0] == (0.25, 0.25)   # survives a restart


def test_deleting_the_rings_removes_the_file_and_tells_the_loop(tmp_path):
    path = tmp_path / "counting_ring.json"
    store = RingStore(path, "cam_01")
    store.on_message(json.dumps(msg()).encode())
    store.take_update()
    store.on_message(json.dumps(rings_msg()).encode())
    assert store.take_update() == [] and not path.exists() and store.load() is None


def test_a_ring_file_saved_before_multiple_rings_still_loads(tmp_path):
    path = tmp_path / "counting_ring.json"
    path.write_text(json.dumps({"points": RING, "into_ring_is_exit": True}), encoding="utf-8")
    [(points, into_exit)] = RingStore(path, "cam_01").load()
    assert len(points) == 6 and into_exit is True


def test_store_ignores_bad_messages_and_a_corrupt_file(tmp_path):
    path = tmp_path / "counting_ring.json"
    store = RingStore(path, "cam_01")
    store.on_message(b"{not json")
    store.on_message(json.dumps(msg(points=RING[:2])).encode())
    assert store.take_update() is None and not path.exists()

    path.write_text("{", encoding="utf-8")
    assert store.load() is None


def test_two_rings_add_up_and_redrawing_keeps_the_counts():
    left = [(0.0, 0.0), (0.3, 0.0), (0.3, 0.3), (0.0, 0.3)]
    right = [(0.7, 0.7), (1.0, 0.7), (1.0, 1.0), (0.7, 1.0)]
    c = MultiRingCounter([(left, True), (right, False)], 100, 100)
    c.update([1, 2], [(10, 10, 14, 14), (50, 50, 54, 54)])   # bird 1 in the left hole, bird 2 in the room
    c.update([1, 2], [(50, 10, 54, 14), (80, 80, 84, 84)])   # 1 leaves the left ring, 2 enters the right one
    assert (c.entry_count, c.exit_count) == (2, 0)           # left: out of a hole = ENTRY; right: into it = ENTRY

    c.set_rings([(SQUARE, True)])
    assert (c.entry_count, c.exit_count) == (2, 0) and len(c.polygons) == 1


def test_new_ring_keeps_counts_and_does_not_invent_a_crossing():
    c = RingCounter(SQUARE, 100, 100)
    c.update([1], [(47, 47, 53, 53)])            # bird inside the old ring
    c.update([1], [(87, 87, 93, 93)])            # comes out: ENTRY
    c.update([2], [(57, 57, 63, 63)])            # another bird inside the old ring, sitting still
    assert (c.entry_count, c.exit_count) == (1, 0)

    c.set_ring([(0.0, 0.0), (0.5, 0.0), (0.5, 0.5), (0.0, 0.5)], 100, 100, True)
    c.update([2], [(57, 57, 63, 63)])            # now outside the new ring without moving
    assert (c.entry_count, c.exit_count) == (1, 0)
    c.update([2], [(17, 17, 23, 23)])            # really flies into the new ring: EXIT
    assert (c.entry_count, c.exit_count) == (1, 1)


# Khung phiên theo lịch đếm
DEFAULT = {"MORNING_EXIT": ("05:30", "07:00"), "EVENING_ENTRY": ("17:30", "19:00")}
RAINY = {"MORNING_EXIT": ["06:00", "07:30"], "EVENING_ENTRY": ["17:00", "18:30"]}


def windows_msg(by_date, device="cam_01"):
    return {"deviceId": device, "session_windows": by_date}


def test_windows_for_this_camera_are_parsed():
    parsed = parse_windows(windows_msg({"2026-11-20": RAINY}), "cam_01")
    assert parsed == {"2026-11-20": {"MORNING_EXIT": ("06:00", "07:30"), "EVENING_ENTRY": ("17:00", "18:30")}}
    assert parse_windows(windows_msg({"2026-11-20": RAINY}, "cam_02"), "cam_01") is None
    assert parse_windows(msg(), "cam_01") is None


@pytest.mark.parametrize("by_date", [
    {"20/11/2026": RAINY},
    {"2026-11-20": {"MORNING_EXIT": ["06:00", "07:30"]}},
    {"2026-11-20": {**RAINY, "EVENING_ENTRY": ["18:30", "17:00"]}},
    {"2026-11-20": {**RAINY, "MORNING_EXIT": ["6:00", "07:30"]}},
    ["2026-11-20"],
])
def test_malformed_windows_raise(by_date):
    with pytest.raises(ValueError):
        parse_windows(windows_msg(by_date), "cam_01")


def test_schedule_store_uses_the_day_sent_and_falls_back_to_config(tmp_path):
    store = ScheduleStore(tmp_path / "windows.json", "cam_01")
    assert store.windows_on("2026-11-20", DEFAULT) == DEFAULT
    store.on_message(json.dumps(windows_msg({"2026-11-20": RAINY})).encode())
    rainy = store.windows_on("2026-11-20", DEFAULT)
    assert rainy["EVENING_ENTRY"] == ("17:00", "18:30")
    assert store.windows_on("2026-11-21", DEFAULT) == DEFAULT
    # 18:45 thuộc phiên chiều mặc định nhưng ngoài khung chiều của ngày mưa
    from datetime import datetime
    assert current_session(rainy, datetime(2026, 11, 20, 18, 45)) is None
    assert current_session(DEFAULT, datetime(2026, 11, 20, 18, 45)) == "EVENING_ENTRY"


def test_schedule_store_keeps_windows_across_a_restart_and_ignores_bad_input(tmp_path):
    path = tmp_path / "windows.json"
    ScheduleStore(path, "cam_01").on_message(json.dumps(windows_msg({"2026-11-20": RAINY})).encode())
    again = ScheduleStore(path, "cam_01")
    again.load()
    assert again.windows_on("2026-11-20", DEFAULT)["MORNING_EXIT"] == ("06:00", "07:30")
    again.on_message(b"not json")
    again.on_message(json.dumps(windows_msg({"bad": RAINY})).encode())
    assert again.windows_on("2026-11-20", DEFAULT)["MORNING_EXIT"] == ("06:00", "07:30")
    path.write_text("{corrupt", encoding="utf-8")
    broken = ScheduleStore(path, "cam_01")
    broken.load()
    assert broken.windows_on("2026-11-20", DEFAULT) == DEFAULT


def test_one_failing_store_does_not_starve_the_others():
    class Broken:
        def on_message(self, payload):
            raise OSError("disk full")

    received = []

    class Recorder:
        def on_message(self, payload):
            received.append(payload)

    dispatch_config([Broken(), Recorder()], b"{}")
    assert received == [b"{}"]
