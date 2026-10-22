"""
SwiftletCare - Entrance ring counter
Counts swiftlets crossing a closed ring drawn around the entrance hole.

The camera looks at the hole from inside the house, so birds go through it
roughly towards the lens and can leave in any direction: a single straight
line would miss whoever flies off the other way. A ring catches every
direction; a bird that only flies past the hole crosses the ring in and out,
which cancels in the net count the backend computes (VISION-FR-009).

Birds are tracked over the whole frame while they circle (plan §19.8), but at
the hole they move 150-200 px per frame and show as a blur for 1-2 frames, so
the frame inside the ring is often never detected. Two rules cover that, both
only for fast tracks (circling birds move 20-35 px per frame):
- a track lost just outside the ring whose last velocity carries it into the
  ring went into the hole;
- a new track first seen just outside the ring whose first velocity, run
  backwards, comes from inside the ring came out of the hole.
A track born and lost inside the ring without ever leaving it cannot be told
apart (in or out) and is only counted in `ambiguous`. A track lost anywhere
else, e.g. at the frame edge, counts nothing.

SRS: VISION-FR-005; plan §3.3 items 6-7, §6.4, §19.8
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, Optional, Sequence, Tuple

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
    """
    ring: polygon points as frame ratios [(x, y), ...] (0.0–1.0), in order.
    into_ring_is_exit: True when the inside of the ring is the hole leading
    outdoors (camera inside the house): going into the ring = EXIT.
    base_entry/base_exit: counts already made in this session before a restart.
    lost_frames: frames without a sighting before a track is final (= the tracker's lost_track_buffer).
    extrapolate_frames: how many frames of motion to extrapolate at a track's ends; 0 turns it off.
    min_speed_px: extrapolate only tracks at least this fast (px per frame).
    """

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
        # kept until lost_frames have passed, so a track the tracker loses for a few frames
        # still counts if it crossed meanwhile
        self._tracks: Dict[int, _Track] = {}
        self.set_ring(ring, width, height, into_ring_is_exit)

    def set_ring(self, ring: Sequence[Sequence[float]], width: int, height: int, into_ring_is_exit: bool) -> None:
        """
        Swap in a new ring (the Domain Expert redrew it, VISION-FR-018) without losing the session's
        counts. Where each track stood is forgotten: a bird sitting between the old and the new ring
        would otherwise count as a crossing it never made.
        """
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
        """
        One frame of tracks: ids and (x1, y1, x2, y2) boxes in full-frame pixels. Call it for every
        frame, also with no tracks, so lost tracks get finalised. Returns (new_entries, new_exits).
        """
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


def current_session(windows: Dict[str, Sequence[str]], now: datetime) -> Optional[str]:
    """Phiên đang diễn ra theo giờ của `now` ("HH:MM", đầu tính, cuối không tính)."""
    hhmm = now.strftime("%H:%M")
    for name, (start, end) in windows.items():
        if start <= hhmm < end:
            return name
    return None


class BucketClock:
    """VISION-FR-017 — cắt số đếm cả ngày thành từng khoảng, căn theo đồng hồ (…:00, …:05).

    Nhận tổng cộng dồn của bộ đếm cả ngày; trả số của khoảng vừa hết. Mất hình giữa chừng thì
    khoảng đó dài hơn bình thường nhưng vẫn mang mốc đầu của nó, số trong lúc mất hình là 0.
    """

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
