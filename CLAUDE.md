# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It holds what every module shares; each module's own `CLAUDE.md` holds its architecture and rules and is loaded when you work in that folder.

## Project overview

SwiftletCare — IoT monitoring + automation system for swiftlet (yến) houses (KLTN/thesis project, FA26, FPT University). Modules, each independent (no root `package.json`/workspace):

- `firmware/` — ESP32 (PlatformIO): RS485 sensors, fuzzy relay control, MQTT, lullaby speaker. → `firmware/CLAUDE.md`
- `backend/` — Node.js + Express + TypeScript + MongoDB + MQTT (EMQX) + Socket.io. → `backend/CLAUDE.md`
- `frontend/` — React 18 + Vite + TailwindCSS web dashboard/PWA. → `frontend/CLAUDE.md`, rules in `frontend/FE_Design_Claude.md`
- `mobile/` — Expo (Router, file-based routes) + React Native app, talks to the same backend API. → "Mobile" below
- `ai-pipeline/` — YOLOv8 (ONNX Runtime) + ByteTrack bird counting on a PC/cloud AI node (plan in `docs/bird-counting-plan.md`). **Scaffold only, not implemented/deployed**; no `models/` folder, ONNX weights are never committed. → "AI pipeline" below
- `docs/` — `docs/api/api-spec.yaml` is the OpenAPI 3.0 **source of truth** for the API contract; the backend reads it at boot and serves Swagger UI at `/api-docs`. Routes are unprefixed (no `/api/v1`, despite what the SRS narrative implies).

**`SwiftletCare_SRS.md` §5, column "Trạng thái Backend"** is the single source of truth for per-requirement (FR) completion status — check it before assuming a feature is done.

**Scope after council Review 1 — SRS v2.0.0 (`SwiftletCare_SRS.md` §0).** The capstone register was revised (`FA26_SE_Capstone_Project_Register_SwiftletCare_v2.docx`) and later reviews judge the system against it; SRS §0 wins over any older text. **`backend/` and `firmware/` (1.3.0) follow the v2 scope**; `frontend/`, `mobile/` and `ai-pipeline/` still follow v1.24.0. SRS §0.5 lists what is left per module; rows marked `🔄 Cần sửa code (v2.0.0)` in §5 are the same list at FR level. In short:

- **Main flow is the automated system**, not the business platform: fuzzy microclimate control, bird in/out counting with an annotated live stream, multi-modal health monitoring with an expert in the loop. Technician/tickets/Admin are a side flow — keep them working, don't extend them.
- **Domain Expert replaces Farm Operator** (role `DOMAIN_EXPERT`, whole farm, no `zone_ids`): read-only on operations, confirms/rejects inferred alerts, approves thresholds and fuzzy coefficients, tunes six per-Zone detection parameters (EXPERT-FR-008), writes conclusions for the Farm Owner (SRS §5.12). No relay control, tickets, harvest writes or alert acknowledgement. Permissions per role: SRS §4.4.
- **Removed:** Buyer + Marketplace (harvest recording stays), predator detection, heating, Zalo/SMS (the out-of-app channel is a Telegram bot or FCM push — one must really send; ALERT-FR-013). Vision is one class (`swiftlet`) on a PC/cloud AI node, not a Raspberry Pi.
- **NH3/CO2 are monitor-and-alert only** — they no longer drive the fan. `BIRD_PANIC` became `NOISE_ANOMALY`, a supporting signal shown with bird counts and confirmed by the expert.
- **Never invent a threshold or behaviour without a source**; if none is found, downgrade the claim (alert-only, "set by the Domain Expert"). Engineering constants that had to be picked anyway are listed as unconfirmed assumptions at the end of SRS §0.5 — add any new one there.

Known repo quirks:
- `docs/db/` does not exist, yet `docker-compose.yml` bind-mounts `./docs/db/mongo-init.js` as Mongo's `/docker-entrypoint-initdb.d/init.js` — Docker creates an empty directory there on first `up`, so the DB init hook is a silent no-op.
- `docs/hardware/` only has `BOM.md` (no circuit diagram or prototype photos); `docs/test-reports/` only has a `.gitkeep`.

### Per-module rules

Each module has its own lead and its own rules. Judge a change only against the rules of the module it lives in — never apply frontend folder/naming rules to backend code or vice versa. Rule sources, in precedence order (the first one wins):

| Module | Rule sources |
|---|---|
| `backend/` | `backend/CLAUDE.md` · `backend/README.md` · `backend/.eslintrc.cjs` · `docs/api/api-spec.yaml` (API contract) |
| `frontend/` | `frontend/FE_Design_Claude.md` (design tokens, components, i18n, mock data, §12 folders + naming, §13 code rules, target structure) · `frontend/CLAUDE.md` (structure as the code is today) · `frontend/README.md` · `frontend/.eslintrc.cjs` |
| `mobile/` | "Mobile" section below · `mobile/README.md` |
| `firmware/` | `firmware/CLAUDE.md` · `firmware/README.md` |
| `ai-pipeline/` | "AI pipeline" section below · `ai-pipeline/README.md` · `docs/bird-counting-plan.md` |

Repo-wide: commit messages (`.commitlintrc.json`), the PR template (`.github/pull_request_template.md`) and the cross-module rules below.

### Cross-module rules

These bind more than one module, so a PR on either side must respect them:

- **API contract.** `docs/api/api-spec.yaml` describes every route; a route change updates it in the same PR, and frontend/mobile calls follow it.
- **Shared enums.** `backend/src/types/domain.types.ts`, `frontend/src/types/` and `mobile/types/` keep the same enum values (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`…). They are not a generated mirror — renaming on one side changes nothing on the other.
- **MQTT.** Topics are `swiftletcare/{farmId}/{houseId}/{zoneId}/...` with real MongoDB ObjectIds. Backend ingestion keys off `deviceId` inside the payload, not topic segments. Any command meant for one device on a zone topic (`relay/command`, `audio/command`, `config/reassign`, a `config/update` carrying speaker settings or RESTART/OTA) carries `deviceId`; firmware drops commands addressed to another device and applies ones without it (zone-wide thresholds).
- **Fuzzy model.** `firmware/src/pid/FuzzyControl.cpp` and `backend/src/utils/fuzzyModel.util.ts` change together, with the shared test cases.
- **Runtime parameters** (thresholds, fuzzy coefficients, detection tuning) use the same names and ranges in the backend validator and the firmware clamp.

## Commands

Each module's own file lists its full command set. The ones you need most:

```bash
docker compose up -d mongodb emqx          # infra (add minio, redis if needed)
cd backend  && npm run dev                 # API on :3000 — dev MQTT must be mqtt://localhost:1883 (EMQX self-signs 8883)
cd frontend && npm run dev                 # http://localhost:5173, proxies /api and /socket.io to :3000
cd firmware && pio test -e native          # firmware host-side unit tests
```

Mobile (`mobile/`): Expo app pointing at `localhost:3000` by default (`constants/api.ts`); scripts `start`/`android`/`ios`/`prebuild`, `build:dev|preview|prod` (EAS profiles in `eas.json`), `lint`, `test` (jest), `typecheck`.

## Mobile (`mobile/`)

Expo Router (file-based routing) under `mobile/app/`: `(auth)` group (login/register) and `(tabs)` group (dashboard/alerts/analytics/farms/tickets/settings), plus detail routes `farm/[farmId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`, `ticket/[ticketId]`, `livestream/[zoneId]`. Supporting code in `config/`, `constants/`, `hooks/`, `services/`, `store/`, `types/`, `utils/` (no `components/` folder yet). Talks to the **same backend**, unprefixed routes (`constants/api.ts`'s `ENDPOINTS` map follows `docs/api/api-spec.yaml`). React Query + Zustand + axios + socket.io-client, same overall pattern as the web frontend; storage via `react-native-mmkv`, charts via `victory-native`. Most screens are stubs. Still on the v1.24.0 scope: no `DOMAIN_EXPERT`, `BIRD_PANIC` labels, Zalo/SMS options, no FCM registration (SRS §0.5 Mobile) — only remove or replace these, never extend them.

## AI pipeline (`ai-pipeline/`) — scaffold, not deployed

`src/stream.py` (RTSP loop) → `inference.py` (YOLOv8 via ONNX Runtime) → `tracker.py` (ByteTrack) → `counting.py` (line-crossing entry/exit) → `alert_publisher.py` (MQTT). The backend subscribes to `vision/bird-count`, but `backend/src/mqtt/handlers/birdCount.handler.ts` is still a stub that only logs (plan §8 adds `birdCount.service.ts`). `config/config.yaml` covers the RTSP source, model thresholds, MQTT (TLS 8883), MinIO snapshot upload and morning/evening session windows. It still lists 4 classes (swiftlet/rat/snake/owl) with predator settings — SRS v2 keeps only `swiftlet`, so the predator parts may only be removed, never extended.

## Module completion status (see SRS §5 for FR-level detail)

Backend and firmware match SRS v2 (§0.5 backend/firmware lists are done except the bird-counting items and the physical bypass switch): AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, System, Harvest and the EXPERT module (alert verdicts, detection tuning, override history + automatic-time ratio, zone health reports) all have real backend logic. Firmware 1.3.0 is built and host-tested only, not yet exercised on a real board. **The frontend has not caught up** (still `sales-staff/`, marketplace screens, heating toggle, no Domain Expert — `frontend/CLAUDE.md`), and mobile is a scaffold. **Vision/AI** is not wired end-to-end: the read side exists (`GET /analytics/bird-count/daily|trends`, used by the Analytics page), but the MQTT handler `birdCount.handler.ts` only logs (nothing writes `birdCountRecord` or raises `LOW_RETURN_RATE`) and `ai-pipeline` isn't implemented or deployed — `docs/bird-counting-plan.md` covers all three.

## Conventions

- Commit messages follow Conventional Commits with a project-specific `type`/`scope` enum enforced by commitlint (`.commitlintrc.json`). CI (`.github/workflows/ci.yml`) validates them via `wagoid/commitlint-github-action`, runs a gitleaks secret scan, and — only for the modules a PR touches (`dorny/paths-filter`) — runs **backend** `npm run lint` · `build:check` · `npm test` (integration tests use `mongodb-memory-server`), **frontend** `npm run lint` · `tsc --noEmit` · `vitest run` · `npm run build`, **firmware** `pio test -e native`. Mobile has no lockfile yet, so it has no CI job. Run the same commands locally before pushing.
- Both `backend` and `frontend` use the `@/*` → `src/*` path alias.

## Working with Claude

- Reply to the user in Vietnamese.
- Review a PR with `/review-pr <PR number>` (`.claude/commands/review-pr.md`). That file is the single review procedure: the "PR auto-review" routine on claude.ai reads it too, so change review behaviour there, not in the routine. It judges each module by its own rules plus SRS §0 scope and the cross-module rules, and posts a COMMENT-only review on the owner's own PRs. A PR-triggered routine run is checked out at the PR's head, so the routine must read `review-pr.md` from the PR's base branch (`git show origin/<base>:.claude/commands/review-pr.md`), never from the checkout — otherwise a PR could change the rules it is reviewed by. Routine runs have no built-in `/code-review`; the command then falls back to a find-then-verify review with `Agent` subagents. When reviewing, read code and diffs only — never run `npm install`/`npm ci`, builds or test suites.
- Commits and PRs carry no Claude attribution (`.claude/settings.json` sets `attribution` to empty) — don't add `Co-Authored-By`, session links or similar lines by hand either.
