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
  counting.py            Vòng đếm quanh miệng lỗ → entry/exit (VISION-FR-005)
  alert_publisher.py     Publish MQTT vision/bird-count (§9.2); vision/alert không còn dùng cho thiên địch
tools/pick_roi.py     Lấy ROI + vòng đếm cho config.yaml
tools/extract_frames.py  Tách frame theo ROI + nhãn nháp để gán nhãn (plan §7.2)
tools/split_by_day.py    Chia train/val/test theo ngày quay (plan §7.4)
tests/                pytest cho vòng đếm và các công cụ
```

## Hiệu chỉnh ROI và vòng đếm

Camera nhìn vào miệng lỗ ra vào từ trong nhà, nên đếm bằng một **vòng khép kín** quanh miệng lỗ (`tracking.ring` trong `config/config.yaml`), không phải một vạch thẳng. Chim đi vào vòng là chui vào lỗ (**RA**), đi ra khỏi vòng là chui ra (**VỀ**); con chỉ bay lướt qua lỗ cắt vòng hai lần và số ròng triệt tiêu. Camera đặt ngoài nhà thì đổi `tracking.into_ring_is_exit: false`.

1. Lấy một clip có chim. Đo **s** = cỡ một con chim sát miệng lỗ (px), **v** = quãng nó bay giữa hai khung liên tiếp (px).
2. Chạy `python tools/pick_roi.py <ảnh|clip|rtsp> --margin <d> --roi-pad <3v>` với `d = max(s, 1,5 × v)`. Không truyền nguồn thì công cụ lấy `CAMERA_RTSP_URL` trong `.env`.
3. Kéo to cửa sổ, click lần lượt các góc viền ngoài miệng lỗ. Phím `+`/`-` nới hoặc thu vòng 10 px, `z` bỏ điểm cuối, Enter in khối `roi` + `ring` để chép vào `config.yaml`.
4. Cạnh dài nhất của ROI ≤ `640 × s / 15` để chim còn ≥ 15 px trong ảnh đưa vào model. Không để dòng ngày giờ của camera trong ROI.
5. Chạy pipeline trên clip, đếm tay rồi so với số máy đếm. Chim chui ra khỏi lỗ mà số RA tăng thì đổi `into_ring_is_exit`.

Giá trị đang dùng ở nhà yến thử nghiệm và cách đo: `docs/bird-counting-plan.md` mục 19.8.

## Train model

Từ clip đến file ONNX: `docs/bird-counting-plan.md` mục 7 (tách frame → gán nhãn trên Roboflow → chia theo ngày → train trên Google Colab T4 → export ONNX → đo sai số đếm). Clip, frame và dataset để ở `D:\SwiftletCare\`, không để trong repo.

## MQTT Topics (§9.2)

```
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/bird-count
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/alert
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/heartbeat
```

## Trạng thái

Scaffold module (`src/*.py`), chưa có model và chưa chạy thật — implement theo `docs/bird-counting-plan.md`. Tiến trình phải tự khởi động lại khi crash (REL-NFR-004).
