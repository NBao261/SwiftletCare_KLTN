"""SwiftletCare – pipeline đếm chim.
RTSP/file → tô đen + 2 ô → YOLO (ONNX) → ByteTrack → vòng đếm quanh miệng lỗ → MJPEG + MediaMTX + MQTT

Chạy trong thư mục ai-pipeline:
  python src/stream.py                                                    # nguồn: CAMERA_RTSP_URL trong .env
  python src/stream.py --source D:/SwiftletCare/clips/x.mp4 --session EVENING_ENTRY --no-mqtt
  python src/stream.py --source D:/SwiftletCare/clips/x.mp4 --session EVENING_ENTRY --realtime   # camera demo (plan 15.8)
Xem: http://127.0.0.1:8090/stream
SRS: VISION-FR-001..006, 012..014, 017, 018
"""
import argparse
import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator, Optional, Sequence, Tuple

import cv2
import numpy as np
import paho.mqtt.client as mqtt
import yaml
from dotenv import load_dotenv
from loguru import logger

from counting import SESSION_TYPES, BucketClock, RingCounter, current_session
from inference import InferenceEngine
from mjpeg_server import MjpegServer
from pipeline import FramePipeline, draw, track_ids
from remote_config import RingStore, start_listener
from stream_pusher import StreamPusher

CONFIG = Path(__file__).resolve().parents[1] / "config" / "config.yaml"
STATE_FILE = Path("state.json")
RECONNECT_MAX_SEC = 30
STALL_TIMEOUT_MS = 10_000   # luồng đứng hình quá lâu thì nối lại (mặc định của OpenCV là 30 giây)

Ring = Tuple[Sequence[Sequence[float]], bool]


def load_config(path: Path = CONFIG) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8-sig"))


def make_engine(cfg: dict, model_path: Optional[str] = None) -> InferenceEngine:
    m = cfg["model"]
    return InferenceEngine(model_path or m["path"], m["input_size"], m["confidence_threshold"],
                           m["nms_iou_threshold"], m["classes"], m["providers"])


def make_counter(cfg: dict, width: int, height: int, ring: Optional[Ring] = None,
                 base: Tuple[int, int] = (0, 0)) -> RingCounter:
    """ring = (points, into_ring_is_exit) từ backend (VISION-FR-018); None = vòng trong config.yaml."""
    t = cfg["tracking"]
    points, into_ring_is_exit = ring or (t["ring"], t["into_ring_is_exit"])
    return RingCounter(points, width, height, into_ring_is_exit, *base, lost_frames=t["lost_track_buffer"],
                       extrapolate_frames=t["extrapolate_frames"], min_speed_px=t["extrapolate_min_speed_px"])


# ── Nguồn hình ───────────────────────────────────────────────────────────────
class FrameGrabber(threading.Thread):
    """Đọc RTSP liên tục, chỉ giữ frame mới nhất để hình không trễ dần."""

    def __init__(self, source: str):
        super().__init__(daemon=True)
        self.source, self.frame, self.seq = source, None, 0
        self.lock = threading.Lock()

    def run(self) -> None:
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        delay = 1
        while True:
            cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG, [
                cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, STALL_TIMEOUT_MS, cv2.CAP_PROP_READ_TIMEOUT_MSEC, STALL_TIMEOUT_MS])
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                delay = 1
                with self.lock:
                    self.frame, self.seq = frame, self.seq + 1
            cap.release()
            logger.warning(f"Mất luồng camera, kết nối lại sau {delay} giây")
            time.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX_SEC)


def frames(source: str, live: bool, realtime: bool = False) -> Iterator[np.ndarray]:
    """Live: luôn trả frame mới nhất. File: trả đủ từng frame (để đo độ chính xác)."""
    if not live:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise SystemExit(f"Không mở được {source}")
        interval, next_t = 1 / (cap.get(cv2.CAP_PROP_FPS) or 25), time.time()
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            yield frame
            if realtime:
                next_t += interval
                time.sleep(max(0.0, next_t - time.time()))
    grabber = FrameGrabber(source)
    grabber.start()
    last = 0
    while True:
        with grabber.lock:
            frame, seq = grabber.frame, grabber.seq
        if frame is None or seq == last:
            time.sleep(0.002)
            continue
        last = seq
        yield frame


# ── Số đếm của phiên qua lần khởi động lại ───────────────────────────────────
def load_state(session: str, today: str, path: Path = STATE_FILE) -> Tuple[int, int]:
    """Số đã đếm của đúng phiên + ngày, để khởi động lại giữa phiên không mất số."""
    try:
        s = json.loads(path.read_text(encoding="utf-8"))
        if s["session"] == session and s["date"] == today:
            return int(s["entry"]), int(s["exit"])
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return 0, 0


def save_state(session: str, today: str, counter: RingCounter, path: Path = STATE_FILE) -> None:
    path.write_text(json.dumps({"session": session, "date": today,
                                "entry": counter.entry_count, "exit": counter.exit_count}), encoding="utf-8")


# ── MQTT ─────────────────────────────────────────────────────────────────────
def topic_base(env) -> str:
    """SRS v2.1.8 — camera ở cửa ra vào của cả nhà yến nên topic theo House, không có đoạn zone:
    swiftletcare/{farmId}/{houseId}/heartbeat | vision/bird-count | vision/alert (khớp backend mqtt.client.ts)."""
    return f"swiftletcare/{env['FARM_ID']}/{env['HOUSE_ID']}"


class Publisher:
    """Payload theo BirdCountPayload của backend (backend/src/types/domain.types.ts)."""

    def __init__(self, cfg: dict, model_version: str):
        self.device_id = os.environ["CAMERA_DEVICE_ID"]
        self.model_version = model_version
        base = topic_base(os.environ)
        self.topic_count = f"{base}/vision/bird-count"
        self.topic_heartbeat = f"{base}/heartbeat"
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=self.device_id)
        if cfg.get("tls"):                       # cloud: chứng chỉ Let's Encrypt, dùng CA có sẵn của hệ điều hành
            self.client.tls_set()
        if os.getenv("MQTT_USERNAME"):
            self.client.username_pw_set(os.environ["MQTT_USERNAME"], os.getenv("MQTT_PASSWORD"))
        self.client.on_connect = lambda *a: logger.info(f"MQTT đã nối {cfg['broker']}:{cfg['port']}")
        self.client.on_disconnect = lambda *a: logger.warning("MQTT mất kết nối, tự nối lại")
        self.client.connect_async(cfg["broker"], cfg["port"])   # tự kết nối lại khi rớt
        self.client.loop_start()

    def bird_count(self, session: str, counter: RingCounter, conf_avg: float, final: bool = False) -> None:
        self.client.publish(self.topic_count, json.dumps({
            "deviceId": self.device_id,
            "session_type": session,
            "entry_count": counter.entry_count,
            "exit_count": counter.exit_count,
            "confidence_avg": round(conf_avg, 3),
            "final": final,                      # true = phiên vừa kết thúc
            "timestamp": int(time.time() * 1000),
        }), qos=1)

    def bucket(self, start_ts: float, minutes: int, entry: int, exit_: int) -> None:
        """VISION-FR-017 — số chim qua vòng đếm trong một khoảng thời gian, gửi cả ngoài phiên."""
        self.client.publish(self.topic_count, json.dumps({
            "deviceId": self.device_id, "kind": "BUCKET",
            "bucket_start": int(start_ts * 1000), "bucket_minutes": minutes,
            "entry_count": entry, "exit_count": exit_,
            "timestamp": int(time.time() * 1000),
        }), qos=1)

    def heartbeat(self) -> None:
        self.client.publish(self.topic_heartbeat, json.dumps({
            "deviceId": self.device_id, "firmwareVersion": self.model_version,
        }), qos=0)


# ── Vòng lặp chính ───────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(CONFIG))
    ap.add_argument("--source", help="ghi đè nguồn hình (file hoặc rtsp://)")
    ap.add_argument("--session", choices=SESSION_TYPES, help="ép phiên khi chạy trên clip")
    ap.add_argument("--realtime", action="store_true", help="phát file đúng tốc độ thật (camera demo)")
    ap.add_argument("--no-mqtt", action="store_true")
    args = ap.parse_args()

    load_dotenv()
    cfg = load_config(Path(args.config))
    logger.add(cfg["logging"]["file"], rotation=cfg["logging"]["rotation"])

    source = args.source or os.getenv("CAMERA_RTSP_URL") or cfg["camera"]["source"]
    live = str(source).startswith(("rtsp://", "rtsps://", "http://", "https://"))
    m, s = cfg["model"], cfg["sessions"]
    tz = timezone(timedelta(hours=s["utc_offset_hours"]))

    engine = make_engine(cfg)
    server = MjpegServer(cfg["stream"]["host"], cfg["stream"]["port"], cfg["stream"]["jpeg_quality"])
    pub = None if args.no_mqtt else Publisher(cfg["mqtt"], m["version"])
    pusher = None
    if os.getenv("STREAM_PUSH_URL"):                          # có máy chủ video (MediaMTX): đẩy hình đã vẽ khung
        p = cfg["push"]
        pusher = StreamPusher(os.environ["STREAM_PUSH_URL"], p["width"], p["height"], p["fps"], p["bitrate"])
        pusher.start()
    logger.info(f"Nguồn: {'camera RTSP' if live else source} | xem http://{cfg['stream']['host']}:{cfg['stream']['port']}/stream"
                f" | đẩy lên máy chủ video: {'có' if pusher else 'không'}")

    # VISION-FR-018: vòng Domain Expert vẽ trên web thắng vòng trong config.yaml và đổi được khi đang chạy
    device_id = os.environ.get("CAMERA_DEVICE_ID", "")
    rings = RingStore(Path(cfg["tracking"]["ring_override_file"]), device_id)
    ring: Optional[Ring] = rings.load()
    if not args.no_mqtt and device_id and os.environ.get("FARM_ID") and os.environ.get("HOUSE_ID"):
        start_listener(cfg["mqtt"], rings, os.environ["FARM_ID"], os.environ["HOUSE_ID"], device_id)

    pipe: Optional[FramePipeline] = None
    session: Optional[str] = None
    counter: Optional[RingCounter] = None
    day_counter: Optional[RingCounter] = None  # đếm liên tục, làm nguồn cho số đếm 5 phút
    buckets = BucketClock(cfg["mqtt"]["bucket_minutes"], time.time())
    started = False
    conf_sum, conf_n = 0.0, 0
    last_pub, last_log = 0.0, time.time()      # last_pub = 0: heartbeat ngay ở frame đầu
    n_frames, fps = 0, 0.0

    for frame in frames(source, live, args.realtime):
        h, w = frame.shape[:2]
        if pipe is None:
            pipe = FramePipeline(cfg, engine, w, h)
        new_ring = rings.take_update()
        if new_ring:
            ring = new_ring
            for c in (counter, day_counter):
                if c is not None:
                    c.set_ring(ring[0], w, h, ring[1])

        now_vn = datetime.now(tz)
        today = now_vn.strftime("%Y-%m-%d")
        now_session = args.session or current_session(s["windows"], now_vn)
        if not started or now_session != session:            # bắt đầu hoặc đổi phiên
            if pub and session:
                pub.bird_count(session, counter, conf_sum / max(conf_n, 1), final=True)
            session, started = now_session, True
            base = load_state(session, today) if session and live else (0, 0)
            counter = make_counter(cfg, w, h, ring, base)
            if day_counter is None:
                day_counter = make_counter(cfg, w, h, ring)
            conf_sum, conf_n = 0.0, 0
            logger.info(f"Phiên: {session or 'ngoài phiên'} (đã đếm trước đó: vào {base[0]}, ra {base[1]})")

        tracks, frame_conf, frame_dets = pipe.track(frame)
        conf_sum, conf_n = conf_sum + frame_conf, conf_n + frame_dets
        ids = track_ids(tracks)
        counter.update(ids, tracks.xyxy)
        day_counter.update(ids, tracks.xyxy)

        annotated = draw(frame.copy(), tracks, counter, fps, session) if server.watching_boxes or pusher else None
        server.publish(annotated, frame)
        if pusher:
            pusher.update(annotated)

        n_frames += 1
        now = time.time()
        if now - last_log >= 5:
            fps = n_frames / (now - last_log)
            logger.info(f"{fps:.1f} FPS | track {len(tracks)} | vào {counter.entry_count} ra {counter.exit_count}"
                        f" | không rõ chiều {counter.ambiguous}")
            n_frames, last_log = 0, now
        if now - last_pub >= cfg["mqtt"]["publish_interval_sec"]:
            last_pub = now
            if pub:
                pub.heartbeat()
                if session:
                    pub.bird_count(session, counter, conf_sum / max(conf_n, 1))
            if session and live:
                save_state(session, today, counter)
        if live:
            done = buckets.roll(now, (day_counter.entry_count, day_counter.exit_count))
            if done and pub:
                pub.bucket(done[0], cfg["mqtt"]["bucket_minutes"], done[1], done[2])

    # chỉ tới đây khi chạy trên file
    if counter is None:
        raise SystemExit(f"{source} không có frame nào")
    logger.info(f"KẾT QUẢ {source}: vào {counter.entry_count} | ra {counter.exit_count} | không rõ chiều {counter.ambiguous}")
    if pub and session:
        pub.bird_count(session, counter, conf_sum / max(conf_n, 1), final=True)
        time.sleep(1)                                        # chờ gửi xong tin cuối


if __name__ == "__main__":
    main()
