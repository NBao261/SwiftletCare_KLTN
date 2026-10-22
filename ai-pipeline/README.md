# SwiftletCare AI Pipeline (đếm chim yến)

Python + OpenCV + YOLO26n (ONNX Runtime) + ByteTrack. Nhận RTSP từ camera IP tại cửa chim ra vào, đếm chim ra/vào qua vạch ảo, publish số đếm qua MQTT và phát video đã vẽ khung. Xem `SwiftletCare_SRS.md` §5.4 (Module VISION), §11 và kế hoạch chi tiết ở `docs/bird-counting-plan.md`.

> **Phạm vi v2.0.0 (sau Review 1):** chỉ còn **1 class `swiftlet`** — phát hiện thiên địch (rat/snake/owl) đã bị bỏ. Nút AI là **PC tại nhà yến hoặc máy chủ cloud**, không dùng Raspberry Pi. Live stream có vẽ khung và báo cáo độ chính xác đếm (VISION-FR-014/016) là bắt buộc.

## Chạy local

```bash
cd ai-pipeline
python -m venv .venv && source .venv/bin/activate   # hoặc .venv\Scripts\activate trên Windows
pip install -r requirements.txt
cp .env.example .env                                  # điền CAMERA_RTSP_URL, ID thiết bị/farm/nhà
python src/stream.py                                  # camera thật; xem http://127.0.0.1:8090/stream
python src/stream.py --source D:/SwiftletCare/clips/20261022_morning_01.mp4 --session MORNING_EXIT --no-mqtt
pytest
```

## Cấu trúc

```
config/config.yaml   2 ô + vùng tô đen, model, ngưỡng, vòng đếm, MQTT (địa chỉ RTSP nằm trong .env)
models/               Model ONNX (không commit)
src/
  stream.py           Vòng lặp chính: đọc RTSP (giữ frame mới nhất), phiên theo giờ VN, MQTT, số đếm 5 phút
  pipeline.py         Mỗi frame: tô đen → 2 ô → YOLO → ByteTrack → vòng đếm → vẽ ô xanh
  frame_prep.py       Tô đen + cắt ô, dùng chung với công cụ tách ảnh train
  inference.py        YOLO qua ONNX Runtime (YOLO26 và YOLOv8/11), chạy theo ô rồi gộp
  counting.py         Vòng đếm quanh miệng lỗ + ngoại suy cho chim lao qua lỗ → entry/exit (VISION-FR-005)
  remote_config.py    Vòng đếm Domain Expert vẽ trên web (VISION-FR-018)
  mjpeg_server.py     Xem thử MJPEG trên máy (127.0.0.1:8090)
  stream_pusher.py    Đẩy hình đã vẽ khung lên MediaMTX để xem trên web/mobile
tools/pick_roi.py     Lấy vòng đếm cho config.yaml
tools/extract_frames.py  Tách frame theo 2 ô + nhãn nháp từ tracking để gán nhãn trên Roboflow (plan §7.2)
tools/track_clip.py   Chạy pipeline trên một đoạn clip, ghi video có ô xanh (plan §6.8)
tools/split_by_day.py    Chia train/val/test theo ngày quay (plan §7.4)
tools/record_session.ps1 Quay clip hằng ngày (Task Scheduler) vào D:\SwiftletCare\clips
tests/                pytest cho vòng đếm và các công cụ
```

## Theo dõi và vòng đếm

Camera nhìn vào miệng lỗ ra vào từ trong nhà, nên đếm bằng một **vòng khép kín** quanh miệng lỗ (`tracking.ring` trong `config/config.yaml`), không phải một vạch thẳng. Chim đi vào vòng là chui vào lỗ (**RA**), đi ra khỏi vòng là chui ra (**VỀ**); con chỉ bay lướt qua lỗ cắt vòng hai lần và số ròng triệt tiêu. Camera đặt ngoài nhà thì đổi `tracking.into_ring_is_exit: false`.

Chim được theo dõi trên **cả khung hình** (ô xanh cho mọi con, kể cả đang lượn), chia 2 ô chồng nhau (`camera.tiles`) để chim còn ≥ 15 px trong ảnh đưa vào model; dòng ngày giờ được tô đen (`camera.mask`). Chim qua lỗ bay 150–200 px/frame nên frame trong vòng thường không được phát hiện: vết nhanh mất ngay ngoài vòng mà đi tiếp thì vào vòng tính RA, vết nhanh mới xuất hiện mà lùi lại thì ra từ vòng tính VỀ (`extrapolate_frames`, `extrapolate_min_speed_px`). Vết sinh và mất đều trong vòng thì không rõ chiều, chỉ đếm riêng. Vết mất ở mép khung không tính gì.

1. Lấy một clip có chim. Đo **s** = cỡ một con chim sát miệng lỗ (px), **v** = quãng nó bay giữa hai khung liên tiếp (px).
2. Chạy `python tools/pick_roi.py <ảnh|clip|rtsp> --margin <d>` với `d = max(s, 1,5 × v)` (chim lượn; chim lao qua lỗ do luật ngoại suy lo). Không truyền nguồn thì công cụ lấy `CAMERA_RTSP_URL` trong `.env`.
3. Kéo to cửa sổ, click lần lượt các góc viền ngoài miệng lỗ. Phím `+`/`-` nới hoặc thu vòng 10 px, `z` bỏ điểm cuối, Enter in khối `ring` để chép vào `config.yaml`.
4. Chạy `python tools/track_clip.py <clip> --start <giây> --seconds 20`, xem video có ô xanh trong `D:/SwiftletCare/clips/annotated/`. Chưa có model tự train thì thêm `--detector motion` (vật chuyển động thay cho model) để xem tracker và bộ đếm.
5. Đếm tay rồi so với số máy đếm. Chim chui ra khỏi lỗ mà số RA tăng thì đổi `into_ring_is_exit`.

Giá trị đang dùng ở nhà yến thử nghiệm và cách đo: `docs/bird-counting-plan.md` mục 19.8.

## Train model

Từ clip đến file ONNX: `docs/bird-counting-plan.md` mục 7 (tách frame → gán nhãn trên Roboflow → chia theo ngày → train trên Google Colab T4 → export ONNX → đo sai số đếm). Clip, frame và dataset để ở `D:\SwiftletCare\`, không để trong repo.

## MQTT Topics (SRS v2.1.8: theo nhà yến, không có đoạn zone)

```
swiftletcare/{farmId}/{houseId}/vision/bird-count   ← số đếm phiên (30 giây/lần) và số đếm 5 phút (kind: BUCKET)
swiftletcare/{farmId}/{houseId}/heartbeat           ← {deviceId, firmwareVersion}; im 90 giây là EDGE_AI_DEGRADED
swiftletcare/{farmId}/{houseId}/config/update       → vòng đếm Domain Expert vẽ (VISION-FR-018)
```

## Trạng thái

Chạy được trên clip và camera thật với model COCO tạm; model COCO không nhận ra chim yến trong ảnh hồng ngoại, nên phải train model riêng (plan §7). Chưa triển khai lên VPS. Tiến trình phải tự khởi động lại khi crash (REL-NFR-004).
