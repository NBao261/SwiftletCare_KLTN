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
from counting import BirdCounter
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

    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    counter = BirdCounter(frame_h, cfg["tracking"]["counting_line_y_ratio"])

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

        detections, fps = engine.infer(frame)
        tracks = tracker.update(detections)
        counter.update(tracks)

        frame_count += 1
        if frame_count % fps_log_interval == 0:
            logger.info(f"FPS: {fps:.1f} | Active tracks: {len(tracks)} | "
                        f"Entry: {counter.session.entry_count} Exit: {counter.session.exit_count}")

    cap.release()


if __name__ == "__main__":
    main()
