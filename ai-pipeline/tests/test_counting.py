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


# ── Luật ngoại suy (plan §19.8): chim qua lỗ 150–200 px/frame, frame trong vòng thường không được phát hiện ──
HOLE = [(0.4, 0.4), (0.6, 0.4), (0.6, 0.6), (0.4, 0.6)]   # 1000x1000 frame -> 400..600 px


def fast_counter(**kw):
    return RingCounter(HOLE, 1000, 1000, lost_frames=3, extrapolate_frames=2, min_speed_px=60, **kw)


def idle(counter, frames=5):
    for _ in range(frames):
        counter.update([], [])


def test_track_lost_just_outside_heading_into_the_hole_is_exit():
    c = fast_counter()
    run(c, [(100, 500), (250, 500), (370, 500)])           # 120 px/frame, next frame at 490 = inside
    assert (c.entry_count, c.exit_count) == (0, 0)          # not final until lost_frames pass
    idle(c)
    assert (c.entry_count, c.exit_count) == (0, 1)


def test_new_track_first_seen_just_outside_moving_away_from_the_hole_is_entry():
    c = fast_counter()
    run(c, [(650, 500), (780, 500)])                        # going back 130 px from 650 lands inside
    assert (c.entry_count, c.exit_count) == (1, 0)
    idle(c)
    assert (c.entry_count, c.exit_count) == (1, 0)


def test_track_lost_at_the_frame_edge_counts_nothing():
    c = fast_counter()
    run(c, [(820, 500), (920, 500), (990, 500)])            # far from the hole, flies off the frame
    idle(c)
    assert (c.entry_count, c.exit_count, c.ambiguous) == (0, 0, 0)


def test_slow_circling_bird_lost_near_the_ring_counts_nothing():
    c = fast_counter()
    run(c, [(300, 500), (330, 500), (360, 500)])            # 30 px/frame: circling, not diving
    idle(c)
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_track_born_and_lost_inside_is_ambiguous_not_counted():
    c = fast_counter()
    run(c, [(480, 500), (520, 500)])
    idle(c)
    assert (c.entry_count, c.exit_count, c.ambiguous) == (0, 0, 1)


def test_crossing_into_the_ring_then_lost_inside_counts_once():
    c = fast_counter()
    run(c, [(250, 500), (370, 500), (480, 500)])            # crossing counted when it happens
    idle(c)
    assert (c.entry_count, c.exit_count, c.ambiguous) == (0, 1, 0)


def test_short_gap_does_not_finalise_and_the_last_motion_decides():
    c = fast_counter()
    run(c, [(100, 500), (250, 500), (370, 500)])
    idle(c, 2)                                              # tracker lost it for 2 frames < lost_frames
    run(c, [(300, 300)])                                    # reacquired, now veering away from the hole
    idle(c)
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_extrapolation_is_off_unless_configured():
    c = RingCounter(HOLE, 1000, 1000, lost_frames=3)
    run(c, [(100, 500), (250, 500), (370, 500)])
    idle(c)
    assert (c.entry_count, c.exit_count) == (0, 0)


def test_new_ring_forgets_tracks():
    c = fast_counter()
    run(c, [(100, 500), (250, 500), (370, 500)])
    c.set_ring(HOLE, 1000, 1000, True)
    idle(c)
    assert (c.entry_count, c.exit_count) == (0, 0)
