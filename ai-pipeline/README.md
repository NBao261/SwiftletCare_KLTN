# SwiftletCare AI Pipeline (đếm chim yến)

Python + OpenCV + YOLO26n (ONNX Runtime) + ByteTrack (`supervision`). Nhận RTSP từ camera IP tại cửa chim ra vào, đếm chim ra/vào qua vạch ảo, publish số đếm qua MQTT và phát hình đã vẽ khung. Yêu cầu: `SwiftletCare_SRS.md` §5.4 (Module VISION); kế hoạch chi tiết: `docs/bird-counting-plan.md`.

> **Phạm vi v2.0.0:** chỉ **1 class `swiftlet`** (đã bỏ phát hiện thiên địch). Nút AI là máy chủ cloud (hoặc PC tại nhà yến ở phương án lùi), không dùng Raspberry Pi.

## Cài đặt

```powershell
cd ai-pipeline
py -3.12 -m venv .venv              # Python 3.11–3.12
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env              # điền CAMERA_RTSP_URL, CAMERA_DEVICE_ID, FARM_ID/HOUSE_ID/ZONE_ID
```

Model không nằm trong repo. Chưa có model tự train thì export YOLO26n pretrained (COCO, class `bird` = 14) một lần trên Colab hoặc một venv riêng có `ultralytics==8.4.170`, rồi đặt file vào `models/yolo26n.onnx` (plan 6.1):

```python
from ultralytics import YOLO
YOLO("yolo26n.pt").export(format="onnx", imgsz=640, nms=False, simplify=True)
```

## Chạy

Mọi lệnh chạy trong thư mục `ai-pipeline`.

```powershell
# Ghi clip từ camera để train và đo sai số (plan 7.1, 16.6) — 90 phút, vào clips/
powershell -ExecutionPolicy Bypass -File tools/record_session.ps1

# Chạy trên clip, không gửi MQTT; xem ô xanh ở http://127.0.0.1:8090/stream
python src/stream.py --source clips/20261020_evening_01.mp4 --session EVENING_ENTRY --no-mqtt

# Chạy với camera thật (CAMERA_RTSP_URL trong .env) và gửi số đếm về backend
python src/stream.py

pytest
```

| Cờ | Tác dụng |
|---|---|
| `--source` | File clip hoặc `rtsp://…`; mặc định lấy `CAMERA_RTSP_URL` trong `.env`, rồi `camera.source` trong config |
| `--session MORNING_EXIT\|EVENING_ENTRY` | Ép phiên khi chạy trên clip; chạy thật thì phiên tính theo giờ Việt Nam (`sessions` trong config) |
| `--realtime` | Phát file đúng tốc độ thật (camera demo, plan 15.8) |
| `--no-mqtt` | Không gửi gì lên broker |
| `--config` | File cấu hình khác (`config/config.yaml` mặc định) |

### Xem live stream qua MediaMTX (plan 16.3, mức dev 2)

Có `STREAM_PUSH_URL` trong `.env` thì pipeline đẩy hình đã vẽ khung (ô xanh, vạch đếm, số VAO/RA) lên MediaMTX, ở luồng riêng: máy chủ video sập hay mạng chậm thì việc đếm vẫn chạy, video tự đẩy lại khi máy chủ lên.

```powershell
docker compose up -d mongodb emqx mediamtx        # ở gốc repo
cd backend; npm run dev                            # backend/.env có STREAM_TOKEN_SECRET, STREAM_AUTH_KEY=dev-auth-key, STREAM_PUBLISH_SECRET=dev-publish
# ai-pipeline/.env: STREAM_PUSH_URL=rtsp://pipeline:dev-publish@localhost:8554/cam-<CAMERA_DEVICE_ID>
python src/stream.py
```

Người xem lấy token bằng `GET /devices/camera-nodes/:id/stream-token` (Farm Owner/Domain Expert, sống 60 giây), rồi mở `http://localhost:8889/cam-<device_id>/?token=<token>` (trang xem có sẵn của MediaMTX), hoặc gửi WHEP với header `Authorization: Bearer <token>`. Không có token thì MediaMTX trả 401.

Clip nặng khoảng 0,9 GB/giờ. Ổ chứa repo đầy thì để `clips/` ở ổ khác bằng junction (mọi lệnh vẫn dùng `clips/...`):

```powershell
New-Item -ItemType Directory -Force D:\SwiftletCare\clips
Move-Item clips\* D:\SwiftletCare\clips\       # khi không có ffmpeg nào đang ghi
Remove-Item clips; New-Item -ItemType Junction -Path clips -Target D:\SwiftletCare\clips
```

Hiệu chỉnh ROI, vạch đếm và chiều đếm bằng cách sửa `config/config.yaml` rồi chạy lại, xem hình ở `/stream` (`/stream?boxes=0` là hình gốc) — trình tự ở plan 6.8. **ROI và vạch đếm hiện là giá trị tạm**, chốt sau khi có clip phiên chiều (plan 19.7).

## Cấu trúc

```
config/config.yaml     camera, model, tracking, phiên, MQTT, MJPEG, log (không chứa bí mật)
.env                   RTSP URL, MQTT, ID farm/house/zone/device — không commit (.env.example là mẫu)
models/  clips/        không commit
src/
  stream.py            vòng lặp chính: đọc frame mới nhất → suy luận → ByteTrack → đếm → MJPEG + MQTT
  inference.py         ONNX Runtime; đọc cả đầu ra YOLO26n (nms=False) lẫn YOLOv8n/YOLO11n (có NMS)
  counting.py          LineCounter (sv.LineZone), phiên theo giờ, cắt khoảng 5 phút
  mjpeg_server.py      xem trước MJPEG chỉ cho máy này (127.0.0.1), nén ảnh khi có người xem
  stream_pusher.py     đẩy hình đã vẽ khung lên MediaMTX bằng ffmpeg (H.264, không B-frame cho WebRTC), che mật khẩu trong log
tools/record_session.ps1  ghi clip RTSP theo lịch
tests/                 pytest, không cần camera/model/broker
```

## MQTT

Topic dưới `swiftletcare/{farmId}/{houseId}/{zoneId}/`, payload theo `BirdCountPayload` của backend:

| Topic | Khi nào | Payload |
|---|---|---|
| `vision/bird-count` | 30 giây/lần trong phiên, và khi hết phiên (`final: true`) | `{deviceId, session_type, entry_count, exit_count, confidence_avg, final, timestamp}` |
| `vision/bird-count` | Hết mỗi khoảng 5 phút, cả ngoài phiên (chỉ khi chạy với camera) | `{deviceId, kind: "BUCKET", bucket_start, bucket_minutes, entry_count, exit_count, timestamp}` |
| `heartbeat` | 30 giây/lần khi còn nhận được hình | `{deviceId, firmwareVersion}` (= `model.version`) |

Pipeline gửi số thô; backend tự tính tỷ lệ chim về trên số ròng. Mất hình thì ngừng heartbeat, backend báo `EDGE_AI_DEGRADED` sau 90 giây.

## Trạng thái

Pipeline chạy được trên clip và RTSP với model tạm YOLO26n COCO; **chưa có model tự train** (GĐ2), chưa có Dockerfile cho VPS (plan 18.3). Đẩy video lên MediaMTX và xem qua WebRTC đã chạy thử với camera thật ở dev (20/10/2026). Tiến trình tự nối lại khi rớt camera hoặc broker; khi chạy thật phải có trình giám sát khởi động lại lúc crash (REL-NFR-004).
