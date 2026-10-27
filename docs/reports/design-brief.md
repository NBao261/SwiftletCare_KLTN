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
| Version | 1.1 (registration v3, BM03 1.1, SRS 3.1.0, SDD 1.1.0) |
| Date | 26/10/2026 |

## 1. Scope

### 1.1 Registration Changes

| Section | Current | Proposed | Reason |
| --- | --- | --- | --- |
| B, D6, 3.2a | YOLOv8; virtual line | YOLO (version in SDD); ring around the hole | Birds leave the hole in every direction |
| B, C, D, 4 | Technician installs on tickets; public sign-up | Owner sets up by QR (Flow 10); one owner per installation; no tickets, no sign-up | Review 1: system, not platform |
| B, C, D, E | Periodic summary per zone | Daily status per house, reports, PDF/CSV, ratings (Flow 11); rule-based indicator | Measurable multi-modal output |
| B, C.1, 4 | No weather or load current; "pump dry", "power loss" | Weather as context; pump and fan current; "misting ineffective", "unexpected restart" | No unmeasured cause claimed |
| D9, 4, C.2 | Bypass; Telegram or push; predator; any override length | No bypass; Telegram and push; no predator; pump ON ≤ 30 min | Borrowed house; Review 1; safety |

### 1.2 Out of Scope

| Item | Reason |
| --- | --- |
| Predator detection, call classification, heating, light control, fan driven by NH3/CO2 or weather | One vision class; dB-only sensor; no equipment or limits |
| Marketplace, buyer, tickets, SLA, regions, public sign-up, several owners per installation, Zalo/SMS, bypass, 24/7 production | Platform functions (Review 1); borrowed house; prototype only |

## 2. System at a Glance

Owners visit their closed swiftlet houses every few days, so humidity drift, equipment faults and a falling flock go unnoticed. SwiftletCare, installed for one owner's houses, lets each house regulate and watch itself. On each floor an ESP32 reads five RS485 sensors and drives misting, fan and speaker with fuzzy logic, even offline. A PC counts birds at the entrance camera (YOLO + ByteTrack) and streams annotated video. A cloud backend raises alerts, forecasts breaches and gives each house a daily rule-based health status from environment, air, return rate and noise. The Farm Owner monitors, overrides and sets up devices by QR; a Domain Expert validates and tunes; Technician and Administrator support them. Architecture: SDD 2.1; deployment: SDD 11.

## 3. Key Design Decisions

| ID | Decision | Options considered | Chosen option and rationale | Owner | Related FR / diagram |
| --- | --- | --- | --- | --- | --- |
| D1 | Where control runs | Cloud; controller | Controller decides every 10 s; cloud only configures, so control survives outages | Nguyễn Chí Bảo | ENV-FR-010, 014; AD-01, 03 |
| D2 | Counting geometry | Line; ring near hole; ring + whole-frame tracking | Whole-frame tracking, ring, extrapolation: at the hole a bird is a 1–2-frame blur | Nguyễn Chí Bảo | VISION-FR-004, 005; AD-06 |
| D3 | Expert in the loop | Approval blocks; no review | Owner changes apply and open a review item; only the expert applies suggestions | Thái Minh Tuấn | EXPERT-FR-010, 011; SM-10, 11 |
| D4 | Device identity | Typed IDs; BLE; label + floor QR; zone or device topics | Label and floor QR; one credential and topic tree per device; zone kept by the backend | Trần Minh Kiệt | FARM-FR-003c, 010; SDD D3; AD-10 |
| D5 | Combining sources | Weighted score; classifier; rules | Agreement rules: `ACTION` needs the flock plus another source; reasons listed | Nguyễn Thị Yến Nhi | ANALYTICS-FR-012; AD-14 |

## 4. Top Risks

| ID | Risk | Impact | How we verify or mitigate | Owner |
| --- | --- | --- | --- | --- |
| R1 | No trained model; PC may not keep up with 25 fps (7–12 fps on a laptop) | NFR-04/09 fail | Train by recording day; measure on the PC; else lower camera rate, re-measure NFR-09 | Nguyễn Chí Bảo |
| R2 | MF-11 not built; NFR-14 needs ≥ 14 rated days | Health not measured | Daily job first on seeded days; field run from installation | Nguyễn Thị Yến Nhi |
| R3 | No staging; MQTT moves to device topics, `esp-mqtt`, TLS | Demos need staging | Staging first in It. 2; one firmware-backend-AI PR, bench-tested | Nguyễn Chí Bảo |

## 5. Known Gaps

Code against SRS and SDD, grouped by owner; each gap in Project Tracking §6.

| ID | Gap | Location | Plan | Owner | Due |
| --- | --- | --- | --- | --- | --- |
| G-01, 14 | Alert-type renames, `DISMISSED`, new types; predator, Zalo/SMS, heating left; data model behind SDD 6.1 | all modules | One enum PR with migration, then SDD 6.4 | Kiệt | Tag; It. 2 |
| G-02, 09, 10, 16 | Public sign-up open (removed before the tag); QR setup screens; FCM only logged; mobile a scaffold | backend, web, mobile | AUTH-FR-005c; AD-10; ALERT-FR-002; SDD 5.4 | Kiệt, Nhi, Bảo | Tag; It. 2–3 |
| G-03, 04, 15 | `DISMISSED`, owner fallback and notices, evidence, review items, proposals; expert screens on mock data | backend, web | SM-01, 10, 11 | Tuấn, Kiệt | It. 2 |
| G-05, 06 | Breach without dwell; one override expiry per controller, no pump limit or confirmation | backend, firmware, web | BR-34, BR-08, 20, 35 | Kiệt, Len | It. 2 |
| G-07, 08 | Zone topics, shared credential, QoS 0, no TLS on the ESP32; no configuration version | firmware, backend, AI node | SDD D3, 7.2; SM-12 | Bảo | It. 2 |
| G-11 | Daily status, ratings with snapshot, house reports, PDF/CSV, weather, evaluation | backend, web, mobile | SM-17, AD-14 | Nhi, Kiệt | It. 2–3 |
| G-12, 13 | No trained model; sessions from buckets; ring editor; current sensing | AI node, backend, web, board | VISION-FR-008…020; THREAT-FR-014 | Bảo | It. 2–3 |
| G-17 | Staging, TLS proxy, demo seed | deploy | SDD 3.4, 11 | Bảo | It. 2 |

## 6. Proposed Mandatory Features

| ID | Feature | Actor | Acceptance criteria (testable) | Test | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, dashboard | FO, DE | On the dashboard ≤ 2 s; dead sensor stale; no event to other farms | TC-F01 | Done |
| F-02 | Fuzzy control | auto | Decision every 10 s ± 1 s; firmware = backend on shared cases | TC-F02 | Done |
| F-03 | Thresholds, coefficients | FO, DE | Stored with history, sent; out of range 400; Technician/Admin 403 | TC-F03 | In progress |
| F-04 | Offline operation | auto | 30-min outage: all decisions, 0 samples lost; hang → `UNEXPECTED_RESTART` | TC-F04 | In progress |
| F-05 | Self-diagnosis | auto | 300 s pump ON, no +2 % → `MISTING_INEFFECTIVE`; timeout → `SENSOR_FAULT` | TC-F05 | In progress |
| F-06 | Actuator current | auto | Relay ON, current < 50 % of normal 30 s → `ACTUATOR_FAULT` | TC-F06 | Planned |
| F-07 | Alert lifecycle | FO | Repeats merge; humidity out 10 min → breach; ack of resolved 409 | TC-F07 | In progress |
| F-08 | Push and Telegram | FO | CRITICAL on both ≤ 5 s; none after sign-out or unlink | TC-F08 | In progress |
| F-09 | Forecast warning | auto | Crossing within 60 min → `FORECAST_BREACH`; < 2 h data → none | TC-F09 | Done |
| F-10 | Counting, return rate | auto | Counts per house; drop > limit vs ≥ 3 days → one alert | TC-F10 | In progress |
| F-11 | Live stream | FO, DE | Box on each bird; 60-s token for one camera; others 403 | TC-F11 | In progress |
| F-12 | Abnormal noise | auto | +20 dB 12 s of 15 → `NOISE_ANOMALY`; none while speaker plays | TC-F12 | Done |
| F-13 | Expert verdict | DE | `REJECTED` without note 422, with note `DISMISSED`; FO 403 | TC-F13 | In progress |
| F-14 | Tuning, ring, schedule | DE | Applied with history; out of range 400; ring of 13 vertices 422 | TC-F14 | In progress |
| F-15 | Review, suggestions | DE, FO | Owner change opens a review item; owner applying suggestion 403 | TC-F15 | Planned |
| F-16 | Conclusions, notices | DE, FO | Every expert decision notifies each owner; only the author edits | TC-F16 | In progress |
| F-17 | Manual override | FO | Own expiry per relay; pump 31 min 422; unconfirmed with alert 409 | TC-F17 | In progress |
| F-18 | Farm structure and device registration | FO, Admin | Farm, house, zone; scans → `PENDING`; bad key 400; in service 409 | TC-F18 | In progress |
| F-19 | Device lifecycle, diagnostics and setup progress | FO | Progress shown; "applied" after version; offline move on reconnect | TC-F19 | In progress |
| F-20 | Daily health status | auto | Flock `CLEAR` + humidity `SLIGHT` → `ACTION`; flock alone → `WATCH` | TC-F20 | Planned |
| F-21 | Reports, PDF/CSV | FO, DE | Day/week/month per house; files match the screen; others 403 | TC-F21 | In progress |
| F-22 | Independent rating | FO, DE | Asked before status; snapshot kept; Technician/Admin 403 | TC-F22 | Planned |

FO = Farm Owner, DE = Domain Expert (Farm Owner if none, BR-22); auto = done by a system component, not an actor; TC-Fnn = TC-Fnn-01..03 in Report 5. Status is copied from Project Tracking.

## 7. Non-Functional Requirements

| ID | Quality attribute | Metric | Threshold | Measurement method |
| --- | --- | --- | --- | --- |
| NFR-01 | Performance | Publish → dashboard | P95 ≤ 2 s | 200 MQTT messages on staging |
| NFR-02 | Performance | Alert → app, push, Telegram | P95 ≤ 5 s each | 30 injected alerts on staging |
| NFR-06 | Reliability | Decisions; samples and alerts lost | 100 %; 0 in a 30-min outage | Uplink cut on the prototype |
| NFR-09 | Accuracy | Detection P, R; count error | ≥ 0.80; ≤ 10 % | Unseen days, per lighting |
| NFR-13 | Usability | Power-on → "applied" | ≤ 10 min in 5/5; 2 scans + Wi-Fi | 5 first-time users |
| NFR-14 | Accuracy | Rating vs snapshot agreement | ≥ 70 % (95 % CI), ≥ 14 days | Field run (ANALYTICS-FR-014) |

## 8. Ownership Map

| Member | Role | Owned parts (2–3) | Main workflow owned | Key decisions / PRs |
| --- | --- | --- | --- | --- |
| Nguyễn Chí Bảo | Leader; IoT, AI | Firmware, MQTT; AI pipeline; staging, push, documents | WF-01, 03, 06 | D1, D2; #88 |
| Trần Minh Kiệt | Backend, firmware | Devices, accounts; alerts, expert; daily health | WF-04, 10 | D4; `[TEAM]` |
| Nguyễn Vũ Len | Web, mobile: Owner | Farm Owner screens; E2E | WF-02, 05, 09 | `[TEAM]` |
| Nguyễn Thị Yến Nhi | Web, mobile: Admin | Admin, daily status screens; mobile base; E2E | WF-11 | D5; `[TEAM]` |
| Thái Minh Tuấn | Web, mobile: Expert | Expert, Technician screens; E2E | WF-07, 08 | D3; #91 |

---

# Appendix A – Defense 1.1 Targets

## A1. Main Workflows

Actors are people and external services only; the controller, the AI node and the backend are parts of SwiftletCare (SRS Section 2.3). WF-03 and WF-09 have one actor and are valid because each passes through three mandatory features.

| ID | Workflow | Actors | Trigger | Business outcome | Features | Entity states | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WF-01 | Automatic micro-climate regulation (MF-01, AD-01) | Farm Owner, Domain Expert | 10-s control cycle; parameter change | Misting and fan follow humidity and temperature with the zone's current parameters | F-01, F-02, F-03 | Config sync: `PENDING` → `APPLIED`; relay output in `AUTO` | Nguyễn Chí Bảo |
| WF-02 | Air-quality monitoring (MF-02, AD-02) | Farm Owner, Domain Expert, Telegram, FCM | NH3 or CO2 above the zone limit | Alert raised for assessment; fan not driven | F-01, F-07, F-08 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED` | Nguyễn Vũ Len |
| WF-03 | Offline operation and recovery (MF-03, AD-03) | Farm Owner | Internet lost, hang or power loss | Control continues; buffered data uploaded; restart reported | F-04, F-07, F-08 | Device: `ONLINE` → `OFFLINE` → `ONLINE`; `NODE_OFFLINE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-04 | Equipment fault handling (MF-04, AD-04) | Farm Owner, Technician, Telegram, FCM | Misting without humidity rise, sensor fault, load not drawing current | Loop in a safe state; alert raised, sent again until acknowledged | F-05, F-06, F-07, F-08 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED` | Trần Minh Kiệt |
| WF-05 | Early warning by forecast (MF-05, AD-05) | Farm Owner, Domain Expert | Every 10 min | Early warning with the expected crossing time; verdict recorded | F-09, F-07, F-13 | Nguyễn Vũ Len | Nguyễn Thị Yến Nhi |
| WF-06 | Bird counting session (MF-06, AD-06) | Farm Owner, Domain Expert | Morning and evening sessions | Counts and return rate of the house; alert on drop; annotated stream | F-10, F-11, F-07 | AI node: `PENDING` → `ONLINE`; `LOW_RETURN_RATE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-07 | Abnormal noise (MF-07, AD-07) | Domain Expert, Farm Owner | Noise above the hourly baseline | Indication shown with bird counts; validated by the expert | F-12, F-13, F-16 | Alert: `ACTIVE` → `DISMISSED` (verdict `REJECTED`) | Thái Minh Tuấn |
| WF-08 | Expert validation and tuning (MF-08, AD-08) | Domain Expert, Farm Owner | Owner change, suggestion, health report | Changes reviewed, suggestion applied, conclusion delivered, owner notified | F-03, F-14, F-15, F-16 | Review item: `PENDING_REVIEW` → `ADJUSTED`; proposal: `PROPOSED` → `APPROVED`; report: `GENERATED` → `CONCLUDED` | Thái Minh Tuấn |
| WF-09 | Manual override (MF-09, AD-09) | Farm Owner | Owner switches a relay | Relay manual for a limited time, then automatic; logged | F-17, F-01, F-02 | Relay: `AUTO` → `MANUAL` → `AUTO` | Nguyễn Vũ Len |
| WF-10 | Device setup by the Farm Owner (MF-10, AD-10) | Administrator, Farm Owner | New controller or move to another floor | Device online in the scanned zone with its configuration | F-18, F-19, F-03 | Label: `IN_STOCK` → `IN_SERVICE`; device: `PENDING` → `ONLINE`; config: `PENDING` → `APPLIED` | Trần Minh Kiệt |
| WF-11 | Daily health assessment and reports (MF-11, AD-14) | Farm Owner, Domain Expert, Open-Meteo | End of day; week; month | Daily status with reasons; reports downloaded; day rated independently | F-20, F-21, F-22 | Daily status: (new) → `COMPUTED`; each assessor's rating: `PENDING` → `RATED`; report: `GENERATED` | Nguyễn Thị Yến Nhi |

## A2. Demo Scenarios

Run on staging (SDD Section 3.4) with data loaded by the demo seed script (`docs/deploy/staging.md` §5).

| ID | Workflow | Type | Preconditions and data | Main steps | Expected result | Presenter |
| --- | --- | --- | --- | --- | --- | --- |
| DS-01 | WF-01 | Main | Zone with controller online; humidity below `humidity_min` | Watch the dashboard; expert raises `humidity_min` by 2 %RH | Misting power rises within one cycle; new parameters reach the controller and show as applied | Nguyễn Chí Bảo |
| DS-02 | WF-01 | Exception | Same zone | Technician tries to change thresholds; expert enters a value out of range | 403 for the Technician; 400 for the out-of-range value; nothing stored, controller keeps the old configuration | Nguyễn Chí Bảo |
| DS-03 | WF-02 | Main | NH3 limit of the zone set below the current reading | Wait for the reading; owner acknowledges with a note; raise the limit | `THRESHOLD_BREACH` (NH3) raised and seen by owner and expert; fan output unchanged; alert resolved after recovery | Nguyễn Vũ Len |
| DS-04 | WF-02 | Exception | Same alert open | Domain Expert tries to acknowledge it | 403; alert stays `ACTIVE` | Nguyễn Vũ Len |
| DS-05 | WF-03 | Main | Controller online, misting active | Unplug the router uplink for 5 min, then reconnect | Relays keep switching; no gap in the telemetry chart after reconnection; `NODE_OFFLINE` raised then resolved | Nguyễn Chí Bảo |
| DS-06 | WF-03 | Exception | Controller online | Cut the controller's power and restore it | Heartbeat back within 30 s; `UNEXPECTED_RESTART` with reset reason `POWER_ON` | Nguyễn Chí Bảo |
| DS-07 | WF-04 | Main | Humidity below range; water to the pump closed | Let misting run | After 300 s without rise automatic misting stops and one `MISTING_INEFFECTIVE` is raised; owner acknowledges | Trần Minh Kiệt |
| DS-08 | WF-04 | Exception | Controller running | Unplug the temperature-humidity sensor | `SENSOR_FAULT` raised; reading marked stale; after 2 cycles without temperature and humidity, misting and fan are 0 | Trần Minh Kiệt |
| DS-09 | WF-05 | Main | Seeded 6 h of humidity falling toward the threshold | Run the forecast job | `FORECAST_BREACH` with the expected crossing time; expert confirms it | Nguyễn Vũ Len |
| DS-10 | WF-05 | Exception | Zone with less than 2 h of data | Open the forecast | "Insufficient data" shown; no alert | Nguyễn Vũ Len |
| DS-11 | WF-06 | Main | AI node online; seeded 7 days of counts | Play a recorded entrance clip through the AI node during a session window | Counts of the house rise on the page; live stream shows boxes; next return-rate check raises `LOW_RETURN_RATE` for the seeded drop | Nguyễn Chí Bảo |
| DS-12 | WF-06 | Exception | Session in progress | Stop the AI node | `EDGE_AI_DEGRADED` after 90 s; the day is incomplete and not evaluated | Nguyễn Chí Bảo |
| DS-13 | WF-07 | Main | Speaker off; seeded hourly baseline | Play loud noise near the sensor for the sustain period | `NOISE_ANOMALY` shown with bird counts; expert rejects with a note; status `DISMISSED`, owner notified | Thái Minh Tuấn |
| DS-14 | WF-07 | Exception | Farm with a Domain Expert | Farm Owner tries to record a verdict | 403 | Thái Minh Tuấn |
| DS-15 | WF-08 | Main | Farm with an expert; pending suggestion | Owner changes a threshold and submits the suggestion; expert adjusts the change, approves the suggestion, writes a conclusion | Review item `ADJUSTED`, proposal `APPROVED`, controllers updated, owner notified of each decision | Thái Minh Tuấn |
| DS-16 | WF-08 | Exception | Same farm | Owner applies the suggestion directly | 403; coefficients unchanged | Thái Minh Tuấn |
| DS-17 | WF-09 | Main | Pump in `AUTO` | Owner forces the pump ON for 1 min | Relay `MANUAL`, then `AUTO` after 1 min; override in the history | Nguyễn Vũ Len |
| DS-18 | WF-09 | Exception | Same zone; a `SENSOR_FAULT` open | Pump ON for 31 min; pump ON without confirming the alert; Domain Expert tries an override | 422; 409; 403 | Nguyễn Vũ Len |
| DS-19 | WF-10 | Main | Labelled controller in stock; floor QR printed | Owner scans the label and the floor code, enters Wi-Fi in AP mode | Device `PENDING` → `ONLINE` in that zone; "configuration applied" shown | Trần Minh Kiệt |
| DS-20 | WF-10 | Exception | Controller already in service in another farm | Owner scans its label | 409; no device created | Trần Minh Kiệt |
| DS-21 | WF-11 | Main | Seeded day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily job; owner rates the day; download PDF and CSV | Status `ACTION` with both reasons; rating asked before the status; files show the same figures | Nguyễn Thị Yến Nhi |
| DS-22 | WF-11 | Exception | Seeded day with an incomplete evening session | Run the daily job | `INSUFFICIENT_DATA`, never `GOOD`; reason names the missing session | Nguyễn Thị Yến Nhi |

## A3. Functional Test Case Target

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 22 | 3 | 66 |
| Main workflows (end-to-end) | 11 | 1 | 11 |
| State transitions of main entities | 53 | 1 | 53 |
| Committed NFRs | 6 | 1 | 6 |
| Total | | | 136 |

Automated in CI: at least 50% of the committed total, i.e. at least 68 test cases. State transitions counted (SRS Section 6): alert status 10, alert verdict 2, relay mode 4, device connection 5, device label 6, configuration sync 5, review item 6, suggestion proposal 5, daily health status 2, assessor rating 5, health report 3. Test cases are listed in Report 5.
