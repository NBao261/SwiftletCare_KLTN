# SwiftletCare Backend

Node.js 20 LTS + Express 4 + TypeScript + MongoDB + EMQX (MQTT) + Socket.io. Xem `SwiftletCare_SRS.md` §3.2, §7-9.

## Chạy local

```bash
cp .env.example .env   # rồi sửa MONGODB_URI/MQTT_BROKER_URL khớp docker-compose (xem comment trong .env.example)
npm install
docker compose up -d mongodb emqx   # từ thư mục gốc repo
npm run seed             # tạo sẵn 1 Farm Owner + 1 Technician + Farm/House/Zone/SensorNode để test nhanh
npm run dev               # (terminal 1) tsx watch, hot reload
npm run mdns              # (terminal 2, nếu có ESP32 thật) xem mục ESP32 dưới đây — để chạy song song, không tắt
```

Lưu ý dev: EMQX tự ký cert TLS trên 8883 → Node `mqtt` client mặc định reject. Dùng cổng **1883 non-TLS** cho backend ở dev (`MQTT_BROKER_URL=mqtt://localhost:1883`), đổi lại `mqtts://...:8883` + CA cert thật khi lên production.

### Xử lý lỗi thường gặp

- **`MongoServerError: Authentication failed` (code 18) lúc bootstrap** — `.env` đang có
  user/pass (`admin:swiftletcare_dev`) khớp **container Mongo của docker-compose**, nhưng
  cổng 27017 đang bị 1 MongoDB khác chiếm (VD: MongoDB cài native trên Windows, chạy như
  Windows Service) — connection của bạn thật ra đang nói chuyện với con Mongo *đó*, không
  phải container, nên user đó không tồn tại. Kiểm tra `Get-Service | Where Name -like
  '*mongo*'` (PowerShell); nếu có service native đang `Running`, dừng nó lại rồi
  `docker compose up -d mongodb`, hoặc đổi `MONGODB_URI` sang không kèm user/pass nếu bạn
  cố tình dùng Mongo native không bật `security.authorization`.
- **Dùng MongoDB Atlas thay vì local/docker** — chỉ cần đổi `MONGODB_URI` trong `.env`
  thành connection string Atlas (`mongodb+srv://...`), nhớ **thêm tên database vào path**
  (VD: `.../swiftletcare?retryWrites=true&w=majority` — connection string Atlas copy từ
  dashboard thường không có sẵn tên DB). `.env` đã nằm trong `.gitignore`, không bao giờ
  commit credentials thật lên repo.
- **Kích hoạt ESP32 thật, thiết bị không lên `ONLINE`** — kiểm tra theo thứ tự:
  1. Chạy `npm run mdns` ở 1 terminal riêng, song song `docker compose up -d` — script này
     phát mDNS hostname `swiftletcare-broker.local` trỏ về IP LAN hiện tại của máy này, để
     ESP32 tự tìm broker (`firmware/src/mqtt/MQTTManager.cpp`, `resolveBrokerViaMdns()`)
     mà không cần biết/nhập tay IP mỗi lần đổi mạng WiFi. Nếu không chạy được (VD mạng
     công ty chặn multicast), ESP32 tự fallback về IP đã lưu qua captive portal, cuối
     cùng mới về `SECRET_MQTT_BROKER` trong `Secrets.h` — lúc đó vẫn cần lấy IP LAN bằng
     `ipconfig`/`Get-NetIPAddress` và nhập tay như trước (qua captive portal, không cần
     nạp lại firmware — xem `firmware/src/wifi/WiFiProvisioner.h`).
  2. ESP32 chỉ hỗ trợ WiFi **2.4GHz** — nếu router có tách SSID riêng cho 5GHz (tên
     thường có "5G"), phải dùng SSID 2.4GHz trong `SECRET_WIFI_SSID`, và cả 2 thiết bị
     (ESP32 + máy chạy backend/EMQX) phải ở **cùng mạng LAN**.
  3. Windows Firewall: nếu mạng WiFi đang ở profile **Public** (`Get-NetConnectionProfile`),
     mặc định chặn inbound — cần mở cổng MQTT cho LAN bằng PowerShell **admin**:
     `New-NetFirewallRule -DisplayName "SwiftletCare-MQTT-1883-dev" -Direction Inbound -Protocol TCP -LocalPort 1883 -Action Allow -Profile Any`
     (mDNS dùng UDP 5353 — nếu vẫn không tự tìm được broker dù đã chạy `npm run mdns`, mở
     thêm rule tương tự cho `-Protocol UDP -LocalPort 5353`).
  4. `SECRET_DEVICE_ID` trong `Secrets.h` phải khớp `device_id` của 1 `SensorNode` đã tồn
     tại trong DB (seed script tạo sẵn `node_001`) — backend tra thiết bị theo `deviceId`
     trong payload JSON, **không** theo farmId/houseId/zoneId trong topic MQTT (xem mục
     "Quan trọng — topic MQTT" bên dưới).

## Firmware (ESP32)

Code ở `firmware/` (PlatformIO, không phải npm) — dùng CLI `pio` (cài kèm VSCode
PlatformIO extension, hoặc `pip install platformio`):

```bash
cd firmware
cp src/config/Secrets.h.example src/config/Secrets.h   # rồi điền WiFi/MQTT/farmId thật — xem file, có hướng dẫn
pio run -e esp32dev                          # build thử, không cần cắm board (kiểm tra compile trước khi nạp)
pio run -e esp32dev --target upload          # nạp vào ESP32 qua USB (cần cắm board)
pio device monitor -b 115200                 # xem log Serial (Ctrl+C để thoát)
```

`pio run --target upload` chỉ cần chạy khi **đổi code** firmware. Đổi WiFi hoặc IP MQTT
broker (kể cả đổi mạng khác hẳn) **không cần** upload lại — xem cơ chế tự phục vụ ở mục
"Kích hoạt ESP32 thật" bên dưới (mDNS tự dò broker, hoặc captive portal nhập tay qua điện
thoại nếu mDNS không hoạt động).

## API Docs (Swagger)

Spec OpenAPI 3.0 ở `docs/api/api-spec.yaml` (gốc repo) — nguồn sự thật duy nhất, sửa file này khi thêm/đổi endpoint. Server tự đọc file này lúc boot:

- Swagger UI: `http://localhost:3000/api-docs`
- Raw YAML: `http://localhost:3000/api-docs.yaml`

Chỉ còn tag **Sales** (Giai đoạn 2 — `products`/`inventory`/`orders`/`return-requests`/
`sales-reports`) là stub thật (501); request/response schema ở đó mô tả *hợp đồng dự
kiến*, chưa có logic. Mọi tag khác (Auth, Farms, Devices, Telemetry, Alerts, Analytics,
Harvests, Marketplace, Tickets) đã có logic thật phía sau. Trạng thái chi tiết theo từng
FR (kể cả các phần vẫn thiếu/một phần) nằm ở `SwiftletCare_SRS.md` §5, cột **"Trạng thái
Backend"** — luôn kiểm tra đó trước khi giả định 1 tính năng đã xong hoàn toàn.

## Kiến trúc — Route → Controller → Service → Model

```
Request → routes/*.ts (validate + RBAC) → controllers/*.ts (parse req, gọi service, res.json)
                                                    │
                                          services/*.ts (business logic thật: query DB,
                                          check quyền, publish MQTT, emit socket, throw AppError)
                                                    │
                                          models/*.ts (Mongoose schema, §8.2)
```

**Nguyên tắc bắt buộc khi thêm/sửa code:**

- **Controller không chứa business logic.** Chỉ: lấy `req.params/body/query/user`, gọi đúng 1 hàm service, trả `res.json({success, data, meta?})`, và `catch (err) { next(err) }` — không tự viết try/catch trả lỗi thủ công.
- **Service throw lỗi bằng `utils/appError.util.ts`** (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`) thay vì tự set status code — `middlewares/errorHandler.middleware.ts` tự bắt và format response đúng chuẩn.
- **Response envelope thống nhất** (SRS §9.0): `{ success: boolean, data?, meta?: {page,limit,total}, error?: {code, message} }`. Mọi endpoint (kể cả stub 501 của module Sales) đều theo format này — dùng `utils/notImplemented.util.ts` cho endpoint chưa code.
- **MQTT handler cũng theo nguyên tắc tương tự**: `mqtt/handlers/*.ts` chỉ parse `topicParts`/`message` rồi gọi 1 hàm service (`telemetry.handler.ts` → `telemetry.service.ts`'s `ingestTelemetry()` là ví dụ mẫu) — không query DB trực tiếp trong handler.
- **Quyền truy cập Farm dùng chung** `utils/farmAccess.util.ts` (`hasFarmAccess`, `isPrimaryOwner`) — đừng viết lại logic này ở service khác, import từ đây.
- **Đặt tên file theo `<resource>.<layer>.ts`**: `farm.service.ts`, `farms.controller.ts`, `farms.route.ts`, `farm.model.ts`. Layer luôn viết đủ (`.service`/`.controller`/`.route`/`.model`/`.middleware`/`.util`/`.handler`/`.job`), không viết tắt kiểu `farmService.ts`.

### Ví dụ thêm 1 endpoint mới (theo đúng pattern)

```ts
// services/thing.service.ts
export async function getThing(id: string, user: CurrentUser) {
  const thing = await Thing.findById(id)
  if (!thing) throw NotFoundError('Không tìm thấy')
  if (!hasFarmAccess(thing, user)) throw ForbiddenError('Không có quyền')
  return thing
}

// controllers/things.controller.ts
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const thing = await thingService.getThing(req.params.id, req.user)
    res.json({ success: true, data: thing })
  } catch (err) { next(err) }
}
```

## Cấu trúc thư mục

```
src/
  config/      Kết nối DB (db.config.ts), app Express — đăng ký middleware/route (app.config.ts)
  controllers/ Request/response only (xem nguyên tắc ở trên)
  services/    Business logic thật — nơi duy nhất được query DB/publish MQTT/emit socket
  models/      Mongoose schema (§8.2)
  routes/      REST endpoint (§9.1) + express-validator + RBAC (requireRole)
  middlewares/ auth (JWT+RBAC), rateLimiter, errorHandler (bắt AppError), validate
  jobs/        node-cron background jobs (deviceOffline, alertEscalation, overrideExpiry, invitationExpiry)
  mqtt/        mqtt.client.ts (kết nối EMQX, subscribe theo wildcard, route theo topic) + handlers/ (adapter mỏng → service)
  socket/      Socket.io realtime events (§9.3) — emit*() functions dùng từ service
  utils/       appError.util, farmAccess.util, notImplemented.util, logger.util, helpers.util — helper dùng chung, không đặt logic module cụ thể ở đây
  types/       Domain enums/interfaces dùng chung (mirror ở frontend/mobile types/index.ts)
  scripts/     seed.script.ts — tạo dữ liệu test (npm run seed), không phải code chạy production
```

## Module → phạm vi

> Bảng này chỉ nêu tổng quan theo module. Muốn biết chính xác 1 FR cụ thể đã xong / một
> phần / chưa làm (và vì sao), tra `SwiftletCare_SRS.md` §5 cột "Trạng thái Backend" —
> đó là nguồn duy nhất được cập nhật ở mức chi tiết FR, bảng dưới đây dễ bị lỗi thời.

| Module | Trạng thái | Ghi chú |
| ------ | ---------- | ------- |
| AUTH | Đã code phần lớn (`auth.service.ts`) | register/login/refresh/logout/OTP/quên-đặt lại mật khẩu/lời mời/yêu cầu xoá tài khoản. **Chưa có:** 2FA, audit log, Admin khoá/mở khoá tài khoản, Admin tạo tài khoản Technician |
| FARM (farm/house/zone/member/sales-staff) | Đã code đầy đủ (`farm.service.ts`) | `GET /farms/:id` trả kèm `full_name`/`email` của owner/members (query phụ, không đổi field cũ) |
| Device (sensor/camera node, relay control) | Đã code đầy đủ (`device.service.ts`) | Relay control publish MQTT thật — xem ghi chú topic bên dưới. **Chưa có:** gỡ bỏ/thay thế/dời Zone cho thiết bị đã lắp |
| ENV/Telemetry (ingest MQTT, REST latest/history) | Đã code đầy đủ (`telemetry.service.ts`) | |
| Heartbeat, Relay status confirm (MQTT) | Đã code đầy đủ (`device.service.ts`) | Job `node-cron` mỗi 10s (`jobs/deviceOffline.job.ts`) tự chuyển OFFLINE khi mất heartbeat >30s, phát `DEVICE_STATUS_CHANGE` |
| ALERT (Alert Engine, dedup, quiet hours) | Đã code đầy đủ (`alert.service.ts`) | **Chưa nối thật:** Firebase FCM/Zalo ZNS/SMS chỉ log ở dev (`notification.service.ts`), chưa có credential |
| ANALYTICS (env summary/compare, bird-count) | Đã code đầy đủ (`analytics.service.ts`) | Nhóm bird-count/return-rate/correlation trả rỗng cho tới khi module VISION (Edge AI, chưa lắp phần cứng) có dữ liệu thật — không phải lỗi |
| TICKET | Đã code phần lớn (`ticket.service.ts`) | Tạo/định tuyến/SLA/SAT checklist/KPI/huỷ/đánh giá đã xong. **Chưa có:** job tự tạo ticket MAINTENANCE theo lịch, endpoint Admin sửa toàn quyền 1 ticket |
| MARKET (harvest/marketplace) | Đã code đầy đủ (`market.service.ts`) | Farm Owner: tạo Harvest Batch (tự gắn snapshot), đăng bán, xem thống kê/liên hệ. `HarvestBatch.listing_id` được set khi tạo Listing để tra lại sau |
| SALES | Scaffold (501) | Giai đoạn 2, stretch — §5.10, chưa bắt buộc nghiệm thu |

### Quan trọng — topic MQTT dùng ObjectId thật

Lệnh điều khiển (`relay/command`, `config/update`) publish tới `swiftletcare/{farmId}/{houseId}/{zoneId}/...` dùng **MongoDB ObjectId thật** của Farm/House/Zone (không phải slug tuỳ ý). Firmware (`Secrets.h`) nên được cấu hình đúng 3 ObjectId này (Technician lấy từ Web Console sau khi `POST /devices/sensor-nodes/register` — FARM-FR-003, đã code) để nhận lệnh đúng thiết bị — tuy nhiên **không bắt buộc để backend nhận được telemetry/heartbeat**: `deviceId` trong payload JSON (khớp `SensorNode.device_id`) mới là khoá backend dùng để tra cứu (topic chỉ dùng để subscribe theo wildcard `+/+/+`, không dùng để định danh thiết bị) — xem `mqtt/mqtt.client.ts` (`TOPICS`) và `mqtt/handlers/*.ts`.

## Lệnh hữu ích

```bash
npm run build   # tsc → dist/
npm run seed    # tạo User/Farm/House/Zone/SensorNode test
npm run mdns    # phát mDNS "swiftletcare-broker.local" cho ESP32 tự dò broker (chạy song song docker-compose)
npm test        # Jest (unit + integration)
npm run lint
```
