import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from counting import RingCounter  # noqa: E402
from stream import load_config, load_state, make_counter, save_state, topic_base  # noqa: E402

SQUARE = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]


def test_state_restores_only_same_session_and_day(tmp_path):
    path = tmp_path / "state.json"
    save_state("EVENING_ENTRY", "2026-10-20", RingCounter(SQUARE, 200, 200, base_entry=12, base_exit=4), path)
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (12, 4)
    assert load_state("MORNING_EXIT", "2026-10-20", path) == (0, 0)    # phiên khác
    assert load_state("EVENING_ENTRY", "2026-10-21", path) == (0, 0)   # ngày khác


def test_state_missing_or_broken_file(tmp_path):
    path = tmp_path / "state.json"
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)
    path.write_text("{not json", encoding="utf-8")
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)


def test_topic_base_is_per_house_without_zone():
    # Backend SRS v2.1.8: nút AI publish theo nhà yến — swiftletcare/{farm}/{house}/heartbeat|vision/...
    assert topic_base({"FARM_ID": "f1", "HOUSE_ID": "h1", "ZONE_ID": "z1"}) == "swiftletcare/f1/h1"


def test_counter_from_config_restores_counts_and_uses_the_backend_ring():
    cfg = load_config()
    c = make_counter(cfg, 1920, 1080, base=(7, 3))
    assert (c.entry_count, c.exit_count) == (7, 3)
    backend = make_counter(cfg, 1000, 1000, ring=(SQUARE, False))
    assert backend.contains((500, 500)) and not backend.contains((100, 100))
