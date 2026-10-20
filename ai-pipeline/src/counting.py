"""SwiftletCare – đếm chim qua vạch ảo, xác định phiên và cắt khoảng 5 phút (VISION-FR-005/006/017)."""
from datetime import datetime
from typing import Dict, Optional, Sequence, Tuple

import supervision as sv

SESSION_TYPES = ("MORNING_EXIT", "EVENING_ENTRY")


class LineCounter:
    """Bọc sv.LineZone: vạch 2 điểm bất kỳ, ánh xạ chiều in/out sang ENTRY/EXIT."""

    def __init__(self, line: Sequence[float], width: int, height: int, in_is_entry: bool = True,
                 base_entry: int = 0, base_exit: int = 0):
        x1, y1, x2, y2 = line
        self.start = sv.Point(int(x1 * width), int(y1 * height))
        self.end = sv.Point(int(x2 * width), int(y2 * height))
        self._zone = sv.LineZone(start=self.start, end=self.end, triggering_anchors=[sv.Position.CENTER])
        self._in_is_entry = in_is_entry
        self._base = (base_entry, base_exit)  # số đã đếm trước khi pipeline khởi động lại

    def update(self, tracks: sv.Detections) -> None:
        if tracks.tracker_id is not None and len(tracks):
            self._zone.trigger(tracks)

    @property
    def entry_count(self) -> int:
        n = self._zone.in_count if self._in_is_entry else self._zone.out_count
        return self._base[0] + n

    @property
    def exit_count(self) -> int:
        n = self._zone.out_count if self._in_is_entry else self._zone.in_count
        return self._base[1] + n


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
