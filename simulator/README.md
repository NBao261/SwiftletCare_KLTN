# Bộ giả lập thiết bị (SYSTEM-FR-004)

Công cụ test của nhóm (Report 3 SYSTEM-FR-004, Report 4 D20 và DF-17). Nó tạo nhiều controller và camera giả lập, đi đúng đường của thiết bị thật:

1. Administrator nhập kho với `simulated: true` (`POST /admin/provisioned-devices`).
2. Farm Owner tạo nhà, tầng và đăng ký thiết bị bằng mã kích hoạt, như khi quét nhãn ở SF-01.
3. Mỗi thiết bị nối broker bằng tài khoản riêng (device ID + broker secret) và publish trên cây topic của nó, `swiftletcare/dev/{deviceId}/…`.

Thiết bị đăng ký từ mục kho giả lập có cờ `simulated` trên bản ghi. Mọi màn hình phải ghi rõ đó là thiết bị giả lập (việc của web và mobile).

Dùng cho:
- **NFR-03:** tải đúng cỡ A-7, gồm 120 controller và 20 camera.
- **NFR-15:** dựng sẵn cảnh báo và Work Order, đo độ trễ leo thang và độ trễ kiểm phục hồi.
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
| `--api`, `--broker` | `http://localhost:3000`, `mqtt://localhost:1883` | Hoặc `SIM_API_URL`, `SIM_BROKER_URL`. Trên staging: `https://<DOMAIN>/api` và `mqtts://<DOMAIN>:8883` |
| `--farm` | farm đầu tiên của Farm Owner | Farm để tạo nhà |
| `--houses`, `--zones`, `--controllers`, `--cameras` | 2, 2, 1, 1 | Số nhà; số tầng mỗi nhà; số controller mỗi tầng; số camera mỗi nhà |
| `--telemetry-sec` | 10 | Chu kỳ telemetry; heartbeat luôn 30 giây như firmware |
| `--breach` | 0 | Tỉ lệ controller (0–1) có độ ẩm trôi xuống dưới 75 %, sinh `THRESHOLD_BREACH` sau thời gian chờ của BR-34 |
| `--offline`, `--offline-after-min` | 0, 5 | Tỉ lệ controller bị ngắt sau số phút đã cho, sinh `NODE_OFFLINE` |
| `--alerts` | 0 | Số cảnh báo `MISTING_INEFFECTIVE` gửi rải trong phút thứ 2, mỗi cảnh báo một `eventId`, mỗi cái ở một controller khác nhau nếu đủ controller (NFR-15) |
| `--work-orders` | 0 | Số Work Order thợ làm để đo NFR-15 (b); cần `SIM_TECHNICIAN_EMAIL`, `SIM_TECHNICIAN_PASSWORD` |
| `--prefix` | `SIM` | Tiền tố tên nhà và device ID. Mỗi lần chạy thêm một mã riêng, nên chạy lại không trùng kho |

Chạy cỡ NFR-03 (A-7: 20 nhà, 60 tầng, 120 controller, 20 camera):

```bash
npm start -- --houses 20 --zones 3 --controllers 2 --cameras 1
```

## Đo NFR-03 và NFR-15

Cùng một lượt chạy ở cỡ A-7. Trước khi đo:

- Nâng tạm `RATE_LIMIT_MAX` của staging (ví dụ `1000000`), vì mọi người dùng giả của k6 và bộ giả lập ra từ một IP. Trả về `300` sau khi đo.
- Seed không tạo Administrator: tạo một tài khoản `ADMIN` trên staging trước.
- Staging thử trên máy dùng chứng chỉ tự ký: `NODE_EXTRA_CA_CERTS=<file fullchain.pem>` để Node tin chứng chỉ đó, cho cả API lẫn MQTT TLS. Không tắt kiểm tra TLS.

```bash
# 1. Thiết bị cỡ A-7, 30 cảnh báo, 10 Work Order; thợ của seed được gán làm thợ chính của mọi nhà giả lập
export SIM_TECHNICIAN_EMAIL=tech@swiftletcare.dev SIM_TECHNICIAN_PASSWORD=...
npm start -- --houses 20 --zones 3 --controllers 2 --cameras 1 --alerts 30 --work-orders 10

# 2. Trong lúc đó, NFR-03: 100 client Socket.io + 20 người dùng mở dashboard, cảnh báo, phân tích trong 5 phút
docker run --rm -i -e BASE_URL=https://<DOMAIN> -e K6_EMAIL=owner@swiftletcare.dev -e K6_PASSWORD=...   grafana/k6:1.3.0 run - < load/nfr03.k6.js
```

- **NFR-03** (`load/nfr03.k6.js`): ngưỡng `http_req_duration{scenario:api}` p(95) < 500 ms; k6 thoát mã khác 0 nếu không đạt. Các biến `SOCKETS`, `API_VUS`, `DURATION_SEC` đổi được; `INSECURE=1` khi chứng chỉ tự ký.
- **NFR-15** (`src/nfr15.js`): thợ không xác nhận cảnh báo nào, nên cả 30 cảnh báo phải leo thang. Từ phút 16, bộ giả lập đọc `escalated_at` của từng cảnh báo. (a) là `escalated_at` trừ hạn leo thang (lúc tạo + 15 phút). Sau đó thợ bắt đầu và báo xong 10 Work Order. (b) là `verified_at` trừ hạn kiểm (lúc báo xong + 10 phút). Bộ giả lập in P50, P95, max và ĐẠT/KHÔNG ĐẠT (≤ 60 s). Mốc thời gian là của backend; `escalated_at` được ghi ngay trước khi gửi push và Telegram, nên (a) không gồm thời gian FCM hay Telegram chuyển tin.

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
