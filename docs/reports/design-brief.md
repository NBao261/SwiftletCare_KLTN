# Design Brief – Review 2 (BM01)

Source of form BM01. The Word file `design-brief/SWP490_R2_BM01_Design_Brief_SwiftletCare.docx` is generated from the tables below, so edit this file first and then regenerate it. Details are in the registration form v3 (`registration-v3.md`), Report 3 (SRS) and Report 4 (SDD); this brief only points to them. Sections 0–8 must fit on 4 A4 pages; Appendix A is not counted.

## 0. Header

| Field | Value |
| --- | --- |
| Project code | FA26SE158 |
| Project name | SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | Nguyễn Văn Chiến, Trương Long |
| Repository link (tag review-2) | https://github.com/NBao261/SwiftletCare_KLTN/tree/review-2 |
| Version | 1.2 (registration v3, BM03 1.2, SRS 3.2.0, SDD 1.2.0) |
| Date | 03/11/2026 |

## 1. Scope

### 1.1 Registration Changes

| Section | Current | Proposed | Reason |
| --- | --- | --- | --- |
| B, D6, 3.2a | YOLOv8; virtual line | YOLO (version in SDD); ring around the hole | Birds leave the hole in every direction |
| B, C, D, 4 | Technician installs on tickets; public sign-up | Owner sets up by QR (supporting flow); no Technician, Admin maintains remotely; one owner per installation; no tickets, no sign-up | Review 1: system, not platform |
| B, C, D, E | Periodic summary per zone | Daily status per house, reports, PDF/CSV, ratings (Flow 6); rule-based indicator | Measurable multi-modal output |
| B, C.1, 4 | No weather or load current; "pump dry", "power loss" | Weather as context; pump and fan current; "misting ineffective", "unexpected restart" | No unmeasured cause claimed |
| D9, 4, C.2 | Bypass; Telegram or push; predator; any override length | No bypass; Telegram and push; no predator; pump ON ≤ 30 min | Borrowed house; Review 1; safety |
| D | Nine flows; offline, override, noise each a flow | Six flows by business process; setup a supporting flow | One process, one outcome per flow |

### 1.2 Out of Scope

| Item | Reason |
| --- | --- |
| Predator detection, call classification, heating, light control, fan driven by NH3/CO2 or weather | One vision class; dB-only sensor; no equipment or limits |
| Marketplace, buyer, tickets, SLA, regions, public sign-up, several owners per installation, Zalo/SMS, bypass, 24/7 production | Platform functions (Review 1); borrowed house; prototype only |

## 2. System at a Glance

Owners visit their closed swiftlet houses every few days, so humidity drift, equipment faults and a falling flock go unnoticed. SwiftletCare, installed for one owner's houses, lets each house regulate and watch itself. On each floor an ESP32 reads five RS485 sensors and drives misting, fan and speaker with fuzzy logic, even offline. A PC counts birds at the entrance camera (YOLO + ByteTrack) and streams annotated video. A cloud backend raises alerts, forecasts breaches and gives each house a daily rule-based health status from environment, air, return rate and noise. The Farm Owner monitors, overrides and sets up devices by QR; a Domain Expert validates and tunes; the Administrator supports them. Architecture: SDD 2.1; deployment: SDD 11.

## 3. Key Design Decisions

| ID | Decision | Options considered | Chosen option and rationale | Owner | Related FR / diagram |
| --- | --- | --- | --- | --- | --- |
| D1 | Where control runs | Cloud; controller | Controller decides every 10 s; cloud only configures, so control survives outages | Nguyễn Chí Bảo | ENV-FR-010, 014; AD-01 |
| D2 | Counting geometry | Line; ring near hole; ring + whole-frame tracking | Whole-frame tracking, ring, extrapolation: at the hole a bird is a 1–2-frame blur | Nguyễn Chí Bảo | VISION-FR-004, 005; AD-03 |
| D3 | Expert in the loop | Approval blocks; no review | Owner changes apply and open a review item; only the expert applies suggestions | Thái Minh Tuấn | EXPERT-FR-010, 011; SM-10, 11 |
| D4 | Device identity | Typed IDs; BLE; label + floor QR; zone or device topics | Label and floor QR; one credential and topic tree per device; zone kept by the backend | Trần Minh Kiệt | FARM-FR-003c, 010; SDD D3; AD-07 |
| D5 | Combining sources | Weighted score; classifier; rules | Agreement rules: `ACTION` needs the flock plus another source; reasons listed | Nguyễn Thị Yến Nhi | ANALYTICS-FR-012; AD-06 |

## 4. Top Risks

| ID | Risk | Impact | How we verify or mitigate | Owner |
| --- | --- | --- | --- | --- |
| R1 | No trained model; PC may not keep up with 25 fps (7–12 fps on a laptop) | NFR-04/09 fail | Train by recording day; measure on the PC; else lower camera rate, re-measure NFR-09 | Nguyễn Chí Bảo |
| R2 | MF-06 not merged yet; NFR-14 needs ≥ 14 rated days | Health not measured | Daily job first on seeded days; field run from installation | Nguyễn Thị Yến Nhi |
| R3 | No staging; MQTT moves to device topics, `esp-mqtt`, TLS | Demos need staging | Staging first in It. 2; one firmware-backend-AI PR, bench-tested | Nguyễn Chí Bảo |

## 5. Known Gaps

Code against SRS and SDD, grouped by owner; each gap in Project Tracking §6.

| ID | Gap | Location | Plan | Owner | Due |
| --- | --- | --- | --- | --- | --- |
| G-14 | Data model behind SDD 6.1 (user status, audit source, harvest type and photo, alert details) | backend | SDD 6.1–6.4 | Kiệt | It. 2 |
| G-02, 09, 10, 16 | Administrator-created Farm Owner, real e-mail; QR setup screens; FCM only logged; mobile screens partly built | backend, web, mobile | AUTH-FR-005c; AD-07; ALERT-FR-002; SDD 5.4 | Kiệt, Nhi, Len | It. 2–3 |
| G-06 | One override expiry per controller; no pump limit, confirmation or command freshness (PR #124 open) | backend, firmware, web, mobile | BR-08, 20, 35 | Kiệt, Len | It. 2 |
| G-07, 08 | Zone topics, shared credential, QoS 0, no TLS on the ESP32; no configuration version | firmware, backend, AI node | SDD D3, 7.2; SM-12 | Bảo | It. 2 |
| G-11 | Daily status, ratings with snapshot, house reports, PDF/CSV, weather, evaluation | backend, web, mobile | SM-17, AD-06 | Nhi, Kiệt | It. 2–3 |
| G-12, 13 | Model not yet evaluated on held-out clips; sessions from buckets; ring editor; current sensing | AI node, backend, web, board | VISION-FR-008…020; THREAT-FR-014 | Bảo | It. 2–3 |
| G-17 | Staging, TLS proxy, demo seed | deploy | SDD 3.4, 11 | Bảo | It. 2 |

## 6. Proposed Mandatory Features

| ID | Feature | Actor | Acceptance criteria (testable) | Test | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, dashboard | FO, DE | On the dashboard ≤ 2 s; dead sensor stale; no event to other farms | TC-F01 | Done |
| F-02 | Fuzzy control | auto | Decision every 10 s ± 1 s; firmware = backend on shared cases | TC-F02 | Done |
| F-03 | Thresholds, coefficients | FO, DE | Stored with history, sent; out of range 400; Admin 403 | TC-F03 | In progress |
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
| F-20 | Daily health status | auto | Flock `CLEAR` + humidity `SLIGHT` → `ACTION`; flock alone → `WATCH` | TC-F20 | Planned |
| F-21 | Reports, PDF/CSV | FO, DE | Day/week/month per house; files match the screen; others 403 | TC-F21 | In progress |
| F-22 | Independent rating | FO, DE | Asked before status; snapshot kept; Admin 403 | TC-F22 | Planned |

FO = Farm Owner, DE = Domain Expert (Farm Owner if none, BR-22); auto = done by a system component, not an actor; TC-Fnn = TC-Fnn-01..03 in Report 5. Status is copied from Project Tracking. F-18 and F-19 (device setup, supporting flow SF-01) are built and tested but not proposed as mandatory features.

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
| Nguyễn Chí Bảo | Leader; IoT, AI | Firmware, MQTT; AI pipeline; staging, push, documents | WF-01, 03 | D1, D2; #88 |
| Trần Minh Kiệt | Backend, firmware | Devices, accounts; alerts, expert; daily health | WF-05 | D4; #113, #116 |
| Nguyễn Vũ Len | Mobile: Farm Owner | Farm Owner mobile app; E2E | WF-02 | #123, #93 |
| Nguyễn Thị Yến Nhi | Web: Owner, Admin | Farm Owner web; Admin; E2E | WF-06 | D5; #26, #72 |
| Thái Minh Tuấn | Web, mobile: Expert | Expert screens, Admin device console; E2E | WF-04 | D3; #91, #125 |

---

# Appendix A – Defense 1.1 Targets

## A1. Main Workflows

Actors are people and external services only; the controller, the AI node and the backend are parts of SwiftletCare (SRS Section 2.3). Every workflow has at least two actors and changes the state of a main entity.

| ID | Workflow | Actors | Trigger | Business outcome | Features | Entity states | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WF-01 | Automatic micro-climate control (MF-01, AD-01) | Farm Owner, Domain Expert | 10-s control cycle; Internet or power loss; owner switches a relay | Misting and fan follow humidity and temperature, also offline; an override lasts a limited time, then automatic | F-01, F-02, F-04, F-17 | Controller relay: `AUTO` → `MANUAL` → `AUTO`; Controller: `ONLINE` → `OFFLINE` → `ONLINE` | Nguyễn Chí Bảo |
| WF-02 | Incident handling (MF-02, AD-02) | Farm Owner, Telegram, FCM | Breach after the dwell time, NH3/CO2 above limit, equipment fault, restart, offline, forecast | Alert sent by push and Telegram, repeated until acknowledged, closed on recovery; loop held safe | F-05, F-06, F-07, F-08, F-09 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED` | Nguyễn Vũ Len |
| WF-03 | Bird counting session (MF-03, AD-03) | Farm Owner, Domain Expert | Morning and evening sessions | Counts and return rate of the house; alert on drop; annotated stream | F-10, F-11 | CameraNode: `PENDING` → `ONLINE`; Alert `LOW_RETURN_RATE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-04 | Expert validation of inferred alerts (MF-04, AD-04) | Domain Expert, Farm Owner | Abnormal noise, implausible readings, early warning | Verdict with evidence; rejected alert dismissed; owner notified | F-12, F-13, F-16 | Alert: `ACTIVE` → `DISMISSED`; ExpertVerdict: pending → `REJECTED` | Thái Minh Tuấn |
| WF-05 | Control-parameter tuning (MF-05, AD-05) | Domain Expert, Farm Owner | Owner change, coefficient suggestion, detection or ring change | Changes reviewed, suggestion approved, new configuration applied on the controllers, owner notified | F-03, F-14, F-15 | ReviewItem: `PENDING_REVIEW` → `ADJUSTED`; CoefficientProposal: `PROPOSED` → `APPROVED`; Controller config: `PENDING` → `APPLIED` | Trần Minh Kiệt |
| WF-06 | Daily health assessment and reports (MF-06, AD-06) | Farm Owner, Domain Expert, Open-Meteo | End of day; week; month | Daily status with reasons; day rated independently; reports downloaded and concluded | F-20, F-21, F-22 | DailyHealthStatus: (new) → `COMPUTED`; DailyRating: `PENDING` → `RATED`; HealthReport: `GENERATED` → `CONCLUDED` | Nguyễn Thị Yến Nhi |

## A2. Demo Scenarios

Run on staging (SDD Section 3.4) with data loaded by the demo seed script (`docs/deploy/staging.md` §5).

| ID | Workflow | Type | Preconditions and data | Main steps | Expected result | Presenter |
| --- | --- | --- | --- | --- | --- | --- |
| DS-01 | WF-01 | Main | Zone with controller online; humidity below `humidity_min` | Watch the dashboard; unplug the router uplink for 5 min and reconnect; owner forces the pump ON for 1 min | Misting power rises within one cycle; relays keep switching offline, no gap in the chart after reconnection; relay `MANUAL`, then `AUTO` after 1 min, override in the history | Nguyễn Chí Bảo |
| DS-02 | WF-01 | Exception | Same zone; a `SENSOR_FAULT` open | Pump ON for 31 min; pump ON without confirming the alert; Domain Expert tries an override | 422; 409; 403; relay stays `AUTO` | Nguyễn Chí Bảo |
| DS-03 | WF-02 | Main | NH3 limit of the zone set below the current reading | Wait for the dwell time; owner reads the push and Telegram message and acknowledges with a note; raise the limit | `THRESHOLD_BREACH` (NH3) sent by push and Telegram; fan output unchanged; `ACKNOWLEDGED` with the note; `RESOLVED` after recovery | Nguyễn Vũ Len |
| DS-04 | WF-02 | Exception | Same alert open | Domain Expert tries to acknowledge it | 403; alert stays `ACTIVE` | Nguyễn Vũ Len |
| DS-05 | WF-03 | Main | AI node online; seeded 7 days of counts | Play a recorded entrance clip through the AI node during a session window | Counts of the house rise on the page; live stream shows boxes; next return-rate check raises `LOW_RETURN_RATE` for the seeded drop | Nguyễn Chí Bảo |
| DS-06 | WF-03 | Exception | Session in progress | Stop the AI node | `EDGE_AI_DEGRADED` after 90 s; the day is incomplete and not evaluated | Nguyễn Chí Bảo |
| DS-07 | WF-04 | Main | Speaker off; seeded hourly baseline | Play loud noise near the sensor for the sustain period | `NOISE_ANOMALY` shown with bird counts; expert rejects with a note; status `DISMISSED`, owner notified | Thái Minh Tuấn |
| DS-08 | WF-04 | Exception | Farm with a Domain Expert | Farm Owner tries to record a verdict | 403 | Thái Minh Tuấn |
| DS-09 | WF-05 | Main | Farm with an expert; pending suggestion | Owner changes a threshold and submits the suggestion; expert adjusts the change and approves the suggestion | Review item `ADJUSTED`, proposal `APPROVED`, configuration applied on the controllers, owner notified of each decision | Trần Minh Kiệt |
| DS-10 | WF-05 | Exception | Same farm | Owner applies the suggestion directly | 403; coefficients unchanged | Trần Minh Kiệt |
| DS-11 | WF-06 | Main | Seeded day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily job; owner rates the day; download PDF and CSV | Status `ACTION` with both reasons; rating asked before the status; files show the same figures | Nguyễn Thị Yến Nhi |
| DS-12 | WF-06 | Exception | Seeded day with an incomplete evening session | Run the daily job | `INSUFFICIENT_DATA`, never `GOOD`; reason names the missing session | Nguyễn Thị Yến Nhi |

## A3. Functional Test Case Target

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 20 | 3 | 60 |
| Main workflows (end-to-end) | 6 | 1 | 6 |
| State transitions of main entities | 53 | 1 | 53 |
| Committed NFRs | 6 | 1 | 6 |
| Total | | | 125 |

Automated in CI: at least 50% of the committed total, i.e. at least 63 test cases. State transitions counted (SRS Section 6): alert status 10, alert verdict 2, relay mode 4, device connection 5, device label 6, configuration sync 5, review item 6, suggestion proposal 5, daily health status 2, assessor rating 5, health report 3. Test cases are listed in Report 5.
