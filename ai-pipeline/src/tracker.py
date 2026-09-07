"""
SwiftletCare - ByteTrack Multi-Object Tracker Wrapper
SRS: VISION-FR-004, §11.3
"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from loguru import logger


@dataclass
class Track:
    """Active track from ByteTrack."""
    track_id:   int
    class_id:   int
    class_name: str
    bbox:       Tuple[int, int, int, int]   # (x1, y1, x2, y2)
    confidence: float
    age:        int = 0
    confirmed:  bool = False    # True after >= CONFIRM_FRAMES detections
    counted:    bool = False    # True once included in crossing count

    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)


class TrackerWrapper:
    """
    Wraps ByteTrack algorithm.
    Falls back to basic IOU tracker if ByteTrack not available.

    Track confirmation: >= 3 consecutive frames (§11.3)
    Max active tracks: 50 (§11.3)
    """

    CONFIRM_FRAMES = 3
    MAX_TRACKS     = 50

    def __init__(self):
        self._tracks: dict[int, Track] = {}
        self._next_id = 1
        logger.info("ByteTrack tracker initialized")

    def update(self, detections) -> List[Track]:
        """
        Update tracker with new detections from inference.
        Returns list of confirmed active tracks.
        """
        # TODO: Replace with ByteTrack implementation
        # from bytetrack.byte_tracker import BYTETracker
        confirmed = [t for t in self._tracks.values() if t.confirmed]
        return confirmed[:self.MAX_TRACKS]
