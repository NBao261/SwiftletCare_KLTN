# SwiftletCare Backend

Node.js 22 + Express 4 + TypeScript + MongoDB + EMQX (MQTT) + Socket.io. Yêu cầu: Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md)); thiết kế: Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.3, §6–7). Hai Report thắng `SwiftletCare_SRS.md` khi lệch nhau.

> **Phạm vi sau Review 1.** Khác so với bản v1.24.0:
>
> - Role `DOMAIN_EXPERT` thay `FARM_OPERATOR`, phạm vi cả farm (không còn `zone_ids`, `operatorZoneScope`, `applyZoneScope`, `PUT /farms/:id/members/:userId`). Chuyên gia chỉ đọc dữ liệu vận hành, sửa ngưỡng/hệ số/tham số phát hiện, kiểm chứng cảnh báo, viết kết luận — không relay, ticket, ghi thu hoạch hay xác nhận cảnh báo (Report 3 §2.4).
> - Không còn Marketplace; `services/harvest.service.ts` chỉ ghi nhận thu hoạch.
> - Không còn relay `heating`. NH3/CO2 chỉ cảnh báo: `utils/fuzzyModel.util.ts` khớp firmware 1.3.0, breach NH3/CO2 mức MEDIUM và không sinh ticket.
> - `NOISE_ANOMALY` thay `BIRD_PANIC` (firmware cũ gửi tên cũ vẫn nhận); `alerts.expert_verdict`, `PUT /alerts/:id/verdict`, `GET /alerts/verdict-stats`.
> - `zones.detection_tuning` + `PUT /farms/zones/:zoneId/detection-tuning` (EXPERT-FR-008); 5 tham số gửi xuống ESP32 qua `config/update`.
> - `relay_override_logs` + `GET /devices/sensor-nodes/:id/relay-overrides`, `GET /analytics/autonomy`.
> - `zone_health_reports`, job `healthReport.job.ts` và `/health-reports`.
> - Kênh ngoài ứng dụng chạy thật: Telegram bot (`services/telegram.service.ts`, cần `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME`). Firebase FCM vẫn chỉ ghi log dù Report 3 cam kết cả hai kênh (ALERT-FR-002); Zalo/SMS không làm.
>
> **Report 3 còn đòi hỏi thêm** những việc backend chưa làm — mỗi việc một dòng ở [`docs/reports/README.md`](../docs/reports/README.md) mục "Chỗ lệch": quyền theo §2.4 (Technician/Admin không sửa ngưỡng và hệ số; Technician không can thiệp tay, không xác nhận cảnh báo; bỏ ticket, SLA, vùng của Technician), Farm Owner tự setup thiết bị bằng QR (MF-10), `DISMISSED`, farm chưa có chuyên gia thì chủ farm quyết (BR-22), báo chủ farm mọi quyết định của chuyên gia (EXPERT-FR-009), duyệt thay đổi và đề xuất hệ số (EXPERT-FR-010/011), version cấu hình và `CONFIG_MISMATCH` (ENV-FR-027), gói bằng chứng (ALERT-FR-014), lịch đếm theo mùa và phiên không đầy đủ (VISION-FR-019/020).
>
> **DB đang chạy bản cũ:** chạy `npm run migrate:scope-v2` một lần sau khi deploy (đổi role, bỏ `zone_ids`, đổi tên loại cảnh báo, gỡ dữ liệu Marketplace).
>
> **Đếm chim:** backend đã nhận số đếm từ `vision/bird-count`, lưu số đếm 5 phút, chạy job `LOW_RETURN_RATE` và cấp stream token của camera; còn chờ `ai-pipeline` gửi dữ liệu thật (`docs/bird-counting-plan.md`). Lịch đếm theo mùa và phiên không đầy đủ của Report 3 (VISION-FR-019/020) chưa làm.

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

Mọi tag (Auth, Admin, System, Farms, Devices, Telemetry, Alerts, Analytics, Harvests,
HealthReports, Tickets) đều có logic thật phía sau. Quyền theo farm kiểm tra ở
`utils/farmAccess.util.ts`; quyền theo role ở `requireRole` của từng route. Những FR của Report 3 mà code
chưa đáp ứng nằm ở `docs/reports/README.md` (mục "Chỗ lệch") và Report 4 §12 — luôn kiểm tra
đó trước khi giả định 1 tính năng đã xong hoàn toàn.

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

- **Controller không chứa business logic.** Chỉ: lấy `req.params/body/query/user`, gọi đúng 1 hàm service, trả `res.json({success, data, meta?})`. Mọi handler bọc trong `asyncHandler` (`utils/asyncHandler.util.ts`, tự chuyển lỗi sang `next`) — không tự viết `try { … } catch (err) { next(err) }`, không tự format lỗi trong controller.
- **Service throw lỗi bằng `utils/appError.util.ts`** (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`) thay vì tự set status code — `middlewares/errorHandler.middleware.ts` tự bắt và format response đúng chuẩn.
- **Response envelope thống nhất** (Report 4 §7.1): `{ success: boolean, data?, meta?: {page,limit,total}, error?: {code, message} }`. Mọi endpoint đều theo format này.
- **MQTT handler cũng theo nguyên tắc tương tự**: `mqtt/handlers/*.ts` chỉ parse `topicParts`/`message` rồi gọi 1 hàm service (`telemetry.handler.ts` → `telemetry.service.ts`'s `ingestTelemetry()` là ví dụ mẫu) — không query DB trực tiếp trong handler.
- **Quyền truy cập Farm dùng chung** `utils/farmAccess.util.ts` (`hasFarmAccess`, `isPrimaryOwner`, `assertFarmAccess`, `assertZoneAccess`, `assertZoneInFarm`, `findFarmOrThrow`, `findZoneChainOrThrow`, `listAccessibleFarmIds`/`listAccessibleZoneIds`) — đừng viết lại logic này ở service khác, import từ đây.
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
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const thing = await thingService.getThing(req.params.id, req.user)
  res.json({ success: true, data: thing })
})
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
  jobs/        node-cron background jobs — danh sách và lịch chạy ở `backend/CLAUDE.md` (bảng Background jobs)
  mqtt/        mqtt.client.ts (kết nối EMQX, subscribe theo wildcard, route theo topic) + handlers/ (adapter mỏng → service)
  socket/      Socket.io realtime events (§9.3) — emit*() functions dùng từ service
  utils/       appError.util, farmAccess.util, logger.util, helpers.util — helper dùng chung, không đặt logic module cụ thể ở đây
  types/       Domain enums/interfaces dùng chung (mirror ở frontend/mobile types/index.ts)
  scripts/     seed.script.ts — tạo dữ liệu test (npm run seed), không phải code chạy production
```

## Module → phạm vi

> Bảng này chỉ nêu tổng quan theo module. Muốn biết 1 FR cụ thể còn thiếu gì so với
> Report 3, tra `docs/reports/README.md` mục "Chỗ lệch" — bảng dưới đây dễ bị lỗi thời.
> (Cột "Trạng thái Backend" của `SwiftletCare_SRS.md` §5 không còn được cập nhật.)

| Module | Trạng thái | Ghi chú |
| ------ | ---------- | ------- |
| AUTH | Đã code đầy đủ (`auth.service.ts`, `admin.service.ts`) | register/login/refresh/logout/OTP/quên-đặt lại mật khẩu/lời mời/yêu cầu xoá tài khoản; audit log, Admin khoá/mở khoá tài khoản, Admin tạo tài khoản Technician. **Chưa có:** gửi OTP qua email thật (SMTP, mới ghi log). 2FA ngoài phạm vi (Report 3 §8) |
| FARM (farm/house/zone/member) | Đã code đầy đủ (`farm.service.ts`) | `GET /farms/:id` trả kèm `full_name`/`email` của owner/members (Domain Expert chỉ nhận bản ghi của chính mình). Mời đồng sở hữu hoặc Domain Expert (`role`); tham số phát hiện theo Zone (`PUT /farms/zones/:zoneId/detection-tuning`, chỉ Domain Expert) |
| Device (sensor/camera node, relay control) | Đã code (`device.service.ts`, `provisionedDevice.service.ts`) | Đăng ký từ kho thiết bị, gỡ/thay/dời Zone khi online, lệnh từ xa và OTA; relay control publish MQTT thật — xem ghi chú topic bên dưới. **Report 3 còn thiếu:** Farm Owner tự đăng ký/dời/gỡ bằng QR (MF-10), dời thiết bị đang offline, cấp lại khoá cho thiết bị đã kích hoạt một lần (FARM-FR-007b, 010) |
| ENV/Telemetry (ingest MQTT, REST latest/history) | Đã code đầy đủ (`telemetry.service.ts`) | |
| Heartbeat, Relay status confirm (MQTT) | Đã code đầy đủ (`device.service.ts`) | Job `node-cron` mỗi 10s (`jobs/deviceOffline.job.ts`) tự chuyển OFFLINE khi mất heartbeat >30s, phát `DEVICE_STATUS_CHANGE` |
| ALERT (Alert Engine, dedup, quiet hours) | Đã code đầy đủ (`alert.service.ts`) | Telegram bot gửi thật khi có `TELEGRAM_BOT_TOKEN` (`telegram.service.ts`); kiểm chứng của Domain Expert (`PUT /alerts/:id/verdict`). **Chưa nối:** Firebase FCM (chỉ log; Report 3 bắt buộc, ALERT-FR-002); Zalo/SMS ngoài phạm vi. **Report 3 còn thiếu:** trạng thái `DISMISSED`, gói bằng chứng (ALERT-FR-014) |
| ANALYTICS (env summary/compare, bird-count) | Đã code đầy đủ (`analytics.service.ts`) | Nhóm bird-count/return-rate/correlation trả rỗng cho tới khi module VISION (Edge AI, chưa lắp phần cứng) có dữ liệu thật — không phải lỗi |
| TICKET | Đã code đầy đủ (`ticket.service.ts`, `maintenanceSchedule.service.ts`) | Tạo/định tuyến/SLA/SAT checklist/KPI/huỷ/đánh giá, bảo trì định kỳ tự sinh ticket, Admin can thiệp mọi ticket. **Ra ngoài phạm vi** (Report 3 §8, BM03 #9): chỉ được gỡ, không mở rộng |
| HARVEST (ghi nhận thu hoạch) | Đã code đầy đủ (`harvest.service.ts`) | Farm Owner tạo/sửa/xoá mềm Harvest Batch (tự gắn snapshot môi trường + đàn chim, `trace_code`); Domain Expert chỉ xem. Marketplace ngoài phạm vi (Report 3 §8) |
| EXPERT (báo cáo sức khỏe Zone) | Đã code đầy đủ (`healthReport.service.ts`) | Job tổng hợp theo chu kỳ (`HEALTH_REPORT_CRON`, mặc định thứ Hai 06:00), xem theo khoảng bất kỳ, Domain Expert viết kết luận, Farm Owner được báo |
| Lịch sử can thiệp tay + tỷ lệ tự động | Đã code đầy đủ (`relayOverrideLog.service.ts`) | Ghi ở mọi đường override bắt đầu/kết thúc; `GET /analytics/autonomy` |

### Quan trọng — topic MQTT dùng ObjectId thật

Lệnh điều khiển (`relay/command`, `config/update`) publish tới `swiftletcare/{farmId}/{houseId}/{zoneId}/...` dùng **MongoDB ObjectId thật** của Farm/House/Zone (không phải slug tuỳ ý). Không ai phải nhập 3 ObjectId này vào thiết bị (FARM-FR-003c): thiết bị khởi động với định danh đang lưu (`Secrets.h` hoặc NVS), và khi heartbeat tới trên topic khác Zone đã đăng ký, `recordHeartbeat` tự gửi `config/reassign` với định danh đúng, thiết bị lưu NVS rồi khởi động lại trên topic của Zone. Việc tra cứu thiết bị cũng không dựa vào topic: `deviceId` trong payload JSON (khớp `SensorNode.device_id`) mới là khoá backend dùng để tra cứu (topic chỉ dùng để subscribe theo wildcard `+/+/+`, không dùng để định danh thiết bị) — xem `mqtt/mqtt.client.ts` (`TOPICS`) và `mqtt/handlers/*.ts`.

## Lệnh hữu ích

```bash
npm run build   # tsc → dist/
npm run seed    # tạo User/Farm/House/Zone/SensorNode test
npm run mdns    # phát mDNS "swiftletcare-broker.local" cho ESP32 tự dò broker (chạy song song docker-compose)
npm run migrate:data-model  # chạy 1 lần TRƯỚC khi deploy SRS v1.23.0: điền zones.farm_id, băm refresh token, tạo index mới (chạy lại vẫn an toàn)
npm run migrate:scope-v2    # chạy 1 lần sau khi deploy SRS v2: FARM_OPERATOR → DOMAIN_EXPERT, bỏ zone_ids, BIRD_PANIC → NOISE_ANOMALY, gỡ dữ liệu Marketplace/sưởi (chạy lại vẫn an toàn)
npm test        # Jest (unit + integration)
npm run lint
```
