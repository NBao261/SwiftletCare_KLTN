# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SwiftletCare — IoT monitoring + automation system for swiftlet (yến) houses (KLTN/thesis project, FA26, FPT University). Modules, each independent (no root `package.json`/workspace):

- `firmware/` — ESP32 (PlatformIO): RS485 sensors, PID relay control, MQTT, lullaby speaker.
- `backend/` — Node.js + Express + TypeScript + MongoDB + MQTT (EMQX) + Socket.io.
- `frontend/` — React 18 + Vite + TailwindCSS web dashboard/PWA.
- `mobile/` — Expo (Router, file-based routes) + React Native app, talks to the same backend API.
- `ai-pipeline/` — Raspberry Pi 4, YOLOv8 (ONNX Runtime) + ByteTrack. **Scaffold only, not implemented/deployed** — `models/` (ONNX weights) is intentionally empty.
- `docs/` — `docs/api/api-spec.yaml` is the OpenAPI 3.0 **source of truth** for the API contract; the backend reads it at boot and serves Swagger UI at `/api-docs`. Routes are unprefixed (no `/api/v1`, despite what the SRS narrative implies).

**`SwiftletCare_SRS.md` §5, column "Trạng thái Backend"** is the single source of truth for per-requirement (FR) completion status — check it before assuming any feature is fully done. Module-level status tables in `backend/README.md`/`frontend/README.md` go stale faster.

Known repo quirks worth knowing before you go looking for something:
- `docs/db/mongo-init.js` is actually an **empty directory**, not a file, even though `docker-compose.yml` bind-mounts it as Mongo's `/docker-entrypoint-initdb.d/init.js` — the DB init hook is effectively a silent no-op.
- `docs/hardware/circuit-diagram/` and `docs/hardware/prototype-photos/` are empty placeholders; `docs/test-reports/` only has a `.gitkeep`.
- `frontend/src/components/{alerts,analytics,charts,dashboard,devices}/` are empty — those features are built directly inside the matching `pages/**` folder, not as reusable components (yet).

## Commands

### Backend (`backend/`)

```bash
npm run dev          # tsx watch, hot reload — needs docker compose (mongodb, emqx) running
npm run build        # tsc -> dist/
npm run build:check  # tsc --noEmit (type-check only)
npm test             # jest --coverage (unit + integration)
npm run test:unit    # jest tests/unit --coverage
npm run test:int     # jest tests/integration
npx jest path/to/file.test.ts   # single test file
npm run lint         # eslint src/**/*.ts
npm run seed         # seed 1 Farm Owner + 1 Technician + Farm/House/Zone/SensorNode
npm run mdns         # publish mDNS "swiftletcare-broker.local" so a real ESP32 can auto-discover the broker (run alongside npm run dev)
```

Dev EMQX self-signs its TLS cert on 8883, which the Node `mqtt` client rejects by default — backend dev config must point at **`mqtt://localhost:1883`** (non-TLS), switching to `mqtts://...:8883` + a real CA cert only in production.

### Frontend (`frontend/`)

```bash
npm run dev      # http://localhost:5173, Vite proxies /api -> backend :3000 and /socket.io (ws:true) (no manual CORS)
npm run build    # tsc && vite build
npm run lint     # eslint src --ext ts,tsx
npm test         # vitest
```

### Mobile (`mobile/`)

Expo app; points at `localhost:3000` by default (`constants/api.ts`). Scripts: `start`/`android`/`ios` (Expo), `eas build` profiles (dev/preview/prod via `eas.json`), `lint`, `jest`, `typecheck`.

### Firmware (`firmware/`, PlatformIO — not npm)

```bash
pio run -e esp32dev                      # build only, no board needed
pio run -e esp32dev --target upload      # flash over USB (only needed when firmware code changes)
pio device monitor -b 115200             # serial log
pio test -e native                       # host-side unit tests, no board needed
pio run -e modbus_scan                   # standalone RS485 slave-ID/baudrate scan tool (test_noise_rs485.cpp only, not part of main.cpp build)
```

Changing WiFi/broker network does **not** require reflashing — the device re-discovers the broker via mDNS, then falls back to captive-portal manual entry, then to the compiled `Secrets.h` default (see `firmware/src/wifi/WiFiProvisioner.h`, `resolveBrokerViaMdns()` in `firmware/src/mqtt/MQTTManager.cpp`).

### Infra (repo root)

```bash
docker compose up -d mongodb emqx        # add minio, redis if needed
```

## Architecture

### Backend: Route → Controller → Service → Model

```
routes/*.ts (express-validator + requireRole)
  → controllers/*.ts (parse req, call exactly one service fn, res.json)
      → services/*.ts (the only layer that queries DB, checks permissions, publishes MQTT, emits socket events, throws AppError)
          → models/*.ts (Mongoose schemas)
```

Binding rules when adding/editing backend code:

- **Controllers never contain business logic** — just read `req.params/body/query/user`, call one service function, return `res.json({success, data, meta?})`, and `catch (err) { next(err) }` (no manual try/catch error formatting).
- **Services throw via `utils/appError.util.ts`** (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`); `middlewares/errorHandler.middleware.ts` is the only place that turns those into HTTP responses.
- **Every response follows the envelope** `{ success, data?, meta?: {page,limit,total}, error?: {code, message} }` — including 501 stubs (via `utils/notImplemented.util.ts`) for the not-yet-built Sales module. `utils/helpers.util.ts#paginate()` normalizes `page`/`limit` (default 20, max 100) into that `meta` shape consistently across list endpoints.
- **MQTT handlers (`mqtt/handlers/*.ts`) are thin adapters**: parse `topicParts`/`message`, call one service function (e.g. `telemetry.handler.ts` → `telemetry.service.ts#ingestTelemetry()`), never query the DB directly.
- **Farm access checks always go through `utils/farmAccess.util.ts`** (`hasFarmAccess`, `isPrimaryOwner`) — don't reimplement this in another service.
- **File naming**: `<resource>.<layer>.ts` with the layer spelled out in full — `farm.service.ts`, `farms.controller.ts`, `farms.route.ts`, `farm.model.ts` (never `farmService.ts`).

**Express middleware order** (`config/app.config.ts`): `helmet()` → `cors({origin: CORS_ORIGIN ?? http://localhost:5173, credentials: true})` → `rateLimiter` (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, default 100 req/60s) → `morgan('combined')` → `express.json({limit:'10mb'})` → `urlencoded` → `cookieParser()` → `/health` → Swagger (`/api-docs`, spec loaded from `docs/api/api-spec.yaml` inside a try/catch — a missing spec just logs a warning, doesn't crash boot) → ~15 domain routers → 404 handler → `errorHandler` (must stay last). `config/db.config.ts#connectDB()` requires `MONGODB_URI` and connects with `maxPoolSize: 10`.

**Models** (`src/models/*.ts`, one per file): `user`, `farm` (+ embedded members), `houseZone` (House + Zone, with threshold history), `device` (SensorNode + CameraNode), `telemetry`, `alert`, `auditLog`, `invitation`, `ticket`, `harvestBatch`, `nestListing`, `birdCountRecord`, `contactInquiry`, plus Sales-module scaffolding (`product`, `inventory`, `order`, `orderItem`, `returnRequest`, `shipment`, `salesAssignment`).

**Background jobs** (`src/jobs/*.ts`, `node-cron`):
| Job | Schedule | Does |
|---|---|---|
| `deviceOffline.job.ts` | every 10s | flips `SensorNode`s with a stale heartbeat (>30s) from ONLINE→OFFLINE, emits `DEVICE_STATUS_CHANGE` |
| `overrideExpiry.job.ts` | every 1 min | reverts relays whose manual override expired back to AUTO mode |
| `alertEscalation.job.ts` | every 2 min | auto-creates a ticket for CRITICAL/HIGH alerts left unacknowledged >15 min |
| `invitationExpiry.job.ts` | hourly | marks invitations older than 7 days as EXPIRED |

**Socket.io** (`src/socket/index.ts`): JWT-authenticated in `io.use` (verifies `socket.handshake.auth.token` against `JWT_ACCESS_SECRET`). Clients `JOIN_ZONE`/`LEAVE_ZONE` to join room `zone:${zoneId}`. Services never touch `io` directly — they call exported helpers `emitTelemetryUpdate`, `emitRelayUpdate`, `emitBirdCountUpdate`, `emitAlertNew`, `emitDeviceStatusChange`, each of which does `io.to('zone:'+zoneId).emit(EVENT, data)`.

**Alert Engine** (`alert.service.ts`): `createAlert()` is the single entry point (called from MQTT ingestion, threshold checks, offline detection). It dedups by looking for an existing `ACTIVE` alert with the same `farm_id + zone_id + type` created within a 5-minute window — a hit returns `null` instead of inserting a duplicate. Otherwise it applies a default severity per `AlertType` (unless overridden), saves the alert, emits `ALERT_NEW`, and fires-and-forgets `dispatchAlertNotification()` (push/Zalo/SMS + quiet-hours logic in `notification.service.ts`) so a slow notification channel never blocks the write.

**Auth/token handling** (`auth.service.ts` + `auth.route.ts`): endpoints are `register/login/refresh/logout/otp/send/otp/verify/forgot-password/reset-password/notification-preferences/delete-request` (invitation accept/decline lives in `invitations.route.ts`). Access token: short-lived JWT (`JWT_ACCESS_TTL`, default 15m), returned in the JSON body, checked by `authenticate` middleware and by Socket.io's `io.use`. Refresh token (`JWT_REFRESH_TTL`, default 30d): set as an **httpOnly cookie** (`secure` in prod, `sameSite: 'strict'`) *and* persisted in `user.refresh_tokens[]` so it's individually revocable — `/refresh` validates both the JWT and DB presence before issuing a new access token; `resetPassword` wipes the whole array (forces logout everywhere). OTP/reset codes are 6-digit, SHA-256-hashed before storage; in dev they're just `console.log`'d (SMTP/Zalo ZNS integration is a TODO, `notification.service.ts`).

MQTT topics (`swiftletcare/{farmId}/{houseId}/{zoneId}/...`, used for `relay/command` and `config/update`) use the real MongoDB ObjectId of Farm/House/Zone. This matters for firmware provisioning, but **not** for backend ingestion: telemetry/heartbeat lookups key off `deviceId` inside the JSON payload (matching `SensorNode.device_id`), not the topic segments — the topic is only used for wildcard subscription (`mqtt/mqtt.client.ts`, `TOPICS`).

Backend roles (`Role` in `backend/src/types/domain.types.ts`): `ADMIN | FARM_OWNER | TECHNICIAN | SALES_STAFF`, enforced with `requireRole(...)` (`middlewares/auth.middleware.ts`).

Key `.env` vars by category (see `backend/.env.example` for full list/comments): app (`NODE_ENV`, `PORT`), DB (`MONGODB_URI`, `MONGODB_TEST_URI`), auth (`JWT_ACCESS_SECRET/TTL`, `JWT_REFRESH_SECRET/TTL`), MQTT (`MQTT_BROKER_URL`, `MQTT_USERNAME/PASSWORD`, `MQTT_CA_CERT_PATH`), CORS (`CORS_ORIGIN`), object storage (`MINIO_*`), push/email/Zalo (`FIREBASE_*`, `SMTP_*`, `ZALO_*`), rate limiting (`RATE_LIMIT_WINDOW_MS/MAX`).

### Frontend: pages organized by role ownership, not by feature

`frontend/src/pages/` is split into `Admin/`, `FarmOwner/`, `SalesStaff/`, `Public/`, `Shared/` (multi-role) — not one folder per route. Route-level access control lives in `App.tsx`, which lazy-loads each page and wraps it in `<RequireRole allow={...}>` (`components/auth/RequireRole.tsx`, redirects to `/403`) using role groups defined there (`OPS_ROLES = [FARM_OWNER, TECHNICIAN, ADMIN]`, `FARM_OWNER_ONLY`, or an inline list) — check `App.tsx` for the authoritative allow-list per route, since a page's folder (e.g. `Shared/`) doesn't by itself tell you which roles can reach it. `hooks/usePermission.ts` does the equivalent role checks for UI-level hide/disable (not routing).

Other structure:

- `components/common/` — shared widgets (`RelayToggle`, `SensorCard`, `ThresholdsModal`, `ZonePicker`, `Pagination`, `ConfirmModal`, `Toast`, etc.); `components/ui/` — design-system primitives (`Button`, `Card`, `Modal`, `Select`, ...); `components/layout/` — app shell (`MainLayout` mounts the global `useAlertNotifications` socket listener, plus `Sidebar`/`TopBar`/`MobileDock`/`ZoneSwitcher`/`navItems.tsx` for role-based nav).
- `services/api/*.ts` — one file per resource. `client.ts`'s Axios instance (`withCredentials: true`) attaches `Authorization` from `authStore` on request; on a 401 with `error.code === 'TOKEN_EXPIRED'` it does a **single-flight** refresh (concurrent 401s share one `POST /auth/refresh` promise) and retries once, or clears auth + redirects to `/login` (via `utils/navigation.ts`) if refresh fails.
- `services/socket.ts` — lazy singleton socket (`autoConnect: false`, lifecycle owned by `hooks/useSocket.ts`); `auth` is a callback re-read on every (re)connect so a refreshed token is always used; exposes `joinZone`/`leaveZone` plus `on*Update`/`onAlertNew` subscribers mirroring the backend's `emit*()` events.
- `services/queryClient.ts` — singleton React Query client (`staleTime: 30s`, `retry: 1`) kept outside the React tree so the axios interceptor can clear its cache on logout/failed refresh.
- `hooks/*` — one file per resource wrapping `services/api` in React Query (`useAlerts`, `useDevices`, `useFarms`, `useTickets`, `useTelemetry` (REST latest + live socket updates with a staleness timeout), `useHarvests`, `useMarketplace`, `useInvitations`, `useAnalytics`) plus `usePaginatedListQuery` (generic wrapper for the `{data, meta}` envelope). `useBirdCount` is a stub returning hardcoded zeros pending the Vision/AI module.
- `store/` — Zustand: `authStore`, `alertStore`, `toastStore`, `zoneStore`.
- Dev proxy (`vite.config.ts`): `/api` → `localhost:3000` (strip prefix), `/socket.io` → same target with `ws: true`. `vite-plugin-pwa` (`registerType: 'autoUpdate'`) caches static assets and does `NetworkFirst` runtime caching for the `api.swiftletcare.vn` API host.

`frontend/src/types/index.ts` and `backend/src/types/domain.types.ts` keep their **enums** in sync (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`, etc.) but are **not** a generated/shared mirror — frontend defines client-facing entity interfaces + socket payload types, backend defines its own DTOs/JWT payload/API-envelope types (plus Sales-only enums like `OrderStatus`/`PaymentStatus` absent on the frontend). Don't assume renaming a field in one automatically applies to the other.

Both `backend` and `frontend` use the `@/*` → `src/*` path alias.

### Mobile (`mobile/`)

Expo Router (file-based routing) under `mobile/app/`: `(auth)` group (login/register) and `(tabs)` group (dashboard/alerts/analytics/farms/tickets/settings), plus detail routes `farm/[farmId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`, `ticket/[ticketId]`, `livestream/[zoneId]`. `components/` mirrors the same domain areas as web. Talks to the **same backend**, unprefixed routes (`constants/api.ts`'s `ENDPOINTS` map matches `docs/api/api-spec.yaml`). React Query + Zustand + axios + socket.io-client, same overall pattern as the web frontend; storage via `react-native-mmkv`, charts via `victory-native`.

### Firmware: FreeRTOS, 3 tasks

```
sensors/  SensorManager — 5 RS485 Modbus sensors (RX GPIO16 / TX GPIO17, 4800bps, slave IDs 1-5: noise/CO2/NH3/light/temp+humidity)
pid/      PIDController — closed-loop on/off control for 4 relays (misting/speaker/ventilation/heating) + threat flags
audio/    AudioManager — DFPlayer Mini lullaby playback on schedule
mqtt/     publish telemetry/heartbeat/relay-status, subscribe to command topics
storage/  NVS (config) + SPIFFS (offline buffering)
main.cpp  SensorTask / PIDTask / MQTTTask
```

`config/Config.h`/`.cpp` holds default thresholds (temp 26–31°C, humidity 75–95%, light max 0.2, NH3 max 25ppm, CO2 max 1500ppm) and the lullaby schedule (default windows 05–07h/17–19h) — all runtime-overridable via MQTT `config/update` and persisted to NVS, so editing these defaults in code only affects first boot. `platformio.ini` defines three envs: `esp32dev` (default, full firmware), `modbus_scan` (standalone RS485 slave-ID/baudrate scanner, `test_noise_rs485.cpp` only — not part of the `esp32dev` build), `native` (host-side unit tests, no hardware).

### AI pipeline (`ai-pipeline/`) — scaffold, not deployed

`src/stream.py` (RTSP loop) → `inference.py` (YOLOv8 via ONNX Runtime) → `tracker.py` (ByteTrack) → `counting.py` (line-crossing entry/exit) → `alert_publisher.py` (MQTT). `config/config.yaml` covers RTSP source, model thresholds, 4 detection classes (swiftlet/rat/snake/owl) with a separate predator confidence floor, MQTT (TLS 8883), MinIO snapshot upload, and morning/evening session windows. `models/` is intentionally empty — ONNX weights are not committed.

### Module completion status (see SRS §5 for FR-level detail)

AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, and Harvest/Marketplace all have real backend logic behind them. **SALES is a 501 scaffold only** (Phase 2/stretch) — its request/response schemas in the OpenAPI spec describe the intended contract, not working behavior. **Vision/AI (bird-count)** is likewise not wired up end-to-end: `ai-pipeline` isn't deployed and `useBirdCount` on the frontend is a hardcoded stub.

## Conventions

- Commit messages follow Conventional Commits with a project-specific `type`/`scope` enum enforced by commitlint (`.commitlintrc.json`). CI (`.github/workflows/ci.yml`) validates them via `wagoid/commitlint-github-action`, plus runs a gitleaks secret scan; lint/test CI jobs are still commented-out placeholders, not yet active — `npm run lint`/`npm test` must be run locally.
