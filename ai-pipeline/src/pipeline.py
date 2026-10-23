"""
SwiftletCare - one frame through the pipeline: mask -> 2 tiles -> YOLO -> ByteTrack, and drawing

Shared by the live loop (src/stream.py) and tools/track_clip.py so a clip is
processed exactly like the camera stream. Counting stays with the caller: the live loop
feeds the same tracks to the session counter and to the all-day counter.

SRS: VISION-FR-004, VISION-FR-005, VISION-FR-014; plan §6.6, §19.8
"""
from typing import List, Optional, Tuple

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
    def __init__(self, cfg: dict, engine: InferenceEngine, width: int, height: int):
        cam, m, t = cfg["camera"], cfg["model"], cfg["tracking"]
        self.engine = engine
        self.mask = cam["mask"]
        self.tiles = tile_rects(cam["tiles"], width, height)
        self.tile_overlap = m["tile_merge_overlap"]
        self.box_pad = t["box_pad"]
        # Lives for the whole run (not rebuilt per session) so track ids never repeat: the counters
        # remember where each id stood.
        # ponytail: sv.ByteTrack is deprecated and removed in supervision 0.31 (pinned <0.31 in
        # requirements.txt); move to the `trackers` package before upgrading
        self.tracker = sv.ByteTrack(
            track_activation_threshold=m["confidence_threshold"],
            lost_track_buffer=t["lost_track_buffer"],
            minimum_matching_threshold=t["minimum_matching_threshold"],
            frame_rate=cam["fps"],
        )

    def track(self, frame: np.ndarray) -> Tuple[sv.Detections, float, int]:
        """Returns (tracks in full-frame pixels at real size, sum of detection confidences, detections)."""
        dets, _ = self.engine.infer_tiles(apply_mask(frame, self.mask), self.tiles, self.tile_overlap)
        det = to_sv(dets)
        if len(det):
            det.xyxy = scale_boxes(det.xyxy, self.box_pad)
        tracks = self.tracker.update_with_detections(det)
        if len(tracks):
            tracks.xyxy = scale_boxes(tracks.xyxy, 1 / self.box_pad)    # real size for counting and drawing
        return tracks, float(sum(d.confidence for d in dets)), len(dets)


def track_ids(tracks: sv.Detections):
    return tracks.tracker_id if tracks.tracker_id is not None else []


def draw(frame: np.ndarray, tracks: sv.Detections, counter: RingCounter, fps: float,
         session: Optional[str] = None) -> np.ndarray:
    """Green box + #id per bird, the counting ring and the counts; text at the bottom (the camera's clock is top-left)."""
    cv2.polylines(frame, [counter.polygon.astype(np.int32)], True, YELLOW, 2)
    for box, tid in zip(tracks.xyxy.astype(int), track_ids(tracks)):
        cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), GREEN, 2)
        cv2.putText(frame, f"#{tid}", (box[0], box[1] - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, GREEN, 1)
    text = (f"VAO {counter.entry_count}  RA {counter.exit_count}  ?{counter.ambiguous}  {fps:.0f} FPS"
            f"  {session or 'ngoai phien'}")
    org = (10, frame.shape[0] - 16)
    cv2.putText(frame, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 4)
    cv2.putText(frame, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    return frame
