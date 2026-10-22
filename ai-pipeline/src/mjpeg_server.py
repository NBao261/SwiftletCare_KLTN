"""SwiftletCare – phát frame dưới dạng MJPEG để hiệu chỉnh ROI và vạch đếm (VISION-FR-013/014, chỉ dùng khi dev).

GET /stream           → có ô xanh, ROI, vạch đếm
GET /stream?boxes=0   → hình gốc
"""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

import cv2
import numpy as np


class MjpegServer:
    def __init__(self, host: str, port: int, quality: int = 70):
        self._jpeg = {}                      # "1": có box, "0": hình gốc
        self._viewers = {"1": 0, "0": 0}
        self._cond = threading.Condition()
        self._params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                if not self.path.startswith("/stream"):
                    self.send_error(404)
                    return
                key = "0" if "boxes=0" in self.path else "1"
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with outer._cond:
                    outer._viewers[key] += 1
                try:
                    while True:
                        with outer._cond:
                            outer._cond.wait(timeout=5)
                            jpg = outer._jpeg.get(key)
                        if jpg is None:
                            continue
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n"
                                         b"Content-Length: %d\r\n\r\n" % len(jpg))
                        self.wfile.write(jpg + b"\r\n")
                except ConnectionError:      # người xem đóng tab
                    pass
                finally:
                    with outer._cond:
                        outer._viewers[key] -= 1

            def log_message(self, *args) -> None:   # không ghi log mỗi request
                pass

        self._httpd = ThreadingHTTPServer((host, port), Handler)
        self._httpd.daemon_threads = True
        threading.Thread(target=self._httpd.serve_forever, daemon=True).start()

    @property
    def watching_boxes(self) -> bool:
        return self._viewers["1"] > 0

    def publish(self, annotated: Optional[np.ndarray], raw: np.ndarray) -> None:
        """Chỉ nén bản đang có người xem: nén JPEG 1080p tốn vài ms mỗi bản."""
        out = {}
        for key, img in (("1", annotated), ("0", raw)):
            if self._viewers[key] and img is not None:
                ok, buf = cv2.imencode(".jpg", img, self._params)
                if ok:
                    out[key] = buf.tobytes()
        if out:
            with self._cond:
                self._jpeg.update(out)
                self._cond.notify_all()
