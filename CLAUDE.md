# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It holds what every module shares; each module's own `CLAUDE.md` holds its architecture and rules and is loaded when you work in that folder.

## Project overview

SwiftletCare — IoT monitoring + automation system for swiftlet (yến) houses (KLTN/thesis project, FA26, FPT University). Modules, each independent (no root `package.json`/workspace):

- `firmware/` — ESP32 (PlatformIO): RS485 sensors, fuzzy relay control, MQTT, lullaby speaker. → `firmware/CLAUDE.md`
- `backend/` — Node.js + Express + TypeScript + MongoDB + MQTT (EMQX) + Socket.io. → `backend/CLAUDE.md`
- `frontend/` — React 18 + Vite + TailwindCSS web dashboard/PWA. → `frontend/CLAUDE.md`, rules in `frontend/FE_Design_Claude.md`
- `mobile/` — Expo (Router, file-based routes) + React Native app, talks to the same backend API. → "Mobile" below
- `ai-pipeline/` — YOLO26n (ONNX Runtime) + ByteTrack bird counting on a PC/cloud AI node (plan in `docs/bird-counting-plan.md`). **Not deployed:** it tracks and counts on clips and RTSP but publishes nothing yet, and there is no trained swiftlet model (the COCO model finds no bird in infrared images); no `models/` folder, ONNX weights are never committed. → "AI pipeline" below
- `docs/` — `docs/reports/` holds the Review 2 reports: **Report 3 `report3-srs.md` (requirements)**, **Report 4 `report4-sdd.md` (design)** and `README.md` (report status, code gaps, BM03 draft). `docs/api/api-spec.yaml` is the OpenAPI 3.0 **source of truth** for the API contract; the backend reads it at boot and serves Swagger UI at `/api-docs`. Routes are unprefixed (no `/api/v1`). `docs/database/init.mongo.js` is the database script generated from the Mongoose models (`npm run db:script` in `backend/`).

**Requirements and design: Report 3 and Report 4.** `docs/reports/report3-srs.md` (Report 3, SRS 3.0.0, English) is the requirements baseline and `docs/reports/report4-sdd.md` (Report 4) is the design; they win over every other text, including `SwiftletCare_SRS.md`, which is now an internal Vietnamese record (scope history, detailed flows) — never add requirements there. FR codes are the same in both. Where the code still differs from Report 3, the gap is listed in `docs/reports/README.md` ("Chỗ lệch") and Report 4 §12: check them before assuming a feature is done, and update that list in the PR that closes a gap.

**Scope (Report 3 §1.2, §2.2, §8).** Reviews judge the system against the revised capstone register (`FA26_SE_Capstone_Project_Register_SwiftletCare_v2.docx`) plus the BM03 changes drafted in `docs/reports/README.md`. **`backend/` and `firmware/` (1.4.0) follow the Review 1 scope**, with the Report 3 gaps above; `frontend/`, `mobile/` and `ai-pipeline/` still follow v1.24.0. In short:

- **Main flows MF-01…11 are the automated system** (Report 3 §2.2): fuzzy microclimate control, offline operation and recovery, self-diagnosis and alerts, early warning by forecast, bird counting with an annotated live stream, abnormal noise, expert validation and tuning, manual override, device setup by the Farm Owner, and the daily health assessment with periodic reports. Supporting flows SF-02 (tickets), SF-03 (accounts) and SF-04 (harvest logging) are priority S — keep them working, don't extend them.
- **Multi-modal health = one daily status per house (MF-11):** environment, air quality, flock return rate and abnormal noise are each rated against the house's levels and combined by agreement between sources (BR-28…30, rain as context from a weather API), with reasons; daily/weekly/monthly reports export to PDF/CSV; the Farm Owner and the expert rate each day from their own observation before seeing the status (BR-31), and the agreement is measured (NFR-14). The status is an indicator, not a diagnosis.
- **Device setup is the Farm Owner's (MF-10):** in the mobile app, scan the label QR of a controller (device ID + activation key, FARM-FR-010) and the QR code of its floor (FARM-FR-011). Nothing about the farm is typed on the device: the AP-mode page takes only Wi-Fi and the broker address, and the backend corrects the controller's topic at its heartbeat (FARM-FR-003c, BR-26/27). A Technician does the same steps only on an installation ticket.
- **Domain Expert** (role `DOMAIN_EXPERT`, whole farm, no `zone_ids`): reads operations; confirms or rejects inferred alerts (a rejected one becomes `DISMISSED`); edits zone thresholds and fuzzy coefficients, reviews the Farm Owner's own changes (EXPERT-FR-010) and is the only one who applies a coefficient suggestion (EXPERT-FR-011); tunes five per-Zone detection parameters and the per-House return-rate drop (EXPERT-FR-008), the counting ring and the counting schedule; writes conclusions. No relay control, tickets, harvest writes or alert acknowledgement. The Farm Owner is notified of every expert decision (EXPERT-FR-009); on a farm without an expert the Farm Owner takes those decisions (BR-22). Thresholds and fuzzy coefficients belong to the farm: Technician and Administrator never edit them, and the Administrator's system defaults are copied into a zone only at creation or reset (ENV-FR-007/020). Permissions per role: Report 3 §2.4.
- **Out of scope (Report 3 §8):** Buyer + Marketplace (harvest logging stays), predator detection, heating, Zalo/SMS. Out-of-app alerts go through **both** a Telegram bot (ALERT-FR-013) and FCM push (ALERT-FR-002). Vision is one class (`swiftlet`) on a PC/cloud AI node, not a Raspberry Pi; cameras, bird counts and their alerts belong to the House (Report 3 §2.8).
- **NH3/CO2 are monitor-and-alert only** — they never drive the fan. `BIRD_PANIC` became `NOISE_ANOMALY`, an inferred signal shown with bird counts and validated by the expert.
- **Never invent a threshold or behaviour without a source**; if none is found, downgrade the claim (alert-only, "set by the Domain Expert"). An engineering constant that had to be picked anyway is added to Report 3 §4.5 (assumption A-4) in the same PR.

Known repo quirks:
- `docker compose` runs no Mongo init script: the backend logs in as the root user from `docker-compose.yml`, and collections/indexes come from Mongoose, `npm run seed` and `npm run migrate:*`. `docs/database/init.mongo.js` (Report 4 §6.5) is run by hand with `mongosh` when a database must be created from scratch. A machine that ran an older compose file may hold an empty `docs/db/` folder (untracked) — safe to delete.
- Docs live under `docs/` (map: `docs/FOLDER_STRUCTURE.md`); only the old `SwiftletCare_SRS.md` stays at the repo root. `docs/hardware/` has `BOM.md` and `components-guide.md` but no circuit diagram or prototype photos; `docs/test-reports/` only has a `.gitkeep`.

### Per-module rules

Each module has its own lead and its own rules. Judge a change only against the rules of the module it lives in — never apply frontend folder/naming rules to backend code or vice versa. Rule sources, in precedence order (the first one wins):

| Module | Rule sources |
|---|---|
| `backend/` | `backend/CLAUDE.md` · `backend/README.md` · `backend/.eslintrc.cjs` · `docs/api/api-spec.yaml` (API contract) |
| `frontend/` | `frontend/FE_Design_Claude.md` (design tokens, components, i18n, mock data, §12 folders + naming, §13 code rules, target structure) · `frontend/CLAUDE.md` (structure as the code is today) · `frontend/README.md` · `frontend/.eslintrc.cjs` |
| `mobile/` | `mobile/CLAUDE.md` when present · "Mobile" section below · `mobile/README.md` |
| `firmware/` | `firmware/CLAUDE.md` · `firmware/README.md` |
| `ai-pipeline/` | `ai-pipeline/CLAUDE.md` when present · "AI pipeline" section below · `ai-pipeline/README.md` · `docs/bird-counting-plan.md` |

Repo-wide: commit messages (`.commitlintrc.json`), the PR template (`.github/pull_request_template.md`) and the cross-module rules below.

### Cross-module rules

These bind more than one module, so a PR on either side must respect them:

- **API contract.** `docs/api/api-spec.yaml` describes every route; a route change updates it in the same PR, and frontend/mobile calls follow it.
- **Shared enums.** `backend/src/types/domain.types.ts`, `frontend/src/types/` and `mobile/types/` keep the same enum values (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`…). They are not a generated mirror — renaming on one side changes nothing on the other. Report 3 still needs `DISMISSED` in `AlertStatus`, `CONFIG_MISMATCH` and `ACTUATOR_FAULT` in `AlertType` and the removal of `PREDATOR_DETECTED`; each lands on all three sides in one PR.
- **MQTT.** ESP32 topics are `swiftletcare/{farmId}/{houseId}/{zoneId}/...`; the bird-counting AI node publishes per house, `swiftletcare/{farmId}/{houseId}/heartbeat|vision/bird-count|vision/alert` (the camera watches the entrance of the whole house, so cameras, bird counts and their alerts belong to the House, not a Zone — Report 3 §2.8). Real MongoDB ObjectIds. A controller's farm, house and zone come only from its registration: the backend sends `config/reassign` when a heartbeat arrives on another topic than the registered zone (FARM-FR-003c), so no identity field goes back onto the AP-mode page. Backend ingestion keys off `deviceId` inside the payload, not topic segments. Any command meant for one device on a zone topic (`relay/command`, `audio/command`, `config/reassign`, a `config/update` carrying speaker settings or RESTART/OTA) carries `deviceId`; firmware drops commands addressed to another device and applies ones without it (zone-wide thresholds).
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

Expo Router (file-based routing) under `mobile/app/`: `(auth)` group (login/register) and `(tabs)` group (dashboard/alerts/analytics/farms/tickets/settings), plus detail routes `farm/[farmId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`, `ticket/[ticketId]`, `livestream/[zoneId]`. Supporting code in `config/`, `constants/`, `hooks/`, `services/`, `store/`, `types/`, `utils/` (no `components/` folder yet). Talks to the **same backend**, unprefixed routes (`constants/api.ts`'s `ENDPOINTS` map follows `docs/api/api-spec.yaml`). React Query + Zustand + axios + socket.io-client, same overall pattern as the web frontend; storage via `react-native-mmkv`, charts via `victory-native`. Most screens are stubs. Still on the v1.24.0 scope: no `DOMAIN_EXPERT`, `BIRD_PANIC` labels, Zalo/SMS options, no FCM registration — only remove or replace these, never extend them. Report 3 makes mobile carry two main-flow pieces: FCM token registration (ALERT-FR-002) and device setup by QR scan (`expo-camera`, MF-10).

## AI pipeline (`ai-pipeline/`) — not deployed

`src/stream.py` (RTSP loop) runs `pipeline.py` (`FramePipeline`) on every frame: `frame_prep.py` (mask the camera's date overlay, cut 2 overlapping tiles) → `inference.py` (YOLO on ONNX Runtime per tile, YOLO26 and YOLOv8/11 outputs, tile duplicates merged) → `sv.ByteTrack` over the whole frame → `counting.py` (`RingCounter`: closed ring around the entrance hole, plus extrapolation of fast tracks because a bird at the hole is a 1–2-frame blur; plan §19.8) → green boxes drawn. `remote_config.py` applies the counting ring the Domain Expert draws. `tools/track_clip.py` runs the same `FramePipeline` on a clip. Not built yet (plan §6.6): MQTT publishing (session counts, 5-minute buckets, heartbeat), session switching, video push to MediaMTX. The backend side is ready: `vision/bird-count` → `backend/src/services/birdCount.service.ts` (session records, 5-minute buckets, `LOW_RETURN_RATE` job) and the AI node's heartbeat/`EDGE_AI_DEGRADED` (plan §8), plus live-stream access for MediaMTX (`stream.service.ts`, §8.6). `config/config.yaml` covers the tiles and mask, the model and its thresholds, tracking (ring, extrapolation), MQTT (TLS 8883) and the morning/evening session windows (only defaults: Report 3 has the backend compute sessions from 5-minute buckets per the house's counting schedule, VISION-FR-008/019); it has one class, `swiftlet` — predator detection may only be removed, never extended. Topics are per house: `swiftletcare/{farmId}/{houseId}/heartbeat|vision/bird-count|vision/alert` (`vision/alert` only for `EDGE_AI_DEGRADED`), and the node listens on `{houseId}/config/update` for the counting ring.

## Module status (FR-level gaps: `docs/reports/README.md`, Report 4 §12)

**Backend** has real logic for AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, System, Harvest, the EXPERT module (alert verdicts, detection tuning, override history + automatic-time ratio, zone health reports, in-app notifications) and the backend side of bird counting. Report 3 asks for more than the code does yet: Technician/Administrator are still allowed on thresholds, coefficients and overrides in some routes; Farm Owner device setup (Farm Owner on register/move/remove routes, moving an offline controller, re-issuing a key); `DISMISSED`; the Farm Owner fallback without an expert (BR-22); owner notifications and one expert activity history (EXPERT-FR-009); review items and suggestion proposals (EXPERT-FR-010/011); configuration version and `CONFIG_MISMATCH` (ENV-FR-027); alert evidence (ALERT-FR-014); the seasonal counting schedule and incomplete sessions (VISION-FR-019/020); real FCM sending (ALERT-FR-002); the daily health assessment, ratings, per-house reports and PDF/CSV export, weather (MF-11). **Firmware** 1.4.0 (remote RESTART/OTA with rollback) runs on a real ESP32 board, but which scenarios were checked on hardware is not recorded yet (`firmware/README.md`); it does not report a configuration version yet (ENV-FR-027); the bypass switch and the team's controller board with current transformers (THREAT-FR-014) are not built. **The frontend has not caught up** (still `sales-staff/`, marketplace screens, heating toggle, no Domain Expert, no setup/QR screens — `frontend/CLAUDE.md`), and mobile is a scaffold. **Vision/AI** is not wired end-to-end: the backend ingests `vision/bird-count`, stores session records and 5-minute buckets and raises `LOW_RETURN_RATE`, but `ai-pipeline` is not deployed (no trained model, publishes nothing yet) and no screen plays the live stream yet (the backend issues stream tokens and MediaMTX runs in `docker-compose.yml`) — `docs/bird-counting-plan.md` covers the rest.

## Conventions

- Commit messages follow Conventional Commits with a project-specific `type`/`scope` enum enforced by commitlint (`.commitlintrc.json`). CI (`.github/workflows/ci.yml`) validates them via `wagoid/commitlint-github-action`, runs a gitleaks secret scan, and — only for the modules a PR touches (`dorny/paths-filter`) — runs **backend** `npm run lint` · `build:check` · `npm test` (integration tests use `mongodb-memory-server`), **frontend** `npm run lint` · `tsc --noEmit` · `vitest run` · `npm run build`, **firmware** `pio test -e native`, **mobile** `npm run lint` · `typecheck` · `jest --passWithNoTests`. ai-pipeline has no CI job yet. Run the same commands locally before pushing.
- Tests are written by whoever builds the feature, in the same PR — not left for someone else later. How much is required is set per module (backend: [Bắt buộc] for new or changed service logic; frontend and mobile: [Nên] for pure logic; firmware: [Bắt buộc] for control/filter/detection logic).
- Both `backend` and `frontend` use the `@/*` → `src/*` path alias.

## Working with Claude

- Reply to the user in Vietnamese.
- Review a PR with `/review-pr <PR number>` (`.claude/commands/review-pr.md`). That file is the single review procedure: the "PR auto-review" routine on claude.ai reads it too, so change review behaviour there, not in the routine. It judges each module by its own rules plus the Report 3 scope and the cross-module rules, and posts a COMMENT-only review on the owner's own PRs. A PR-triggered routine run is checked out at the PR's head, so the routine must read `review-pr.md` from the PR's base branch (`git show origin/<base>:.claude/commands/review-pr.md`), never from the checkout — otherwise a PR could change the rules it is reviewed by. Routine runs have no built-in `/code-review`; the command then falls back to a find-then-verify review with `Agent` subagents. When reviewing, read code and diffs only — never run `npm install`/`npm ci`, builds or test suites.
- Keep `review-pr.md` lean: before adding a step or rule to it, name a real bug or rule break that the new step would have caught and the current text would not. Prefer a test or a CI check over a new review instruction — CI checks every PR the same way, a prompt does not.
- Commits and PRs carry no Claude attribution (`.claude/settings.json` sets `attribution` to empty) — don't add `Co-Authored-By`, session links or similar lines by hand either.
