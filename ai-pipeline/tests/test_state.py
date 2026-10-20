from counting import LineCounter
from stream import load_state, save_state


def test_state_restores_only_same_session_and_day(tmp_path):
    path = tmp_path / "state.json"
    save_state("EVENING_ENTRY", "2026-10-20", LineCounter([0, 0.5, 1, 0.5], 200, 200, base_entry=12, base_exit=4), path)
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (12, 4)
    assert load_state("MORNING_EXIT", "2026-10-20", path) == (0, 0)    # phiên khác
    assert load_state("EVENING_ENTRY", "2026-10-21", path) == (0, 0)   # ngày khác


def test_state_missing_or_broken_file(tmp_path):
    path = tmp_path / "state.json"
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)
    path.write_text("{not json", encoding="utf-8")
    assert load_state("EVENING_ENTRY", "2026-10-20", path) == (0, 0)


def test_topic_base_is_per_house_without_zone():
    from stream import topic_base
    # Backend SRS v2.1.8: nút AI publish theo nhà yến — swiftletcare/{farm}/{house}/heartbeat|vision/...
    assert topic_base({"FARM_ID": "f1", "HOUSE_ID": "h1", "ZONE_ID": "z1"}) == "swiftletcare/f1/h1"
