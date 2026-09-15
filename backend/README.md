# SwiftletCare Backend

Node.js 20 LTS + Express 4 + TypeScript + MongoDB + EMQX (MQTT) + Socket.io. Xem `SwiftletCare_SRS.md` §3.2, §7-9.

## Chạy local

```bash
cp .env.example .env   # rồi sửa MONGODB_URI/MQTT_BROKER_URL khớp docker-compose (xem comment trong .env.example)
npm install
docker compose up -d mongodb emqx   # từ thư mục gốc repo
npm run seed             # tạo sẵn 1 User/Farm/House/Zone/SensorNode để test nhanh (không cần AUTH/FARM API)
npm run dev               # tsx watch, hot reload
```

Lưu ý dev: EMQX tự ký cert TLS trên 8883 → Node `mqtt` client mặc định reject. Dùng cổng **1883 non-TLS** cho backend ở dev (`MQTT_BROKER_URL=mqtt://localhost:1883`), đổi lại `mqtts://...:8883` + CA cert thật khi lên production.

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
- **Service throw lỗi bằng `utils/AppError.ts`** (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`) thay vì tự set status code — `middlewares/errorHandler.ts` tự bắt và format response đúng chuẩn.
- **Response envelope thống nhất** (SRS §9.0): `{ success: boolean, data?, meta?: {page,limit,total}, error?: {code, message} }`. Mọi endpoint (kể cả stub 501) đều theo format này — dùng `utils/notImplemented.ts` cho endpoint chưa code.
- **MQTT handler cũng theo nguyên tắc tương tự**: `mqtt/handlers/*.ts` chỉ parse `topicParts`/`message` rồi gọi 1 hàm service (`telemetryHandler.ts` → `telemetryService.ingestTelemetry()` là ví dụ mẫu) — không query DB trực tiếp trong handler.
- **Quyền truy cập Farm dùng chung** `utils/farmAccess.ts` (`hasFarmAccess`, `isPrimaryOwner`) — đừng viết lại logic này ở service khác, import từ đây.

### Ví dụ thêm 1 endpoint mới (theo đúng pattern)

```ts
// services/xService.ts
export async function getThing(id: string, user: CurrentUser) {
  const thing = await Thing.findById(id)
  if (!thing) throw NotFoundError('Không tìm thấy')
  if (!hasAccess(thing, user)) throw ForbiddenError('Không có quyền')
  return thing
}

// controllers/x.ts
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const thing = await xService.getThing(req.params.id, req.user)
    res.json({ success: true, data: thing })
  } catch (err) { next(err) }
}
```

## Cấu trúc thư mục

```
src/
  config/      Kết nối DB (db.ts), app Express — đăng ký middleware/route (app.ts)
  controllers/ Request/response only (xem nguyên tắc ở trên)
  services/    Business logic thật — nơi duy nhất được query DB/publish MQTT/emit socket
  models/      Mongoose schema (§8.2)
  routes/      REST endpoint (§9.1) + express-validator + RBAC (requireRole)
  middlewares/ auth (JWT+RBAC), rateLimiter, errorHandler (bắt AppError), validate
  mqtt/        client.ts (kết nối EMQX, route theo topic) + handlers/ (adapter mỏng → service)
  socket/      Socket.io realtime events (§9.3) — emit*() functions dùng từ service
  utils/       AppError, farmAccess, notImplemented, logger — helper dùng chung, không đặt logic module cụ thể ở đây
  types/       Domain enums/interfaces dùng chung (mirror ở frontend/mobile types/index.ts)
  scripts/     seed.ts — tạo dữ liệu test, không phải code chạy production
```

## Module → phạm vi

| Module | Trạng thái | Ghi chú |
| ------ | ---------- | ------- |
| AUTH | ✅ Đã code đầy đủ (`authService.ts`) | register/login/refresh/logout/OTP |
| FARM (farm/house/zone/member/sales-staff) | ✅ Đã code đầy đủ (`farmService.ts`) | |
| Device (sensor/camera node, relay control) | ✅ Đã code đầy đủ (`deviceService.ts`) | Relay control publish MQTT thật — xem ghi chú topic bên dưới |
| ENV/Telemetry (ingest MQTT, REST latest/history) | ✅ Đã code đầy đủ (`telemetryService.ts`) | |
| Heartbeat, Relay status confirm (MQTT) | ✅ Đã code đầy đủ (`deviceService.ts`) | Chưa có job tự động OFFLINE khi mất heartbeat >30s — xem TODO trong code |
| ALERT, ANALYTICS, VISION (bird-count MQTT) | ⏳ Scaffold (controller 501, handler log-only) | MVP — cần implement theo `SwiftletCare_TASK_DETAIL_Checklist.md` mục C |
| TICKET | ⏳ Scaffold (501) | MVP — §5.9 |
| MARKET (harvest/marketplace) | ⏳ Scaffold (501) | MVP (landing + form liên hệ) — §5.8 |
| SALES | ⏳ Scaffold (501) | Giai đoạn 2, stretch — §5.10 |

### ⚠️ Quan trọng — topic MQTT dùng ObjectId thật

Lệnh điều khiển (`relay/command`, `config/update`) publish tới `swiftletcare/{farmId}/{houseId}/{zoneId}/...` dùng **MongoDB ObjectId thật** của Farm/House/Zone (không phải slug tuỳ ý). Firmware (`Secrets.h`) phải được cấu hình đúng 3 ObjectId này (qua onboarding QR — FARM-FR-003, chưa code) để nhận lệnh đúng thiết bị. `deviceId` trong payload JSON (khớp `SensorNode.device_id`) mới là khoá để backend tra cứu — không dùng topic để định danh thiết bị.

## Lệnh hữu ích

```bash
npm run build   # tsc → dist/
npm run seed    # tạo User/Farm/House/Zone/SensorNode test
npm test        # Jest (unit + integration)
npm run lint
```
