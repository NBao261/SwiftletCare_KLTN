import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from counting import MultiRingCounter  # noqa: E402
from stream import load_config, load_day_total, load_state, make_counter, save_state, topic_base  # noqa: E402

SQUARE = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]


def test_state_restores_only_same_session_and_day(tmp_path):
    path = tmp_path / "state.json"
    save_state("EVENING_ENTRY", "2026-10-20", MultiRingCounter([(SQUARE, True)], 200, 200, base_entry=12, base_exit=4), path)
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (12, 4)
    assert load_state("MORNING_EXIT", "2026-10-20", path) == (0, 0)    # phiên khác
    assert load_state("EVENING_ENTRY", "2026-10-21", path) == (0, 0)   # ngày khác


def test_state_missing_or_broken_file(tmp_path):
    path = tmp_path / "state.json"
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)
    path.write_text("{not json", encoding="utf-8")
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)


def test_topic_base_is_per_device():
    # Mỗi thiết bị một cây topic, nhà yến do backend giữ
    assert topic_base({"CAMERA_DEVICE_ID": "cam-1"}) == "swiftletcare/dev/cam-1"


def test_counter_from_config_restores_counts_and_uses_the_backend_ring():
    cfg = load_config()
    c = make_counter(cfg, 1920, 1080, base=(7, 3))
    assert (c.entry_count, c.exit_count) == (7, 3)
    backend = make_counter(cfg, 1000, 1000, rings=[(SQUARE, False)])
    assert backend.contains((500, 500)) and not backend.contains((100, 100))


def test_day_total_survives_a_restart_on_the_same_day_only(tmp_path):
    path = tmp_path / "state.json"
    save_state(None, "2026-11-23", MultiRingCounter([(SQUARE, True)], 200, 200), path, day_total=57)
    assert load_day_total("2026-11-23", path) == 57
    assert load_day_total("2026-11-24", path) == 0     # sang ngày mới đếm lại
    path.write_text("{not json", encoding="utf-8")
    assert load_day_total("2026-11-23", path) == 0
