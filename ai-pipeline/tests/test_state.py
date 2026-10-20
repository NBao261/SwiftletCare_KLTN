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
