# Bộ giả lập thiết bị (SYSTEM-FR-004)

Công cụ test của nhóm (Report 3 SYSTEM-FR-004, Report 4 D20 và DF-17). Nó tạo nhiều controller và camera giả lập, đi đúng đường của thiết bị thật:

1. Administrator nhập kho với `simulated: true` (`POST /admin/provisioned-devices`).
2. Farm Owner tạo nhà, tầng và đăng ký thiết bị bằng mã kích hoạt, như khi quét nhãn ở SF-01.
3. Mỗi thiết bị nối broker bằng tài khoản riêng (device ID + broker secret) và publish trên cây topic của nó, `swiftletcare/dev/{deviceId}/…`.

Thiết bị đăng ký từ mục kho giả lập có cờ `simulated` trên bản ghi. Mọi màn hình phải ghi rõ đó là thiết bị giả lập (việc của web và mobile).

Dùng cho:
- **NFR-03:** tải đúng cỡ A-7, gồm 120 controller và 20 camera.
- **NFR-15:** dựng sẵn cảnh báo để đo độ trễ leo thang.
- **Demo nhiều nhà** ở WF-06.

## Chạy

Cần backend và EMQX đang chạy (`docker compose up -d mongodb emqx`, `cd backend && npm run dev`). Cần thêm hai tài khoản có sẵn:
- **Administrator:** seed không tạo tài khoản này.
- **Farm Owner có ít nhất một farm:** `npm run seed` tạo `owner@swiftletcare.dev`.

```bash
cd simulator
npm install
export SIM_ADMIN_EMAIL=... SIM_ADMIN_PASSWORD=...
export SIM_OWNER_EMAIL=owner@swiftletcare.dev SIM_OWNER_PASSWORD=...
npm start -- --houses 2 --zones 2 --controllers 1 --cameras 1
```

Mật khẩu chỉ đọc từ biến môi trường, không truyền qua tham số dòng lệnh để không lưu lại trong lịch sử shell.

| Tham số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `--api`, `--broker` | `http://localhost:3000`, `mqtt://localhost:1883` | Hoặc `SIM_API_URL`, `SIM_BROKER_URL`. Trên staging: URL `api.` và `mqtts://mqtt.…:8883` |
| `--farm` | farm đầu tiên của Farm Owner | Farm để tạo nhà |
| `--houses`, `--zones`, `--controllers`, `--cameras` | 2, 2, 1, 1 | Số nhà; số tầng mỗi nhà; số controller mỗi tầng; số camera mỗi nhà |
| `--telemetry-sec` | 10 | Chu kỳ telemetry; heartbeat luôn 30 giây như firmware |
| `--breach` | 0 | Tỉ lệ controller (0–1) có độ ẩm trôi xuống dưới 75 %, sinh `THRESHOLD_BREACH` sau thời gian chờ của BR-34 |
| `--offline`, `--offline-after-min` | 0, 5 | Tỉ lệ controller bị ngắt sau số phút đã cho, sinh `NODE_OFFLINE` |
| `--alerts` | 0 | Số cảnh báo `MISTING_INEFFECTIVE` gửi rải trong phút thứ 2, mỗi cảnh báo một `eventId` (NFR-15) |
| `--prefix` | `SIM` | Tiền tố tên nhà và device ID. Mỗi lần chạy thêm một mã riêng, nên chạy lại không trùng kho |

Chạy cỡ NFR-03 (A-7: 20 nhà, 60 tầng, 120 controller, 20 camera):

```bash
npm start -- --houses 20 --zones 3 --controllers 2 --cameras 1
```

## Thiết bị giả lập làm gì

- **Controller:**
  - telemetry đủ 6 số đo, đi ngẫu nhiên quanh giá trị thường gặp trong nhà yến;
  - relay theo luật đơn giản, không phải bộ điều khiển mờ thật;
  - heartbeat có `appliedConfigVersion` là `config_version` vừa nhận từ `config` retained, như firmware 2.1.0 (ENV-FR-027);
  - không thực hiện lệnh `cmd`.
- **Camera:**
  - heartbeat có `fps`;
  - tin số đếm 5 phút sau mỗi mốc 5 phút: đông chim trong khung phiên mặc định BR-13 theo giờ Việt Nam, lác đác ngoài khung;
  - trong phiên còn gửi tin của phiên với số cộng dồn.
- **Dừng:** Ctrl+C ngắt mọi kết nối. Nhà, tầng và thiết bị giả lập vẫn nằm trong DB tới lần đặt lại seed (Report 4 §11). Trên staging, chạy từ máy của một thành viên.

## Test

```bash
npm test   # node --test: payload, khung phiên, số đo
```
