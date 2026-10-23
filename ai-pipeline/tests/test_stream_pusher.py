import time

import numpy as np

from stream_pusher import StreamPusher, mask_url


def test_mask_url_hides_password():
    assert mask_url("Error opening output rtsp://pipeline:s3cret@host:8554/cam-x") == \
        "Error opening output rtsp://***@host:8554/cam-x"
    assert mask_url("rtsps://u:p@a.b:8322/x and rtsp://c:d@e/f") == "rtsps://***@a.b:8322/x and rtsp://***@e/f"
    assert mask_url("method ANNOUNCE failed: 401 (Unauthorized)") == "method ANNOUNCE failed: 401 (Unauthorized)"


def test_pusher_survives_missing_ffmpeg_and_never_blocks_update():
    p = StreamPusher("rtsp://pipeline:x@127.0.0.1:1/cam-x", 64, 36, 30, "100k")
    p._cmd = ["__no_such_ffmpeg__"]                 # Popen ném FileNotFoundError ở mỗi lần thử
    p.start()
    t0 = time.time()
    for _ in range(50):
        p.update(np.zeros((72, 128, 3), dtype=np.uint8))
    assert time.time() - t0 < 0.5                    # luồng đếm không bao giờ phải chờ việc đẩy video
    time.sleep(0.3)
    assert p.is_alive()                              # lỗi chỉ làm thử lại, không giết luồng đẩy
