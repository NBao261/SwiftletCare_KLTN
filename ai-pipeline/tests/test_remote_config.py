import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from counting import RingCounter  # noqa: E402
from remote_config import RingStore, parse_ring, roi_for_ring  # noqa: E402

RING = [[0.379, 0.228], [0.527, 0.136], [0.575, 0.277], [0.569, 0.374], [0.427, 0.477], [0.386, 0.334]]
SQUARE = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]


def msg(**ring):
    return {"deviceId": "cam_01", "counting_ring": {"points": RING, "into_ring_is_exit": True, **ring}}


def test_ring_for_this_camera_is_parsed():
    points, into_exit = parse_ring(msg(), "cam_01")
    assert points[0] == (0.379, 0.228) and len(points) == 6 and into_exit is True


def test_other_device_or_no_ring_is_ignored():
    assert parse_ring(msg(), "cam_02") is None
    assert parse_ring({"deviceId": "cam_01", "temp_min": 26}, "cam_01") is None
    assert parse_ring("not a dict", "cam_01") is None


@pytest.mark.parametrize("ring", [
    {"points": RING[:2]},
    {"points": RING * 3},
    {"points": [[0.1, 0.1], [1.2, 0.1], [0.5, 0.9]]},
    {"points": [[0.1], [0.2, 0.2], [0.5, 0.9]]},
    {"points": [[True, 0.1], [0.2, 0.2], [0.5, 0.9]]},
    {"into_ring_is_exit": "true"},
])
def test_malformed_ring_raises(ring):
    with pytest.raises(ValueError):
        parse_ring(msg(**ring), "cam_01")


def test_roi_wraps_the_ring_with_padding_and_stays_in_frame():
    # 21/10 ring on 1920x1080: x 728..1104 px, y 147..515 px
    assert roi_for_ring([tuple(p) for p in RING], 250, 1920, 1080) == (477, 0, 1354, 765)


def test_store_saves_the_ring_and_hands_it_to_the_loop_once(tmp_path):
    path = tmp_path / "state" / "counting_ring.json"
    store = RingStore(path, "cam_01")
    assert store.load() is None

    store.on_message(json.dumps(msg()).encode())
    assert store.take_update()[1] is True
    assert store.take_update() is None
    assert RingStore(path, "cam_01").load()[0][1] == (0.527, 0.136)   # survives a restart


def test_store_ignores_bad_messages_and_a_corrupt_file(tmp_path):
    path = tmp_path / "counting_ring.json"
    store = RingStore(path, "cam_01")
    store.on_message(b"{not json")
    store.on_message(json.dumps(msg(points=RING[:2])).encode())
    assert store.take_update() is None and not path.exists()

    path.write_text("{", encoding="utf-8")
    assert store.load() is None


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
