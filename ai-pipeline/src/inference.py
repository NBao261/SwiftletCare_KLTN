"""
SwiftletCare - YOLOv8 ONNX Inference Engine
Raspberry Pi 4 optimized for >= 25 FPS (PERF-NFR-004)

SRS: VISION-FR-001, VISION-FR-002, VISION-FR-003
"""
import cv2
import numpy as np
import onnxruntime as ort
import time
from typing import List, Tuple
from loguru import logger


class Detection:
    """Single object detection result."""
    def __init__(self, class_id: int, class_name: str, confidence: float, bbox: Tuple[int, int, int, int]):
        self.class_id   = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox       = bbox  # (x1, y1, x2, y2)

    def __repr__(self):
        return f"Detection({self.class_name}, conf={self.confidence:.2f}, bbox={self.bbox})"


class InferenceEngine:
    """
    ONNX Runtime inference engine for YOLOv8.
    Targets >= 25 FPS on Raspberry Pi 4 (PERF-NFR-004).
    """

    CLASS_NAMES = {0: "swiftlet", 1: "rat", 2: "snake", 3: "owl"}
    PREDATOR_IDS = {1, 2, 3}

    def __init__(self, model_path: str, input_size: int = 640,
                 conf_threshold: float = 0.5, iou_threshold: float = 0.45):
        self.input_size    = input_size
        self.conf_thresh   = conf_threshold
        self.iou_thresh    = iou_threshold

        # Load ONNX model (INT8 quantized for RPi speed)
        providers = ["CPUExecutionProvider"]
        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = 4   # Use all 4 RPi cores
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(model_path, sess_opts, providers=providers)
        self.input_name  = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

        logger.info(f"Model loaded: {model_path}")

    def preprocess(self, frame: np.ndarray) -> Tuple[np.ndarray, float, float, int, int]:
        """Resize + normalize frame for YOLO input."""
        orig_h, orig_w = frame.shape[:2]
        scale = min(self.input_size / orig_w, self.input_size / orig_h)
        new_w, new_h = int(orig_w * scale), int(orig_h * scale)

        resized = cv2.resize(frame, (new_w, new_h))
        padded  = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        pad_x   = (self.input_size - new_w) // 2
        pad_y   = (self.input_size - new_h) // 2
        padded[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

        blob = padded.astype(np.float32) / 255.0
        blob = np.transpose(blob, (2, 0, 1))[np.newaxis]  # HWC -> NCHW

        return blob, scale, scale, pad_x, pad_y

    def postprocess(self, outputs: np.ndarray, scale_x: float, scale_y: float,
                    pad_x: int, pad_y: int) -> List[Detection]:
        """Apply NMS and convert to Detection objects."""
        predictions = outputs[0]  # shape: (1, 84, num_anchors)
        predictions = np.squeeze(predictions).T  # (num_anchors, 84)

        boxes   = predictions[:, :4]
        scores  = predictions[:, 4:]
        class_ids = np.argmax(scores, axis=1)
        confidences = scores[np.arange(len(scores)), class_ids]

        # Filter by confidence threshold
        mask = confidences >= self.conf_thresh
        boxes, confidences, class_ids = boxes[mask], confidences[mask], class_ids[mask]

        if len(boxes) == 0:
            return []

        # Convert cx,cy,w,h → x1,y1,x2,y2 and unscale to original coords
        x1 = ((boxes[:, 0] - boxes[:, 2] / 2) - pad_x) / scale_x
        y1 = ((boxes[:, 1] - boxes[:, 3] / 2) - pad_y) / scale_y
        x2 = ((boxes[:, 0] + boxes[:, 2] / 2) - pad_x) / scale_x
        y2 = ((boxes[:, 1] + boxes[:, 3] / 2) - pad_y) / scale_y
        xyxy = np.stack([x1, y1, x2, y2], axis=1)

        # NMS
        indices = cv2.dnn.NMSBoxes(
            xyxy.tolist(), confidences.tolist(),
            self.conf_thresh, self.iou_thresh
        )
        if len(indices) == 0:
            return []

        detections = []
        for i in indices.flatten():
            bbox = tuple(map(int, xyxy[i]))
            detections.append(Detection(
                class_id   = int(class_ids[i]),
                class_name = self.CLASS_NAMES.get(int(class_ids[i]), "unknown"),
                confidence = float(confidences[i]),
                bbox       = bbox,
            ))
        return detections

    def infer(self, frame: np.ndarray) -> Tuple[List[Detection], float]:
        """Run inference on one frame. Returns (detections, fps)."""
        t0 = time.perf_counter()
        blob, sx, sy, px, py = self.preprocess(frame)
        outputs = self.session.run([self.output_name], {self.input_name: blob})
        detections = self.postprocess(outputs, sx, sy, px, py)
        fps = 1.0 / (time.perf_counter() - t0)
        return detections, fps
