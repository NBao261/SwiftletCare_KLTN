# backend/CLAUDE.md

Rules and architecture for `backend/` (Node.js + Express + TypeScript + MongoDB + MQTT/EMQX + Socket.io). This file wins over the root `CLAUDE.md` for backend code; `/review-pr` judges backend changes by it. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; the "Known debt" table lists what is already out of line.

The backend follows the SRS v2.0.0 scope (`SwiftletCare_SRS.md` §0): roles `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`, no Marketplace, no heating relay, NH3/CO2 alert-only, `NOISE_ANOMALY` instead of `BIRD_PANIC`, Telegram as the out-of-app channel.

## Commands

```bash
npm run dev          # tsx watch — needs docker compose (mongodb, emqx) running
npm run build        # tsc -> dist/
npm run build:check  # tsc --noEmit
npm test             # jest --coverage (unit + integration, mongodb-memory-server)
npm run test:unit    # jest tests/unit --coverage
npm run test:int     # jest tests/integration
npx jest path/to/file.test.ts
npm run lint         # eslint src/**/*.ts
npm run seed         # 1 Farm Owner + 1 Technician + Farm/House/Zone/SensorNode
npm run migrate:retention     # sync TTL/indexes + merge duplicate open alerts (idempotent; rerun after changing a TTL)
npm run migrate:remove-sales  # one-off after SRS v1.23.0 (idempotent)
npm run migrate:data-model    # one-off, BEFORE deploying v1.23.0 code (idempotent)
npm run migrate:scope-v2      # one-off after deploying the SRS v2 backend: FARM_OPERATOR → DOMAIN_EXPERT, drop zone_ids, BIRD_PANIC → NOISE_ANOMALY, remove heating, un-list harvests, drop marketplace collections (idempotent)
npm run mdns         # publish mDNS "swiftletcare-broker.local" for a real ESP32 (run alongside npm run dev)
```

Dev EMQX self-signs its TLS cert on 8883, which the Node `mqtt` client rejects — dev config must use **`mqtt://localhost:1883`**; `mqtts://...:8883` + a real CA cert only in production. CI (`.github/workflows/ci.yml`, job Backend) runs `npm ci`, `lint`, `build:check` and `npm test` on every PR that touches `backend/` or `docs/api/api-spec.yaml`.

## Architecture: Route → Controller → Service → Model

```
routes/*.route.ts (express-validator + requireRole)
  → controllers/*.controller.ts (parse req, call exactly one service fn, res.json)
      → services/*.service.ts (the only layer that queries DB, checks permissions, publishes MQTT, emits socket events, throws AppError)
          → models/*.model.ts (Mongoose schemas)
```

**Express middleware order** (`config/app.config.ts`): `helmet()` → `cors({origin: CORS_ORIGIN ?? http://localhost:5173, credentials: true})` → `rateLimiter` (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, default 100 req/60s) → `morgan('combined')` → `express.json({limit:'10mb'})` → `urlencoded` → `cookieParser()` → `requestContext` (AsyncLocalStorage holding the client IP so `logAction()` can fill `audit_logs.ip_address`; set `TRUST_PROXY=<hops>` behind a proxy, never `true`) → `/health` → Swagger (`/api-docs`, spec loaded from `docs/api/api-spec.yaml` in a try/catch — a missing spec only logs a warning) → 13 domain routers → 404 handler → `errorHandler` (must stay last). `config/db.config.ts#connectDB()` requires `MONGODB_URI`, `maxPoolSize: 10`.

**Models** (`src/models/*.model.ts`, one per file): `user`, `farm` (+ embedded members; soft-deleted — `utils/softDelete.util.ts#applySoftDeleteScope` hides `is_deleted` docs from every `find*`/`countDocuments` unless the filter names `is_deleted`, same for `harvestBatch`; delete a farm via `farm.service#softDeleteFarm`, which also resolves open alerts and expires pending invitations), `houseZone` (House + Zone, with threshold history, fuzzy-control tuning and detection tuning + their histories, each entry recording the editor's role), `device` (SensorNode + CameraNode), `audioTrack` (lullaby files per device on MinIO via `config/minio.config.ts`; the real copy lives on the DFPlayer SD card), `telemetry`, `alert`, `auditLog`, `systemSetting` (singleton, unique `_singleton` key), `invitation`, `ticket`, `harvestBatch`, `birdCountRecord`, `ticketMessage`, `maintenanceSchedule`, `provisionedDevice`, `relayOverrideLog` (one row per manual override — who, role, relay, forced state, start/expiry/end, end reason; ENV-FR-019; written best-effort *after* the relay command is published), `zoneHealthReport` (EXPERT-FR-005/006). No SALES module, no Marketplace (`harvest.service.ts` only records harvests).

**Background jobs** (`src/jobs/*.job.ts`, `node-cron`):

| Job | Schedule | Does |
|---|---|---|
| `deviceOffline.job.ts` | every 10s | stale heartbeat (>30s) → SensorNode ONLINE→OFFLINE, emits `DEVICE_STATUS_CHANGE` |
| `activationOverdue.job.ts` | every 1 min | `markOverdueActivations()` — device registered but no first heartbeat after 15 min (Flow 1 case 8a); `markOtaTimeouts()` — OTA unconfirmed after 30 min counts as failed (Flow 15) |
| `overrideExpiry.job.ts` | every 1 min | reverts relays whose manual override expired back to AUTO |
| `alertEscalation.job.ts` | every 2 min | ticket for CRITICAL/HIGH alerts unacknowledged >15 min (`NODE_OFFLINE`: offline >1 h even if acknowledged, one ticket per outage); auto-resolves `THRESHOLD_BREACH` not seen for 5 min and episodic device alerts (`NOISE_ANOMALY`, `PUMP_DRY`) not seen for 60 min (firmware re-sends those every 15 min while the incident lasts) |
| `slaBreach.job.ts` | every 2 min | `ticket.service#markBreachedTickets()` — open tickets past SLA (TICKET-FR-009) |
| `invitationExpiry.job.ts` | hourly | invitations older than 7 days → EXPIRED |
| `maintenanceSchedule.job.ts` | hourly | `generateDueMaintenanceTickets()` — MAINTENANCE ticket `MAINTENANCE_LEAD_DAYS` (default 3) before `next_due_at`, then rolls the cycle (TICKET-FR-013); `accumulateRelayUsage()` — pump/fan on-hours and switches into `sensor_nodes.relay_usage`, ticket past `RELAY_SERVICE_LIMITS` (TICKET-FR-018) |
| `sensorAnomaly.job.ts` | every 10 min | `scanSensorAnomalies()` — stuck temp/humidity (2 h), repeated impossible jumps, drift between devices of a zone → `SENSOR_ANOMALY` (MEDIUM), auto-resolved (ALERT-FR-010) |
| `forecast.job.ts` | every 10 min (offset 5) | `scanForecastBreaches()` — Holt damped-trend 60-min forecast; in range now but forecast to cross → `FORECAST_BREACH` (LOW), auto-resolved (ALERT-FR-011) |
| `healthReport.job.ts` | `HEALTH_REPORT_CRON` (default Mon 06:00) | `generateWeeklyReports()` — one `zone_health_reports` row per zone with telemetry in the last `HEALTH_REPORT_DAYS` (default 7); notifies owners and experts (EXPERT-FR-005/007) |

**Ticket visits** (`ticket.service.ts`, `utils/visitTime.util.ts`): `scheduled_visit_at` must be in the future and within **07:00–18:00 Vietnam time** on every path that sets it — `assertValidVisitTime()` on create, `scheduleVisit` (`PUT /tickets/:id/scheduled-date`), admin-override and maintenance `next_due_at`; the maintenance job pushes a late slot to the next 07:00 with `nextVisitSlot()`. Format with `formatVisitTime()` (always VN time). INSTALLATION gets its visit at creation; fault tickets never carry one at creation — the assignee sets it via `scheduleVisit` once `IN_PROGRESS` (SRS Flow 9 step 6b); MAINTENANCE only comes from schedules. Any ticket with a field visit (`requiresFieldVisit()`) needs the full SAT checklist before `CLOSED`.

**Socket.io** (`src/socket/index.ts`): JWT-authenticated in `io.use` (`socket.handshake.auth.token` vs `JWT_ACCESS_SECRET`). Clients `JOIN_ZONE`/`LEAVE_ZONE` room `zone:${zoneId}`. Services never touch `io` directly — they call `emitTelemetryUpdate`, `emitRelayUpdate`, `emitBirdCountUpdate`, `emitAlertNew`, `emitDeviceStatusChange`.

**Alert Engine** (`alert.service.ts`): `createAlert()` is the single entry point. Only HIGH/CRITICAL escalate to tickets, so every *inferred* type (`NOISE_ANOMALY`, `SENSOR_ANOMALY`, `FORECAST_BREACH`, `LOW_RETURN_RATE` — `INFERRED_ALERT_TYPES`) stays MEDIUM/LOW; `ingestDeviceAlert` caps those and `THRESHOLD_BREACH` at MEDIUM and maps the old `BIRD_PANIC` name from firmware < 1.3.0. NH3/CO2 breaches are alert-only (ALERT-FR-012). Domain Expert verdicts go through `PUT /alerts/:id/verdict` (`alerts.expert_verdict`, EXPERT-FR-003), separate from `acknowledge` (Farm Owner/Technician/Admin). Dedup per incident: an open (`ACTIVE`/`ACKNOWLEDGED`) alert with the same `farm_id + zone_id + node_id + type` only bumps `last_seen_at` + `occurrence_count` (at most once a minute) and returns `null`. `NODE_OFFLINE` resolves when the device returns (`device.service.ts#announceBackOnline`, shared by `recordHeartbeat` and `markNodeSeen`). New alerts emit `ALERT_NEW` and fire-and-forget `dispatchAlertNotification()` (`notification.service.ts`: recipients are the farm's owners, not experts; **Telegram** really sends via `telegram.service.ts` — ALERT-FR-013; FCM push only logs; Zalo/SMS out of scope; no in-app inbox).

**Auth** (`auth.service.ts` + `auth.route.ts`): `register/login/refresh/logout/otp/send/otp/verify/forgot-password/reset-password/notification-preferences/telegram/link/delete-request` (invitation accept/decline in `invitations.route.ts`). Access token: JWT (`JWT_ACCESS_TTL`, default 15m) in the JSON body, checked by `authenticate` and Socket.io. Refresh token (`JWT_REFRESH_TTL`, default 30d): httpOnly cookie (`secure` in prod, `sameSite: 'strict'`) *and* stored in `user.refresh_tokens[]` so it is individually revocable; `/refresh` checks both; `resetPassword` wipes the array. OTP/reset codes are 6-digit and SHA-256-hashed; in dev they are only logged.

**MQTT**: topics `swiftletcare/{farmId}/{houseId}/{zoneId}/...` use real MongoDB ObjectIds (matters for firmware provisioning). Ingestion keys off `deviceId` inside the JSON payload (`SensorNode.device_id`), not topic segments — topics only drive wildcard subscription (`mqtt/mqtt.client.ts`, `TOPICS`).

**Roles** (`types/domain.types.ts`, enforced with `requireRole(...)` in `middlewares/auth.middleware.ts`): `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`. `DOMAIN_EXPERT` is invited farm-wide by the primary Farm Owner (`POST /farms/:id/members` with `role`). Per SRS §4.4 the expert reads dashboards, analytics, alerts, harvests, override history and health reports; edits zone thresholds, fuzzy coefficients and detection tuning; sets alert verdicts and report conclusions — and cannot drive relays or the speaker, touch tickets or maintenance schedules, write harvests, acknowledge alerts, edit/delete farms, manage members or create houses/zones. One email = one role.

**Env vars** (full list in `.env.example`): app (`NODE_ENV`, `PORT`), DB (`MONGODB_URI`, `MONGODB_TEST_URI`), auth (`JWT_ACCESS_SECRET/TTL`, `JWT_REFRESH_SECRET/TTL`), MQTT (`MQTT_BROKER_URL`, `MQTT_USERNAME/PASSWORD`, `MQTT_CA_CERT_PATH`), CORS (`CORS_ORIGIN`), MinIO (`MINIO_*`), notifications (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`; `FIREBASE_*`, `SMTP_*`, `ZALO_*` not read yet), health reports (`HEALTH_REPORT_CRON`, `HEALTH_REPORT_DAYS`), rate limiting (`RATE_LIMIT_WINDOW_MS/MAX`).

## Rules

### Layers
- **[Bắt buộc]** Controllers hold no business logic: read `req.params/body/query/user`, call exactly one service function, return `res.json({ success, data, meta? })`. Every handler is wrapped in `asyncHandler` (`utils/asyncHandler.util.ts`); no hand-written `try { … } catch (err) { next(err) }`, no error formatting in the controller.
- **[Bắt buộc]** Only services query the DB, check permissions, publish MQTT and emit socket events. Services throw via `utils/appError.util.ts` (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError`, `UnauthorizedError`); only `middlewares/errorHandler.middleware.ts` turns them into HTTP responses.
- **[Bắt buộc]** MQTT handlers (`mqtt/handlers/*.handler.ts`) are thin adapters: parse `topicParts`/`message`, call one service function, never query the DB.
- **[Bắt buộc]** Services emit realtime events only through the `emit*()` helpers in `socket/index.ts`.

### API surface
- **[Bắt buộc]** Every response uses the envelope `{ success, data?, meta?: {page,limit,total}, error?: {code, message} }`; list endpoints paginate with `utils/helpers.util.ts#paginate()` (default 20, max 100).
- **[Bắt buộc]** Every route validates its params/query/body with `express-validator` followed by `validate` (`middlewares/validate.middleware.ts`). Filters that reach a Mongo query are checked as strings first (`.isString()` before `isIn`/`isMongoId`) so `?x[$ne]=` and repeated params cannot become operators or arrays.
- **[Bắt buộc]** Every route that changes state, or reads data a role must not see, has `requireRole(...)` matching the SRS §4.4 matrix. A new action never opens to `DOMAIN_EXPERT` if §4.4 says the expert only reads it.
- **[Bắt buộc]** A route added, removed or changed (path, method, params, body, response fields, roles) updates `docs/api/api-spec.yaml` **in the same PR**. Routes stay unprefixed (no `/api/v1`).
- **[Bắt buộc]** Shared enums (`Role`, `AlertType`, `AlertSeverity/Status`, `DeviceStatus`, `TicketType/Priority/Status`…) in `types/domain.types.ts` change only together with the frontend/mobile copies in the same PR, or the PR says which follow-up PR updates them.

### Data access and permissions
- **[Bắt buộc]** Farm access goes through `utils/farmAccess.util.ts` (`hasFarmAccess`, `isPrimaryOwner`, `assertFarmAccess`, `assertZoneAccess`, `assertZoneInFarm`, `findFarmOrThrow`, `findZoneChainOrThrow`, `listAccessibleFarmIds`/`listAccessibleZoneIds`) — never reimplemented in a service. There is no per-Zone scope; what a role may *do* is decided by `requireRole` on the route.
- **[Bắt buộc]** Soft-deleted farms/harvests stay hidden: query through the models (the `applySoftDeleteScope` hook), delete a farm only via `farm.service#softDeleteFarm`.
- **[Bắt buộc]** `Zone.farm_id` is immutable; zone→farm lookups use it, not `House`.
- **[Bắt buộc]** Sensitive state changes (users, roles, members, thresholds, tuning, overrides, system settings, ticket admin actions) write an audit row with `logAction()`.

### Device, MQTT and control
- **[Bắt buộc]** A command meant for one device on a zone topic (`relay/command`, `audio/command`, `config/reassign`, a `config/update` carrying speaker settings or RESTART/OTA) carries `deviceId: node.device_id`.
- **[Bắt buộc]** `utils/fuzzyModel.util.ts` mirrors `firmware/src/pid/FuzzyControl.cpp`; a change to one is made to the other in the same PR, with the shared test cases updated.
- **[Bắt buộc]** Runtime device parameters (thresholds, fuzzy coefficients, detection tuning) go out through `buildDeviceConfig`/`config/update`, validated against the same ranges the firmware clamps to.
- **[Bắt buộc]** Inferred alert types stay MEDIUM/LOW and never create tickets; alerts go through `createAlert()`/`ingestDeviceAlert`.

### Scope and constants
- **[Bắt buộc]** Nothing new for what SRS §0.2 removed (Marketplace/Buyer, Farm Operator and zone scope, predator detection, heating, Zalo/SMS, NH3/CO2 driving the fan).
- **[Bắt buộc]** No threshold, limit or behaviour without a source (SRS, the Domain Expert, a cited reference). An engineering constant that has to be picked anyway is added to the unconfirmed-assumptions list at the end of SRS §0.5 in the same PR.
- **[Nên]** Technician/ticket/Admin code is a side flow: keep it working, do not extend it (SRS §0.2 #11).

### Quality
- **[Bắt buộc]** No `console.*` outside `src/scripts/` (ESLint `no-console`); log through `utils/logger.util.ts`. No unused vars (prefix `_` when a signature needs them).
- **[Bắt buộc]** No `any`/`as any`/`@ts-ignore` in new code; unknown input is `unknown` and narrowed.
- **[Bắt buộc]** New or changed service logic has Jest tests (unit, or integration with `mongodb-memory-server`) covering the main path and the permission/validation failures; a bug fix adds a test that fails without it.
- **[Bắt buộc]** Migrations in `src/scripts/migrate-*.script.ts` are idempotent (safe to run twice) and get an `npm run migrate:*` script plus a line in this file's Commands.
- **[Bắt buộc]** A new env var is added to `.env.example` with a comment, and read with a safe default or a clear startup error.
- **[Bắt buộc]** File naming `<resource>.<layer>.ts` with the layer spelled out (`.service`, `.controller`, `.route`, `.model`, `.middleware`, `.util`, `.handler`, `.job`, `.script`) — never `farmService.ts`.
- **[Nên]** Comments explain *why* (business reason, SRS FR code), not what the code does.

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `package.json` `jest.coverageThreshold.global.lines: 80` | Line coverage is ~78%, so `npm test` and the CI Backend job fail on coverage although all tests pass | Owner decides: add tests, lower the threshold to the current level and raise it over time, or report coverage without failing |
| `notification.service.ts` FCM | Push only logs; Telegram is the one channel that really sends (ALERT-FR-013 is met by Telegram) | Wire FCM when mobile registers tokens |
| Low coverage areas (`jobs/` 0%, `analytics.service.ts`, `notification.service.ts`) | Little or no test coverage | Add tests when touching them |
| Bird counting (VISION) | Backend side exists but nothing real publishes bird counts (`ai-pipeline/` not deployed) | — |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse.

## Before opening a PR

- **[Bắt buộc]** In `backend/`: `npm run lint`, `npm run build:check` and `npm test` pass (the coverage threshold aside, while it is in Known debt).
- **[Bắt buộc]** `docs/api/api-spec.yaml` updated for any route change; `.env.example` for any new env var; SRS §0.5 assumptions list for any new hand-picked constant.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (backend scopes are usually `api`, `db`, `mqtt`, `auth`, `alert`, `env`).
