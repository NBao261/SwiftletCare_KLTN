"""
SwiftletCare - frame preparation shared by the live pipeline and the dataset tools

The model must see exactly the same pixels in training and in production, so
masking the camera's date overlay and cutting the frame into tiles live here
once, used by src/stream.py, tools/extract_frames.py and tools/track_clip.py.

Plan §19.8: birds circle the whole room, so the whole frame is tracked; it is cut
into two overlapping tiles so a bird keeps >= 15 px after the 640 px model input.
"""
from typing import List, Sequence, Tuple

import numpy as np

Rect = Tuple[int, int, int, int]   # x1, y1, x2, y2 in pixels


def to_pixels(rect: Sequence[float], width: int, height: int) -> Rect:
    """[x1, y1, x2, y2] as frame ratios -> pixels."""
    x1, y1, x2, y2 = rect
    return int(x1 * width), int(y1 * height), int(x2 * width), int(y2 * height)


def tile_rects(tiles: Sequence[Sequence[float]], width: int, height: int) -> List[Rect]:
    return [to_pixels(t, width, height) for t in tiles]


def apply_mask(frame: np.ndarray, rects: Sequence[Sequence[float]]) -> np.ndarray:
    """Copy of the frame with each rect (frame ratios) painted black, e.g. the camera's date overlay."""
    out = frame.copy()
    h, w = frame.shape[:2]
    for rect in rects:
        x1, y1, x2, y2 = to_pixels(rect, w, h)
        out[y1:y2, x1:x2] = 0
    return out
