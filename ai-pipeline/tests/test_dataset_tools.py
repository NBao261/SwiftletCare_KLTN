import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from extract_frames import draft_labels, keep_tracks, tile_labels  # noqa: E402
from split_by_day import day_of, split  # noqa: E402


def test_draft_labels_boxes_blobs_and_drops_noise():
    mask = np.zeros((100, 200), np.uint8)
    mask[40:60, 90:110] = 255                    # một con chim 20x20 px
    mask[5, 5] = 255                             # nhiễu 1 px, bị phép mở xóa
    lines = draft_labels(mask, min_area=30, max_area=20000)
    assert len(lines) == 1
    cls, cx, cy, w, h = lines[0].split()
    assert cls == "0" and abs(float(cx) - 0.5) < 0.02 and abs(float(cy) - 0.5) < 0.02


def test_draft_labels_respects_area_limits():
    mask = np.zeros((100, 100), np.uint8)
    mask[10:90, 10:90] = 255
    assert draft_labels(mask, min_area=30, max_area=1000) == []


def test_tile_labels_put_each_box_in_the_tile_holding_its_centre():
    left, right = (0, 0, 1040, 1080), (880, 0, 1920, 1080)
    bird = (1000.0, 520.0, 1040.0, 560.0)                # centre x 1020: inside both tiles
    edge = (1020.0, 100.0, 1080.0, 140.0)                # centre x 1050: right tile only, cut at the left tile's edge
    assert len(tile_labels([bird, edge], left)) == 1
    assert len(tile_labels([bird, edge], right)) == 2
    cls, cx, cy, w, h = tile_labels([bird], right)[0].split()
    assert cls == "0" and abs(float(cx) - 140 / 1040) < 1e-6 and abs(float(w) - 40 / 1040) < 1e-6


def test_keep_tracks_drops_short_and_still_tracks():
    history = {
        1: [(100, 100), (130, 100), (160, 110)],           # circling bird: 3 frames, moves 60 px
        2: [(500, 500), (501, 500), (500, 501)],           # flickering noise: does not move
        3: [(700, 700), (760, 700)],                       # only 2 frames
    }
    assert keep_tracks(history, min_frames=3, min_move=20) == {1}


def test_day_of_reads_roboflow_names():
    assert day_of("20261022_morning_01_000105_jpg.rf.abc123.jpg") == "20261022"
    with pytest.raises(ValueError):
        day_of("frame_0001.jpg")


def test_split_by_day_keeps_each_day_in_one_set(tmp_path):
    src = tmp_path / "export" / "train"
    (src / "images").mkdir(parents=True)
    (src / "labels").mkdir(parents=True)
    for day in ("20261022", "20261023", "20261024"):
        (src / "images" / f"{day}_morning_01_000100.jpg").write_bytes(b"x")
    (src / "labels" / "20261022_morning_01_000100.txt").write_text("0 0.5 0.5 0.1 0.1")
    dst = tmp_path / "final"
    assert split(tmp_path / "export", dst, val=["20261023"], test=["20261024"]) == {"train": 1, "val": 1, "test": 1}
    assert (dst / "labels" / "train" / "20261022_morning_01_000100.txt").read_text() == "0 0.5 0.5 0.1 0.1"
    assert (dst / "labels" / "test" / "20261024_morning_01_000100.txt").read_text() == ""   # ảnh âm
    assert "0: swiftlet" in (dst / "data.yaml").read_text()
