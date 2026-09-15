# SwiftletCare AI Pipeline (Edge Vision — Raspberry Pi)

Python + OpenCV + YOLOv8/YOLOv10 + ByteTrack. Chạy trên Raspberry Pi 4, nhận RTSP từ camera IP, publish kết quả đếm chim & cảnh báo thiên địch qua MQTT. Xem `SwiftletCare_SRS.md` §5.4-5.5 (Module VISION/THREAT), §11.

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
  inference.py         YOLO inference (swiftlet/rat/snake/owl)
  tracker.py            ByteTrack — tránh đếm trùng qua các frame
  counting.py            Logic line-crossing → entry/exit (VISION-FR-005)
  alert_publisher.py     Publish MQTT vision/bird-count, vision/alert (§9.2)
tests/                Unit test cho counting/tracker
```

## MQTT Topics (§9.2)

```
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/bird-count
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/alert
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/heartbeat
```

## Trạng thái

Scaffold module (`src/*.py`) — implement theo `SwiftletCare_TASK_DETAIL_Checklist.md` mục B (Sprint 1-6). Dùng PM2/Supervisor để auto-restart process khi deploy (REL-NFR-004).
