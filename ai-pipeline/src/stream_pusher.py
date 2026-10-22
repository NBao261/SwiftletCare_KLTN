"""SwiftletCare – đẩy frame đã vẽ khung lên MediaMTX (H.264 qua RTSP) bằng ffmpeg (VISION-FR-013/014, plan §15.6).

Chạy ở luồng riêng với tốc độ khung cố định: mạng chậm hay máy chủ video sập chỉ làm luồng này chờ,
việc đếm ở luồng chính không bị ảnh hưởng.
"""
import re
import subprocess
import threading
import time
from typing import IO, Optional

import cv2
import numpy as np
from loguru import logger

RETRY_MAX_SEC = 30


def mask_url(text: str) -> str:
    """URL đẩy video chứa mật khẩu dịch vụ: không bao giờ để nó lọt vào log."""
    return re.sub(r"(\w+://)[^/@\s]*@", r"\1***@", text)


class StreamPusher(threading.Thread):
    def __init__(self, url: str, width: int, height: int, fps: int, bitrate: str):
        super().__init__(daemon=True)
        self._size, self._fps = (width, height), fps
        self._frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
            "-an", "-c:v", "libx264", "-profile:v", "baseline",
            "-preset", "ultrafast", "-tune", "zerolatency",     # không B-frame: bắt buộc cho WebRTC
            "-pix_fmt", "yuv420p", "-g", str(fps * 2),
            "-b:v", bitrate, "-maxrate", bitrate, "-bufsize", bitrate,
            "-f", "rtsp", "-rtsp_transport", "tcp", url,
        ]

    def update(self, frame: np.ndarray) -> None:
        with self._lock:
            self._frame = frame

    @staticmethod
    def _drain(stream: IO[bytes]) -> None:
        """Đọc hết stderr của ffmpeg (để pipe không đầy làm ffmpeg đứng) và ghi log đã che mật khẩu."""
        for line in iter(stream.readline, b""):
            logger.warning(f"ffmpeg: {mask_url(line.decode(errors='replace').strip())}")

    def _start(self) -> subprocess.Popen:
        proc = subprocess.Popen(self._cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        threading.Thread(target=self._drain, args=(proc.stderr,), daemon=True).start()
        return proc

    def run(self) -> None:
        proc: Optional[subprocess.Popen] = None
        interval, delay = 1 / self._fps, 1
        while True:
            t0 = time.time()
            with self._lock:
                frame = self._frame
            if frame is not None:
                try:
                    if proc is None:
                        proc, started = self._start(), time.time()
                    proc.stdin.write(cv2.resize(frame, self._size).tobytes())
                    if time.time() - started > RETRY_MAX_SEC:
                        delay = 1                    # đã đẩy ổn định một lúc: lần rớt sau thử lại nhanh
                except OSError as err:               # ffmpeg thoát (bị từ chối 401, máy chủ video sập, mất mạng) hoặc không có ffmpeg
                    reason = "không tìm thấy ffmpeg" if isinstance(err, FileNotFoundError) else "ffmpeg đã dừng"
                    logger.warning(f"Không đẩy được video lên máy chủ video ({reason}), thử lại sau {delay} giây")
                    if proc is not None:
                        proc.kill()
                        proc.wait()
                    proc = None
                    time.sleep(delay)
                    delay = min(delay * 2, RETRY_MAX_SEC)
                    continue
            time.sleep(max(0.0, interval - (time.time() - t0)))
