"""
SwiftletCare - Virtual Line Crossing Counter
Bidirectional counting for swiftlet entry/exit

SRS: VISION-FR-005, VISION-FR-006, VISION-FR-008, VISION-FR-009
"""
from dataclasses import dataclass, field
from typing import Dict, Tuple
from enum import Enum
from loguru import logger


class Direction(Enum):
    ENTRY = "ENTRY"   # Bird coming IN (evening)
    EXIT  = "EXIT"    # Bird going OUT (morning)


@dataclass
class CountingSession:
    session_type: str       # MORNING_EXIT | EVENING_ENTRY
    entry_count:  int = 0
    exit_count:   int = 0
    counted_ids:  set = field(default_factory=set)

    @property
    def return_rate(self) -> float:
        if self.exit_count == 0:
            return 0.0
        return round(self.entry_count / self.exit_count * 100, 2)


class BirdCounter:
    """
    Virtual line crossing counter.
    Tracks center-of-mass movement across a horizontal line.

    line_y_ratio: position of counting line as fraction of frame height (0.0–1.0)
    SRS: VISION-FR-005
    """

    def __init__(self, frame_height: int, line_y_ratio: float = 0.5):
        self.line_y     = int(frame_height * line_y_ratio)
        self._prev_pos: Dict[int, Tuple[float, float]] = {}   # track_id -> (cx, cy)
        self.session: CountingSession = CountingSession("MORNING_EXIT")

    def start_session(self, session_type: str):
        """Begin a new counting session (morning/evening)."""
        self.session = CountingSession(session_type)
        self._prev_pos.clear()
        logger.info(f"Counting session started: {session_type}")

    def end_session(self) -> CountingSession:
        """End current session and return results."""
        logger.info(
            f"Session ended: type={self.session.session_type} "
            f"entry={self.session.entry_count} exit={self.session.exit_count} "
            f"return_rate={self.session.return_rate}%"
        )
        return self.session

    def update(self, tracks) -> Tuple[int, int]:
        """
        Process tracks from current frame.
        Returns (new_entries, new_exits) this frame.
        """
        new_entries = 0
        new_exits   = 0

        for track in tracks:
            if track.class_name != "swiftlet":
                continue

            cx, cy = track.center()
            track_id = track.track_id

            if track_id in self._prev_pos:
                prev_cy = self._prev_pos[track_id][1]

                if track_id not in self.session.counted_ids:
                    # Bird crossed the line (VISION-FR-005)
                    if prev_cy < self.line_y <= cy:
                        # Moved downward → EXIT
                        self.session.exit_count += 1
                        self.session.counted_ids.add(track_id)
                        new_exits += 1
                    elif prev_cy > self.line_y >= cy:
                        # Moved upward → ENTRY
                        self.session.entry_count += 1
                        self.session.counted_ids.add(track_id)
                        new_entries += 1

            self._prev_pos[track_id] = (cx, cy)

        return new_entries, new_exits
