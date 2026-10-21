import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from extract_frames import draft_labels, roi_pixels  # noqa: E402
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


def test_roi_pixels_matches_config_ratios():
    assert roi_pixels([0.25, 0.0, 0.75, 0.70], 1920, 1080) == (480, 0, 1440, 756)


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
