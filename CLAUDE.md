# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SwiftletCare — IoT monitoring + automation system for swiftlet (yến) houses (KLTN/thesis project, FA26, FPT University). Modules, each independent (no root `package.json`/workspace):

- `firmware/` — ESP32 (PlatformIO): RS485 sensors, PID relay control, MQTT, lullaby speaker.
- `backend/` — Node.js + Express + TypeScript + MongoDB + MQTT (EMQX) + Socket.io.
- `frontend/` — React 18 + Vite + TailwindCSS web dashboard/PWA.
- `mobile/` — Expo (Router, file-based routes) + React Native app, talks to the same backend API.
- `ai-pipeline/` — Raspberry Pi 4, YOLOv8 (ONNX Runtime) + ByteTrack. **Scaffold only, not implemented/deployed** — there is no `models/` folder; ONNX weights are never committed.
- `docs/` — `docs/api/api-spec.yaml` is the OpenAPI 3.0 **source of truth** for the API contract; the backend reads it at boot and serves Swagger UI at `/api-docs`. Routes are unprefixed (no `/api/v1`, despite what the SRS narrative implies).

**`SwiftletCare_SRS.md` §5, column "Trạng thái Backend"** is the single source of truth for per-requirement (FR) completion status — check it before assuming any feature is fully done. Module-level status tables in `backend/README.md`/`frontend/README.md` go stale faster.

Known repo quirks worth knowing before you go looking for something:
- `docs/db/` does not exist in the repo, yet `docker-compose.yml` bind-mounts `./docs/db/mongo-init.js` as Mongo's `/docker-entrypoint-initdb.d/init.js` — Docker creates an empty directory there on first `up`, so the DB init hook is a silent no-op.
- `docs/hardware/` only has `BOM.md` (no circuit diagram or prototype photos); `docs/test-reports/` only has a `.gitkeep`.

### Per-module rules

Each module has its own lead and its own rules. Judge a change only against the rules of the module it lives in — never apply frontend folder/naming rules to backend code or vice versa. Rule sources, in precedence order (a rule file inside the module, e.g. `backend/CLAUDE.md`, wins over this file if one is added):

| Module | Rule sources |
|---|---|
| `backend/` | "Backend" section below · `backend/README.md` · `backend/.eslintrc.cjs` · `docs/api/api-spec.yaml` (API contract) |
| `frontend/` | `frontend/FE_Design_Claude.md` (design tokens, components, i18n, mock-data policy, §12 folder structure + file naming) · "Frontend" section below · `frontend/README.md` · `frontend/.eslintrc.cjs` |
| `mobile/` | "Mobile" section below · `mobile/README.md` |
| `firmware/` | "Firmware" section below · `firmware/README.md` |
| `ai-pipeline/` | "AI pipeline" section below · `ai-pipeline/README.md` |

Repo-wide: commit messages (`.commitlintrc.json`) and the PR template (`.github/pull_request_template.md`).

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
npm run migrate:retention  # sync TTL/indexes to the schema on an existing DB + merge duplicate open alerts (idempotent; rerun after changing a TTL — Mongoose won't alter an existing TTL index)
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
pio test -e native                       # host-side unit tests, no board needed (env defined, but no firmware/test/ suite exists yet)
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

- **Controllers never contain business logic** — just read `req.params/body/query/user`, call one service function, return `res.json({success, data, meta?})`. Wrap every handler in `asyncHandler` (`utils/asyncHandler.util.ts`, which forwards rejections to `next`) instead of writing `try { … } catch (err) { next(err) }` by hand — never format errors in the controller.
- **Services throw via `utils/appError.util.ts`** (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`); `middlewares/errorHandler.middleware.ts` is the only place that turns those into HTTP responses.
- **Every response follows the envelope** `{ success, data?, meta?: {page,limit,total}, error?: {code, message} }` (`meta` is pagination on list endpoints; a non-list endpoint may add an advisory hint there, e.g. `PUT /admin/users/:id/status` returns `meta.openTickets` when locking a Technician who still has assigned tickets) — including 501 stubs (via `utils/notImplemented.util.ts`) for the not-yet-built Sales module. `utils/helpers.util.ts#paginate()` normalizes `page`/`limit` (default 20, max 100) into that `meta` shape consistently across list endpoints.
- **MQTT handlers (`mqtt/handlers/*.ts`) are thin adapters**: parse `topicParts`/`message`, call one service function (e.g. `telemetry.handler.ts` → `telemetry.service.ts#ingestTelemetry()`), never query the DB directly.
- **Farm access checks always go through `utils/farmAccess.util.ts`** (`hasFarmAccess`, `isPrimaryOwner`, `assertFarmAccess`, `assertZoneAccess`, `findFarmOrThrow`, `findZoneChainOrThrow`, `listAccessibleFarmIds`/`listAccessibleZoneIds`) — don't reimplement this in another service.
- **File naming**: `<resource>.<layer>.ts` with the layer spelled out in full — `farm.service.ts`, `farms.controller.ts`, `farms.route.ts`, `farm.model.ts` (never `farmService.ts`).

**Express middleware order** (`config/app.config.ts`): `helmet()` → `cors({origin: CORS_ORIGIN ?? http://localhost:5173, credentials: true})` → `rateLimiter` (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, default 100 req/60s) → `morgan('combined')` → `express.json({limit:'10mb'})` → `urlencoded` → `cookieParser()` → `requestContext` (AsyncLocalStorage holding the client IP so `logAction()` can fill `audit_logs.ip_address`; set `TRUST_PROXY=<hops>` when running behind a proxy, never `true`) → `/health` → Swagger (`/api-docs`, spec loaded from `docs/api/api-spec.yaml` inside a try/catch — a missing spec just logs a warning, doesn't crash boot) → 17 domain routers (the 5 Sales ones — `products`, `inventory`, `orders`, `return-requests`, `sales-reports` — are 501 stubs) → 404 handler → `errorHandler` (must stay last). `config/db.config.ts#connectDB()` requires `MONGODB_URI` and connects with `maxPoolSize: 10`.

**Models** (`src/models/*.ts`, one per file): `user`, `farm` (+ embedded members), `houseZone` (House + Zone, with threshold history), `device` (SensorNode + CameraNode), `audioTrack` (lullaby files per device; file on MinIO via `config/minio.config.ts`, the real copy lives on the DFPlayer SD card), `telemetry`, `alert`, `auditLog`, `systemSetting` (singleton, unique `_singleton` key), `invitation`, `ticket`, `harvestBatch`, `nestListing`, `birdCountRecord`, `contactInquiry`, plus Sales-module scaffolding (`product`, `inventory`, `order`, `orderItem`, `returnRequest`, `shipment`, `salesAssignment`, `salesAssignmentRequest` — Farm Owner proposals to add/remove a Sales Staff, approved by Admin).

**Background jobs** (`src/jobs/*.ts`, `node-cron`):
| Job | Schedule | Does |
|---|---|---|
| `deviceOffline.job.ts` | every 10s | flips `SensorNode`s with a stale heartbeat (>30s) from ONLINE→OFFLINE, emits `DEVICE_STATUS_CHANGE` |
| `overrideExpiry.job.ts` | every 1 min | reverts relays whose manual override expired back to AUTO mode |
| `alertEscalation.job.ts` | every 2 min | auto-creates a ticket for CRITICAL/HIGH alerts left unacknowledged >15 min (`NODE_OFFLINE`: device offline >1 h even if acknowledged, one ticket per outage, a repeat outage notes the still-open ticket); auto-resolves `THRESHOLD_BREACH` alerts not seen for 5 min |
| `slaBreach.job.ts` | every 2 min | `ticket.service#markBreachedTickets()` — flags open tickets past their SLA deadline (TICKET-FR-009, ≤5 min detection) |
| `invitationExpiry.job.ts` | hourly | marks invitations older than 7 days as EXPIRED |

**Socket.io** (`src/socket/index.ts`): JWT-authenticated in `io.use` (verifies `socket.handshake.auth.token` against `JWT_ACCESS_SECRET`). Clients `JOIN_ZONE`/`LEAVE_ZONE` to join room `zone:${zoneId}`. Services never touch `io` directly — they call exported helpers `emitTelemetryUpdate`, `emitRelayUpdate`, `emitBirdCountUpdate`, `emitAlertNew`, `emitDeviceStatusChange`, each of which does `io.to('zone:'+zoneId).emit(EVENT, data)`.

**Alert Engine** (`alert.service.ts`): `createAlert()` is the single entry point (called from MQTT ingestion, threshold checks, offline detection). It dedups per incident: if an alert with the same `farm_id + zone_id + node_id + type` is still open (`ACTIVE`/`ACKNOWLEDGED`, no time limit) it only bumps `last_seen_at` + `occurrence_count` (at most once a minute) and returns `null` — no new row, no re-notification. Open `THRESHOLD_BREACH` alerts not seen for 5 min are auto-resolved by `resolveStaleThresholdAlerts()` (run from `alertEscalation.job.ts`); `NODE_OFFLINE` is resolved when the device comes back — `device.service.ts#announceBackOnline`, shared by `recordHeartbeat` and `markNodeSeen` because either MQTT topic may arrive first. Otherwise it applies a default severity per `AlertType` (unless overridden), saves the alert, emits `ALERT_NEW`, and fires-and-forgets `dispatchAlertNotification()` (push/Zalo/SMS + quiet-hours logic in `notification.service.ts`) so a slow notification channel never blocks the write.

**Auth/token handling** (`auth.service.ts` + `auth.route.ts`): endpoints are `register/login/refresh/logout/otp/send/otp/verify/forgot-password/reset-password/notification-preferences/delete-request` (invitation accept/decline lives in `invitations.route.ts`). Access token: short-lived JWT (`JWT_ACCESS_TTL`, default 15m), returned in the JSON body, checked by `authenticate` middleware and by Socket.io's `io.use`. Refresh token (`JWT_REFRESH_TTL`, default 30d): set as an **httpOnly cookie** (`secure` in prod, `sameSite: 'strict'`) *and* persisted in `user.refresh_tokens[]` so it's individually revocable — `/refresh` validates both the JWT and DB presence before issuing a new access token; `resetPassword` wipes the whole array (forces logout everywhere). OTP/reset codes are 6-digit, SHA-256-hashed before storage; in dev they're just `console.log`'d (SMTP/Zalo ZNS integration is a TODO, `notification.service.ts`).

MQTT topics (`swiftletcare/{farmId}/{houseId}/{zoneId}/...`, used for `relay/command` and `config/update`) use the real MongoDB ObjectId of Farm/House/Zone. This matters for firmware provisioning, but **not** for backend ingestion: telemetry/heartbeat lookups key off `deviceId` inside the JSON payload (matching `SensorNode.device_id`), not the topic segments — the topic is only used for wildcard subscription (`mqtt/mqtt.client.ts`, `TOPICS`). Command topics are per **zone** but a zone can hold several ESP32s, so any command meant for one device (`relay/command`, `audio/command`, `config/reassign`, a `config/update` carrying speaker settings or RESTART/OTA) must put `deviceId: node.device_id` in the payload; firmware `mqttCallback` drops commands addressed to another `deviceId` and applies ones without it (zone-wide thresholds). Firmware older than this filter applies everything — reflash to get per-device commands.

Backend roles (`Role` in `backend/src/types/domain.types.ts`): `ADMIN | FARM_OWNER | TECHNICIAN | SALES_STAFF`, enforced with `requireRole(...)` (`middlewares/auth.middleware.ts`).

Key `.env` vars by category (see `backend/.env.example` for full list/comments): app (`NODE_ENV`, `PORT`), DB (`MONGODB_URI`, `MONGODB_TEST_URI`), auth (`JWT_ACCESS_SECRET/TTL`, `JWT_REFRESH_SECRET/TTL`), MQTT (`MQTT_BROKER_URL`, `MQTT_USERNAME/PASSWORD`, `MQTT_CA_CERT_PATH`), CORS (`CORS_ORIGIN`), object storage (`MINIO_*`), push/email/Zalo (`FIREBASE_*`, `SMTP_*`, `ZALO_*`), rate limiting (`RATE_LIMIT_WINDOW_MS/MAX`).

### Frontend: every layer partitioned by role, shared work grouped under `shared/`

Each concern folder splits its files into the same buckets — `admin/`, `farm-owner/`, `technician/`, `sales-staff/`, `auth/`, `shared/` and `common/` (role-agnostic infrastructure). **A file belongs in `shared/` only when two or more roles actually reach it**; one consumer means it belongs in that role's folder, however generic it looks. What survives in `shared/` today is small and genuinely cross-role: `apis/shared/` + `hooks/shared/` hold farms, alerts, devices and tickets — farms and alerts reach all four roles because the app shell itself renders `ZoneSwitcher` and `NotificationPopover`. There is no `components/features/shared/` at all. Placement follows the import graph with one deliberate exception: `components/features/admin/tickets/AdminOverrideModals.tsx` is imported by a Technician page but sits under `admin/` because it is Admin-only UI gated by `usePermission('ADMIN')` — ownership wins over the importer when a component is a role's capability rendered inside someone else's screen.

`pages/` is the exception and has no `shared/` or `public/`: every page sits in the folder of the role that **owns that piece of business**, and its filename carries that role — `pages/technician/TechnicianDevicesPage.tsx`, `pages/farm-owner/FarmOwnerHarvestPage.tsx`, `pages/admin/AdminUsersPage.tsx`. The component's exported name matches its filename. Four pages belong to no role and sit at the root of `pages/`: `SettingsPage` (every signed-in role), `MarketplacePage`, `ListingDetailPage`, `ForbiddenPage`; the sign-in/sign-up/invitation screens sit in `pages/auth/`.

**A page's folder is not an access-control statement.** `TechnicianDevicesPage` is still opened by Farm Owner and Admin — `allow={OPS_ROLES}` in `routes/technician.routes.tsx` is the real permission list, and `routes/` is where you look to answer "who can reach this". The folder only says whose daily job the screen is.

```
src/
  apis/        admin/ auth/ farm-owner/ shared/ — one `<resource>.api.ts` per resource, no barrel
  components/  auth/ · common/ · features/<role>/<area>/ · layouts/ · ui/ (design system)
  constants/   roles (role groups + getRoleHomePath/canAccessPath) · thresholds · tickets · auditActions
  hooks/       admin/ auth/ common/ farm-owner/ shared/
  lib/         axios · queryClient · socket · cn · helpers · navigation · chartTheme
  pages/       admin/ auth/ farm-owner/ sales-staff/ technician/ + 4 root files — ONLY `*Page.tsx`
  providers/   AppProviders.tsx — every provider wrapping the tree
  routes/      <role>.routes.tsx — one per pages/<role>/ folder
  stores/      Zustand: authStore · alertStore · toastStore · zoneStore · breadcrumbStore
  types/       <module>.types.ts + index.ts barrel
  validations/ admin/ · common/ · technician/ — pure form-validation functions
```

Binding rules:

- **`pages/` holds nothing but `*Page.tsx`.** Anything a page renders — modals, tabs, table column builders, feature-local constants — lives in `components/features/<role>/<area>/`, even when only one page uses it. A page that needs a sub-component does not get a `components/` subfolder of its own.
- **Routes live in `src/routes/<role>.routes.tsx`**, one file per `pages/<role>/` folder, each exporting a fragment of `<Route>` elements (`publicRoutes`, `adminRoutes`, `farmOwnerRoutes`, `technicianRoutes`, `salesStaffRoutes`). Each file `lazy()`-loads its own pages (route-level code-splitting — this is what keeps chart.js/date-fns out of the main bundle) and applies its own `<RequireRole allow={...}>`. `App.tsx` only assembles them, plus the two routes that belong to no role: the index redirect and `/settings`.
- **Role groups come from `constants/roles.ts`** (`OPS_ROLES`, `FARM_OWNER_ONLY`, `HARVEST_ROLES`, `ADMIN_ONLY`) — the route table's `allow={...}` and the `MENU_ACCESS` path → roles table in the same file both use them. There is no shared nav file: menus live in the layouts (see below), so adding a menu item means editing that role's layout **and** adding a `MENU_ACCESS` row. `hooks/common/usePermission.ts` does the equivalent check for UI-level hide/disable (not routing).
- **Imports always use the `@/` alias**, never `../`. A file's own folder is the only thing that changes when it moves.
- **Where a component goes is decided by two questions, in order.** *Does it know about the domain* — does it import `@/types` domain enums, `@/hooks`, `@/apis` or `@/stores`? *How many features use it?*
  - no domain knowledge → **`components/ui/`**, whatever the consumer count. This is the design system and it is self-contained: its only outside import is `@/lib/cn` (plus the generic `SortDirection` type in `DataTable`), so it holds both the atomic primitives (`Button`, `Input`, `Modal`, `Badge`, `Card`, `Select`, `Textarea`, `Toggle`) and the composite widgets (`DataTable`, `Pagination`, `FilterChip`, `EmptyState`, `LoadingSkeleton`, `StarRating`, `ActionsMenu`, `SelectMenu`, `ConfirmModal`, `NoteActionModal`, `ComingSoon`) plus `useFloatingMenu`, the positioning hook only those menus use. `components/ui/index.ts` re-exports all of it (the only barrel in `src/`); `icons.tsx` is deliberately left out so a screen pulls only the icons it names. Nothing inside `ui/` may import that barrel — import the sibling module directly.
  - knows the domain, used by one feature → **`components/features/<role>/<area>/`** (`ThresholdsModal`, `SensorCard`, `AlertBadge`, …). One consumer is enough; do not park it in `common/` "for later".
  - knows the domain, used by two or more features → **`components/common/`** (currently `ZoneSwitcher`, `NotificationPopover`, `Toast`, `ZonePicker`, `StatusDot`). It is meant to stay small.
- `components/layouts/` holds exactly seven files: one per role (`AdminLayout`, `FarmOwnerLayout`, `TechnicianLayout`, `SalesStaffLayout`) and three shared `App*` pieces (`AppShell`, `AppSidebar`, `AppHeader`). Reading the folder tells you at a glance which file belongs to which role. **Each role layout writes its whole menu out literally at the top of the file** — `{ label, path, icon }` per item, grouped into titled sections, plus `dockItems` when the mobile dock needs a hand-picked set. Nothing is looked up from a shared nav table, so opening `AdminLayout.tsx` shows you everything Admin sees. (No `id` field: `NavLink` derives the active item from the URL, so an id would be a field nothing reads.)
- `AppShell` owns the chrome for all four roles — it renders `AppSidebar`, `AppHeader`, the content `Outlet` and the `Toast` host, and mounts the global `useAlertNotifications` socket listener. `AppSidebar` renders the same menu twice for the two breakpoints (the `w-64` desktop rail and the floating mobile dock) and is purely presentational. `App.tsx`'s `RoleLayout` picks the layout from `user.role` at runtime, because SwiftletCare URLs carry no role prefix — `/devices` cannot be routed to a layout the way `/admin/*` can.
- `getRoleHomePath` and `canAccessPath` live in `constants/roles.ts` next to the role groups. `canAccessPath` keeps its own compact path → roles table (`MENU_ACCESS`) that mirrors the layout menus; it deliberately does not read the menus back out of the layouts, because `useAuth` calls it and the layouts render `AppHeader`, which calls `useAuth` — importing either way round would close a runtime cycle.
- `lib/axios.ts` — Axios instance (`withCredentials: true`) attaching `Authorization` from `authStore`; on a 401 with `error.code === 'TOKEN_EXPIRED'` it does a **single-flight** refresh (concurrent 401s share one `POST /auth/refresh` promise) and retries once, or clears auth + redirects to `/login` (via `lib/navigation.ts#redirectToLogin`) if refresh fails.
- `lib/socket.ts` — lazy singleton socket (`autoConnect: false`, lifecycle owned by `hooks/common/useSocket.ts`); `auth` is a callback re-read on every (re)connect so a refreshed token is always used; exposes `joinZone`/`leaveZone` plus `on*Update`/`onAlertNew` subscribers mirroring the backend's `emit*()` events.
- `lib/queryClient.ts` — singleton React Query client (`staleTime: 30s`, `retry: 1`) kept outside the React tree so the axios interceptor can clear its cache on logout/failed refresh.
- `hooks/` — one file per resource wrapping `apis/` in React Query (`useAlerts`, `useDevices`, `useFarms`, `useTickets`, `useTelemetry` (REST latest + live socket updates with a staleness timeout), `useHarvests`, `useMarketplace`, `useInvitations`, `useAnalytics`, `useAudioTracks`, `useUsers`, `useSystem`, `useAccountRequests`, `useAuth`), `hooks/shared/useAlertNotifications` (the global alert socket listener `AppShell` mounts), plus `hooks/common/` for the role-agnostic ones (`usePaginatedListQuery` — generic wrapper for the `{data, meta}` envelope — `usePermission`, `useSocket`, `useBreadcrumb`).
- Dev proxy (`vite.config.ts`): `/api` → `localhost:3000` (strip prefix), `/socket.io` → same target with `ws: true`. `vite-plugin-pwa` (`registerType: 'autoUpdate'`) caches static assets and does `NetworkFirst` runtime caching for the `api.swiftletcare.vn` API host.

- `types/` splits by backend module (`auth`, `farm`, `device`, `telemetry`, `alert`, `ticket`, `harvest`, `vision`, `system`, `socket`, `common`), **not** by role like every other folder — a type is an entity shape mirroring a Mongoose model, so `Zone` and `Alert` are read by three roles and have no single owner. `types/index.ts` is a barrel, so `@/types` keeps working everywhere.
- `validations/` holds pure form-validation functions, split by role (`admin/user.validation.ts`, `technician/audioTrack.validation.ts`) or `common/` when the rule is role-agnostic (`common/threshold.validation.ts`). A form component imports its validator instead of defining one inline, so the rule can be read — and later reused — without opening the modal.

`frontend/src/types/index.ts` and `backend/src/types/domain.types.ts` keep their **enums** in sync (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`, etc.) but are **not** a generated/shared mirror — frontend defines client-facing entity interfaces + socket payload types, backend defines its own DTOs/JWT payload/API-envelope types (plus Sales-only enums like `OrderStatus`/`PaymentStatus` absent on the frontend). Don't assume renaming a field in one automatically applies to the other.

Both `backend` and `frontend` use the `@/*` → `src/*` path alias.

### Mobile (`mobile/`)

Expo Router (file-based routing) under `mobile/app/`: `(auth)` group (login/register) and `(tabs)` group (dashboard/alerts/analytics/farms/tickets/settings), plus detail routes `farm/[farmId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`, `ticket/[ticketId]`, `livestream/[zoneId]`. Supporting code sits in `config/`, `constants/`, `hooks/`, `services/`, `store/`, `types/`, `utils/` (there is no `components/` folder yet). Talks to the **same backend**, unprefixed routes (`constants/api.ts`'s `ENDPOINTS` map matches `docs/api/api-spec.yaml`). React Query + Zustand + axios + socket.io-client, same overall pattern as the web frontend; storage via `react-native-mmkv`, charts via `victory-native`.

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

`src/stream.py` (RTSP loop) → `inference.py` (YOLOv8 via ONNX Runtime) → `tracker.py` (ByteTrack) → `counting.py` (line-crossing entry/exit) → `alert_publisher.py` (MQTT). `config/config.yaml` covers RTSP source, model thresholds, 4 detection classes (swiftlet/rat/snake/owl) with a separate predator confidence floor, MQTT (TLS 8883), MinIO snapshot upload, and morning/evening session windows. There is no `models/` folder — ONNX weights are not committed.

### Module completion status (see SRS §5 for FR-level detail)

AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, and Harvest/Marketplace all have real backend logic behind them. **SALES is a 501 scaffold only** (Phase 2/stretch) — its request/response schemas in the OpenAPI spec describe the intended contract, not working behavior. **Vision/AI (bird-count)** is likewise not wired up end-to-end: the backend side exists (`mqtt/handlers/birdCount.handler.ts` → `birdCountRecord`, `GET /analytics/bird-count/daily|trends`, consumed by `useBirdCountTrends` on the Analytics page), but `ai-pipeline` isn't deployed, so nothing real publishes bird counts.

## Conventions

- Commit messages follow Conventional Commits with a project-specific `type`/`scope` enum enforced by commitlint (`.commitlintrc.json`). CI (`.github/workflows/ci.yml`) validates them via `wagoid/commitlint-github-action`, plus runs a gitleaks secret scan; lint/test CI jobs are still commented-out placeholders, not yet active — `npm run lint`/`npm test` must be run locally.
