import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from inference import Detection, decode, merge_tiles  # noqa: E402

BIRD = {14: "swiftlet"}


def test_decodes_yolo26_end2end_rows_and_undoes_the_letterbox():
    out = np.zeros((300, 6), np.float32)
    out[0] = [100, 200, 140, 230, 0.9, 14]       # bird
    out[1] = [10, 10, 50, 50, 0.9, 0]            # person: not a configured class
    out[2] = [300, 300, 320, 320, 0.1, 14]       # below the threshold
    dets = decode(out, 0.3, 0.45, BIRD, scale=0.5, pad_x=20, pad_y=10)
    assert len(dets) == 1
    assert dets[0].class_name == "swiftlet" and dets[0].bbox == (160, 380, 240, 440)


def test_decodes_yolov8_columns_with_nms():
    out = np.zeros((84, 3), np.float32)          # 4 box rows + 80 class scores, 3 anchors
    out[:4, 0] = [120, 215, 40, 30]              # cx, cy, w, h
    out[:4, 1] = [121, 216, 40, 30]              # near-duplicate, removed by NMS
    out[:4, 2] = [400, 400, 20, 20]
    out[4 + 14, :] = [0.9, 0.8, 0.2]
    dets = decode(out, 0.3, 0.45, BIRD, scale=1.0, pad_x=0, pad_y=0)
    assert [d.bbox for d in dets] == [(100, 200, 140, 230)]


def test_merge_keeps_one_box_for_a_bird_in_the_tile_overlap():
    full = Detection(14, "swiftlet", 0.9, (1000, 500, 1040, 540))
    cut = Detection(14, "swiftlet", 0.6, (1020, 500, 1040, 540))     # same bird cut by the left tile's edge
    other = Detection(14, "swiftlet", 0.7, (1100, 500, 1140, 540))
    kept = merge_tiles([cut, full, other], max_overlap=0.6)
    assert [d.bbox for d in kept] == [full.bbox, other.bbox]
