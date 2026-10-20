import numpy as np

from inference import decode

CLASSES = {14: "swiftlet"}


def test_end2end_output_filters_class_and_confidence_and_removes_letterbox():
    # YOLO26n nms=False: (1, 300, 6) = x1, y1, x2, y2, conf, class
    out = np.zeros((1, 300, 6), dtype=np.float32)
    out[0, 0] = [110, 60, 130, 80, 0.9, 14]     # chim, giữ
    out[0, 1] = [10, 10, 20, 20, 0.2, 14]       # dưới ngưỡng
    out[0, 2] = [10, 10, 20, 20, 0.9, 0]        # class khác (person)
    dets = decode(out, CLASSES, 0.3, 0.45, scale=0.5, pad_x=10, pad_y=20)
    assert [(d.class_name, d.bbox) for d in dets] == [("swiftlet", (200, 80, 240, 120))]
    assert abs(dets[0].confidence - 0.9) < 1e-6


def test_yolov8_style_output_runs_nms():
    # YOLOv8n/YOLO11n: (1, 4 + 80, N) = cx, cy, w, h, điểm từng class
    n = 8400
    out = np.zeros((1, 84, n), dtype=np.float32)
    for i, (cx, score) in enumerate([(100, 0.9), (101, 0.8), (300, 0.7)]):   # 2 box gần trùng + 1 box riêng
        out[0, :4, i] = [cx, 100, 20, 20]
        out[0, 4 + 14, i] = score
    dets = decode(out, CLASSES, 0.3, 0.45, scale=1.0, pad_x=0, pad_y=0)
    assert sorted(d.bbox for d in dets) == [(90, 90, 110, 110), (290, 90, 310, 110)]


def test_no_detections():
    assert decode(np.zeros((1, 300, 6), dtype=np.float32), CLASSES, 0.3, 0.45, 1.0, 0, 0) == []
    assert decode(np.zeros((1, 84, 8400), dtype=np.float32), CLASSES, 0.3, 0.45, 1.0, 0, 0) == []
