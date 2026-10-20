"""SwiftletCare – suy luận YOLO bằng ONNX Runtime (VISION-FR-001..003).

Đọc được hai kiểu đầu ra, nhận theo shape (plan mục 6.3), nên đổi model để so sánh (plan 7.9)
chỉ cần sửa model.path trong config:
- YOLO26n export nms=False: (1, 300, 6), mỗi dòng [x1, y1, x2, y2, confidence, class_id], không cần NMS.
- YOLOv8n/YOLO11n:          (1, 4 + số class, 8400), mỗi cột [cx, cy, w, h, điểm từng class], phải chạy NMS.
"""
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np
import onnxruntime as ort
from loguru import logger


@dataclass
class Detection:
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2 theo tọa độ ảnh đưa vào infer()


def decode(output: np.ndarray, class_names: Dict[int, str], conf_thresh: float, iou_thresh: float,
           scale: float, pad_x: int, pad_y: int) -> List[Detection]:
    """Đầu ra thô của model → Detection theo tọa độ ảnh gốc (đã bỏ viền letterbox)."""
    out = output[0]
    end2end = out.shape[1] == 6
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
    if not end2end and len(xyxy):
        xywh = np.concatenate([xyxy[:, :2], xyxy[:, 2:] - xyxy[:, :2]], axis=1)  # NMSBoxes nhận x, y, w, h
        idx = np.array(cv2.dnn.NMSBoxes(xywh.tolist(), conf.tolist(), conf_thresh, iou_thresh), dtype=int).reshape(-1)
        xyxy, conf, cls = xyxy[idx], conf[idx], cls[idx]

    xyxy = (xyxy - [pad_x, pad_y, pad_x, pad_y]) / scale
    return [Detection(int(c), class_names[int(c)], float(p), tuple(int(v) for v in b))
            for b, p, c in zip(xyxy, conf, cls)]


class InferenceEngine:
    def __init__(self, model_path: str, input_size: int = 640, conf_threshold: float = 0.3,
                 iou_threshold: float = 0.45, class_names: Optional[Dict[int, str]] = None,
                 providers: Optional[Sequence[str]] = None):
        self.input_size = input_size
        self.conf_thresh = conf_threshold
        self.iou_thresh = iou_threshold
        self.class_names = {int(k): v for k, v in (class_names or {0: "swiftlet"}).items()}

        opts = ort.SessionOptions()
        # Không đặt intra_op_num_threads: mặc định ORT dùng số nhân thật. Đặt bằng os.cpu_count() (luồng logic,
        # gấp đôi số nhân khi có SMT) làm suy luận chậm gấp đôi (đo 20/10/2026: 45 ms so với 21 ms, Ryzen 7 6800H)
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, opts, providers=list(providers or ["CPUExecutionProvider"]))
        self.input_name = self.session.get_inputs()[0].name
        logger.info(f"Model: {model_path} | providers: {self.session.get_providers()}")

    def preprocess(self, frame: np.ndarray) -> Tuple[np.ndarray, float, int, int]:
        """Letterbox về input_size, BGR → RGB (model train bằng ảnh RGB), NCHW float 0–1."""
        h, w = frame.shape[:2]
        scale = min(self.input_size / w, self.input_size / h)
        new_w, new_h = int(round(w * scale)), int(round(h * scale))
        pad_x, pad_y = (self.input_size - new_w) // 2, (self.input_size - new_h) // 2
        padded = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        padded[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = cv2.resize(frame, (new_w, new_h))
        blob = padded[:, :, ::-1].transpose(2, 0, 1)[np.newaxis].astype(np.float32) / 255.0
        return np.ascontiguousarray(blob), scale, pad_x, pad_y

    def infer(self, frame: np.ndarray) -> Tuple[List[Detection], float]:
        """Trả về (detections, thời gian suy luận tính bằng ms)."""
        t0 = time.perf_counter()
        blob, scale, pad_x, pad_y = self.preprocess(frame)
        output = self.session.run(None, {self.input_name: blob})[0]
        dets = decode(output, self.class_names, self.conf_thresh, self.iou_thresh, scale, pad_x, pad_y)
        return dets, (time.perf_counter() - t0) * 1000
