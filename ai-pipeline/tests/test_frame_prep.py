import sys
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from frame_prep import apply_mask, tile_rects  # noqa: E402

CAMERA = yaml.safe_load((Path(__file__).resolve().parents[1] / "config" / "config.yaml").read_text(encoding="utf-8-sig"))["camera"]


def test_config_tiles_cover_the_frame_with_overlap_wider_than_a_bird():
    (lx1, ly1, lx2, ly2), (rx1, ry1, rx2, ry2) = tile_rects(CAMERA["tiles"], 1920, 1080)
    assert (lx1, ly1, ly2, ry1, rx2, ry2) == (0, 0, 1080, 0, 1920, 1080)
    assert lx2 - rx1 >= 150                                  # circling birds are up to ~40 px
    assert 640 / max(lx2 - lx1, ly2 - ly1) * 25 >= 14.8     # a 25 px bird stays ~15 px at the model input


def test_mask_blacks_out_the_date_overlay_only():
    frame = np.full((1080, 1920, 3), 200, np.uint8)
    out = apply_mask(frame, CAMERA["mask"])
    assert out[39:58, 61:416].max() == 0                     # date text measured on the 21/10 frame
    assert out[100, 500].tolist() == [200, 200, 200]
    assert frame.min() == 200                                # input left untouched
