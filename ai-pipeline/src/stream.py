"""
SwiftletCare - Main Pipeline Entry Point
Orchestrates: RTSP capture → mask + 2 tiles → YOLO → ByteTrack → ring count (src/pipeline.py)

MQTT publishing of counts, the MJPEG preview and the push to MediaMTX are plan §6.5-6.6 (not done yet).

SRS: VISION-FR-001..012
"""
import os
import time
from pathlib import Path
from typing import Optional, Sequence, Tuple

import cv2
import yaml
from dotenv import load_dotenv
from loguru import logger

from counting import RingCounter
from inference import InferenceEngine
from pipeline import FramePipeline
from remote_config import RingStore, start_listener

CONFIG = Path(__file__).resolve().parents[1] / "config" / "config.yaml"


def load_config(path: Path = CONFIG) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8-sig"))


def make_engine(cfg: dict, model_path: Optional[str] = None) -> InferenceEngine:
    m = cfg["model"]
    return InferenceEngine(model_path or m["path"], m["input_size"], m["confidence_threshold"],
                           m["nms_iou_threshold"], m["classes"], m["providers"])


def make_counter(cfg: dict, width: int, height: int,
                 ring: Optional[Tuple[Sequence[Sequence[float]], bool]] = None) -> RingCounter:
    """ring = (points, into_ring_is_exit) from the backend (VISION-FR-018); None = config.yaml's ring."""
    t = cfg["tracking"]
    points, into_ring_is_exit = ring or (t["ring"], t["into_ring_is_exit"])
    return RingCounter(points, width, height, into_ring_is_exit, lost_frames=t["lost_track_buffer"],
                       extrapolate_frames=t["extrapolate_frames"], min_speed_px=t["extrapolate_min_speed_px"])


def main() -> None:
    cfg = load_config()
    logger.add(cfg["logging"]["file"], rotation=cfg["logging"]["rotation"])
    load_dotenv()

    url = os.environ.get("CAMERA_RTSP_URL")
    if not url:
        logger.error("CAMERA_RTSP_URL is not set in .env")
        return
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        logger.error("Cannot open RTSP stream")
        return
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # VISION-FR-018: the ring the Domain Expert drew wins over config.yaml, and can change while running
    device_id = os.environ.get("CAMERA_DEVICE_ID", "")
    rings = RingStore(Path(cfg["tracking"]["ring_override_file"]), device_id)
    counter = make_counter(cfg, frame_w, frame_h, rings.load())
    if device_id and os.environ.get("FARM_ID") and os.environ.get("HOUSE_ID"):
        start_listener(cfg["mqtt"], rings, os.environ["FARM_ID"], os.environ["HOUSE_ID"], device_id)
    else:
        logger.info("CAMERA_DEVICE_ID/FARM_ID/HOUSE_ID not set — counting ring comes from config.yaml only")
    pipe = FramePipeline(cfg, make_engine(cfg), counter, frame_w, frame_h)

    frame_count = 0
    logger.info("Pipeline started. Press Ctrl+C to stop.")
    while True:
        ret, frame = cap.read()
        if not ret:
            logger.warning("Frame read failed, reconnecting...")
            time.sleep(1)
            cap.open(url, cv2.CAP_FFMPEG)
            continue

        ring = rings.take_update()
        if ring:
            counter.set_ring(ring[0], frame_w, frame_h, ring[1])
        _, tracks = pipe.process(frame)

        frame_count += 1
        if frame_count % 100 == 0:
            logger.info(f"FPS: {pipe.fps:.1f} | Active tracks: {len(tracks)} | Entry: {counter.entry_count} "
                        f"Exit: {counter.exit_count} Ambiguous: {counter.ambiguous}")


if __name__ == "__main__":
    main()
