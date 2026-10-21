"""
SwiftletCare - Main Pipeline Entry Point
Orchestrates: RTSP capture → YOLO inference → ByteTrack → Counting → MQTT publish

SRS: VISION-FR-001..012
"""
import cv2
import time
import yaml
import json
import signal
import threading
from pathlib import Path
from loguru import logger

from inference import InferenceEngine
from tracker import TrackerWrapper
from counting import RingCounter
from alert_publisher import AlertPublisher


def load_config(path: str = "config/config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def main():
    cfg = load_config()
    logger.add(cfg["logging"]["file"], rotation=cfg["logging"]["rotation"])

    # Initialize components
    engine  = InferenceEngine(
        model_path       = cfg["model"]["path"],
        input_size       = cfg["model"]["input_size"],
        conf_threshold   = cfg["model"]["confidence_threshold"],
        iou_threshold    = cfg["model"]["nms_iou_threshold"],
    )
    tracker = TrackerWrapper()

    cap = cv2.VideoCapture(cfg["camera"]["rtsp_url"])
    if not cap.isOpened():
        logger.error("Cannot open RTSP stream")
        return

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    counter = RingCounter(cfg["tracking"]["ring"], frame_w, frame_h, cfg["tracking"]["into_ring_is_exit"])
    rx1, ry1, rx2, ry2 = (int(r * (frame_w, frame_h)[i % 2]) for i, r in enumerate(cfg["camera"]["roi"]))

    frame_count = 0
    fps_log_interval = 100  # log FPS every 100 frames

    logger.info("Pipeline started. Press Ctrl+C to stop.")
    while True:
        ret, frame = cap.read()
        if not ret:
            logger.warning("Frame read failed, reconnecting...")
            time.sleep(1)
            cap.open(cfg["camera"]["rtsp_url"])
            continue

        detections, fps = engine.infer(frame[ry1:ry2, rx1:rx2])
        for d in detections:                    # ROI coords -> full-frame coords, where the ring lives
            x1, y1, x2, y2 = d.bbox
            d.bbox = (x1 + rx1, y1 + ry1, x2 + rx1, y2 + ry1)
        tracks = [t for t in tracker.update(detections) if t.class_name == "swiftlet"]
        counter.update([t.track_id for t in tracks], [t.bbox for t in tracks])

        frame_count += 1
        if frame_count % fps_log_interval == 0:
            logger.info(f"FPS: {fps:.1f} | Active tracks: {len(tracks)} | "
                        f"Entry: {counter.entry_count} Exit: {counter.exit_count}")

    cap.release()


if __name__ == "__main__":
    main()
