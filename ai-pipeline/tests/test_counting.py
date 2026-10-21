import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from counting import RingCounter  # noqa: E402

SQUARE = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]   # 100x100 frame -> 25..75 px


def box(cx, cy, half=3):
    return (cx - half, cy - half, cx + half, cy + half)


def run(counter, path, tid=1):
    for cx, cy in path:
        counter.update([tid], [box(cx, cy)])


def test_bird_coming_out_of_the_hole_is_entry():
    c = RingCounter(SQUARE, 100, 100)
    run(c, [(50, 50), (60, 60), (90, 95)])
    assert (c.entry_count, c.exit_count) == (1, 0)


def test_bird_going_into_the_hole_is_exit():
    c = RingCounter(SQUARE, 100, 100)
    run(c, [(5, 50), (20, 50), (40, 50)])
    assert (c.entry_count, c.exit_count) == (0, 1)


def test_fly_past_counts_both_ways_so_net_is_zero():
    c = RingCounter(SQUARE, 100, 100)
    run(c, [(5, 50), (50, 50), (95, 50)])
    assert (c.entry_count, c.exit_count) == (1, 1)


def test_first_sighting_is_not_a_crossing():
    c = RingCounter(SQUARE, 100, 100)
    run(c, [(90, 90), (95, 95)])
    run(c, [(50, 50)], tid=2)
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_direction_flips_when_ring_is_not_the_outdoor_side():
    c = RingCounter(SQUARE, 100, 100, into_ring_is_exit=False)
    run(c, [(5, 50), (40, 50)])
    assert (c.entry_count, c.exit_count) == (1, 0)


def test_tracks_are_independent_and_start_from_restored_counts():
    c = RingCounter(SQUARE, 100, 100, base_entry=3, base_exit=2)
    c.update([1, 2], [box(50, 50), box(5, 5)])
    c.update([1, 2], [box(95, 50), box(50, 50)])
    assert (c.entry_count, c.exit_count) == (4, 3)


def test_crossing_while_the_tracker_lost_the_bird_still_counts():
    c = RingCounter(SQUARE, 100, 100)
    c.update([1], [box(50, 50)])
    c.update([], [])                            # missed for a couple of frames
    c.update([], [])
    c.update([1], [box(95, 95)])
    assert (c.entry_count, c.exit_count) == (1, 0)
