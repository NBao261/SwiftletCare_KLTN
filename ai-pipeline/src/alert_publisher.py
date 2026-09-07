"""
SwiftletCare - Alert Publisher (RPi → MQTT → Cloud)
Handles predator detection alerts and uploads snapshots to MinIO/S3.

SRS: THREAT-FR-001..004, VISION-FR-011
"""
import cv2
import json
import time
import uuid
import tempfile
from pathlib import Path
from typing import Optional
from collections import deque
from loguru import logger

import paho.mqtt.client as mqtt
from minio import Minio


class TemporalFilter:
    """
    Confirm detection only if seen in >= N of last M frames.
    Prevents false positives (THREAT-FR-003).
    """

    def __init__(self, confirm_frames: int = 2, window_frames: int = 5):
        self._confirm   = confirm_frames
        self._history:  dict[str, deque] = {}   # class_name -> deque of booleans

    def update(self, class_name: str, detected: bool) -> bool:
        if class_name not in self._history:
            self._history[class_name] = deque(maxlen=5)
        self._history[class_name].append(detected)
        confirmed = sum(self._history[class_name]) >= self._confirm
        return confirmed


class AlertPublisher:
    """
    Publishes predator and anomaly alerts via MQTT.
    Uploads snapshot to MinIO then includes presigned URL in alert.
    """

    SEVERITY_MAP = {
        "snake": "CRITICAL",   # THREAT-FR-004
        "owl":   "CRITICAL",
        "rat":   "HIGH",
    }

    def __init__(self, mqtt_client: mqtt.Client, minio_client: Minio,
                 farm_id: str, house_id: str, zone_id: str, bucket: str):
        self._mqtt    = mqtt_client
        self._minio   = minio_client
        self._farm    = farm_id
        self._house   = house_id
        self._zone    = zone_id
        self._bucket  = bucket
        self._filter  = TemporalFilter(confirm_frames=2)

        self._topic_alert = f"swiftletcare/{farm_id}/{house_id}/{zone_id}/vision/alert"

    def process_detections(self, frame, detections) -> None:
        """
        Check detections for predators; apply temporal filter; publish if confirmed.
        SRS: THREAT-FR-001, THREAT-FR-003
        """
        predator_classes = {"rat", "snake", "owl"}

        for det in detections:
            if det.class_name not in predator_classes:
                continue
            if det.confidence < 0.70:   # THREAT-FR-001
                continue

            confirmed = self._filter.update(det.class_name, True)
            if confirmed:
                snapshot_url = self._upload_snapshot(frame, det)
                self._publish_predator_alert(det, snapshot_url)

        # Reset filter for classes not seen this frame
        seen = {d.class_name for d in detections}
        for cls in predator_classes - seen:
            self._filter.update(cls, False)

    def _upload_snapshot(self, frame, det) -> Optional[str]:
        """Draw bbox, save JPEG, upload to MinIO, return presigned URL. (THREAT-FR-002)"""
        try:
            annotated = frame.copy()
            x1, y1, x2, y2 = det.bbox
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(annotated, f"{det.class_name} {det.confidence:.0%}",
                        (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

            object_name = f"alerts/{int(time.time())}_{det.class_name}_{uuid.uuid4().hex[:8]}.jpg"
            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                f.write(buf.tobytes())
                tmp_path = f.name

            self._minio.fput_object(self._bucket, object_name, tmp_path,
                                    content_type="image/jpeg")
            Path(tmp_path).unlink(missing_ok=True)

            # Presigned URL TTL 7 days for snapshots (longer than dashboard TTL)
            url = self._minio.presigned_get_object(self._bucket, object_name,
                                                    expires=604800)  # 7 days
            return url
        except Exception as e:
            logger.error(f"Snapshot upload failed: {e}")
            return None

    def _publish_predator_alert(self, det, snapshot_url: Optional[str]) -> None:
        """Publish MQTT alert payload (THREAT-FR-001)."""
        payload = {
            "type":        "PREDATOR_DETECTED",
            "class":       det.class_name,
            "severity":    self.SEVERITY_MAP.get(det.class_name, "HIGH"),
            "confidence":  round(det.confidence, 3),
            "snapshotUrl": snapshot_url,
            "timestamp":   int(time.time() * 1000),
        }
        self._mqtt.publish(self._topic_alert, json.dumps(payload), qos=1)
        logger.warning(f"ALERT published: {det.class_name} (conf={det.confidence:.0%})")

    def publish_low_return_rate(self, return_rate: float, avg_7day: float) -> None:
        """Publish alert when return rate drops > 20% vs 7-day avg (VISION-FR-011)."""
        topic  = f"swiftletcare/{self._farm}/{self._house}/{self._zone}/vision/alert"
        payload = {
            "type":       "LOW_RETURN_RATE",
            "severity":   "MEDIUM",
            "returnRate": return_rate,
            "avg7Day":    avg_7day,
            "dropPct":    round((avg_7day - return_rate) / avg_7day * 100, 1),
            "timestamp":  int(time.time() * 1000),
        }
        self._mqtt.publish(topic, json.dumps(payload), qos=1)
