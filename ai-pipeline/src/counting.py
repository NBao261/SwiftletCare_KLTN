"""Counts swiftlets crossing a closed ring around the entrance hole; fast tracks lost at the hole are extrapolated."""
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

Point = Tuple[float, float]
SESSION_TYPES = ("MORNING_EXIT", "EVENING_ENTRY")


@dataclass
class _Track:
    inside: bool
    first: Point
    last: Point
    prev: Optional[Point] = None
    last_frame: int = 0
    seen: int = 1
    ever_outside: bool = False


class RingCounter:
    """ring: frame-ratio points; into_ring_is_exit: going into the ring = EXIT; lost_frames = the tracker's lost_track_buffer."""

    def __init__(self, ring: Sequence[Sequence[float]], width: int, height: int,
                 into_ring_is_exit: bool = True, base_entry: int = 0, base_exit: int = 0, *,
                 lost_frames: int = 15, extrapolate_frames: int = 0, min_speed_px: float = 0.0):
        self.entry_count = base_entry
        self.exit_count = base_exit
        self.ambiguous = 0
        self._lost_frames = lost_frames
        self._extrapolate = extrapolate_frames
        self._min_speed = min_speed_px
        self._frame = 0
        # Kept until lost_frames have passed, so a track lost for a few frames still counts
        self._tracks: Dict[int, _Track] = {}
        self.set_ring(ring, width, height, into_ring_is_exit)

    def set_ring(self, ring: Sequence[Sequence[float]], width: int, height: int, into_ring_is_exit: bool) -> None:
        """Swap in a redrawn ring without losing the session's counts; track positions are forgotten."""
        if len(ring) < 3:
            raise ValueError("ring needs at least 3 points")
        self.polygon = np.array([(x * width, y * height) for x, y in ring], np.float32)
        self._into_ring_is_exit = into_ring_is_exit
        self._tracks.clear()

    def contains(self, point: Point) -> bool:
        return cv2.pointPolygonTest(self.polygon, (float(point[0]), float(point[1])), False) > 0

    def _count(self, into_ring: bool) -> Tuple[int, int]:
        """into_ring=True: the bird went into the ring. Returns (new_entries, new_exits)."""
        if into_ring == self._into_ring_is_exit:
            self.exit_count += 1
            return 0, 1
        self.entry_count += 1
        return 1, 0

    def _reaches_ring(self, start: Point, step: Point) -> bool:
        """Does start + step*k fall inside the ring for some k in 1..extrapolate_frames (fast tracks only)?"""
        if self._extrapolate <= 0 or np.hypot(*step) < self._min_speed:
            return False
        return any(self.contains((start[0] + step[0] * k, start[1] + step[1] * k))
                   for k in range(1, self._extrapolate + 1))

    def update(self, track_ids: Iterable[int], boxes: Iterable[Sequence[float]]) -> Tuple[int, int]:
        """One frame of tracks (ids, full-frame pixel boxes); call it every frame so lost tracks get finalised."""
        self._frame += 1
        entries = exits = 0
        for tid, (x1, y1, x2, y2) in zip(track_ids, boxes):
            c = ((x1 + x2) / 2, (y1 + y2) / 2)
            inside = self.contains(c)
            t = self._tracks.get(int(tid))
            if t is None:
                self._tracks[int(tid)] = _Track(inside, c, c, last_frame=self._frame, ever_outside=not inside)
                continue
            t.prev, t.last, t.last_frame, t.seen = t.last, c, self._frame, t.seen + 1
            if inside != t.inside:                  # crossed the ring, either way
                e, x = self._count(into_ring=inside)
            elif t.seen == 2 and not inside:        # came out of the hole in frames nobody detected
                back = (t.first[0] - c[0], t.first[1] - c[1])
                e, x = self._count(into_ring=False) if self._reaches_ring(t.first, back) else (0, 0)
            else:
                e = x = 0
            entries, exits = entries + e, exits + x
            t.inside = inside
            t.ever_outside = t.ever_outside or not inside

        for tid in [k for k, t in self._tracks.items() if self._frame - t.last_frame > self._lost_frames]:
            t = self._tracks.pop(tid)
            if t.inside:
                if not t.ever_outside:              # born and lost inside: in or out cannot be told
                    self.ambiguous += 1
            elif t.prev is not None:                # went into the hole in frames nobody detected
                step = (t.last[0] - t.prev[0], t.last[1] - t.prev[1])
                if self._reaches_ring(t.last, step):
                    e, x = self._count(into_ring=True)
                    entries, exits = entries + e, exits + x
        return entries, exits


Ring = Tuple[Sequence[Sequence[float]], bool]   # points as frame ratios, into_ring_is_exit


class MultiRingCounter:
    """One RingCounter per entrance hole on the same camera; their entries and exits add up."""

    def __init__(self, rings: Sequence[Ring], width: int, height: int, base_entry: int = 0, base_exit: int = 0,
                 **options: float):
        self._size, self._options = (width, height), options
        self._base = (base_entry, base_exit, 0)
        self.rings = self._make(rings)

    def _make(self, rings: Sequence[Ring]) -> List[RingCounter]:
        if not rings:
            raise ValueError("at least one ring is needed")
        return [RingCounter(points, *self._size, into_ring_is_exit, **self._options) for points, into_ring_is_exit in rings]

    def set_rings(self, rings: Sequence[Ring]) -> None:
        """Swap in redrawn rings without losing the counts made so far."""
        new = self._make(rings)
        self._base = (self.entry_count, self.exit_count, self.ambiguous)
        self.rings = new

    @property
    def entry_count(self) -> int:
        return self._base[0] + sum(r.entry_count for r in self.rings)

    @property
    def exit_count(self) -> int:
        return self._base[1] + sum(r.exit_count for r in self.rings)

    @property
    def ambiguous(self) -> int:
        return self._base[2] + sum(r.ambiguous for r in self.rings)

    @property
    def polygons(self) -> List[np.ndarray]:
        return [r.polygon for r in self.rings]

    def contains(self, point: Point) -> bool:
        return any(r.contains(point) for r in self.rings)

    def update(self, track_ids: Iterable[int], boxes: Iterable[Sequence[float]]) -> Tuple[int, int]:
        ids, boxes = list(track_ids), list(boxes)
        entries = exits = 0
        for ring in self.rings:
            e, x = ring.update(ids, boxes)
            entries, exits = entries + e, exits + x
        return entries, exits


def current_session(windows: Dict[str, Sequence[str]], now: datetime) -> Optional[str]:
    """Phiên đang diễn ra theo giờ của `now` ("HH:MM", đầu tính, cuối không tính)."""
    hhmm = now.strftime("%H:%M")
    for name, (start, end) in windows.items():
        if start <= hhmm < end:
            return name
    return None


class BucketClock:
    """Cắt số đếm cả ngày thành khoảng căn theo đồng hồ; mất hình thì khoảng dài hơn nhưng giữ mốc đầu."""

    def __init__(self, minutes: int, now: float, total: Tuple[int, int] = (0, 0)):
        self.length = minutes * 60
        self.start = now // self.length * self.length
        self._base = total

    def roll(self, now: float, total: Tuple[int, int]) -> Optional[Tuple[float, int, int]]:
        if now < self.start + self.length:
            return None
        done = (self.start, total[0] - self._base[0], total[1] - self._base[1])
        self.start, self._base = now // self.length * self.length, total
        return done
