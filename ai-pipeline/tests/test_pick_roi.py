import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from pick_roi import offset_polygon  # noqa: E402


def test_offset_square_moves_every_corner_out_by_margin():
    ring = offset_polygon([(10, 10), (20, 10), (20, 20), (10, 20)], 5)
    assert [(round(x), round(y)) for x, y in ring] == [(5, 5), (25, 5), (25, 25), (5, 25)]


def test_offset_does_not_depend_on_click_direction():
    cw = offset_polygon([(10, 10), (20, 10), (20, 20), (10, 20)], 5)
    ccw = offset_polygon([(10, 20), (20, 20), (20, 10), (10, 10)], 5)
    assert sorted((round(x), round(y)) for x, y in cw) == sorted((round(x), round(y)) for x, y in ccw)
