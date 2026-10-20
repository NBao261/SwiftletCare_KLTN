# SwiftletCare AI Pipeline (đếm chim yến)

Python + OpenCV + YOLO26n (ONNX Runtime) + ByteTrack. Nhận RTSP từ camera IP tại cửa chim ra vào, đếm chim ra/vào qua vạch ảo, publish số đếm qua MQTT và phát video đã vẽ khung. Xem `SwiftletCare_SRS.md` §5.4 (Module VISION), §11 và kế hoạch chi tiết ở `docs/bird-counting-plan.md`.

> **Phạm vi v2.0.0 (sau Review 1):** chỉ còn **1 class `swiftlet`** — phát hiện thiên địch (rat/snake/owl) đã bị bỏ. Nút AI là **PC tại nhà yến hoặc máy chủ cloud**, không dùng Raspberry Pi. Live stream có vẽ khung và báo cáo độ chính xác đếm (VISION-FR-014/016) là bắt buộc.

## Chạy local

```bash
cd ai-pipeline
python -m venv .venv && source .venv/bin/activate   # hoặc .venv\Scripts\activate trên Windows
pip install -r requirements.txt
python src/stream.py --config config/config.yaml
```

## Cấu trúc

```
config/config.yaml   RTSP URL, model path, ngưỡng confidence, MQTT broker
models/               Model ONNX/NCNN quantized (không commit file .onnx lớn — dùng Git LFS/release asset)
src/
  stream.py           Nhận RTSP, vòng lặp chính
  inference.py         YOLO inference (1 class: swiftlet)
  tracker.py            ByteTrack — tránh đếm trùng qua các frame
  counting.py            Logic line-crossing → entry/exit (VISION-FR-005)
  alert_publisher.py     Publish MQTT vision/bird-count (§9.2); vision/alert không còn dùng cho thiên địch
tests/                Unit test cho counting/tracker
```

## MQTT Topics (§9.2)

```
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/bird-count
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/alert
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/heartbeat
```

## Trạng thái

Scaffold module (`src/*.py`), chưa có model và chưa chạy thật — implement theo `docs/bird-counting-plan.md`. Tiến trình phải tự khởi động lại khi crash (REL-NFR-004).
