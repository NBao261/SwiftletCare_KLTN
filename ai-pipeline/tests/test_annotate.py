"""
TC-F11-01 (VISION-FR-014): every frame sent to the viewers shows the counting ring, and every tracked
bird has a green box with its track id. draw() is the one function that annotates both the live
stream (src/stream.py) and recorded clips (tools/track_clip.py). No model or camera is needed: a fake
engine returns detections and the real ByteTrack gives the ids.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np  # noqa: E402
import supervision as sv  # noqa: E402
import yaml  # noqa: E402

from counting import RingCounter  # noqa: E402
from inference import Detection  # noqa: E402
from pipeline import GREEN, LABEL_HEIGHT, YELLOW, FramePipeline, draw, label_origin  # noqa: E402

CONFIG = yaml.safe_load((Path(__file__).resolve().parents[1] / "config" / "config.yaml").read_text(encoding="utf-8-sig"))
W, H = 640, 360
WHITE = (255, 255, 255)


def blank() -> np.ndarray:
    return np.zeros((H, W, 3), np.uint8)


def counter() -> RingCounter:
    return RingCounter(CONFIG["tracking"]["ring"], W, H)


def has_color(img: np.ndarray, color, x1: int, y1: int, x2: int, y2: int) -> bool:
    """Any pixel of `color` inside the rectangle (clipped to the frame)."""
    region = img[max(y1, 0):min(y2, img.shape[0]), max(x1, 0):min(x2, img.shape[1])]
    return bool(np.all(region == np.array(color, np.uint8), axis=-1).any())


def tracks(boxes, ids) -> sv.Detections:
    return sv.Detections(xyxy=np.array(boxes, np.float32), tracker_id=np.array(ids, int))


def assert_ring(img: np.ndarray, ring: RingCounter) -> None:
    pts = ring.polygon.astype(int)
    for a, b in zip(pts, np.roll(pts, -1, axis=0)):
        mx, my = (a + b) // 2
        assert has_color(img, YELLOW, mx - 2, my - 2, mx + 3, my + 3), f"ring edge {a}-{b} not drawn"


def assert_box_and_label(img: np.ndarray, box) -> None:
    x1, y1, x2, y2 = (int(v) for v in box)
    mid_y = (y1 + y2) // 2
    assert has_color(img, GREEN, x1 - 1, mid_y - 1, x1 + 2, mid_y + 2), f"left edge of {box} not drawn"
    lx, ly = label_origin((x1, y1, x2, y2), img.shape)
    assert 0 <= ly < img.shape[0], "the id label is outside the frame"
    # the text sits above its baseline; the box border is outside this strip
    assert has_color(img, GREEN, lx, ly - LABEL_HEIGHT + 2, lx + 30, ly + 1), f"no #id label for {box}"


def test_draw_shows_the_ring_each_box_with_its_id_and_the_counts():
    ring = counter()
    boxes = [(100, 200, 120, 220), (400, 150, 425, 172)]
    img = draw(blank(), tracks(boxes, [3, 7]), ring, fps=24.6, session="EVENING_ENTRY")
    assert_ring(img, ring)
    for box in boxes:
        assert_box_and_label(img, box)
    assert has_color(img, WHITE, 10, H - 40, 600, H - 5), "counts line not drawn"


def test_frame_without_birds_still_shows_the_ring_and_the_counts():
    ring = counter()
    img = draw(blank(), sv.Detections.empty(), ring, fps=25, session=None)
    assert_ring(img, ring)
    assert has_color(img, WHITE, 10, H - 40, 600, H - 5)
    assert not has_color(img, GREEN, 0, 0, W, H), "no bird, so no box"


def test_bird_at_the_top_edge_keeps_its_id_inside_the_frame():
    box = (300, 2, 318, 20)
    assert label_origin(box, (H, W, 3)) == (300, 20 + LABEL_HEIGHT + 2)   # below the box
    assert label_origin((300, 100, 318, 118), (H, W, 3)) == (300, 96)     # above when there is room
    img = draw(blank(), tracks([box], [12]), counter(), fps=25)
    assert_box_and_label(img, box)


def test_label_stays_inside_a_frame_edge():
    assert label_origin((-5, 200, 10, 215), (H, W, 3))[0] == 0
    assert label_origin((620, H - 15, 639, H - 1), (H, W, 3))[1] <= H - 1


class FakeEngine:
    """Stands in for the ONNX model: one detection per bird per frame, moving a few px each frame."""

    def __init__(self, paths):
        self.paths = paths
        self.frame = 0

    def infer_tiles(self, frame, tiles, max_overlap):
        dets = []
        for path in self.paths:
            if self.frame < len(path):
                x, y = path[self.frame]
                dets.append(Detection(class_id=14, class_name="swiftlet", confidence=0.9, bbox=(x, y, x + 16, y + 16)))
        self.frame += 1
        return dets, 25.0


def test_every_published_frame_has_the_ring_and_a_box_with_id_per_tracked_bird():
    bird_a = [(60 + 6 * i, 250 - 3 * i) for i in range(20)]
    bird_b = [(500 - 5 * i, 60 + 4 * i) for i in range(5, 20)]   # appears later
    pipeline = FramePipeline(CONFIG, FakeEngine([bird_a, bird_b]), W, H)
    ring = counter()
    frames_with_birds = 0
    ids = set()
    for _ in range(20):
        frame = blank()
        tracked, _, _ = pipeline.track(frame)
        img = draw(frame.copy(), tracked, ring, fps=25)
        assert_ring(img, ring)
        for box, tid in zip(tracked.xyxy, tracked.tracker_id if tracked.tracker_id is not None else []):
            assert_box_and_label(img, box)
            ids.add(int(tid))
        frames_with_birds += len(tracked) > 0
    assert frames_with_birds >= 18, "the tracker should follow the birds on almost every frame"
    assert len(ids) == 2, f"two birds, two ids: {ids}"
