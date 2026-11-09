# Design Brief – Review 2 (BM01)

Source of form BM01. The Word file `design-brief/SEP490_R2_BM01_Design_Brief_SwiftletCare.docx` is generated from the tables below, so edit this file first and then regenerate it. Details are in the registration form v3 (`registration-v3.md`), Report 3 (SRS) and Report 4 (SDD); this brief only points to them. Sections 0–8 must fit on 4 A4 pages; Appendix A is not counted.

## 0. Header

| Field | Value |
| --- | --- |
| Project code | FA26SE158 |
| Project name | SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | Nguyễn Văn Chiến, Trương Long |
| Repository link (tag review-2) | https://github.com/NBao261/SwiftletCare_KLTN/tree/review-2 |
| Version | 2.0 (registration v3 final, BM03 1.3, SRS 4.2.0, SDD 2.2.0, BM02 1.0) |
| Date | 09/11/2026 |

## 1. Scope

### 1.1 Registration Changes

| Section | Current | Proposed | Reason |
| --- | --- | --- | --- |
| B, D3, 3.2a | YOLOv8; virtual line | YOLO (version in SDD); ring around the hole | Birds leave the hole in every direction |
| B, C, D, 4 | Technician on tickets; public sign-up | Owner sets up by QR; Farm Technician on assigned houses; Work Orders closed by data; one owner, no sign-up | Review 1: system, not platform; Review 2 |
| B, C, D, E | Periodic zone summary; harvest log | Daily house status, reports, ratings; overview, KPIs, harvest cycles, profiles | Measurable output; Review 2 |
| B, C.1, 4 | No weather, no current; "pump dry" | Weather context and capped misting offset; load current, run hours; "misting ineffective" | No unmeasured cause |
| D, 4, C.2 | Nine flows; bypass; Telegram or push | Eight business flows (maintenance, recommendations added), harvest a supporting flow; no bypass; both channels | One outcome per flow |

### 1.2 Out of Scope

| Item | Reason |
| --- | --- |
| Predator detection, call classification, heating, light control, fan driven by NH3/CO2 or weather | One vision class; dB-only sensor; no equipment or limits |
| Marketplace, buyer, external service providers, regions, queues, payroll, public sign-up, several owners per installation, Zalo/SMS, bypass, yield prediction, 24/7 production | Platform or HR functions (Review 1); borrowed house; too little data; prototype only |

## 2. System at a Glance

Owners visit their closed houses every few days, so drift, faults and a falling flock go unnoticed. On each floor an ESP32 reads five RS485 sensors and drives misting, fan and speaker by fuzzy logic, even offline, with a small expert-approved weather offset. A PC counts birds at the entrance (YOLO + ByteTrack). The backend sends each alert to the house's Farm Technician first, turns faults into Work Orders closed only when the data recover, plans maintenance from run hours and rates each house daily. The Domain Expert validates, tunes and writes rules whose effect is measured; the Farm Owner decides and compares houses and seasons. SDD 2.1, 11.

## 3. Key Design Decisions

| ID | Decision | Options considered | Chosen option and rationale | Owner | Related FR / diagram |
| --- | --- | --- | --- | --- | --- |
| D1 | Where control runs | Cloud; controller | Controller decides every 10 s; cloud only configures, so control survives outages | Nguyễn Chí Bảo | ENV-FR-010, 014; AD-01 |
| D2 | Counting geometry | Line; ring near hole; ring + whole-frame tracking | Whole-frame tracking, ring, extrapolation: at the hole a bird is a 1–2-frame blur | Nguyễn Chí Bảo | VISION-FR-004, 005; AD-03 |
| D3 | Expert in the loop | Approval blocks; no review | Owner changes apply and open a review item; only the expert applies suggestions | Thái Minh Tuấn | EXPERT-FR-010, 011; SM-10, 11 |
| D4 | Device identity | Typed IDs; BLE; label + floor QR; zone or device topics | Label and floor QR; one credential and topic tree per device; zone kept by the backend | Trần Minh Kiệt | FARM-FR-003c, 010; SDD D3; AD-07 |
| D5 | Combining sources | Weighted score; classifier; rules | Agreement rules: `ACTION` needs the flock plus another source; reasons listed | Nguyễn Thị Yến Nhi | ANALYTICS-FR-012; AD-06 |
| D6 | How an incident ends | Manual close; ticket + SLA; data | Work Order closes after 10 min recovered and approval | Trần Minh Kiệt | OPS-FR-003; SM-19 |

## 4. Top Risks

| ID | Risk | Impact | How we verify or mitigate | Owner |
| --- | --- | --- | --- | --- |
| R1 | No trained model; PC may not keep up with 25 fps (7–12 fps on a laptop) | NFR-04/09 fail | Train by recording day; measure on the PC; else lower camera rate, re-measure NFR-09 | Nguyễn Chí Bảo |
| R2 | MF-06 not merged yet; NFR-14 needs ≥ 14 rated days | Health not measured | Daily job first on seeded days; field run from installation | Nguyễn Thị Yến Nhi |
| R3 | No staging; MQTT moves to device topics, `esp-mqtt`, TLS | Demos need staging | Staging first in It. 2; one firmware-backend-AI PR, bench-tested | Nguyễn Chí Bảo |
| R4 | Scope grew at Review 2 with 7 weeks left | Features unfinished | One owner per package; simulator first; roster last | Nguyễn Chí Bảo |

## 5. Known Gaps

Code against SRS and SDD; each gap in Project Tracking §6. In brackets: High findings of BM02, all Planned.

| ID | Gap | Location | Plan | Owner | Due |
| --- | --- | --- | --- | --- | --- |
| G-14 (D-01, 03) | Data model of SDD 6.1 | backend | SDD 6.1–6.4 | Kiệt | It. 2 |
| G-02, 09, 10, 16 (F-04) | Admin-created owner, e-mail; QR screens; FCM; mobile | backend, web, mobile | AD-10; ALERT-FR-002 | Kiệt, Nhi, Len | It. 2–3 |
| G-06 (ST-02, C-03) | Per-relay expiry, pump limit, freshness (PR #124) | backend, firmware | BR-08, 20, 35 | Kiệt, Len | It. 2 |
| G-07, 08 (C-01, F-02, 05) | Device topics, TLS, QoS 1; config version | firmware, backend | SDD D3; SM-12 | Bảo | It. 2 |
| G-11 (F-01, C-04, D-04) | Daily status, ratings, reports, weather | backend, web | AD-06 | Nhi, Kiệt | It. 2–3 |
| G-12, 13 (F-03, 04) | Model evaluation; sessions; current sensing | AI node, board | VISION-FR-008 | Bảo | It. 2–3 |
| G-17 | Staging, TLS proxy, demo seed | deploy | SDD 11 | Bảo | It. 2 |
| G-20…22 (C-02) | Farm Technician; routing; Work Orders; maintenance | backend, apps | OPS-FR; AD-02, 07 | Kiệt, Len, Nhi | It. 2–3 |
| G-23…27 | Weather offset; profiles, rules; KPIs; cycles; simulator | all | AD-08, 09 | Bảo, Tuấn, Nhi | It. 2–3 |

## 6. Proposed Mandatory Features

| ID | Feature | Actor | Acceptance criteria (testable) | Test | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, dashboard | FO, DE | Dashboard ≤ 2 s; dead sensor stale; no event to others | TC-F01 | Done |
| F-02 | Fuzzy control | auto | Decision every 10 s ± 1 s; firmware = backend on shared cases | TC-F02 | Done |
| F-03 | Thresholds, coefficients | FO, DE | History kept, sent; out of range 400; Admin 403 | TC-F03 | In progress |
| F-04 | Offline operation | auto | 30-min outage: no decision or sample lost | TC-F04 | In progress |
| F-05 | Self-diagnosis | auto | 300 s pump, no +2 % → MISTING_INEFFECTIVE | TC-F05 | In progress |
| F-06 | Actuator current | auto | ON, current < 50 % for 30 s → ACTUATOR_FAULT | TC-F06 | Planned |
| F-07 | Alert lifecycle | FT, FO | Repeats merge; 10 min out → breach; ack resolved 409 | TC-F07 | In progress |
| F-08 | Push and Telegram | FT, FO | CRITICAL on both ≤ 5 s; none after sign-out | TC-F08 | In progress |
| F-09 | Forecast warning | auto | Crossing within 60 min → FORECAST_BREACH | TC-F09 | Done |
| F-10 | Counting, return rate | auto | Counts per house; drop > limit → one alert | TC-F10 | In progress |
| F-11 | Live stream | FO, DE | Box on each bird; 60-s token; others 403 | TC-F11 | In progress |
| F-12 | Abnormal noise | auto | +20 dB 12 s of 15 → NOISE_ANOMALY | TC-F12 | Done |
| F-13 | On-site check, verdict | FT, DE | Technician observation in the evidence; reject without note 422, with note DISMISSED | TC-F13 | In progress |
| F-14 | Tuning, ring, schedule | DE, FT | History kept; out of range 400; 13 vertices 422 | TC-F14 | In progress |
| F-15 | Review, suggestions | DE, FO | Owner change → review item; owner applies 403 | TC-F15 | Planned |
| F-16 | Conclusions, notices | DE, FO | Each expert decision notifies every owner | TC-F16 | In progress |
| F-17 | Manual override | FO, FT | Own expiry per relay; pump 31 min 422 | TC-F17 | In progress |
| F-20 | Daily health status | auto | Flock CLEAR + humidity SLIGHT → ACTION | TC-F20 | Planned |
| F-21 | Reports, PDF/CSV | FO, DE | Day/week/month per house; files = screen | TC-F21 | In progress |
| F-22 | Rating, disagreements | FT, FO, DE | Rated on site before status; expert reviews disagreements | TC-F22 | Planned |
| F-23 | Routing, escalation | FT, FO | HIGH to technician, owners after 15 min | TC-F23 | Planned |
| F-24 | Work Orders | FT, FO | Closes after 10 min recovered + approval | TC-F24 | Planned |
| F-25 | Preventive maintenance | FT, FO | 500 h plan → due + Work Order; counter reset | TC-F25 | Planned |
| F-26 | Weather offset | auto, DE | +5 % rule → 45 %; 0 after expiry; 12 % 400 | TC-F26 | Planned |
| F-27 | Recommendation rules | DE, FO | Rule met → one recommendation; effect measured | TC-F27 | Planned |
| F-28 | Profiles, house stage | DE, FO | Applied → new versions; attracting: no return rate | TC-F28 | Planned |
| F-29 | Overview, comparison | FO | Cells = BR-44; 1 A × 12 V × 10 h = 0.12 kWh | TC-F29 | Planned |

FO Farm Owner, FT Farm Technician, DE Domain Expert (FO if none); auto = system component; TC-Fnn = TC-Fnn-01..03 (Report 5); status from Project Tracking. F-18, F-19 (SF-01) and F-30 (SF-06, harvest cycles) are tested, not mandatory.

## 7. Non-Functional Requirements

| ID | Quality attribute | Metric | Threshold | Measurement method |
| --- | --- | --- | --- | --- |
| NFR-01 | Performance | Publish → dashboard | P95 ≤ 2 s | 200 messages, staging |
| NFR-02 | Performance | Alert → app, push, Telegram | P95 ≤ 5 s each | 30 alerts, staging |
| NFR-06 | Reliability | Decisions; data lost | 100 %; 0 in 30 min offline | Uplink cut, prototype |
| NFR-09 | Accuracy | Detection P, R; count error | ≥ 0.80; ≤ 10 % | Unseen days, per lighting |
| NFR-13 | Usability | Power-on → "applied" | ≤ 10 min, 5/5 | 5 first-time users |
| NFR-14 | Accuracy | Rating vs status agreement | ≥ 70 % (95 % CI) | ≥ 14 rated days |
| NFR-15 | Performance | Escalation; verification | P95 ≤ 60 s | Simulator, staging |

## 8. Ownership Map

| Member | Role | Owned parts (2–3) | Main workflow owned | Key decisions / PRs |
| --- | --- | --- | --- | --- |
| Nguyễn Chí Bảo | Leader; IoT, AI | Firmware, weather offset; AI pipeline; analytics backend, simulator | WF-01, 03 | D1, D2; #88 |
| Trần Minh Kiệt | Backend | Devices, alerts, expert; operations backend; daily health | WF-05 | D4, D6; #113 |
| Nguyễn Vũ Len | Mobile | Owner and Technician mobile app; E2E | WF-02, 07 | #123, #93 |
| Nguyễn Thị Yến Nhi | Web: Owner, Admin | Owner web: overview, KPIs, Work Orders, cycles; Admin | WF-06 | D5; #26, #72 |
| Thái Minh Tuấn | Web: Expert | Expert screens: verdicts, profiles, rules, seasons | WF-04, 08 | D3; #91, #125 |

---

# Appendix A – Defense 1.1 Targets

## A1. Main Workflows

Actors are people only; external services (Telegram, FCM, Open-Meteo) and the controller, the AI node and the backend are not counted (SRS Section 2.3). Every workflow has at least two actors and changes the state of a main entity.

| ID | Workflow | Actors | Trigger | Business outcome | Features | Entity states | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WF-01 | Automatic micro-climate control (MF-01, AD-01) | Farm Owner, Farm Technician | 10-s control cycle; forecast; Internet or power loss; a relay switched by hand | Misting and fan follow humidity and temperature, with the bounded weather offset, also offline; an override lasts a limited time, then automatic | F-01, F-02, F-04, F-17, F-26 | Controller relay: `AUTO` → `MANUAL` → `AUTO`; Controller: `ONLINE` → `OFFLINE` → `ONLINE` | Nguyễn Chí Bảo |
| WF-02 | Incident handling (MF-02, AD-02) | Farm Technician, Farm Owner | Breach after the dwell time, NH3/CO2 above limit, equipment fault, restart, offline, forecast | Alert to the technician, escalated to the owner; fault repaired as a Work Order closed by the data; loop held safe | F-05…F-09, F-23, F-24 | Alert: `ACTIVE` → `ACKNOWLEDGED` → `RESOLVED`; WorkOrder: `OPEN` → `IN_PROGRESS` → `VERIFYING` → `AWAITING_APPROVAL` → `CLOSED` | Nguyễn Vũ Len |
| WF-03 | Bird counting session (MF-03, AD-03) | Farm Technician, Domain Expert | Morning and evening sessions; ring drawn on site | Counts and return rate of the house; alert on drop; annotated stream | F-10, F-11, F-14 | CameraNode: `PENDING` → `ONLINE`; Alert `LOW_RETURN_RATE`: `ACTIVE` → `RESOLVED` | Nguyễn Chí Bảo |
| WF-04 | Expert validation of inferred alerts (MF-04, AD-04) | Farm Technician (on-site check), Domain Expert, Farm Owner (BR-22) | Abnormal noise, implausible readings, early warning | Verdict with evidence; rejected alert dismissed; owner notified | F-12, F-13, F-16 | Alert: `ACTIVE` → `DISMISSED`; ExpertVerdict: pending → `REJECTED` | Thái Minh Tuấn |
| WF-05 | Control-parameter tuning (MF-05, AD-05) | Domain Expert, Farm Owner, Farm Technician | Owner change, coefficient suggestion, profile, detection or ring change | Changes reviewed, suggestion approved, profiles applied, new configuration applied on the controllers, owner notified | F-03, F-14, F-15, F-28 | ReviewItem: `PENDING_REVIEW` → `ADJUSTED`; CoefficientProposal: `PROPOSED` → `APPROVED`; Controller config: `PENDING` → `APPLIED` | Trần Minh Kiệt |
| WF-06 | Daily health assessment and reports (MF-06, AD-06) | Farm Technician, Farm Owner, Domain Expert | End of day; week; month | Daily status with reasons; day rated independently; reports downloaded and concluded; houses compared | F-20, F-21, F-22, F-29 | DailyHealthStatus: (new) → `COMPUTED`; DailyRating: `PENDING` → `RATED`; HealthReport: `GENERATED` → `CONCLUDED` | Nguyễn Thị Yến Nhi |
| WF-07 | Preventive maintenance (MF-07, AD-07) | Farm Owner, Farm Technician | Plan due by run hours, switches or date | Preventive Work Order done with its checklist; counter reset; overdue escalated | F-25 | MaintenancePlan: `SCHEDULED` → `DUE` → `SCHEDULED`; WorkOrder: `OPEN` → `CLOSED` | Nguyễn Vũ Len |
| WF-08 | Recommendation loop (MF-08, AD-08) | Domain Expert, Farm Owner, Farm Technician | An expert rule holds for a house | Recommendation accepted (Work Order or parameter change) or rejected; effect measured | F-27 | Recommendation: `OPEN` → `ACCEPTED` → `MEASURED` | Thái Minh Tuấn |

## A2. Demo Scenarios

Run on staging (SDD Section 3.4) with data loaded by the demo seed script (`docs/deploy/staging.md` §5).

| ID | Workflow | Type | Preconditions and data | Main steps | Expected result | Presenter |
| --- | --- | --- | --- | --- | --- | --- |
| DS-01 | WF-01 | Main | Zone with controller online; humidity below `humidity_min` | Watch the dashboard; unplug the router uplink for 5 min and reconnect; owner forces the pump ON for 1 min | Misting power rises within one cycle; relays keep switching offline, no gap in the chart after reconnection; relay `MANUAL`, then `AUTO` after 1 min, override in the history | Nguyễn Chí Bảo |
| DS-02 | WF-01 | Exception | Same zone; a `SENSOR_FAULT` open | Pump ON for 31 min; pump ON without confirming the alert; Domain Expert tries an override | 422; 409; 403; relay stays `AUTO` | Nguyễn Chí Bảo |
| DS-03 | WF-02 | Main | House with a technician; pump tank emptied (or simulated `MISTING_INEFFECTIVE`) | Technician receives push and Telegram, does not acknowledge for 15 min; then repairs, records the cause and a photo; owner approves | Owner notified after 15 min; Work Order `OPEN` → `VERIFYING` → `AWAITING_APPROVAL` after 10 min recovered → `CLOSED`; MTTR shown | Nguyễn Vũ Len |
| DS-04 | WF-02 | Exception | Work Order `VERIFYING` | Misting fails again during verification; technician of another house tries to acknowledge | Work Order back to `IN_PROGRESS`; 403 | Nguyễn Vũ Len |
| DS-05 | WF-03 | Main | AI node online; seeded 7 days of counts | Play a recorded entrance clip through the AI node during a session window | Counts of the house rise on the page; live stream shows boxes; next return-rate check raises `LOW_RETURN_RATE` for the seeded drop | Nguyễn Chí Bảo |
| DS-06 | WF-03 | Exception | Session in progress | Stop the AI node | `EDGE_AI_DEGRADED` after 90 s; the day is incomplete and not evaluated | Nguyễn Chí Bảo |
| DS-07 | WF-04 | Main | Speaker off; seeded hourly baseline | Play loud noise near the sensor for the sustain period; the technician checks the house on site | `NOISE_ANOMALY` shown with bird counts; technician's observation in the evidence; expert rejects with a note; status `DISMISSED`, owner notified | Thái Minh Tuấn |
| DS-08 | WF-04 | Exception | Farm with a Domain Expert | Farm Owner tries to record a verdict | 403 | Thái Minh Tuấn |
| DS-09 | WF-05 | Main | Farm with an expert; pending suggestion | Owner changes a threshold and submits the suggestion; expert adjusts the change and approves the suggestion | Review item `ADJUSTED`, proposal `APPROVED`, configuration applied on the controllers, owner notified of each decision | Trần Minh Kiệt |
| DS-10 | WF-05 | Exception | Same farm | Owner applies the suggestion directly | 403; coefficients unchanged | Trần Minh Kiệt |
| DS-11 | WF-06 | Main | Seeded day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily job; technician rates the day on site; download PDF and CSV | Status `ACTION` with both reasons; rating asked before the status; files show the same figures | Nguyễn Thị Yến Nhi |
| DS-12 | WF-06 | Exception | Seeded day with an incomplete evening session | Run the daily job | `INSUFFICIENT_DATA`, never `GOOD`; reason names the missing session | Nguyễn Thị Yến Nhi |
| DS-13 | WF-07 | Main | Pump plan 500 h; counter seeded at 499 h | Run the pump 1 h; technician follows the checklist and records it | `MAINTENANCE_DUE` and a preventive Work Order; counter reset, next due point shown | Nguyễn Vũ Len |
| DS-14 | WF-07 | Exception | Plan due for 7 days | Run the due job; answer a checklist item "defect" | Plan `OVERDUE`, owner notified; repair Work Order opened | Nguyễn Vũ Len |
| DS-15 | WF-08 | Main | Rule "NH3 above limit 4 h/day for 3 days"; seeded days | Run the daily job; owner accepts; run the effect job on seeded later days | Recommendation with evidence; Work Order created; effect shown on the rule page | Thái Minh Tuấn |
| DS-16 | WF-08 | Exception | Open recommendation | Owner rejects without a reason; 7 days pass | 422; then `EXPIRED` | Thái Minh Tuấn |

## A3. Functional Test Case Target

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 27 | 3 | 81 |
| Main workflows (end-to-end) | 8 | 1 | 8 |
| State transitions of main entities | 74 | 1 | 74 |
| Committed NFRs | 7 | 1 | 7 |
| Total | | | 170 |

Automated in CI: at least 50% of the committed total, i.e. at least 85 test cases. State transitions counted (SRS Section 6): alert status 10, alert verdict 2, relay mode 4, device connection 5, device label 6, configuration sync 5, review item 6, suggestion proposal 5, daily health status 2, assessor rating 5, health report 3, Work Order 10, maintenance plan 5, recommendation 6. Test cases are listed in Report 5.
