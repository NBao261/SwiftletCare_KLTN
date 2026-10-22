"""
SwiftletCare - one frame through the pipeline: mask -> 2 tiles -> YOLO -> ByteTrack -> ring count -> draw

Shared by the live loop (src/stream.py) and tools/track_clip.py so a clip is
processed exactly like the camera stream.

SRS: VISION-FR-004, VISION-FR-005, VISION-FR-014; plan §6.6, §19.8
"""
from typing import List, Tuple

import cv2
import numpy as np
import supervision as sv

from counting import RingCounter
from frame_prep import apply_mask, tile_rects
from inference import Detection, InferenceEngine

GREEN = (0, 255, 0)
YELLOW = (0, 255, 255)


def scale_boxes(xyxy: np.ndarray, k: float) -> np.ndarray:
    """Grow/shrink boxes around their centre. A small fast bird's boxes in two frames do not overlap,
    and ByteTrack matches by IoU, so boxes are grown before tracking and shrunk back for drawing."""
    center = (xyxy[:, :2] + xyxy[:, 2:]) / 2
    half = (xyxy[:, 2:] - xyxy[:, :2]) / 2 * k
    return np.hstack([center - half, center + half]).astype(np.float32)


def to_sv(dets: List[Detection]) -> sv.Detections:
    if not dets:
        return sv.Detections.empty()
    return sv.Detections(
        xyxy=np.array([d.bbox for d in dets], dtype=np.float32),
        confidence=np.array([d.confidence for d in dets], dtype=np.float32),
        class_id=np.array([d.class_id for d in dets], dtype=int),
    )


class FramePipeline:
    def __init__(self, cfg: dict, engine: InferenceEngine, counter: RingCounter, width: int, height: int):
        cam, m, t = cfg["camera"], cfg["model"], cfg["tracking"]
        self.engine = engine
        self.counter = counter
        self.mask = cam["mask"]
        self.tiles = tile_rects(cam["tiles"], width, height)
        self.tile_overlap = m["tile_merge_overlap"]
        self.box_pad = t["box_pad"]
        # ponytail: sv.ByteTrack is deprecated and removed in supervision 0.31 (pinned <0.31 in
        # requirements.txt); move to the `trackers` package before upgrading
        self.tracker = sv.ByteTrack(
            track_activation_threshold=m["confidence_threshold"],
            lost_track_buffer=t["lost_track_buffer"],
            minimum_matching_threshold=t["minimum_matching_threshold"],
            frame_rate=cam["fps"],
        )
        self.fps = 0.0

    def process(self, frame: np.ndarray) -> Tuple[np.ndarray, sv.Detections]:
        """Returns (frame with green boxes, ring and counts drawn; tracks in full-frame pixels)."""
        dets, fps = self.engine.infer_tiles(apply_mask(frame, self.mask), self.tiles, self.tile_overlap)
        self.fps = 0.9 * self.fps + 0.1 * fps if self.fps else fps
        det = to_sv(dets)
        if len(det):
            det.xyxy = scale_boxes(det.xyxy, self.box_pad)
        tracks = self.tracker.update_with_detections(det)
        if len(tracks):
            tracks.xyxy = scale_boxes(tracks.xyxy, 1 / self.box_pad)    # real size for counting and drawing
        ids = tracks.tracker_id if tracks.tracker_id is not None else []
        self.counter.update(ids, tracks.xyxy)
        return self.draw(frame.copy(), tracks), tracks

    def draw(self, frame: np.ndarray, tracks: sv.Detections) -> np.ndarray:
        cv2.polylines(frame, [self.counter.polygon.astype(np.int32)], True, YELLOW, 2)     # counting ring
        ids = tracks.tracker_id if tracks.tracker_id is not None else []
        for box, tid in zip(tracks.xyxy.astype(int), ids):
            cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), GREEN, 2)            # green box per bird
            cv2.putText(frame, f"#{tid}", (box[0], box[1] - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, GREEN, 1)
        c = self.counter
        text = f"VAO {c.entry_count}  RA {c.exit_count}  ?{c.ambiguous}  {self.fps:.1f} FPS"
        cv2.putText(frame, text, (10, frame.shape[0] - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 4)
        cv2.putText(frame, text, (10, frame.shape[0] - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        return frame
