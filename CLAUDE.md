# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SwiftletCare — IoT monitoring + automation system for swiftlet (yến) houses (KLTN/thesis project, FA26, FPT University). Modules, each independent (no root `package.json`/workspace):

- `firmware/` — ESP32 (PlatformIO): RS485 sensors, PID relay control, MQTT, lullaby speaker.
- `backend/` — Node.js + Express + TypeScript + MongoDB + MQTT (EMQX) + Socket.io.
- `frontend/` — React 18 + Vite + TailwindCSS web dashboard/PWA.
- `mobile/` — Expo (Router, file-based routes) + React Native app, talks to the same backend API.
- `ai-pipeline/` — YOLOv8 (ONNX Runtime) + ByteTrack bird counting on a PC/cloud AI node (no longer a Raspberry Pi — plan in `docs/bird-counting-plan.md`). **Scaffold only, not implemented/deployed** — there is no `models/` folder; ONNX weights are never committed.
- `docs/` — `docs/api/api-spec.yaml` is the OpenAPI 3.0 **source of truth** for the API contract; the backend reads it at boot and serves Swagger UI at `/api-docs`. Routes are unprefixed (no `/api/v1`, despite what the SRS narrative implies).

**`SwiftletCare_SRS.md` §5, column "Trạng thái Backend"** is the single source of truth for per-requirement (FR) completion status — check it before assuming any feature is fully done. Module-level status tables in `backend/README.md`/`frontend/README.md` go stale faster.

**Scope after council Review 1 — SRS v2.0.0 (`SwiftletCare_SRS.md` §0).** The capstone register was revised (`FA26_SE_Capstone_Project_Register_SwiftletCare_v2.docx`) and later reviews judge the system against it; SRS §0 wins over any older text. **`backend/` and `firmware/` (1.3.0) already follow the v2 scope**; `frontend/`, `mobile/` and `ai-pipeline/` still follow v1.24.0 — the frontend never even got the Farm Operator role, so it has no notion of `DOMAIN_EXPERT` yet and still calls the removed marketplace and heating-relay endpoints. SRS §0.5 lists what is left per module; rows marked `🔄 Cần sửa code (v2.0.0)` in §5 are the same list at FR level. In short:

- **Main flow is the automated system**, not the business platform: fuzzy microclimate control, bird in/out counting with an annotated live stream, multi-modal health monitoring with an expert in the loop. Technician/tickets/Admin are a side flow — keep them working, don't extend them.
- **Domain Expert replaces Farm Operator** (role `DOMAIN_EXPERT`, whole farm, no `zone_ids`): read-only on operations, confirms/rejects inferred alerts, approves thresholds and fuzzy coefficients, writes conclusions for the Farm Owner (SRS §5.12). No relay control, tickets, harvest writes or alert acknowledgement. Since SRS v2.1.0 the expert also tunes six per-Zone detection parameters (abnormal-noise margin/duration, pump-dry time/rise, speaker drop, return-rate drop — EXPERT-FR-008): `zones.detection_tuning`, five of them pushed to the ESP32 over `config/update`.
- **Removed:** Buyer + Marketplace (harvest recording stays), predator detection, heating, Zalo/SMS (the committed out-of-app channel is a Telegram bot or FCM push — one of the two must really send; ALERT-FR-013). Vision is one class (`swiftlet`) on a PC/cloud AI node, not a Raspberry Pi.
- **NH3/CO2 are monitor-and-alert only** — they no longer drive the fan (no established limit for swiftlet houses was found). `BIRD_PANIC` becomes `NOISE_ANOMALY`, a supporting signal shown with bird counts and confirmed by the expert.
- **Never invent a threshold or behaviour without a source**; if none is found, downgrade the claim (alert-only, "set by the Domain Expert") rather than make one up. The engineering constants that had to be picked anyway (pump retry 30 min, humidity valid up to 101 %, last valid reading usable for 2 control periods, episodic alert resend 15 min / auto-close 60 min, 30 s grace for a stale relay status, 24 h override cap) are listed as unconfirmed assumptions at the end of SRS §0.5 — add any new one there.

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
npm run migrate:remove-sales  # one-off after SRS v1.23.0: delete SALES_STAFF users/invitations, drop SALES collections, backfill farms.members[].role (idempotent)
npm run migrate:data-model    # one-off, run BEFORE deploying v1.23.0 code: backfill zones.farm_id, hash stored refresh tokens, expire invitations of deleted farms, create new indexes (idempotent)
npm run migrate:scope-v2      # one-off after deploying the SRS v2 backend: FARM_OPERATOR → DOMAIN_EXPERT (users, farm members, invitations, ticket messages), drop zone_ids, BIRD_PANIC → NOISE_ANOMALY, remove heating relay state, un-list harvest batches, drop marketplace collections (idempotent)
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
pio test -e native                       # host-side unit tests (test_fuzzy, test_filter, test_noise_anomaly, test_pump_dry — builds only the Arduino-free pid/FuzzyControl, pid/PumpDryMonitor, sensors/SignalFilter, sensors/NoiseAnomalyDetector), needs g++/MinGW on PATH (e.g. winget WinLibs)
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
- **Every response follows the envelope** `{ success, data?, meta?: {page,limit,total}, error?: {code, message} }` (`meta` is pagination on list endpoints; a non-list endpoint may add an advisory hint there, e.g. `PUT /admin/users/:id/status` returns `meta.openTickets` when locking a Technician who still has assigned tickets). `utils/helpers.util.ts#paginate()` normalizes `page`/`limit` (default 20, max 100) into that `meta` shape consistently across list endpoints.
- **MQTT handlers (`mqtt/handlers/*.ts`) are thin adapters**: parse `topicParts`/`message`, call one service function (e.g. `telemetry.handler.ts` → `telemetry.service.ts#ingestTelemetry()`), never query the DB directly.
- **Farm access checks always go through `utils/farmAccess.util.ts`** (`hasFarmAccess`, `isPrimaryOwner`, `assertFarmAccess`, `assertZoneAccess`, `assertZoneInFarm`, `findFarmOrThrow`, `findZoneChainOrThrow`, `listAccessibleFarmIds`/`listAccessibleZoneIds`) — don't reimplement this in another service. There is **no per-Zone scope any more** (SRS v2.0.0 dropped it with the Farm Operator role): `assertZoneAccess` loads the zone chain and checks farm access, a record of a farm (alert, ticket, harvest) is checked with `assertFarmAccess`, so a Domain Expert invited to a farm sees the whole farm. What a role may *do* is decided by `requireRole` on the route (SRS §4.4), not in these helpers. `Zone` stores an immutable `farm_id` (filled from its House by a `pre('validate')` hook when not passed), so zone→farm lookups and per-farm zone filters don't go through `House`.
- **File naming**: `<resource>.<layer>.ts` with the layer spelled out in full — `farm.service.ts`, `farms.controller.ts`, `farms.route.ts`, `farm.model.ts` (never `farmService.ts`).

**Express middleware order** (`config/app.config.ts`): `helmet()` → `cors({origin: CORS_ORIGIN ?? http://localhost:5173, credentials: true})` → `rateLimiter` (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, default 100 req/60s) → `morgan('combined')` → `express.json({limit:'10mb'})` → `urlencoded` → `cookieParser()` → `requestContext` (AsyncLocalStorage holding the client IP so `logAction()` can fill `audit_logs.ip_address`; set `TRUST_PROXY=<hops>` when running behind a proxy, never `true`) → `/health` → Swagger (`/api-docs`, spec loaded from `docs/api/api-spec.yaml` inside a try/catch — a missing spec just logs a warning, doesn't crash boot) → 13 domain routers → 404 handler → `errorHandler` (must stay last). `config/db.config.ts#connectDB()` requires `MONGODB_URI` and connects with `maxPoolSize: 10`.

**Models** (`src/models/*.ts`, one per file): `user`, `farm` (+ embedded members; soft-deleted — `utils/softDelete.util.ts#applySoftDeleteScope` hides `is_deleted` docs from every `find*`/`countDocuments` unless the filter names `is_deleted` itself, same for `harvestBatch`; delete a farm via `farm.service#softDeleteFarm`, which also resolves open alerts and expires pending invitations), `houseZone` (House + Zone, with threshold history, fuzzy-control tuning and detection tuning + their histories, each entry recording the editor's role), `device` (SensorNode + CameraNode), `audioTrack` (lullaby files per device; file on MinIO via `config/minio.config.ts`, the real copy lives on the DFPlayer SD card), `telemetry`, `alert`, `auditLog`, `systemSetting` (singleton, unique `_singleton` key), `invitation`, `ticket`, `harvestBatch`, `birdCountRecord`, `ticketMessage`, `maintenanceSchedule`, `provisionedDevice`, `relayOverrideLog` (one row per manual override — who, role, relay, forced state, start/expiry/end and end reason; ENV-FR-019; written best-effort *after* the relay command is published, never before), `zoneHealthReport` (EXPERT-FR-005/006). There is no SALES module (removed in SRS v1.23.0) and no Marketplace (removed in v2.0.0 — `harvest.service.ts` only records harvests).

**Background jobs** (`src/jobs/*.ts`, `node-cron`):
| Job | Schedule | Does |
|---|---|---|
| `deviceOffline.job.ts` | every 10s | flips `SensorNode`s with a stale heartbeat (>30s) from ONLINE→OFFLINE, emits `DEVICE_STATUS_CHANGE` |
| `overrideExpiry.job.ts` | every 1 min | reverts relays whose manual override expired back to AUTO mode |
| `alertEscalation.job.ts` | every 2 min | auto-creates a ticket for CRITICAL/HIGH alerts left unacknowledged >15 min (`NODE_OFFLINE`: device offline >1 h even if acknowledged, one ticket per outage, a repeat outage notes the still-open ticket); auto-resolves `THRESHOLD_BREACH` alerts not seen for 5 min and episodic device alerts (`NOISE_ANOMALY`, `PUMP_DRY` — fired once when the incident starts) not seen for 60 min, so a later recurrence is a new alert instead of being swallowed by dedup (firmware re-sends those two every 15 min while the incident lasts, so a long one is not closed midway) |
| `slaBreach.job.ts` | every 2 min | `ticket.service#markBreachedTickets()` — flags open tickets past their SLA deadline (TICKET-FR-009, ≤5 min detection) |
| `invitationExpiry.job.ts` | hourly | marks invitations older than 7 days as EXPIRED |
| `maintenanceSchedule.job.ts` | hourly | `generateDueMaintenanceTickets()` — creates a MAINTENANCE ticket `MAINTENANCE_LEAD_DAYS` (default 3) before each schedule's `next_due_at`, then rolls it to the next cycle (TICKET-FR-013); also `accumulateRelayUsage()` — tallies pump/fan on-hours and switches from telemetry into `sensor_nodes.relay_usage` and opens a MAINTENANCE ticket past `RELAY_SERVICE_LIMITS` (TICKET-FR-018) |
| `sensorAnomaly.job.ts` | every 10 min | `scanSensorAnomalies()` — stuck temp/humidity (2 h), repeated physically impossible jumps, drift between devices of a zone → `SENSOR_ANOMALY` (MEDIUM), auto-resolved when healthy (ALERT-FR-010) |
| `forecast.job.ts` | every 10 min (offset 5) | `scanForecastBreaches()` — Holt damped-trend 60-min forecast per zone; a metric still in range but forecast to cross → `FORECAST_BREACH` (LOW), auto-resolved (ALERT-FR-011) |
| `healthReport.job.ts` | `HEALTH_REPORT_CRON` (default Mon 06:00) | `generateWeeklyReports()` — one `zone_health_reports` row per zone with telemetry in the last `HEALTH_REPORT_DAYS` (default 7): time in range, automatic-time %, relay switches, alerts by type, return rate, NH3/CO2 avg/max; notifies owners and experts (EXPERT-FR-005/007) |

**Ticket visits** (`ticket.service.ts`, `utils/visitTime.util.ts`): `scheduled_visit_at` must be in the future and within **07:00–18:00 Vietnam time** on every path that sets it — `assertValidVisitTime()` for create, `scheduleVisit` (`PUT /tickets/:id/scheduled-date`), admin-override and maintenance `next_due_at`; the maintenance job pushes a late slot to the next 07:00 with `nextVisitSlot()`. Format visit times with `formatVisitTime()` (always VN time, never the server's TZ). INSTALLATION gets its visit at creation (Farm Owner picks it); fault tickets never carry one at creation — the assignee sets it via `scheduleVisit` only once the ticket is `IN_PROGRESS` (SRS Flow 9 step 6b); MAINTENANCE only comes from schedules. Any ticket with a field visit (`requiresFieldVisit()`: INSTALLATION/MAINTENANCE or a set `scheduled_visit_at`) needs the full SAT checklist before `CLOSED`.

**Socket.io** (`src/socket/index.ts`): JWT-authenticated in `io.use` (verifies `socket.handshake.auth.token` against `JWT_ACCESS_SECRET`). Clients `JOIN_ZONE`/`LEAVE_ZONE` to join room `zone:${zoneId}`. Services never touch `io` directly — they call exported helpers `emitTelemetryUpdate`, `emitRelayUpdate`, `emitBirdCountUpdate`, `emitAlertNew`, `emitDeviceStatusChange`, each of which does `io.to('zone:'+zoneId).emit(EVENT, data)`.

**Alert Engine** (`alert.service.ts`): only HIGH/CRITICAL alerts escalate to tickets, so every *inferred* alert type (statistical/dB-based: `NOISE_ANOMALY`, `SENSOR_ANOMALY`, `FORECAST_BREACH`, `LOW_RETURN_RATE` — `INFERRED_ALERT_TYPES`) is kept at MEDIUM/LOW — a mis-tuned detector must not spawn tickets; `ingestDeviceAlert` caps those and `THRESHOLD_BREACH` at MEDIUM even when a device sends higher, and maps the old `BIRD_PANIC` name from firmware < 1.3.0. An NH3/CO2 breach is alert-only (ALERT-FR-012). A Domain Expert confirms or rejects an inferred alert via `PUT /alerts/:id/verdict` (`alerts.expert_verdict`, EXPERT-FR-003) — separate from `acknowledge`, which stays with Farm Owner/Technician/Admin. `createAlert()` is the single entry point (called from MQTT ingestion, threshold checks, offline detection). It dedups per incident: if an alert with the same `farm_id + zone_id + node_id + type` is still open (`ACTIVE`/`ACKNOWLEDGED`, no time limit) it only bumps `last_seen_at` + `occurrence_count` (at most once a minute) and returns `null` — no new row, no re-notification. Open `THRESHOLD_BREACH` alerts not seen for 5 min are auto-resolved by `resolveStaleThresholdAlerts()` (run from `alertEscalation.job.ts`); `NODE_OFFLINE` is resolved when the device comes back — `device.service.ts#announceBackOnline`, shared by `recordHeartbeat` and `markNodeSeen` because either MQTT topic may arrive first. Otherwise it applies a default severity per `AlertType` (unless overridden), saves the alert, emits `ALERT_NEW`, and fires-and-forgets `dispatchAlertNotification()` (recipient/channel/quiet-hours logic in `notification.service.ts`; recipients are the farm's owners, not its Domain Experts; **Telegram** really sends — `telegram.service.ts`, ALERT-FR-013 — while FCM push still only logs and Zalo/SMS are out of scope; `notifyUser()` for non-alert notices goes over Telegram too, and there is no in-app notification inbox) so a slow notification channel never blocks the write.

**Auth/token handling** (`auth.service.ts` + `auth.route.ts`): endpoints are `register/login/refresh/logout/otp/send/otp/verify/forgot-password/reset-password/notification-preferences/telegram/link/delete-request` (invitation accept/decline lives in `invitations.route.ts`). Access token: short-lived JWT (`JWT_ACCESS_TTL`, default 15m), returned in the JSON body, checked by `authenticate` middleware and by Socket.io's `io.use`. Refresh token (`JWT_REFRESH_TTL`, default 30d): set as an **httpOnly cookie** (`secure` in prod, `sameSite: 'strict'`) *and* persisted in `user.refresh_tokens[]` so it's individually revocable — `/refresh` validates both the JWT and DB presence before issuing a new access token; `resetPassword` wipes the whole array (forces logout everywhere). OTP/reset codes are 6-digit, SHA-256-hashed before storage; in dev they're just `console.log`'d (SMTP/Zalo ZNS integration is a TODO, `notification.service.ts`).

MQTT topics (`swiftletcare/{farmId}/{houseId}/{zoneId}/...`, used for `relay/command` and `config/update`) use the real MongoDB ObjectId of Farm/House/Zone. This matters for firmware provisioning, but **not** for backend ingestion: telemetry/heartbeat lookups key off `deviceId` inside the JSON payload (matching `SensorNode.device_id`), not the topic segments — the topic is only used for wildcard subscription (`mqtt/mqtt.client.ts`, `TOPICS`). Command topics are per **zone** but a zone can hold several ESP32s, so any command meant for one device (`relay/command`, `audio/command`, `config/reassign`, a `config/update` carrying speaker settings or RESTART/OTA) must put `deviceId: node.device_id` in the payload; firmware `mqttCallback` drops commands addressed to another `deviceId` and applies ones without it (zone-wide thresholds). Firmware older than this filter applies everything — reflash to get per-device commands.

Backend roles (`Role` in `backend/src/types/domain.types.ts`): `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`, enforced with `requireRole(...)` (`middlewares/auth.middleware.ts`). `DOMAIN_EXPERT` (SRS v2.0.0) is a swiftlet-farming expert invited by the primary Farm Owner (`POST /farms/:id/members` with `role`), always farm-wide. Per SRS §4.4 the expert reads dashboards, analytics, alerts, harvests, override history and health reports; edits zone thresholds, fuzzy coefficients and detection tuning; sets alert verdicts and report conclusions — and cannot drive relays or the speaker, touch tickets or maintenance schedules, write harvests, acknowledge alerts, edit/delete farms, manage members or create houses/zones. One email = one role: invitations and acceptance refuse a mismatching account.

Key `.env` vars by category (see `backend/.env.example` for full list/comments): app (`NODE_ENV`, `PORT`), DB (`MONGODB_URI`, `MONGODB_TEST_URI`), auth (`JWT_ACCESS_SECRET/TTL`, `JWT_REFRESH_SECRET/TTL`), MQTT (`MQTT_BROKER_URL`, `MQTT_USERNAME/PASSWORD`, `MQTT_CA_CERT_PATH`), CORS (`CORS_ORIGIN`), object storage (`MINIO_*`), notifications (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` — the one channel that really sends; `FIREBASE_*`, `SMTP_*`, `ZALO_*` are not read by any code yet), health reports (`HEALTH_REPORT_CRON`, `HEALTH_REPORT_DAYS`), rate limiting (`RATE_LIMIT_WINDOW_MS/MAX`).

### Frontend: every layer partitioned by role, shared work grouped under `shared/`

Each concern folder splits its files into the same buckets — `admin/`, `farm-owner/`, `farm-operator/`, `technician/`, `auth/`, `shared/` and `common/` (role-agnostic infrastructure); a `farm-operator/` bucket only appears once some file is used by the Farm Operator alone — most operator screens are Farm Owner pages opened with a narrower role group. **A file belongs in `shared/` only when two or more roles actually reach it**; one consumer means it belongs in that role's folder, however generic it looks. What survives in `shared/` today is small and genuinely cross-role: `apis/shared/` + `hooks/shared/` hold farms, alerts, devices and tickets — farms and alerts reach all four roles because the app shell itself renders `ZoneSwitcher` and `NotificationPopover`. There is no `components/features/shared/` at all. Placement follows the import graph with one deliberate exception: `components/features/admin/tickets/AdminOverrideModals.tsx` is imported by a Technician page but sits under `admin/` because it is Admin-only UI gated by `usePermission('ADMIN')` — ownership wins over the importer when a component is a role's capability rendered inside someone else's screen.

`pages/` is the exception and has no `shared/` or `public/`: every page sits in the folder of the role that **owns that piece of business**, and its filename carries that role — `pages/technician/TechnicianDevicesPage.tsx`, `pages/farm-owner/FarmOwnerHarvestPage.tsx`, `pages/admin/AdminUsersPage.tsx`. The component's exported name matches its filename. Four pages belong to no role and sit at the root of `pages/`: `SettingsPage` (every signed-in role), `MarketplacePage`, `ListingDetailPage`, `ForbiddenPage`; the sign-in/sign-up/invitation screens sit in `pages/auth/`.

**A page's folder is not an access-control statement.** `TechnicianDevicesPage` is still opened by Farm Owner, Farm Operator and Admin — `allow={OPS_ROLES}` in `routes/technician.routes.tsx` is the real permission list, and `routes/` is where you look to answer "who can reach this". The folder only says whose daily job the screen is.

```
src/
  apis/        admin/ auth/ farm-owner/ shared/ — one `<resource>.api.ts` per resource, no barrel
  components/  auth/ · common/ · features/<role>/<area>/ · layouts/ · ui/ (design system)
  constants/   roles (role groups + getRoleHomePath/canAccessPath) · thresholds · tickets · auditActions
  hooks/       admin/ auth/ common/ farm-owner/ shared/
  lib/         axios · queryClient · socket · cn · helpers · navigation · chartTheme
  pages/       admin/ auth/ farm-owner/ technician/ + 4 root files — ONLY `*Page.tsx`
  providers/   AppProviders.tsx — every provider wrapping the tree
  routes/      <role>.routes.tsx — one per pages/<role>/ folder
  stores/      Zustand: authStore · alertStore · toastStore · zoneStore · breadcrumbStore
  types/       <module>.types.ts + index.ts barrel
  validations/ admin/ · common/ · technician/ — pure form-validation functions
```

Binding rules:

- **`pages/` holds nothing but `*Page.tsx`.** Anything a page renders — modals, tabs, table column builders, feature-local constants — lives in `components/features/<role>/<area>/`, even when only one page uses it. A page that needs a sub-component does not get a `components/` subfolder of its own.
- **Routes live in `src/routes/<role>.routes.tsx`**, one file per `pages/<role>/` folder, each exporting a fragment of `<Route>` elements (`publicRoutes`, `adminRoutes`, `farmOwnerRoutes`, `technicianRoutes`). Each file `lazy()`-loads its own pages (route-level code-splitting — this is what keeps chart.js/date-fns out of the main bundle) and applies its own `<RequireRole allow={...}>`. `App.tsx` only assembles them, plus the two routes that belong to no role: the index redirect and `/settings`.
- **Role groups come from `constants/roles.ts`** (`OPS_ROLES` — Farm Owner, Farm Operator, Technician, Admin; `FARM_SIDE_ROLES` — Farm Owner + Farm Operator, for dashboard/analytics; `FARM_OWNER_ONLY` — members, farm settings, marketplace publishing; `HARVEST_ROLES` — Farm Owner, Farm Operator, Admin; `ADMIN_ONLY`) — the route table's `allow={...}` and the `MENU_ACCESS` path → roles table in the same file both use them. There is no shared nav file: menus live in the layouts (see below), so adding a menu item means editing that role's layout **and** adding a `MENU_ACCESS` row. `hooks/common/usePermission.ts` does the equivalent check for UI-level hide/disable (not routing).
- **Imports always use the `@/` alias**, never `../`. A file's own folder is the only thing that changes when it moves.
- **Where a component goes is decided by two questions, in order.** *Does it know about the domain* — does it import `@/types` domain enums, `@/hooks`, `@/apis` or `@/stores`? *How many features use it?*
  - no domain knowledge → **`components/ui/`**, whatever the consumer count. This is the design system and it is self-contained: its only outside import is `@/lib/cn` (plus the generic `SortDirection` type in `DataTable`), so it holds both the atomic primitives (`Button`, `Input`, `Modal`, `Badge`, `Card`, `Select`, `Textarea`, `Toggle`) and the composite widgets (`DataTable`, `Pagination`, `FilterChip`, `EmptyState`, `LoadingSkeleton`, `StarRating`, `ActionsMenu`, `SelectMenu`, `ConfirmModal`, `NoteActionModal`, `ComingSoon`) plus `useFloatingMenu`, the positioning hook only those menus use. `components/ui/index.ts` re-exports all of it (the only barrel in `src/`); `icons.tsx` is deliberately left out so a screen pulls only the icons it names. Nothing inside `ui/` may import that barrel — import the sibling module directly.
  - knows the domain, used by one feature → **`components/features/<role>/<area>/`** (`ThresholdsModal`, `SensorCard`, `AlertBadge`, …). One consumer is enough; do not park it in `common/` "for later".
  - knows the domain, used by two or more features → **`components/common/`** (currently `ZoneSwitcher`, `NotificationPopover`, `Toast`, `ZonePicker`, `StatusDot`). It is meant to stay small.
- `components/layouts/` holds exactly seven files: one per role (`AdminLayout`, `FarmOwnerLayout`, `FarmOperatorLayout`, `TechnicianLayout`) and three shared `App*` pieces (`AppShell`, `AppSidebar`, `AppHeader`). Reading the folder tells you at a glance which file belongs to which role. **Each role layout writes its whole menu out literally at the top of the file** — `{ label, path, icon }` per item, grouped into titled sections, plus `dockItems` when the mobile dock needs a hand-picked set. Nothing is looked up from a shared nav table, so opening `AdminLayout.tsx` shows you everything Admin sees. (No `id` field: `NavLink` derives the active item from the URL, so an id would be a field nothing reads.)
- `AppShell` owns the chrome for all four signed-in roles — it renders `AppSidebar`, `AppHeader`, the content `Outlet` and the `Toast` host, and mounts the global `useAlertNotifications` socket listener. `AppSidebar` renders the same menu twice for the two breakpoints (the `w-64` desktop rail and the floating mobile dock) and is purely presentational. `App.tsx`'s `RoleLayout` picks the layout from `user.role` at runtime, because SwiftletCare URLs carry no role prefix — `/devices` cannot be routed to a layout the way `/admin/*` can.
- `getRoleHomePath` and `canAccessPath` live in `constants/roles.ts` next to the role groups. `canAccessPath` keeps its own compact path → roles table (`MENU_ACCESS`) that mirrors the layout menus; it deliberately does not read the menus back out of the layouts, because `useAuth` calls it and the layouts render `AppHeader`, which calls `useAuth` — importing either way round would close a runtime cycle.
- `lib/axios.ts` — Axios instance (`withCredentials: true`) attaching `Authorization` from `authStore`; on a 401 with `error.code === 'TOKEN_EXPIRED'` it does a **single-flight** refresh (concurrent 401s share one `POST /auth/refresh` promise) and retries once, or clears auth + redirects to `/login` (via `lib/navigation.ts#redirectToLogin`) if refresh fails.
- `lib/socket.ts` — lazy singleton socket (`autoConnect: false`, lifecycle owned by `hooks/common/useSocket.ts`); `auth` is a callback re-read on every (re)connect so a refreshed token is always used; exposes `joinZone`/`leaveZone` plus `on*Update`/`onAlertNew` subscribers mirroring the backend's `emit*()` events.
- `lib/queryClient.ts` — singleton React Query client (`staleTime: 30s`, `retry: 1`) kept outside the React tree so the axios interceptor can clear its cache on logout/failed refresh.
- `hooks/` — one file per resource wrapping `apis/` in React Query (`useAlerts`, `useDevices`, `useFarms`, `useTickets`, `useTelemetry` (REST latest + live socket updates with a staleness timeout), `useHarvests`, `useMarketplace`, `useInvitations`, `useAnalytics`, `useAudioTracks`, `useUsers`, `useSystem`, `useAccountRequests`, `useAuth`), `hooks/shared/useAlertNotifications` (the global alert socket listener `AppShell` mounts), plus `hooks/common/` for the role-agnostic ones (`usePaginatedListQuery` — generic wrapper for the `{data, meta}` envelope — `usePermission`, `useSocket`, `useBreadcrumb`).
- Dev proxy (`vite.config.ts`): `/api` → `localhost:3000` (strip prefix), `/socket.io` → same target with `ws: true`. `vite-plugin-pwa` (`registerType: 'autoUpdate'`) caches static assets and does `NetworkFirst` runtime caching for the `api.swiftletcare.vn` API host.

- `types/` splits by backend module (`auth`, `farm`, `device`, `telemetry`, `alert`, `ticket`, `harvest`, `vision`, `system`, `socket`, `common`), **not** by role like every other folder — a type is an entity shape mirroring a Mongoose model, so `Zone` and `Alert` are read by three roles and have no single owner. `types/index.ts` is a barrel, so `@/types` keeps working everywhere.
- `validations/` holds pure form-validation functions, split by role (`admin/user.validation.ts`, `technician/audioTrack.validation.ts`) or `common/` when the rule is role-agnostic (`common/threshold.validation.ts`). A form component imports its validator instead of defining one inline, so the rule can be read — and later reused — without opening the modal.

`frontend/src/types/index.ts` and `backend/src/types/domain.types.ts` keep their **enums** in sync (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`, etc.) but are **not** a generated/shared mirror — frontend defines client-facing entity interfaces + socket payload types, backend defines its own DTOs/JWT payload/API-envelope types (plus backend-only ones like `FarmMemberRole`). Don't assume renaming a field in one automatically applies to the other.

Both `backend` and `frontend` use the `@/*` → `src/*` path alias.

### Mobile (`mobile/`)

Expo Router (file-based routing) under `mobile/app/`: `(auth)` group (login/register) and `(tabs)` group (dashboard/alerts/analytics/farms/tickets/settings), plus detail routes `farm/[farmId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`, `ticket/[ticketId]`, `livestream/[zoneId]`. Supporting code sits in `config/`, `constants/`, `hooks/`, `services/`, `store/`, `types/`, `utils/` (there is no `components/` folder yet). Talks to the **same backend**, unprefixed routes (`constants/api.ts`'s `ENDPOINTS` map matches `docs/api/api-spec.yaml`). React Query + Zustand + axios + socket.io-client, same overall pattern as the web frontend; storage via `react-native-mmkv`, charts via `victory-native`.

### Firmware: FreeRTOS, 3 tasks

```
sensors/  SensorManager — 5 RS485 Modbus sensors (RX GPIO16 / TX GPIO17, 4800bps, slave IDs 1-5: noise/CO2/NH3/light/temp+humidity)
          SignalFilter (median-5 + Kalman, temperature + humidity only) · NoiseAnomalyDetector (NOISE_ANOMALY by dB level vs a per-hour-of-day learned p90 baseline, so daily bird exit/return noise is normal; skipped while the speaker actually plays) — both run at 1 Hz in sensorTask
pid/      PIDController — control for 3 relays (misting/speaker/ventilation; IN4 is a spare, heating was removed) + threat flags;
          misting + ventilation use FuzzyControl (Sugeno fuzzy logic → % duty, applied by time-proportioning over a tunable window, default 120s);
          PumpDryMonitor (PUMP_DRY → stop misting until the spray session ends)
audio/    AudioManager — DFPlayer Mini lullaby playback on schedule
mqtt/     publish telemetry/heartbeat/relay-status, subscribe to command topics
storage/  NVS (config) + SPIFFS (offline buffering)
main.cpp  SensorTask / PIDTask / MQTTTask
```

`config/Config.h`/`.cpp` holds default thresholds (temp 26–31°C, humidity 75–95%, light max 0.2 — NH3/CO2 limits are no longer in the firmware), the five detection parameters and the lullaby schedule (default windows 05–07h/17–19h) — all runtime-overridable via MQTT `config/update` and persisted to NVS, so editing these defaults in code only affects first boot. `platformio.ini` defines three envs: `esp32dev` (default, full firmware), `modbus_scan` (standalone RS485 slave-ID/baudrate scanner, `test_noise_rs485.cpp` only — not part of the `esp32dev` build), `native` (host-side unit tests, no hardware).

Fuzzy control (firmware 1.3.0, SRS v2): the fan depends on **temperature + humidity only** — NH3/CO2 are telemetry and backend alerts, never a control input. The controller reads **filtered** values (toggle `fuzzy_input_filter`) while telemetry and anomaly detection stay on **raw** values. **Safe state (THREAT-FR-013):** the loop uses the last valid temperature/humidity reading while it is at most `CONTROL_INPUT_MAX_AGE_CYCLES` (2) control periods old, so a single failed RS485 read does not chatter the relays; with no valid reading in that window (or one out of physical range) both demands are 0 so the relays switch off, and the control loop keeps running so overrides still expire and sensor-fault alerts are still raised. **PUMP_DRY (THREAT-FR-011):** evaluated only while humidity is below `humidity_min` (around the target the fuzzy controller holds humidity flat by design); after the pump has been on for `pump_dry_on_sec` in one spray session without humidity rising `pump_dry_min_rise_pct`, misting stops (the alert flag follows the latch, so it is re-sent until MQTT accepts it); the latch clears when demand reaches zero, on a manual override, or by itself after `PUMP_DRY_RETRY_MS` (30 min, a hand-picked firmware constant) so a false positive cannot switch misting off for good. A failed sensor read keeps the monitor state — it is not the end of a spray session. Five detection parameters (`noise_margin_db`, `noise_min_sec`, `pump_dry_on_sec`, `pump_dry_min_rise_pct`, `speaker_drop_pct` — EXPERT-FR-008) arrive over `config/update`, are clamped and stored in NVS like the fuzzy coefficients. `pid/FuzzyControl.cpp` is plain C++ (no Arduino) so it can be unit-tested on the host; membership breakpoints are offsets around the runtime `Config` thresholds, so `config/update` still retunes it. Four coefficients (`fuzzy_humidity_band`, `fuzzy_temp_band`, `fuzzy_fan_dry_level`, `fuzzy_window_sec` — ENV-FR-021) are runtime-tunable per Zone: `zones.fuzzy_tuning` (+ `fuzzy_tuning_history`), `PUT /farms/zones/:zoneId/fuzzy-tuning` → `config/update`, persisted to NVS and clamped by the firmware; `buildDeviceConfig` takes the zone so every full config push carries them. Telemetry carries `control_output {misting, ventilation}` (0-100 %): the backend forwards it as `TELEMETRY_UPDATE.controlOutput` for the dashboard gauge and stores it with the relay states on each persisted sample (`telemetry.misting_pct/ventilation_pct/misting_on/ventilation_on`), which `GET /analytics/control/performance` (ANALYTICS-FR-008), `GET /analytics/forecast` (ANALYTICS-FR-009) and `GET /analytics/control/suggestion` (ANALYTICS-FR-010 — `utils/fuzzyModel.util.ts` holds a TS port of `FuzzyControl.cpp` that must stay in sync; its tests reuse the firmware cases) turn into in-range %, relay switches/hour and tuning-change markers. `PUMP_DRY` counts *cumulative* relay-on time within a spray session, since the pump cycles. `utils/fuzzyModel.util.ts` mirrors the gas-free fan rule and the invalid-input safe state.

### AI pipeline (`ai-pipeline/`) — scaffold, not deployed

`src/stream.py` (RTSP loop) → `inference.py` (YOLOv8 via ONNX Runtime) → `tracker.py` (ByteTrack) → `counting.py` (line-crossing entry/exit) → `alert_publisher.py` (MQTT). `config/config.yaml` covers RTSP source, model thresholds, 4 detection classes (swiftlet/rat/snake/owl) with a separate predator confidence floor, MQTT (TLS 8883), MinIO snapshot upload, and morning/evening session windows. There is no `models/` folder — ONNX weights are not committed.

### Module completion status (see SRS §5 for FR-level detail)

Backend and firmware match SRS v2 (§0.5 backend/firmware lists are done except the bird-counting items and the physical bypass switch). AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, System, Harvest and the EXPERT module (alert verdicts, detection tuning, override history + automatic-time ratio, zone health reports) all have real backend logic behind them. **The frontend has not caught up**: it still has `sales-staff/` code, marketplace screens, the heating relay toggle and no Domain Expert role or screens, and mobile is a scaffold. Firmware 1.3.0 is built and host-tested only — not yet flashed and exercised on a real board. **Vision/AI (bird-count)** is likewise not wired up end-to-end: the backend side exists (`mqtt/handlers/birdCount.handler.ts` → `birdCountRecord`, `GET /analytics/bird-count/daily|trends`, consumed by `useBirdCountTrends` on the Analytics page), but `ai-pipeline` isn't deployed, so nothing real publishes bird counts.

## Conventions

- Commit messages follow Conventional Commits with a project-specific `type`/`scope` enum enforced by commitlint (`.commitlintrc.json`). CI (`.github/workflows/ci.yml`) validates them via `wagoid/commitlint-github-action`, plus runs a gitleaks secret scan; lint/test CI jobs are still commented-out placeholders, not yet active — `npm run lint`/`npm test` must be run locally.

## Working with Claude

- Reply to the user in Vietnamese.
- Review a PR with `/review-pr <PR number>` (`.claude/commands/review-pr.md`). When reviewing, read code and diffs only — never run `npm install`/`npm ci`, builds or test suites.
- Commits and PRs carry no Claude attribution (`.claude/settings.json` sets `attribution` to empty) — don't add `Co-Authored-By`, session links or similar lines by hand either.
