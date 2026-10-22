"""
SwiftletCare - YOLO ONNX inference engine

Reads both output layouts so models can be swapped from config.yaml alone
(plan §6.3, §7.9): YOLO26 exported with nms=False gives (1, 300, 6) rows of
x1, y1, x2, y2, confidence, class_id; YOLOv8/YOLO11 give (1, 4 + classes, N)
columns of cx, cy, w, h, class scores and need NMS.

SRS: VISION-FR-001, VISION-FR-002, VISION-FR-003
"""
import os
import time
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np
import onnxruntime as ort
from loguru import logger


class Detection:
    """Single object detection result."""
    def __init__(self, class_id: int, class_name: str, confidence: float, bbox: Tuple[int, int, int, int]):
        self.class_id   = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox       = bbox  # (x1, y1, x2, y2)

    def __repr__(self) -> str:
        return f"Detection({self.class_name}, conf={self.confidence:.2f}, bbox={self.bbox})"


def decode(out: np.ndarray, conf_thresh: float, iou_thresh: float, class_names: Dict[int, str],
           scale: float, pad_x: int, pad_y: int) -> List[Detection]:
    """One image's raw output (batch dim removed) -> detections in the input image's pixels."""
    end2end = out.shape[1] == 6                  # YOLO26 nms=False: (300, 6); YOLOv8/11: (4 + classes, N)
    if end2end:
        xyxy, conf, cls = out[:, :4], out[:, 4], out[:, 5].astype(int)
    else:
        out = out.T
        cls = out[:, 4:].argmax(axis=1)
        conf = out[np.arange(len(out)), 4 + cls]
        cx, cy, w, h = out[:, 0], out[:, 1], out[:, 2], out[:, 3]
        xyxy = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], axis=1)
    keep = (conf >= conf_thresh) & np.isin(cls, list(class_names))
    xyxy, conf, cls = xyxy[keep], conf[keep], cls[keep]
    if not end2end and len(xyxy):                # cv2.dnn.NMSBoxes takes [x, y, w, h]
        xywh = np.concatenate([xyxy[:, :2], xyxy[:, 2:] - xyxy[:, :2]], axis=1)
        idx = np.array(cv2.dnn.NMSBoxes(xywh.tolist(), conf.tolist(), conf_thresh, iou_thresh)).reshape(-1)
        xyxy, conf, cls = xyxy[idx], conf[idx], cls[idx]
    xyxy = (xyxy - [pad_x, pad_y, pad_x, pad_y]) / scale     # drop the letterbox, back to input pixels
    return [Detection(int(c), class_names[int(c)], float(p), tuple(int(v) for v in b))
            for b, p, c in zip(xyxy, conf, cls)]


def merge_tiles(dets: List[Detection], max_overlap: float) -> List[Detection]:
    """
    Drop duplicates from the overlap between tiles. A bird cut by one tile's edge gives a partial box
    lying inside the full box from the other tile, so overlap is measured on the smaller box
    (intersection / smaller area), not IoU. Highest confidence wins.
    """
    kept: List[Detection] = []
    for d in sorted(dets, key=lambda d: d.confidence, reverse=True):
        x1, y1, x2, y2 = d.bbox
        area = max(1, (x2 - x1) * (y2 - y1))
        dup = False
        for k in kept:
            ix = max(0, min(x2, k.bbox[2]) - max(x1, k.bbox[0]))
            iy = max(0, min(y2, k.bbox[3]) - max(y1, k.bbox[1]))
            other = max(1, (k.bbox[2] - k.bbox[0]) * (k.bbox[3] - k.bbox[1]))
            if ix * iy / min(area, other) > max_overlap:
                dup = True
                break
        if not dup:
            kept.append(d)
    return kept


class InferenceEngine:
    def __init__(self, model_path: str, input_size: int, conf_threshold: float, iou_threshold: float,
                 class_names: Dict[int, str], providers: Optional[Sequence[str]] = None):
        self.input_size  = input_size
        self.conf_thresh = conf_threshold
        self.iou_thresh  = iou_threshold
        self.class_names = {int(k): v for k, v in class_names.items()}

        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = os.cpu_count() or 4
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_opts, providers=list(providers or ["CPUExecutionProvider"]))
        self.input_name  = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        logger.info(f"Model loaded: {model_path} | providers: {self.session.get_providers()}")

    def preprocess(self, image: np.ndarray) -> Tuple[np.ndarray, float, int, int]:
        """Letterbox to input_size, BGR -> RGB (the model trains on RGB), NCHW float."""
        h, w = image.shape[:2]
        scale = min(self.input_size / w, self.input_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        padded = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        pad_x = (self.input_size - new_w) // 2
        pad_y = (self.input_size - new_h) // 2
        padded[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = cv2.resize(image, (new_w, new_h))
        blob = padded[:, :, ::-1].astype(np.float32) / 255.0
        return np.ascontiguousarray(np.transpose(blob, (2, 0, 1))[np.newaxis]), scale, pad_x, pad_y

    def infer(self, image: np.ndarray) -> List[Detection]:
        blob, scale, pad_x, pad_y = self.preprocess(image)
        out = self.session.run([self.output_name], {self.input_name: blob})[0][0]
        return decode(out, self.conf_thresh, self.iou_thresh, self.class_names, scale, pad_x, pad_y)

    def infer_tiles(self, frame: np.ndarray, tiles: Sequence[Tuple[int, int, int, int]],
                    max_overlap: float) -> Tuple[List[Detection], float]:
        """Run each tile (pixel rects), shift boxes back to full-frame pixels, merge. Returns (detections, fps)."""
        t0 = time.perf_counter()
        dets: List[Detection] = []
        for x1, y1, x2, y2 in tiles:
            for d in self.infer(frame[y1:y2, x1:x2]):
                bx1, by1, bx2, by2 = d.bbox
                d.bbox = (bx1 + x1, by1 + y1, bx2 + x1, by2 + y1)
                dets.append(d)
        return merge_tiles(dets, max_overlap), 1.0 / max(time.perf_counter() - t0, 1e-6)
