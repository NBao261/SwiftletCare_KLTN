# Design Brief – Review 2 (BM01)

Source of form BM01. The Word file `design-brief/SWP490_R2_BM01_Design_Brief_SwiftletCare.docx` is generated from the tables below, so edit this file first and then regenerate it. Details are in the registration form v3 (`registration-v3.md`), Report 3 (SRS) and Report 4 (SDD); this brief only points to them. Sections 0–8 must fit on 4 A4 pages; Appendix A is not counted.

## 0. Header

| Field | Value |
| --- | --- |
| Project code | `[TEAM: approved project code]` |
| Project name | SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | `[TEAM: supervisor name]` |
| Repository link (tag review-2) | https://github.com/NBao261/SwiftletCare_KLTN/tree/review-2 |
| Version | 1.0 (registration v3, SRS 3.0.0, SDD 1.0.9) |
| Date | 23/10/2026 |

## 1. Scope

### 1.1 Registration Changes

| Section | Current | Proposed | Reason |
| --- | --- | --- | --- |
| B, D6, 3.2a | YOLOv8; virtual line | YOLO (version in SDD); ring around the hole | Birds leave the hole in every direction (Iteration 1 clips) |
| C.2, C.4, D | Technician installs on tickets | Flow 10: owner sets up by QR; no tickets; Technician on devices only | Review 1: simple setup; "platform, not system" |
| B, C, D, E | Periodic summary per zone | Flow 11: daily status per house, reports with PDF/CSV, ratings | Measurable multi-modal output |
| B, C.1, 4 | No weather, no load current | Weather API as context; current sensing on pump and fan | Explain low return rates; detect dead loads |
| D9, 4, C.2 | Bypass switches; Telegram or push; predator extension | No bypass; Telegram and push; no predator detection | Borrowed house cannot be rewired; team; Review 1 |

### 1.2 Out of Scope

| Item | Reason |
| --- | --- |
| Predator detection, call classification, heating, light control, fan driven by NH3/CO2 or weather | One vision class; dB-only sensor; no equipment or established limits |
| Marketplace, buyer role, tickets, SLA, regions, Zalo/SMS, bypass switches, 24/7 production | Removed after Review 1 (platform functions); borrowed house; prototype and staging only |

## 2. System at a Glance

Swiftlet houses are closed buildings that owners visit every few days, so humidity drift, equipment faults and a falling flock go unnoticed. SwiftletCare lets the house regulate and watch itself. On each floor an ESP32 controller reads five RS485 sensors and drives misting, fan and speaker with fuzzy logic, even without Internet. A PC reads the entrance camera, counts birds (YOLO + ByteTrack) and streams annotated video. A cloud backend raises alerts, forecasts breaches and gives every house one daily health status combining environment, air quality, return rate and noise by agreement. The Farm Owner monitors, overrides and sets up devices by QR code; a Domain Expert validates inferred alerts and tunes parameters; Technician and Administrator support them. Architecture: SDD 2.1; deployment: SDD 11.

## 3. Key Design Decisions

| ID | Decision | Options considered | Chosen option and rationale | Owner | Related FR / diagram |
| --- | --- | --- | --- | --- | --- |
| D1 | Where control runs | Cloud commands; on the controller | Controller decides every 10 s; the cloud only configures, so control survives outages | Nguyễn Chí Bảo | ENV-FR-010, 014; AD-01, AD-03 |
| D2 | Counting geometry | Line; ring near the hole; ring + whole-frame tracking | Whole-frame tracking + ring + extrapolation: a bird at the hole is a 1–2-frame blur | Nguyễn Chí Bảo | VISION-FR-004, 005; AD-06 |
| D3 | Expert in the loop | Approval blocks changes; no review | Owner changes apply and open a review item; only the expert applies suggestions | Thái Minh Tuấn | EXPERT-FR-010, 011; SM-10, 11 |
| D4 | Device identity and setup | Typed IDs; display/BLE; label + floor QR | Label (ID + key) and floor QR; key checked by the backend; zone sent at first heartbeat | Trần Minh Kiệt | FARM-FR-003, 010, 011; SM-16, AD-10 |
| D5 | Combining sources | Weighted score; classifier; agreement rules | Rules: `ACTION` needs the flock plus another source; reasons listed; judged against ratings | Nguyễn Thị Yến Nhi | ANALYTICS-FR-012; SM-17, AD-14 |

## 4. Top Risks

| ID | Risk | Impact | How we verify or mitigate | Owner |
| --- | --- | --- | --- | --- |
| R1 | No trained swiftlet model; spare PC may not reach 25 fps (≈ 7–12 fps on a laptop) | WF-06, WF-11 miss NFR-04/09 | Train on 3 recorded days; measure on the PC in It. 2; else smaller input, demo on clips | Nguyễn Chí Bảo |
| R2 | MF-11 not built; NFR-14 needs ≥ 14 rated days | Health output not shown or measured | Daily job first against seeded days; start field run at installation | Nguyễn Thị Yến Nhi |
| R3 | No staging yet; firmware has no MQTT TLS | Demos must run on staging | Staging and demo seed in It. 2; TLS in 2 days, else authenticated 1883 as a limitation | Trần Minh Kiệt |

## 5. Known Gaps

| ID | Gap | Location | Plan | Owner | Due |
| --- | --- | --- | --- | --- | --- |
| G1 | Roles differ from SRS 2.4; tickets still in code | backend, clients | Fix roles; drop tickets | Trần Minh Kiệt | It. 2 |
| G2 | `DISMISSED`, alert evidence, owner fallback (BR-22), review items, proposals | backend, web | Per SM-01, 10, 11 | Thái Minh Tuấn | It. 2 |
| G3 | Config version, `CONFIG_MISMATCH`; actuator current check | firmware, backend | Version in heartbeat; ADS1115 | Nguyễn Chí Bảo | It. 2–3 |
| G4 | Pipeline not run on staging; sessions from buckets | ai-pipeline, backend | Run on the AI node PC | Nguyễn Chí Bảo | It. 2 |
| G5 | Daily status, ratings, house reports, PDF/CSV, weather | backend, web | SDD 6.4, AD-14 | Nguyễn Thị Yến Nhi | It. 2–3 |
| G6 | QR setup, labels, progress; FCM push; staging, demo seed | mobile, backend, deploy | `expo-camera`; Firebase; staging.md | Trần Minh Kiệt | It. 2 |
| G7 | Web leftovers (`SALES_STAFF`, Technician threshold editing); expert screens on mock fallback | frontend | Remove; wire to API | Nguyễn Vũ Len | It. 2 |

Full list: `docs/reports/README.md` and SDD 12. High self-review findings (BM02) marked Kept or Planned are added after the prompt is run.

## 6. Proposed Mandatory Features

| ID | Feature | Actor | Acceptance criteria (testable) | Test | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, live dashboard | FO, DE | Read every 1 s; on the dashboard ≤ 2 s; dead sensor shown stale; no event to other farms | TC-F01-01..03 | Done |
| F-02 | Fuzzy control | FO (auto) | Decision every 10 s ± 1 s; firmware = backend (±1 %) on shared cases | TC-F02-01..03 | Done |
| F-03 | Thresholds, coefficients | FO, DE | Stored with history and sent; out of range 400, nothing stored; Technician/Admin 403 | TC-F03-01..03 | In progress |
| F-04 | Offline operation | FO (auto) | 30-min outage: all decisions, 0 samples lost; hang → restart, `POWER_OUTAGE` | TC-F04-01..03 | Done |
| F-05 | Self-diagnosis | FO (auto) | 300 s pump ON without +2 % → `PUMP_DRY`, misting 0; timeout → `SENSOR_FAULT` | TC-F05-01..03 | Done |
| F-06 | Actuator current check | FO (auto) | Relay ON, current < 50 % of normal for 30 s → `ACTUATOR_FAULT` | TC-F06-01..03 | Planned |
| F-07 | Alert lifecycle | FO | Repeats merge into one alert; recovery resolves; ack of resolved → 409 | TC-F07-01..03 | In progress |
| F-08 | Push and Telegram | FO, Telegram, FCM | CRITICAL alert on both ≤ 5 s; none after sign-out/unlink | TC-F08-01..03 | In progress |
| F-09 | Forecast warning | FO, DE (auto) | ≥ 2 h data: crossing within 60 min → `FORECAST_BREACH` with time; less → "insufficient data" | TC-F09-01..03 | Done |
| F-10 | Counting, return rate | FO, DE (auto) | Session and 5-min counts per house; drop > threshold vs ≥ 3 days → one alert; incomplete day skipped | TC-F10-01..03 | In progress |
| F-11 | Annotated live stream | FO, DE | Box on each bird; token 60 s, one camera; others 403 | TC-F11-01..03 | In progress |
| F-12 | Abnormal noise | DE (auto) | +20 dB for 12 s of 15 s → one `NOISE_ANOMALY`; none while the speaker plays | TC-F12-01..03 | Done |
| F-13 | Expert verdict | DE | Stored with author; `REJECTED` without note 422, sets `DISMISSED`; FO on expert farm 403 | TC-F13-01..03 | In progress |
| F-14 | Tuning, ring, schedule | DE | Applied without restart, with history; out of range 400; ring of 2 or 13 vertices 422; overlapping windows 400 | TC-F14-01..03 | In progress |
| F-15 | Review and suggestions | DE, FO | Owner change opens one review item; revert resends old values; owner applying a suggestion 403 | TC-F15-01..03 | Planned |
| F-16 | Conclusions, owner notice | DE, FO | Every expert decision notifies each owner; only the author edits a conclusion | TC-F16-01..03 | In progress |
| F-17 | Manual override | FO | `MANUAL` then `AUTO` at expiry; outside 1 min–24 h 422; expert 403 | TC-F17-01..03 | Done |
| F-18 | Register by QR | FO, Admin | Label + floor scan → `PENDING` in that zone; bad key or ID same 400; in service 409 | TC-F18-01..03 | In progress |
| F-19 | Setup progress, move | FO | "Applied" only after the version is reported; offline move corrected on reconnect; 15-min notice | TC-F19-01..03 | In progress |
| F-20 | Daily health status | FO, DE (auto) | Flock `CLEAR` + humidity `SLIGHT` → `ACTION`; flock alone → `WATCH`; incomplete → `INSUFFICIENT_DATA` | TC-F20-01..03 | Planned |
| F-21 | Reports, PDF/CSV | FO, DE | Day/week/month per house; files match the screen, no internal IDs; other farms 403 | TC-F21-01..03 | In progress |
| F-22 | Independent rating | FO, DE | Asked before the status, locked after; Technician/Admin 403; ≤ 7 days after | TC-F22-01..03 | Planned |

FO = Farm Owner, DE = Domain Expert (Farm Owner if none, BR-22); (auto) = done by a system component (controller, backend or AI node), not an actor.

## 7. Non-Functional Requirements

| ID | Quality attribute | Metric | Threshold | Measurement method |
| --- | --- | --- | --- | --- |
| NFR-01 | Performance | Publish → dashboard event | P95 ≤ 2 s | 200 MQTT messages on staging, Socket.io receive times |
| NFR-02 | Performance | Alert → in-app, push, Telegram | P95 ≤ 5 s each | 30 injected alerts on staging |
| NFR-06 | Reliability | Decisions in outage; samples lost | 100 %; 0 for 30 min | Uplink cut 30 min on the prototype |
| NFR-09 | Accuracy | Precision, Recall, count error | `[TEAM: P ≥ X, R ≥ Y, ≤ Z %]` by lighting | Manual counts on `[TEAM: N]` clips |
| NFR-13 | Usability | Power-on → "applied"; input | ≤ 10 min in 5/5; 2 scans + Wi-Fi | 5 first-time users, timed |
| NFR-14 | Accuracy | Agreement, kappa vs ratings | `[TEAM: ≥ X %, κ ≥ Y]`, ≥ 14 days | Field run (ANALYTICS-FR-014) |

## 8. Ownership Map

| Member | Role | Owned parts (2–3) | Main workflow owned | Key decisions / PRs |
| --- | --- | --- | --- | --- |
| Nguyễn Chí Bảo | Leader; IoT, AI | Firmware; AI pipeline; backend MQTT ingestion and alert engine | WF-01, 03, 06 | D1, D2; PR #88 |
| Trần Minh Kiệt | Backend, mobile | Backend devices and setup; ticket removal; mobile app | WF-04, 10 | D4; `[TEAM]` |
| Nguyễn Vũ Len | Web Farm Owner | Farm Owner screens; notification settings and inbox | WF-02, 09 | `[TEAM]` |
| Nguyễn Thị Yến Nhi | Web Admin, reports | Admin screens (accounts, stock, defaults); daily status, reports, export | WF-05, 11 | D5; `[TEAM]` |
| Thái Minh Tuấn | Web Domain Expert | Expert screens; expert backend (reviews, proposals) | WF-07, 08 | D3; PR #91 |

---

# Appendix A – Defense 1.1 Targets

## A1. Main Workflows

Actors are people and external services only; the controller, the AI node and the backend are parts of SwiftletCare (SRS Section 2.3). WF-03 and WF-09 have one actor and are valid because each passes through three mandatory features.

| ID | Workflow | Actors | Trigger | Business outcome | Features | Entity states | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WF-01 | Automatic micro-climate regulation (MF-01, AD-01) | Farm Owner, Domain Expert | 10-s control cycle; parameter change | Misting and fan follow humidity and temperature with the zone's current parameters | F-01, F-02, F-03 | Config sync: `PENDING` → `APPLIED`; relay output in `AUTO` | Nguyễn Chí Bảo |
| WF-02 | Air-quality monitoring (MF-02, AD-02) | Farm Owner, Domain Expert, Telegram, FCM | NH3 or CO2 above the zone limit | Alert raised for assessment; fan not driven | F-01, F-07, F-08 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED` | Nguyễn Vũ Len |
| WF-03 | Offline operation and recovery (MF-03, AD-03) | Farm Owner | Internet lost, hang or power loss | Control continues; buffered data uploaded; restart reported | F-04, F-07, F-08 | Device: `ONLINE` → `OFFLINE` → `ONLINE`; `NODE_OFFLINE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-04 | Equipment fault handling (MF-04, AD-04) | Farm Owner, Technician, Telegram, FCM | Pump dry, sensor fault, load not drawing current | Loop in a safe state; alert raised, sent again until acknowledged | F-05, F-06, F-07, F-08 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED` | Trần Minh Kiệt |
| WF-05 | Early warning by forecast (MF-05, AD-05) | Farm Owner, Domain Expert | Every 10 min | Early warning with the expected crossing time; verdict recorded | F-09, F-07, F-13 | Alert: `ACTIVE` → `RESOLVED`; verdict: pending → `CONFIRMED` | Nguyễn Thị Yến Nhi |
| WF-06 | Bird counting session (MF-06, AD-06) | Farm Owner, Domain Expert | Morning and evening sessions | Counts and return rate of the house; alert on drop; annotated stream | F-10, F-11, F-07 | AI node: `PENDING` → `ONLINE`; `LOW_RETURN_RATE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-07 | Abnormal noise (MF-07, AD-07) | Domain Expert, Farm Owner | Noise above the hourly baseline | Indication shown with bird counts; validated by the expert | F-12, F-13, F-16 | Alert: `ACTIVE` → `DISMISSED` (verdict `REJECTED`) | Thái Minh Tuấn |
| WF-08 | Expert validation and tuning (MF-08, AD-08) | Domain Expert, Farm Owner | Owner change, suggestion, health report | Changes reviewed, suggestion applied, conclusion delivered, owner notified | F-03, F-14, F-15, F-16 | Review item: `PENDING_REVIEW` → `ADJUSTED`; proposal: `PROPOSED` → `APPROVED`; report: `GENERATED` → `CONCLUDED` | Thái Minh Tuấn |
| WF-09 | Manual override (MF-09, AD-09) | Farm Owner | Owner switches a relay | Relay manual for a limited time, then automatic; logged | F-17, F-01, F-02 | Relay: `AUTO` → `MANUAL` → `AUTO` | Nguyễn Vũ Len |
| WF-10 | Device setup by the Farm Owner (MF-10, AD-10) | Administrator, Farm Owner | New controller or move to another floor | Device online in the scanned zone with its configuration | F-18, F-19, F-03 | Label: `IN_STOCK` → `IN_SERVICE`; device: `PENDING` → `ONLINE`; config: `PENDING` → `APPLIED` | Trần Minh Kiệt |
| WF-11 | Daily health assessment and reports (MF-11, AD-14) | Farm Owner, Domain Expert, Open-Meteo | End of day; week; month | Daily status with reasons; reports downloaded; day rated independently | F-20, F-21, F-22 | Daily status: (new) → `COMPUTED` → `RATED`; report: `GENERATED` | Nguyễn Thị Yến Nhi |

## A2. Demo Scenarios

Run on staging (SDD Section 3.4) with data loaded by the demo seed script (`docs/deploy/staging.md` §5).

| ID | Workflow | Type | Preconditions and data | Main steps | Expected result | Presenter |
| --- | --- | --- | --- | --- | --- | --- |
| DS-01 | WF-01 | Main | Zone with controller online; humidity below `humidity_min` | Watch the dashboard; expert raises `humidity_min` by 2 %RH | Misting power rises within one cycle; new parameters reach the controller and show as applied | Nguyễn Chí Bảo |
| DS-02 | WF-01 | Exception | Same zone | Technician tries to change thresholds; expert enters a value out of range | 403 for the Technician; 400 for the out-of-range value; nothing stored, controller keeps the old configuration | Nguyễn Chí Bảo |
| DS-03 | WF-02 | Main | NH3 limit of the zone set below the current reading | Wait for the reading; owner acknowledges with a note; raise the limit | `THRESHOLD_BREACH` (NH3) raised and seen by owner and expert; fan output unchanged; alert resolved after recovery | Nguyễn Vũ Len |
| DS-04 | WF-02 | Exception | Same alert open | Domain Expert tries to acknowledge it | 403; alert stays `ACTIVE` | Nguyễn Vũ Len |
| DS-05 | WF-03 | Main | Controller online, misting active | Unplug the router uplink for 5 min, then reconnect | Relays keep switching; no gap in the telemetry chart after reconnection; `NODE_OFFLINE` raised then resolved | Nguyễn Chí Bảo |
| DS-06 | WF-03 | Exception | Controller online | Cut the controller's power and restore it | Heartbeat back within 30 s; `POWER_OUTAGE` reported | Nguyễn Chí Bảo |
| DS-07 | WF-04 | Main | Humidity below range; water to the pump closed | Let misting run | After 300 s without rise misting stops and one `PUMP_DRY` is raised; owner acknowledges | Trần Minh Kiệt |
| DS-08 | WF-04 | Exception | Controller running | Unplug the temperature-humidity sensor | `SENSOR_FAULT` raised; reading marked stale; after 2 cycles without temperature and humidity, misting and fan are 0 | Trần Minh Kiệt |
| DS-09 | WF-05 | Main | Seeded 6 h of humidity falling toward the threshold | Run the forecast job | `FORECAST_BREACH` with the expected crossing time; expert confirms it | Nguyễn Thị Yến Nhi |
| DS-10 | WF-05 | Exception | Zone with less than 2 h of data | Open the forecast | "Insufficient data" shown; no alert | Nguyễn Thị Yến Nhi |
| DS-11 | WF-06 | Main | AI node online; seeded 7 days of counts | Play a recorded entrance clip through the AI node during a session window | Counts of the house rise on the page; live stream shows boxes; next return-rate check raises `LOW_RETURN_RATE` for the seeded drop | Nguyễn Chí Bảo |
| DS-12 | WF-06 | Exception | Session in progress | Stop the AI node | `EDGE_AI_DEGRADED` after 90 s; the day is incomplete and not evaluated | Nguyễn Chí Bảo |
| DS-13 | WF-07 | Main | Speaker off; seeded hourly baseline | Play loud noise near the sensor for the sustain period | `NOISE_ANOMALY` shown with bird counts; expert rejects with a note; status `DISMISSED`, owner notified | Thái Minh Tuấn |
| DS-14 | WF-07 | Exception | Farm with a Domain Expert | Farm Owner tries to record a verdict | 403 | Thái Minh Tuấn |
| DS-15 | WF-08 | Main | Farm with an expert; pending suggestion | Owner changes a threshold and submits the suggestion; expert adjusts the change, approves the suggestion, writes a conclusion | Review item `ADJUSTED`, proposal `APPROVED`, controllers updated, owner notified of each decision | Thái Minh Tuấn |
| DS-16 | WF-08 | Exception | Same farm | Owner applies the suggestion directly | 403; coefficients unchanged | Thái Minh Tuấn |
| DS-17 | WF-09 | Main | Pump in `AUTO` | Owner forces the pump ON for 1 min | Relay `MANUAL`, then `AUTO` after 1 min; override in the history | Nguyễn Vũ Len |
| DS-18 | WF-09 | Exception | Same zone | Override for 25 h; Domain Expert tries an override | 422; 403 | Nguyễn Vũ Len |
| DS-19 | WF-10 | Main | Labelled controller in stock; floor QR printed | Owner scans the label and the floor code, enters Wi-Fi in AP mode | Device `PENDING` → `ONLINE` in that zone; "configuration applied" shown | Trần Minh Kiệt |
| DS-20 | WF-10 | Exception | Controller already in service in another farm | Owner scans its label | 409; no device created | Trần Minh Kiệt |
| DS-21 | WF-11 | Main | Seeded day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily job; owner rates the day; download PDF and CSV | Status `ACTION` with both reasons; rating asked before the status; files show the same figures | Nguyễn Thị Yến Nhi |
| DS-22 | WF-11 | Exception | Seeded day with an incomplete evening session | Run the daily job | `INSUFFICIENT_DATA`, never `GOOD`; reason names the missing session | Nguyễn Thị Yến Nhi |

## A3. Functional Test Case Target

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 22 | 3 | 66 |
| Main workflows (end-to-end) | 11 | 1 | 11 |
| State transitions of main entities | 48 | 1 | 48 |
| Committed NFRs | 6 | 1 | 6 |
| Total | | | 131 |

Automated in CI: at least 50% of the committed total, i.e. at least 66 test cases. State transitions counted (SRS Section 6): alert status 10, alert verdict 2, relay mode 3, device connection 4, device label 6, configuration sync 4, review item 6, suggestion proposal 5, daily health status 5, health report 3. Test cases are listed in Report 5.
