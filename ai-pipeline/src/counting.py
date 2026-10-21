"""
SwiftletCare - Entrance ring counter
Counts swiftlets crossing a closed ring drawn around the entrance hole.

The camera looks at the hole from inside the house, so birds go through it
roughly towards the lens and can leave in any direction: a single straight
line would miss whoever flies off the other way. A ring catches every
direction; a bird that only flies past the hole crosses the ring in and out,
which cancels in the net count the backend computes (VISION-FR-009).

SRS: VISION-FR-005; plan §3.3 item 6, §6.4
"""
from typing import Dict, Iterable, Sequence, Tuple

import cv2
import numpy as np


class RingCounter:
    """
    ring: polygon points as frame ratios [(x, y), ...] (0.0–1.0), in order.
    into_ring_is_exit: True when the inside of the ring is the hole leading
    outdoors (camera inside the house): going into the ring = EXIT.
    base_entry/base_exit: counts already made in this session before a restart.
    """

    def __init__(self, ring: Sequence[Sequence[float]], width: int, height: int,
                 into_ring_is_exit: bool = True, base_entry: int = 0, base_exit: int = 0):
        if len(ring) < 3:
            raise ValueError("ring needs at least 3 points")
        self.polygon = np.array([(x * width, y * height) for x, y in ring], np.float32)
        self._into_ring_is_exit = into_ring_is_exit
        # track_id -> inside the ring when last seen; kept for the whole session so a track
        # the tracker loses for a few frames still counts if it crossed meanwhile
        self._inside: Dict[int, bool] = {}
        self.entry_count = base_entry
        self.exit_count = base_exit

    def contains(self, point: Tuple[float, float]) -> bool:
        return cv2.pointPolygonTest(self.polygon, (float(point[0]), float(point[1])), False) > 0

    def update(self, track_ids: Iterable[int], boxes: Iterable[Sequence[float]]) -> Tuple[int, int]:
        """
        One frame of tracks: ids and (x1, y1, x2, y2) boxes in full-frame pixels.
        Every crossing counts, both ways. Returns (new_entries, new_exits).
        """
        new_entries = new_exits = 0
        for tid, (x1, y1, x2, y2) in zip(track_ids, boxes):
            inside = self.contains(((x1 + x2) / 2, (y1 + y2) / 2))
            was_inside = self._inside.get(int(tid))
            self._inside[int(tid)] = inside
            if was_inside is None or was_inside == inside:
                continue
            if inside == self._into_ring_is_exit:   # into the ring and that is EXIT, or out of it and that is ENTRY
                self.exit_count += 1
                new_exits += 1
            else:
                self.entry_count += 1
                new_entries += 1
        return new_entries, new_exits
