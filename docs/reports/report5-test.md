# Report 5 – Software Test Documentation

**SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

| Field | Value |
| --- | --- |
| Project code | `[TEAM: approved project code]` |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | `[TEAM: supervisor name]` |
| Document version | 1.1.0 (Review 2) |
| Date | 26/10/2026 |
| Requirements baseline | Report 3 – SRS 3.1.0; Design Brief (BM01) 1.1 sections 6–7 and Appendix A |

This file is generated from the test-case list `docs/reports/report5/tc.py` by `docs/reports/report5/gen_report5.py`. Edit the list and regenerate; do not edit the tables by hand. The generator checks that every automated case names a test that exists; the "Actual result" column is filled only from a CI run on the tag named in Section 6.

---

## 1. Introduction

### 1.1 Purpose

This report is the test plan and the test cases of SwiftletCare for Defense 1.1. It maps every mandatory feature (F-01…22), main workflow (WF-01…11), state transition of a main entity (Report 3, Section 6) and committed NFR of the Design Brief to test cases with their expected and actual results.

### 1.2 Scope of Testing

| In scope | Out of scope |
| --- | --- |
| Firmware logic (filters, fuzzy control, misting check, noise anomaly, remote commands) on the host; backend services, REST API, MQTT ingestion, jobs, Socket.io authorisation; web pure logic; the counting pipeline's geometry; end-to-end workflows on staging; NFRs on staging, prototype and test house | Items of Report 3, Section 8; load beyond NFR-03; security penetration testing; store builds of the mobile app |

### 1.3 Test Count Committed (Design Brief, Appendix A3)

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 22 | 3 | 66 |
| Main workflows (end-to-end) | 11 | 1 | 11 |
| State transitions of main entities | 53 | 1 | 53 |
| Committed NFRs | 6 | 1 | 6 |
| **Total** | | | **136** |

## 2. Test Strategy

### 2.1 Test Levels

| Level | What | Tool | Where | Run by |
| --- | --- | --- | --- | --- |
| Unit | Firmware control and detection logic; backend utilities (fuzzy model, forecast, anomaly, thresholds); web pure logic; pipeline geometry | Unity (`pio test -e native`), Jest, Vitest, pytest | CI on every pull request that touches the module (pytest job since PR #95) | Module owner |
| Integration | Backend routes, services, jobs and MQTT handlers against an in-memory MongoDB; role checks | Jest + supertest + mongodb-memory-server | CI | Module owner |
| System (end-to-end) | Each main workflow through real devices or simulators, backend, web and mobile | Manual, following the demo scenarios | Staging (Report 4, Section 3.4) with the demo seed | Workflow owner |
| Field | Control, counting, health assessment in the test house | Manual measurement, scripts | Test house, AI node | Whole team |
| Non-functional | NFR-01, 02, 06, 09, 13, 14 | Scripts (latency), stopwatch, evaluation scripts | Staging, prototype, test house | Owner in Section 5 |

### 2.2 Test Types per Feature

Each mandatory feature has three test cases (guideline §9.3): one main path, one data or business-rule check, and one exception or permission check. Each state transition has one test, including transitions that must be rejected. Each workflow has one end-to-end test that follows its main demo scenario; the exception scenarios of Appendix A2 are run at the same time and reported in Section 4.2.

### 2.3 Automation

CI (`.github/workflows/ci.yml`) runs on every pull request, only for the modules it touches: backend lint, type check and Jest with an 80 % line-coverage threshold; web lint, type check, Vitest and build; firmware host tests; mobile lint, type check and Jest; AI pipeline pytest. Test cases marked "Auto (CI)" are part of these suites; "Auto (CI, to be written)" are written with the feature they test, in the same pull request. Target at Defense 1.1: at least 50 % of the committed test cases automated in CI.

### 2.4 Entry and Exit Criteria

| | Criteria |
| --- | --- |
| Entry (system test) | Staging deployed from the tag; demo seed loaded; CI green on the tag |
| Exit (Defense 1.1) | 100 % of the main workflows end-to-end; 100 % main and ≥ 80 % exception scenarios pass; ≥ 90 % of test cases pass and 100 % of main-path feature tests; ≥ 50 % automated in CI; no open Critical or High defect |

### 2.5 Defect Management

Defects are GitHub issues labelled `bug` with a severity:

| Severity | Meaning | Example |
| --- | --- | --- |
| Critical | A main workflow cannot complete, data is lost, or a safety rule is broken | Fan driven by NH3; override never returns to AUTO |
| High | A mandatory feature gives a wrong result or a permission is wrong | A Technician can edit thresholds |
| Medium | Wrong result with a workaround, or a non-mandatory feature broken | Wrong label in a report |
| Low | Cosmetic | Alignment, wording |

Every defect is fixed by a pull request that adds a test failing without the fix. Open defects are listed in Project Tracking.

## 3. Test Environment

| Environment | Content |
| --- | --- |
| CI | GitHub Actions, Ubuntu runner, Node 22, Python 3 + PlatformIO, Python + pytest for the AI pipeline, MongoDB in memory |
| Local | Members' machines with `docker compose` (MongoDB, EMQX, MinIO, MediaMTX) |
| Staging | VPS with backend, web, EMQX (TLS), MongoDB, MinIO, MediaMTX behind Caddy; AI node on the spare PC at a member's home, reading the camera over the Internet (`docs/deploy/staging.md`) |
| Prototype | ESP32 controller with the five RS485 sensors, relay module, DFPlayer and speaker; test house in the field run |
| Data | `npm run seed` plus the demo seed (Project Tracking G-17); recorded entrance clips for counting |

## 4. Test Cases

Columns follow the guideline: ID, feature or workflow, preconditions, steps, data, expected result, how it runs (automatic or manual), actual result.

### 4.1 Mandatory Features (66)

Requirements covered by each mandatory feature:

| Feature | Name | Requirements |
| --- | --- | --- |
| F-01 | Telemetry, live dashboard | ENV-FR-001, 002, 004, 005, 015, 022, ANALYTICS-FR-001, 005 |
| F-02 | Fuzzy control | ENV-FR-010, 011, 013b, ANALYTICS-FR-008 |
| F-03 | Thresholds, coefficients | ENV-FR-006, 007, 009, 020, 021, EXPERT-FR-004 |
| F-04 | Offline operation | ENV-FR-014, 024, 025, THREAT-FR-009, 012 |
| F-05 | Self-diagnosis | THREAT-FR-005, 006, 011, 013, ALERT-FR-010 |
| F-06 | Actuator current check | THREAT-FR-014 |
| F-07 | Alert lifecycle | ALERT-FR-001, 007, 008, 009, 012, 015, 016 |
| F-08 | Push and Telegram | ALERT-FR-002, 005, 006, 013 |
| F-09 | Forecast warning | ANALYTICS-FR-009, ALERT-FR-011 |
| F-10 | Counting, return rate | VISION-FR-001…011, 016, 017, 020, THREAT-FR-010, ANALYTICS-FR-002, 003, FARM-FR-004 |
| F-11 | Annotated live stream | VISION-FR-012, 013, 014 |
| F-12 | Abnormal noise | THREAT-FR-007 |
| F-13 | Expert verdict | EXPERT-FR-003, 007, ALERT-FR-014 |
| F-14 | Tuning, ring, schedule | EXPERT-FR-008, VISION-FR-018, 019 |
| F-15 | Review and suggestions | EXPERT-FR-010, 011, ANALYTICS-FR-010 |
| F-16 | Conclusions, owner notice | EXPERT-FR-001, 002, 006, 009 |
| F-17 | Manual override | ENV-FR-016, 017, 018, 019, ANALYTICS-FR-011 |
| F-18 | Farm structure and device registration | FARM-FR-001, 002, 003, 003b, 003c, 010, 011 |
| F-19 | Device lifecycle, diagnostics and setup progress | FARM-FR-005, 006, 007, 007b, 008, 012, ENV-FR-027 |
| F-20 | Daily health status | ANALYTICS-FR-012, 013 |
| F-21 | Reports, PDF/CSV | EXPERT-FR-005, 013 |
| F-22 | Independent rating | EXPERT-FR-012, ANALYTICS-FR-014 |

| ID | Feature / workflow | Requirements verified | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-F01-01 | F-01 | ENV-FR-001, 004, 005 | Zone with a controller; dashboard client in the zone room | Ingest telemetry messages for the zone | One reading per second for 30 s | Every reading is pushed to the dashboard; one sample per 10 s is stored | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “persists live readings at most once per 10s but still pushes every reading to the dashboard” | Not run on the tag |
| TC-F01-02 | F-01 | ENV-FR-022 | Median/Kalman filter initialised | Feed a NaN sample to the filter | Valid samples, then NaN | The filtered value keeps its state; the invalid sample is not used | Auto (CI) – firmware `pio test -e native` `test_filter` › `test_nan_keeps_state` | Not run on the tag |
| TC-F01-03 | F-01 | ENV-FR-005 | User of another farm with a valid token | Emit JOIN_ZONE for a zone of a farm the user is not a member of | Zone ID of farm B, user of farm A | The socket does not join the room and receives no event | Auto (CI) – backend Jest `tests/integration/socketAuth.test.ts` › “does NOT join the room when the user has no access to the zone” | Not run on the tag |
| TC-F02-01 | F-02 | ENV-FR-010 | Default fuzzy coefficients | Compute misting output for the worked example of the SDD | Humidity and temperature of the worked example | Output equals the hand-computed value | Auto (CI) – firmware `pio test -e native` `test_fuzzy` › `test_misting_worked_example` | Not run on the tag |
| TC-F02-02 | F-02 | ENV-FR-010, 011, ANALYTICS-FR-008 | Backend port of the fuzzy model; recorded fuzzy-era samples | Run the shared test cases on the TypeScript model; read the control performance of the zone | Membership, misting, ventilation cases of the firmware tests; seeded samples | Same outputs as the firmware within tolerance; % time in range and relay switches per hour equal the seeded values | Auto (CI) – backend Jest `tests/unit/utils/fuzzyModel.util.test.ts` › “misting worked example and extremes” + Auto (CI) – backend Jest `tests/integration/fuzzyControl.test.ts` › “reports in-range share and relay switches per hour” | Not run on the tag |
| TC-F02-03 | F-02 | ENV-FR-010, 011, THREAT-FR-013 | Default coefficients | Call the controller with invalid (NaN) inputs | NaN humidity and temperature | Safe state: misting and fan output 0 | Auto (CI) – firmware `pio test -e native` `test_fuzzy` › `test_invalid_inputs_give_safe_state` | Not run on the tag |
| TC-F03-01 | F-03 | ENV-FR-006, 009 | Zone with thresholds; Farm Owner signed in | PUT a valid partial threshold update | `humidity_min` = 80 | Values stored as numbers; history entry with source MANUAL; other keys unchanged | Auto (CI) – backend Jest `tests/integration/zoneThresholds.test.ts` › “records only the known keys, with source MANUAL, in the threshold history” | Not run on the tag |
| TC-F03-02 | F-03 | ENV-FR-006 | Same zone | PUT an out-of-range threshold | `humidity_min` = 150 | 400; nothing stored | Auto (CI) – backend Jest `tests/integration/zoneThresholds.test.ts` › “PUT /farms/zones/:id/thresholds answers 400 for an out-of-range value” | Not run on the tag |
| TC-F03-03 | F-03 | ENV-FR-006, 020, 021 | Technician and Administrator accounts | PUT thresholds, reset and fuzzy tuning as each of them | Valid body | 403 for both on every route (ENV-FR-006, 020, 021) | Auto (CI) – backend Jest `tests/integration/roleMatrix.test.ts` › “mỗi dòng của bảng quyền trả 403 cho role bị bỏ” | Not run on the tag |
| TC-F04-01 | F-04 | ENV-FR-014 | Prototype running in AUTO; logging on | Cut the router uplink for 30 min, then restore it | — | A control decision every 10 s during the outage (100 %) | Manual – prototype, test house | Not run |
| TC-F04-02 | F-04 | ENV-FR-004, 024 | Controller reconnects with buffered samples | Ingest flushed offline-buffer readings | Readings with their own timestamps | Stored at their own time; the live dashboard is not touched | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “stores flushed offline-buffer readings at their own time” | Not run on the tag |
| TC-F04-03 | F-04 | ENV-FR-025, THREAT-FR-012 | Prototype running | Block the main loop on purpose (debug build) | — | Watchdog restarts the controller; control resumes; one `UNEXPECTED_RESTART` with reset reason `WATCHDOG` | Manual – prototype | Not run |
| TC-F05-01 | F-05 | THREAT-FR-011 | Humidity below `humidity_min`, pump ON | Simulate 300 s of pump ON without humidity rise | Default `pump_dry_on_sec` = 300, rise 2 % | Detected once and latched; automatic misting output 0 | Auto (CI) – firmware `pio test -e native` `test_pump_dry` › `test_dry_pump_is_detected_once_and_latches` | Not run on the tag |
| TC-F05-02 | F-05 | THREAT-FR-011 | Same detector | Simulate rising humidity while the pump runs | Rise above 2 % | Not detected | Auto (CI) – firmware `pio test -e native` `test_pump_dry` › `test_rising_humidity_is_not_dry` | Not run on the tag |
| TC-F05-03 | F-05 | ALERT-FR-010 | Zone with telemetry | Seed a temperature stuck for 2 h and run the anomaly scan | Constant value | One MEDIUM `SENSOR_ANOMALY`, never escalated; resolved when data is normal | Auto (CI) – backend Jest `tests/integration/sensorAnomaly.test.ts` › “raises one MEDIUM SENSOR_ANOMALY for a stuck sensor” | Not run on the tag |
| TC-F06-01 | F-06 | THREAT-FR-014 | Current detector with learned normal current | Relay ON, current below 50 % of normal for 30 s | Normal 2.0 A; measured 0.8 A | One `ACTUATOR_FAULT` | Auto (CI, to be written) – firmware native test `test_actuator_current` (G-13) | Not run – test to be written |
| TC-F06-02 | F-06 | THREAT-FR-014 | Detector learning | Relay ON for the first 30 s | Steady 2.0 A | Normal current learned as 2.0 A; no fault while learning | Auto (CI, to be written) – firmware native test (G-13) | Not run – test to be written |
| TC-F06-03 | F-06 | THREAT-FR-014 | Learned normal current | Relay OFF, current above 20 % of normal for 30 s | Measured 0.6 A | One `ACTUATOR_FAULT` (relay stuck ON) | Auto (CI, to be written) – firmware native test (G-13) | Not run – test to be written |
| TC-F07-01 | F-07 | ALERT-FR-008 | Open alert of a type for a zone and device | Ingest the same incident again | Same type, zone, device | No new alert; the open one is bumped (occurrence count) | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “folds a repeat into the open alert however old it is” | Not run on the tag |
| TC-F07-02 | F-07 | ALERT-FR-012 | Zone with `humidity_min` = 80 | Ingest humidity 75 % for 9 min, then for 10 min | 1 reading per second | No alert after 9 min; after 10 min one `THRESHOLD_BREACH` with metric, observed value, threshold, direction and start time | Auto (CI, to be written) – backend jest `thresholdBreach.test.ts` (G-05) | Not run – test to be written |
| TC-F07-03 | F-07 | ALERT-FR-009 | Open alert; Domain Expert signed in | PUT acknowledge as the expert | Note text | 403; status unchanged | Auto (CI) – backend Jest `tests/integration/domainExpert.test.ts` › “không xác nhận (acknowledge) cảnh báo” | Not run on the tag |
| TC-F08-01 | F-08 | ALERT-FR-013 | Owner linked to the bot; another owner not linked; an expert | Create a CRITICAL alert | — | Telegram message to the linked owner only | Auto (CI) – backend Jest `tests/integration/telegram.test.ts` › “gửi tới chủ farm đã liên kết” | Not run on the tag |
| TC-F08-02 | F-08 | ALERT-FR-006, 013 | Owner with quiet hours | Create a MEDIUM and a CRITICAL alert in quiet hours | — | MEDIUM not sent; CRITICAL sent | Auto (CI) – backend Jest `tests/integration/telegram.test.ts` › “tôn trọng giờ im lặng, trừ cảnh báo CRITICAL” | Not run on the tag |
| TC-F08-03 | F-08 | ALERT-FR-002 | Mobile app signed in with a registered FCM token | Create a CRITICAL alert; sign out; create another | Firebase test project | Push received for the first only; an invalid token reported by FCM is removed | Auto (CI, to be written) – backend jest with a mocked Firebase Admin SDK (G-10) | Not run – test to be written |
| TC-F09-01 | F-09 | ALERT-FR-011 | 6 h of humidity falling toward `humidity_min` | Run the forecast scan | Seeded 5-minute means | LOW `FORECAST_BREACH` with expected time; resolved when the trend is gone | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “raises a LOW FORECAST_BREACH early warning” | Not run on the tag |
| TC-F09-02 | F-09 | ANALYTICS-FR-009 | Same data | GET the 60-minute forecast | — | Forecast with back-tested MAE predicts the breach | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “forecasts 60 minutes ahead with a backtested error” | Not run on the tag |
| TC-F09-03 | F-09 | ANALYTICS-FR-009 | Only stale data (older than 15 min) | GET the forecast | — | No forecast ("insufficient data") | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “does not forecast from stale data” | Not run on the tag |
| TC-F10-01 | F-10 | VISION-FR-005 | Counting ring around the hole; one tracked bird | Feed the track of a bird moving into the hole across the ring | Synthetic track positions | One EXIT counted, no ENTRY | Auto (CI) – AI pipeline `pytest` `tests/test_counting.py` › `test_bird_going_into_the_hole_is_exit` | Not run on the tag |
| TC-F10-02 | F-10 | VISION-FR-009, 011 | 3 earlier days at 90 % | Run the return-rate check with today at 60 % | `return_rate_drop_pct` = 20 | One `LOW_RETURN_RATE` for the house; re-run adds none; recovery resolves it | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “3 ngày trước 90%, hôm nay 60%” | Not run on the tag |
| TC-F10-03 | F-10 | VISION-FR-004, 005 | Same ring | Feed a track lost at the frame edge, and a slow circling bird lost near the ring | — | Nothing counted for either | Auto (CI) – AI pipeline `pytest` `tests/test_counting.py` › `test_track_lost_at_the_frame_edge_counts_nothing` + Auto (CI) – AI pipeline `pytest` `tests/test_counting.py` › `test_slow_circling_bird_lost_near_the_ring_counts_nothing` | Not run on the tag |
| TC-F11-01 | F-11 | VISION-FR-014 | Pipeline running on a recorded clip | Process frames and read the published frames | Clip with tracked birds | Every published frame shows the ring and a box with a track ID on each tracked bird | Auto (CI, to be written) – AI pipeline pytest `test_annotate.py` (G-12) | Not run – test to be written |
| TC-F11-02 | F-11 | VISION-FR-013 | Camera of a farm; its Farm Owner and Domain Expert | GET stream-token as each | — | Token valid 60 s for path `cam-<device_id>` only | Auto (CI) – backend Jest `tests/integration/streamAuth.test.ts` › “Farm Owner và Domain Expert của farm nhận token 60 giây” | Not run on the tag |
| TC-F11-03 | F-11 | VISION-FR-013 | Technician; Farm Owner of another farm | GET stream-token as each | — | 403 | Auto (CI) – backend Jest `tests/integration/streamAuth.test.ts` › “Technician (SRS §4.4) và Farm Owner của farm khác bị chặn” | Not run on the tag |
| TC-F12-01 | F-12 | THREAT-FR-007 | Hour with a learned quiet baseline | Feed noise above the baseline for the minimum duration | +20 dB for 12 s of 15 s | Anomaly raised | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_same_loudness_in_a_quiet_hour_triggers` | Not run on the tag |
| TC-F12-02 | F-12 | THREAT-FR-007 | Same baseline | Feed a short burst | +20 dB for 8 s | No anomaly | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_short_noise_does_not_trigger` | Not run on the tag |
| TC-F12-03 | F-12 | THREAT-FR-005, 007 | Speaker playing | Feed loud samples | — | Not evaluated and not learned into the baseline | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_speaker_playing_is_ignored_and_not_learned` | Not run on the tag |
| TC-F13-01 | F-13 | EXPERT-FR-003 | Inferred alert of a farm with an expert | PUT a verdict as the expert, then change it | CONFIRMED, then REJECTED with note | Stored with author, time, note and audit; can be changed | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Not run on the tag |
| TC-F13-02 | F-13 | EXPERT-FR-003 | A measured (non-inferred) alert; an alert of another farm | PUT a verdict on each | — | Rejected | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “từ chối cảnh báo đo trực tiếp và cảnh báo của farm khác” | Not run on the tag |
| TC-F13-03 | F-13 | EXPERT-FR-003 | Inferred alert | PUT `REJECTED` without a note; then with a note | — | 422 without note; with note the alert becomes `DISMISSED` | Auto (CI, to be written) – backend jest `alertVerdict.test.ts` (G-03) | Not run – test to be written |
| TC-F14-01 | F-14 | EXPERT-FR-008 | Zone of a farm with an expert | PUT detection tuning as the expert | Five zone parameters | Stored with history and audit; only the five firmware parameters sent to the devices | Auto (CI) – backend Jest `tests/integration/detectionTuning.test.ts` › “Domain Expert lưu tham số kèm lịch sử + audit” | Not run on the tag |
| TC-F14-02 | F-14 | VISION-FR-018 | Camera of the house | PUT a counting ring as the expert | Ring of 6 vertices | Stored with history and audit, sent to the AI node of the house, no RTSP address returned | Auto (CI) – backend Jest `tests/integration/countingRing.test.ts` › “Domain Expert lưu vòng kèm lịch sử + audit” | Not run on the tag |
| TC-F14-03 | F-14 | EXPERT-FR-008 | Farm with an expert | PUT detection tuning as the Farm Owner | Valid values | Read allowed, write rejected (403) | Auto (CI) – backend Jest `tests/integration/detectionTuning.test.ts` › “Farm Owner xem được nhưng không sửa được” | Not run on the tag |
| TC-F15-01 | F-15 | ANALYTICS-FR-010 | ≥ 3 days of telemetry of a fast-drying zone | GET the tuning suggestion | — | Suggestion keeps the zone in range longer; nothing applied | Auto (CI) – backend Jest `tests/integration/tuningSuggestion.test.ts` › “suggests tuning that keeps a fast-drying house in range longer” | Not run on the tag |
| TC-F15-02 | F-15 | EXPERT-FR-010 | Farm with an expert | Owner changes thresholds twice; expert reverts | — | One review item kept with the original values; revert restores and resends them | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-F15-03 | F-15 | EXPERT-FR-011 | Farm with an expert; a suggestion | Owner applies the suggestion directly | — | 403; coefficients unchanged | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-F16-01 | F-16 | EXPERT-FR-006 | Health report; expert and another expert | Write a conclusion; edit it; another expert edits it | — | Owner notified; author can edit; the other expert gets 403 | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Not run on the tag |
| TC-F16-02 | F-16 | EXPERT-FR-007 | User with notifications | Notify, list, read one, read all | — | Inbox entry with socket event; unread count correct | Auto (CI) – backend Jest `tests/integration/inAppNotification.test.ts` › “notifyUser ghi vào hộp + phát socket” | Not run on the tag |
| TC-F16-03 | F-16 | EXPERT-FR-009 | Farm with an expert | Expert changes thresholds, tuning, ring and a verdict | — | Each Farm Owner receives one in-app notification per decision; the activity history lists the same four entries | Auto (CI, to be written) – backend jest (G-03) | Not run – test to be written |
| TC-F17-01 | F-17 | ENV-FR-016, 019 | Pump in AUTO | Override ON; override the same relay again; clear early | — | One log opened; earlier REPLACED; last CLEARED_EARLY | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “bật tay mở 1 bản ghi” | Not run on the tag |
| TC-F17-02 | F-17 | ENV-FR-016 | Same device; a `SENSOR_FAULT` open in the zone | POST pump ON for 31 min; pump ON for 10 min without confirmation; then with confirmation | — | 422; 409; accepted, and the log records the confirmation | Auto (CI, to be written) – backend jest `relayCommand.test.ts` (G-06) | Not run – test to be written |
| TC-F17-03 | F-17 | ENV-FR-016 | Farm with an expert | POST relay, speaker and schedule as the expert | — | 403 for each | Auto (CI) – backend Jest `tests/integration/domainExpert.test.ts` › “không điều khiển relay, loa hay lịch loa” | Not run on the tag |
| TC-F18-01 | F-18 | FARM-FR-001, 002, 003 | Farm Owner account; device in stock with its key | Create a farm with coordinates, a house and a zone; POST register with the label values | Coordinates; device ID and key (case-insensitive) | Farm, house and zone created under the owner, the zone linked to its house's farm; device `PENDING` in the zone; stock entry marked activated | Auto (CI) – backend Jest `tests/integration/technicianAccess.test.ts` › “lets one Farm Owner create two farms” + Auto (CI) – backend Jest `tests/integration/dataModel.test.ts` › “Zone tự lấy farm_id từ House” + Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Not run on the tag |
| TC-F18-02 | F-18 | FARM-FR-003 | Same stock | POST register without key; with a wrong key; with an unknown ID | — | 422 without key; 400 with the same message for the other two | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiếu secretKey → 422” | Not run on the tag |
| TC-F18-03 | F-18 | FARM-FR-003 | Device in service in another farm | POST register | — | 409 with a clear message | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiết bị đã thuộc Farm khác → 409” | Not run on the tag |
| TC-F19-01 | F-19 | FARM-FR-003c, 012 | Controller registered to a zone, never connected | Ingest its first heartbeat on its device topics | — | Device `ONLINE`; the zone configuration with its version published retained on `swiftletcare/dev/<id>/config` | Auto (CI, to be written) – backend jest `deviceMqttContract.test.ts` (G-07) | Not run – test to be written |
| TC-F19-02 | F-19 | FARM-FR-005, 006, 012 | Device `PENDING` for 15 min | Run the activation job; then a first heartbeat carrying diagnostics | Firmware 1.4.0 heartbeat | Flagged once; the heartbeat sets `ONLINE`, clears the flag and stores firmware, uptime, RSSI, free memory, reset reason and IP | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đánh dấu node PENDING quá 15 phút 1 lần” + Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “stores the diagnostics of firmware 1.4.0” | Not run on the tag |
| TC-F19-03 | F-19 | FARM-FR-007b, ENV-FR-027 | Offline controller | Move it to another zone; then it reconnects and reports the new version | — | Move accepted while offline; new zone configuration retained; "applied" shown after the heartbeat reports the version | Auto (CI, to be written) – backend jest `deviceOnboarding.test.ts` (G-07, G-08) | Not run – test to be written |
| TC-F20-01 | F-20 | ANALYTICS-FR-012 | Seeded house-day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily assessment | Seed of BR-28 | Status `ACTION` with both reasons | Auto (CI, to be written) – backend jest `healthAssessment.test.ts` (G-11) | Not run – test to be written |
| TC-F20-02 | F-20 | ANALYTICS-FR-012, 013 | Seeded days: return rate `CLEAR` only; return rate `CLEAR` + noise `SLIGHT` without rain; the same with 2 mm rain over the evening session and the noise episode | Run the assessment on each | — | `WATCH`; `ACTION`; `WATCH` with the rain named | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-F20-03 | F-20 | ANALYTICS-FR-012 | Seeded day with an incomplete evening session; another day without valid noise samples | Run the assessment | — | `INSUFFICIENT_DATA` for the first; the second assessed with "noise not assessed" | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-F21-01 | F-21 | EXPERT-FR-005 | Reports of a farm; user of another farm | List and open reports as owner, expert and outsider | — | Owner and expert read them; outsider 403 | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “Farm Owner và Domain Expert xem danh sách, chi tiết” | Not run on the tag |
| TC-F21-02 | F-21 | EXPERT-FR-013 | Seeded month | GET the CSV of daily indicators | — | One row per house and day with every indicator, level, status and ratings; no internal IDs | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-F21-03 | F-21 | EXPERT-FR-013 | A daily report in the web app | Download the PDF and compare with the screen | — | Same figures; no internal IDs | Manual – web, staging | Not run |
| TC-F22-01 | F-22 | EXPERT-FR-012 | Computed day; Farm Owner who has not rated it | GET the day, the daily report and the CSV; then POST a rating | — | No status, reasons or other ratings before the rating; the rating and its snapshot stored together, and the status returned only in the rating response | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-F22-02 | F-22 | EXPERT-FR-012 | Rated day | Ingest a late count that changes the status; then try to change the rating | — | Current status recomputed, snapshot unchanged; rating change rejected, a note accepted | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-F22-03 | F-22 | EXPERT-FR-012 | Technician, Administrator; a day 8 days ago | Rate as each; rate the old day | — | 403; old day rejected | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |

### 4.2 Main Workflows (11)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-WF-01 | WF-01 | Staging with demo seed; preconditions of DS-01 | Run the main scenario DS-01 of the Design Brief end-to-end | Data of DS-01 | Expected result of DS-01 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-02 | WF-02 | Staging with demo seed; preconditions of DS-03 | Run the main scenario DS-03 of the Design Brief end-to-end | Data of DS-03 | Expected result of DS-03 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-03 | WF-03 | Staging with demo seed; preconditions of DS-05 | Run the main scenario DS-05 of the Design Brief end-to-end | Data of DS-05 | Expected result of DS-05 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-04 | WF-04 | Staging with demo seed; preconditions of DS-07 | Run the main scenario DS-07 of the Design Brief end-to-end | Data of DS-07 | Expected result of DS-07 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-05 | WF-05 | Staging with demo seed; preconditions of DS-09 | Run the main scenario DS-09 of the Design Brief end-to-end | Data of DS-09 | Expected result of DS-09 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-06 | WF-06 | Staging with demo seed; preconditions of DS-11 | Run the main scenario DS-11 of the Design Brief end-to-end | Data of DS-11 | Expected result of DS-11 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-07 | WF-07 | Staging with demo seed; preconditions of DS-13 | Run the main scenario DS-13 of the Design Brief end-to-end | Data of DS-13 | Expected result of DS-13 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-08 | WF-08 | Staging with demo seed; preconditions of DS-15 | Run the main scenario DS-15 of the Design Brief end-to-end | Data of DS-15 | Expected result of DS-15 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-09 | WF-09 | Staging with demo seed; preconditions of DS-17 | Run the main scenario DS-17 of the Design Brief end-to-end | Data of DS-17 | Expected result of DS-17 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-10 | WF-10 | Staging with demo seed; preconditions of DS-19 | Run the main scenario DS-19 of the Design Brief end-to-end | Data of DS-19 | Expected result of DS-19 | Manual – staging, presenter of the workflow | Not run |
| TC-WF-11 | WF-11 | Staging with demo seed; preconditions of DS-21 | Run the main scenario DS-21 of the Design Brief end-to-end | Data of DS-21 | Expected result of DS-21 | Manual – staging, presenter of the workflow | Not run |

Exception scenarios of the Design Brief (Appendix A2), run in the same session as their workflow. They are demo evidence for the guideline's threshold of 80 % of exception scenarios passing and are **not counted** among the committed cases.

| Scenario | Workflow | How it runs | Actual result |
| --- | --- | --- | --- |
| DS-02 (exception) | WF-01 | Manual – staging, presenter of the workflow | Not run |
| DS-04 (exception) | WF-02 | Manual – staging, presenter of the workflow | Not run |
| DS-06 (exception) | WF-03 | Manual – staging, presenter of the workflow | Not run |
| DS-08 (exception) | WF-04 | Manual – staging, presenter of the workflow | Not run |
| DS-10 (exception) | WF-05 | Manual – staging, presenter of the workflow | Not run |
| DS-12 (exception) | WF-06 | Manual – staging, presenter of the workflow | Not run |
| DS-14 (exception) | WF-07 | Manual – staging, presenter of the workflow | Not run |
| DS-16 (exception) | WF-08 | Manual – staging, presenter of the workflow | Not run |
| DS-18 (exception) | WF-09 | Manual – staging, presenter of the workflow | Not run |
| DS-20 (exception) | WF-10 | Manual – staging, presenter of the workflow | Not run |
| DS-22 (exception) | WF-11 | Manual – staging, presenter of the workflow | Not run |

### 4.3 State Transitions (53)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-ST-01 | SRS 6.1 Alert | Entity in the source state of (new) → ACTIVE | Ingest a device alert | — | One ACTIVE alert in the device's farm and zone with the default severity of its type | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “creates an alert in the device farm/zone from the ESP32 payload” | Not run on the tag |
| TC-ST-02 | SRS 6.1 Alert | Entity in the source state of ACTIVE → ACTIVE (repeat) | Ingest the same incident again | — | No new alert; occurrence count of the open alert + 1 | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “folds a repeat into the open alert” | Not run on the tag |
| TC-ST-03 | SRS 6.1 Alert | Entity in the source state of ACTIVE → ACKNOWLEDGED | Farm Owner acknowledges with a note | — | Status ACKNOWLEDGED with user, time and note | Auto (CI, to be written) – backend jest `alertLifecycle.test.ts` (G-03) | Not run – test to be written |
| TC-ST-04 | SRS 6.1 Alert | Entity in the source state of ACTIVE/ACKNOWLEDGED → DISMISSED | Expert rejects an inferred alert with a note | — | Status DISMISSED, previous status stored, Farm Owners notified | Auto (CI, to be written) – backend jest (G-03) | Not run – test to be written |
| TC-ST-05 | SRS 6.1 Alert | Entity in the source state of DISMISSED → DISMISSED | Same incident again | — | Occurrence count + 1; no notification sent | Auto (CI, to be written) – backend jest (G-03) | Not run – test to be written |
| TC-ST-06 | SRS 6.1 Alert | Entity in the source state of DISMISSED → previous status | Verdict changed to CONFIRMED | — | Status back to the stored previous status; Farm Owners notified again | Auto (CI, to be written) – backend jest (G-03) | Not run – test to be written |
| TC-ST-07 | SRS 6.1 Alert | Entity in the source state of ACTIVE → RESOLVED | Device reconnects | — | NODE_OFFLINE alert RESOLVED with its resolution time | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “closes the NODE_OFFLINE alert when the device comes back online” | Not run on the tag |
| TC-ST-08 | SRS 6.1 Alert | Entity in the source state of DISMISSED/RESOLVED → (rejected) | Farm Owner acknowledges | — | 409; status unchanged | Auto (CI, to be written) – backend jest `alertLifecycle.test.ts` (G-03) | Not run – test to be written |
| TC-ST-09 | SRS 6.1 Alert | Entity in the source state of RESOLVED + verdict → unchanged | Verdict recorded on an episode that resolved itself | — | Status stays RESOLVED; verdict kept | Auto (CI) – backend Jest `tests/integration/alertLifecycle.test.ts` › “đợt đã được chuyên gia kiểm chứng vẫn giữ kết quả sau khi tự đóng” | Not run on the tag |
| TC-ST-10 | SRS 6.1 Alert | Entity in the source state of RESOLVED → new alert | Same incident after the episode closed | — | A new ACTIVE alert; the resolved one unchanged | Auto (CI) – backend Jest `tests/integration/alertLifecycle.test.ts` › “lần sau là cảnh báo mới” | Not run on the tag |
| TC-ST-11 | SRS 6.2 Verdict | Entity in the source state of pending → CONFIRMED/REJECTED | Expert records a verdict | — | Verdict stored with author, role and time | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Not run on the tag |
| TC-ST-12 | SRS 6.2 Verdict | Entity in the source state of CONFIRMED ↔ REJECTED | Expert changes the verdict | — | New verdict stored; audit entry for the change | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Not run on the tag |
| TC-ST-13 | SRS 6.3 Relay | Entity in the source state of AUTO → MANUAL | Owner override applied | — | Relay MANUAL; one override log opened | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “bật tay mở 1 bản ghi” | Not run on the tag |
| TC-ST-14 | SRS 6.3 Relay | Entity in the source state of MANUAL → MANUAL | Second relay of the controller overridden | — | The first relay keeps its own expiry | Auto (CI, to be written) – backend jest + firmware native test (G-06) | Not run – test to be written |
| TC-ST-15 | SRS 6.3 Relay | Entity in the source state of MANUAL → AUTO | Override expires | — | Relay AUTO; log closed with EXPIRED | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “job hết hạn đóng bản ghi với EXPIRED” | Not run on the tag |
| TC-ST-16 | SRS 6.3 Relay | Entity in the source state of AUTO → AUTO (rejected) | Override with an invalid duration | — | 422; relay stays AUTO; no log opened | Auto (CI) – backend Jest `tests/integration/relayCommand.test.ts` › “durationMs của lệnh relay phải là số nguyên” | Not run on the tag |
| TC-ST-17 | SRS 6.6 Device | Entity in the source state of (new) → PENDING | Register from the label | — | Device PENDING in the scanned zone | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Not run on the tag |
| TC-ST-18 | SRS 6.6 Device | Entity in the source state of PENDING → ONLINE | First heartbeat | — | Status ONLINE; overdue flag cleared | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “heartbeat đầu tiên gỡ cờ” | Not run on the tag |
| TC-ST-19 | SRS 6.6 Device | Entity in the source state of ONLINE → OFFLINE | No heartbeat beyond the AI-node limit of BR-10 | — | Status OFFLINE; one EDGE_AI_DEGRADED for the house | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “im quá ngưỡng → OFFLINE” | Not run on the tag |
| TC-ST-20 | SRS 6.6 Device | Entity in the source state of OFFLINE → ONLINE | Heartbeat received | — | Status ONLINE; NODE_OFFLINE resolved | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “closes the NODE_OFFLINE alert when a heartbeat arrives before any telemetry” | Not run on the tag |
| TC-ST-21 | SRS 6.6 Device | Entity in the source state of → DECOMMISSIONED | Device removed | — | Hidden from lists, history kept, heartbeats ignored, commands rejected | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “gỡ bỏ: giữ document” | Not run on the tag |
| TC-ST-22 | SRS 6.16 Label | Entity in the source state of (new) → IN_STOCK | Admin adds the device | — | Activation key returned once; only its hash stored | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “trả secretKey 1 lần, chỉ lưu hash” | Not run on the tag |
| TC-ST-23 | SRS 6.16 Label | Entity in the source state of IN_STOCK → IN_SERVICE | Registered from its label | — | Stock entry marked activated; device PENDING | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Not run on the tag |
| TC-ST-24 | SRS 6.16 Label | Entity in the source state of IN_SERVICE → RELEASED | Device removed | — | Entry no longer in service; device document kept | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “gỡ bỏ: giữ document” | Not run on the tag |
| TC-ST-25 | SRS 6.16 Label | Entity in the source state of RELEASED → IN_SERVICE | Registered again with the same label | — | Registration accepted | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiết bị đã gỡ lắp lại được” | Not run on the tag |
| TC-ST-26 | SRS 6.16 Label | Entity in the source state of IN_STOCK → IN_STOCK (key re-issued) | Admin re-issues the key | — | New key returned once; the old label rejected with 400 | Auto (CI) – backend Jest `tests/integration/adminInventoryAndSearch.test.ts` › “replaces the key of an unclaimed device” | Not run on the tag |
| TC-ST-27 | SRS 6.16 Label | Entity in the source state of IN_STOCK → REVOKED | Admin revokes the entry | — | Registration with the label rejected with 409 | Auto (CI) – backend Jest `tests/integration/adminInventoryAndSearch.test.ts` › “blocks activation once revoked” | Not run on the tag |
| TC-ST-28 | SRS 6.12 Config sync | Entity in the source state of APPLIED → PENDING | New configuration version saved | — | Controller shown PENDING; configuration republished | Auto (CI, to be written) – backend jest (G-08) | Not run – test to be written |
| TC-ST-29 | SRS 6.12 Config sync | Entity in the source state of PENDING → APPLIED | Heartbeat reports the version | — | Controller shown APPLIED | Auto (CI, to be written) – backend jest (G-08) | Not run – test to be written |
| TC-ST-30 | SRS 6.12 Config sync | Entity in the source state of PENDING → MISMATCH | 3 heartbeats online with the old version | — | One CONFIG_MISMATCH; controller shown MISMATCH | Auto (CI, to be written) – backend jest (G-08) | Not run – test to be written |
| TC-ST-31 | SRS 6.12 Config sync | Entity in the source state of MISMATCH → APPLIED | Heartbeat reports the new version | — | Controller shown APPLIED; CONFIG_MISMATCH resolved | Auto (CI, to be written) – backend jest (G-08) | Not run – test to be written |
| TC-ST-32 | SRS 6.12 Config sync | Entity in the source state of any → UNKNOWN | Heartbeat of a firmware that reports no configuration version | — | Controller shown UNKNOWN; no CONFIG_MISMATCH raised | Auto (CI, to be written) – backend jest (G-08) | Not run – test to be written |
| TC-ST-33 | SRS 6.10 Review item | Entity in the source state of (new) → PENDING_REVIEW | Owner edits thresholds on a farm with an expert | — | One PENDING_REVIEW item with old and new values; expert notified | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-34 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → PENDING_REVIEW | Owner edits the same group again | — | Same item updated; original old values kept | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-35 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → ACCEPTED | Expert accepts | — | Item ACCEPTED; owners notified | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-36 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → REVERTED | Expert reverts | — | Original values restored and sent; history source EXPERT_REVERT | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-37 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → ADJUSTED | Expert saves new values for the group | — | Item ADJUSTED; new values applied | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-38 | SRS 6.10 Review item | Entity in the source state of closed → (rejected) | Accept or revert a closed item | — | 409 | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-39 | SRS 6.11 Proposal | Entity in the source state of (new) → PROPOSED | Owner submits a suggestion | — | PROPOSED with suggested and current values; expert notified | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-40 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → APPROVED | Expert approves | — | Coefficients applied with history source SUGGESTION_APPROVED | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-41 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → REJECTED | Expert rejects with a note | — | REJECTED; without a note 422 | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-42 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → SUPERSEDED | Newer proposal for the zone | — | Older proposal SUPERSEDED | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-43 | SRS 6.11 Proposal | Entity in the source state of closed → (rejected) | Approve a closed proposal | — | 409 | Auto (CI, to be written) – backend jest (G-04) | Not run – test to be written |
| TC-ST-44 | SRS 6.17 Daily status | Entity in the source state of (new) → COMPUTED | Daily assessment | — | One day record with current status and reasons; one pending rating per Farm Owner and Domain Expert | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-45 | SRS 6.17 Daily status | Entity in the source state of COMPUTED → COMPUTED | Late count arrives after one assessor rated | — | Current status recomputed; the stored snapshot unchanged | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-46 | SRS 6.18 Assessor rating | Entity in the source state of PENDING → RATED | Farm Owner rates | — | Rating and snapshot stored in one write; status returned | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-47 | SRS 6.18 Assessor rating | Entity in the source state of PENDING → SKIPPED | Domain Expert skips | — | Status returned; no rating counted for NFR-14 | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-48 | SRS 6.18 Assessor rating | Entity in the source state of PENDING → EXPIRED | 7 days pass; the Farm Owner rated, the expert did not | — | Expert's rating EXPIRED and the status shown to the expert; the Farm Owner's rating kept | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-49 | SRS 6.18 Assessor rating | Entity in the source state of RATED → RATED | Rated assessor adds a note | — | Note stored; rating unchanged | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-50 | SRS 6.18 Assessor rating | Entity in the source state of RATED/SKIPPED/EXPIRED → (rejected) | Rate again after rating, skipping or expiry | — | 409; nothing changed | Auto (CI, to be written) – backend jest (G-11) | Not run – test to be written |
| TC-ST-51 | SRS 6.9 Health report | Entity in the source state of (new) → GENERATED | Daily, weekly or monthly report job | — | One report per house and period, with a section per zone (the current per-zone weekly test does not count) | Auto (CI, to be written) – backend jest `healthReport.test.ts` (G-11) | Not run – test to be written |
| TC-ST-52 | SRS 6.9 Health report | Entity in the source state of GENERATED → CONCLUDED | Expert writes a conclusion | — | Conclusion stored; Farm Owners notified | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Not run on the tag |
| TC-ST-53 | SRS 6.9 Health report | Entity in the source state of CONCLUDED → CONCLUDED | Author edits; another expert edits | — | Author's edit stored with time; the other expert gets 403 | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Not run on the tag |

### 4.4 Non-Functional Requirements (6)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-NFR-01 | NFR-01 | Environment of the method | Measure as described | Script publishes 200 telemetry messages over MQTT on staging with the send time; a Socket.io client records receive times | Threshold: P95 ≤ 2 s | Manual – script `scripts/nfr01-latency` to write; staging | Not run |
| TC-NFR-02 | NFR-02 | Environment of the method | Measure as described | 30 injected alerts on staging; receive times from the Socket.io client, the mobile log and the Bot API `date` | Threshold: P95 ≤ 5 s per channel | Manual – staging, phone | Not run |
| TC-NFR-06 | NFR-06 | Environment of the method | Measure as described | Router uplink cut for 30 min on the prototype with one sensor fault forced; decision log, stored samples and stored alerts | Threshold: 100 % of decisions; 0 samples lost; the alert delivered once | Manual – prototype, test house | Not run |
| TC-NFR-09 | NFR-09 | Environment of the method | Measure as described | Test days kept out of training and tuning: detection on ≥ 200 labelled frames per lighting (IoU ≥ 0.5); counting on 20 clips of 5 min (10 daylight, 10 low light) against counts by two members | Threshold: Precision ≥ 0.80, Recall ≥ 0.80; count error ≤ 10 % per direction; each per lighting | Manual – AI node, evaluation script and `tools/track_clip.py` | Not run |
| TC-NFR-13 | NFR-13 | Environment of the method | Measure as described | 5 people who have not set up a device before, timed from power-on to "configuration applied" | Threshold: ≤ 10 min in 5/5; two scans + Wi-Fi | Manual – prototype, mobile app | Not run |
| TC-NFR-14 | NFR-14 | Environment of the method | Measure as described | Snapshots and independent ratings over ≥ 14 rated days (ANALYTICS-FR-014) | Threshold: Agreement ≥ 70 % with its 95 % CI; weighted kappa and AC1 reported | Manual – field run, test house | Not run |

### 4.5 Requirement Coverage

Generated from the "Requirements verified" column of Section 4.1, the NFR cases that measure a requirement (TC-NFR-09 for VISION-FR-016, TC-NFR-14 for ANALYTICS-FR-014) and the requirement lists of the main flows (Report 3, Section 2.2). "Verified" means a committed case has steps and an expected result for that requirement; "traced" means only that the requirement belongs to a workflow whose end-to-end test runs. 102 mandatory requirements: 62 are verified by a committed feature or NFR case; 40 are only traced to the end-to-end test of their workflow, which exercises the flow but does not check each of their acceptance criteria. The traced-only requirements are covered by the module suites or get a case when their gap is closed (Project Tracking, Section 6).

| Requirement | Verified by (committed case with steps and expected result) | Traced to (end-to-end test of its workflow) |
| --- | --- | --- |
| ENV-FR-001 | TC-F01-01 | TC-WF-01 |
| ENV-FR-002 | — (traced only) | TC-WF-01 |
| ENV-FR-004 | TC-F01-01, TC-F04-02 | TC-WF-01 |
| ENV-FR-005 | TC-F01-01, TC-F01-03 | TC-WF-01 |
| ENV-FR-022 | TC-F01-02 | TC-WF-01 |
| ENV-FR-006 | TC-F03-01, TC-F03-02, TC-F03-03 | TC-WF-02 |
| ENV-FR-007 | — (traced only) | TC-WF-02 |
| ENV-FR-009 | TC-F03-01 | TC-WF-08 |
| ENV-FR-020 | TC-F03-03 | TC-WF-08 |
| ENV-FR-021 | TC-F03-03 | TC-WF-01 |
| ENV-FR-027 | TC-F19-03 | TC-WF-01, TC-WF-10 |
| ENV-FR-010 | TC-F02-01, TC-F02-02, TC-F02-03 | TC-WF-01 |
| ENV-FR-011 | TC-F02-02, TC-F02-03 | TC-WF-01 |
| ENV-FR-013b | — (traced only) | TC-WF-01 |
| ENV-FR-014 | TC-F04-01 | TC-WF-03 |
| ENV-FR-024 | TC-F04-02 | TC-WF-03 |
| ENV-FR-025 | TC-F04-03 | TC-WF-03 |
| ENV-FR-015 | — (traced only) | TC-WF-01 |
| ENV-FR-016 | TC-F17-01, TC-F17-02, TC-F17-03 | TC-WF-09 |
| ENV-FR-017 | — (traced only) | TC-WF-09 |
| ENV-FR-018 | — (traced only) | TC-WF-09 |
| ENV-FR-019 | TC-F17-01 | TC-WF-09 |
| THREAT-FR-005 | TC-F12-03 | TC-WF-07 |
| THREAT-FR-006 | — (traced only) | TC-WF-04 |
| THREAT-FR-007 | TC-F12-01, TC-F12-02, TC-F12-03 | TC-WF-07 |
| THREAT-FR-009 | — (traced only) | TC-WF-03 |
| THREAT-FR-010 | — (traced only) | TC-WF-06 |
| THREAT-FR-011 | TC-F05-01, TC-F05-02 | TC-WF-04 |
| THREAT-FR-012 | TC-F04-03 | TC-WF-03 |
| THREAT-FR-013 | TC-F02-03 | TC-WF-04 |
| THREAT-FR-014 | TC-F06-01, TC-F06-02, TC-F06-03 | TC-WF-04 |
| ALERT-FR-010 | TC-F05-03 | TC-WF-04 |
| ALERT-FR-001 | — (traced only) | TC-WF-02, TC-WF-04 |
| ALERT-FR-005 | — (traced only) | TC-WF-02 |
| ALERT-FR-006 | TC-F08-02 | TC-WF-02 |
| ALERT-FR-007 | — (traced only) | TC-WF-02 |
| ALERT-FR-008 | TC-F07-01 | TC-WF-04 |
| ALERT-FR-009 | TC-F07-03 | TC-WF-02, TC-WF-04 |
| ALERT-FR-011 | TC-F09-01 | TC-WF-05 |
| ALERT-FR-012 | TC-F07-02 | TC-WF-01, TC-WF-02 |
| ALERT-FR-013 | TC-F08-01, TC-F08-02 | TC-WF-02 |
| ALERT-FR-014 | — (traced only) | TC-WF-07, TC-WF-08 |
| ALERT-FR-002 | TC-F08-03 | TC-WF-02 |
| ALERT-FR-015 | — (traced only) | TC-WF-04 |
| ALERT-FR-016 | — (traced only) | TC-WF-04 |
| ANALYTICS-FR-001 | — (traced only) | TC-WF-01 |
| ANALYTICS-FR-002 | — (traced only) | TC-WF-06 |
| ANALYTICS-FR-003 | — (traced only) | TC-WF-06 |
| ANALYTICS-FR-005 | — (traced only) | TC-WF-01 |
| ANALYTICS-FR-008 | TC-F02-02 | TC-WF-08 |
| ANALYTICS-FR-009 | TC-F09-02, TC-F09-03 | TC-WF-05 |
| ANALYTICS-FR-010 | TC-F15-01 | TC-WF-08 |
| ANALYTICS-FR-011 | — (traced only) | TC-WF-08 |
| ANALYTICS-FR-012 | TC-F20-01, TC-F20-02, TC-F20-03 | TC-WF-11 |
| ANALYTICS-FR-013 | TC-F20-02 | TC-WF-11 |
| ANALYTICS-FR-014 | TC-NFR-14 | TC-WF-11 |
| VISION-FR-001 | — (traced only) | TC-WF-06 |
| VISION-FR-002 | — (traced only) | TC-WF-06 |
| VISION-FR-003 | — (traced only) | TC-WF-06 |
| VISION-FR-004 | TC-F10-03 | TC-WF-06 |
| VISION-FR-005 | TC-F10-01, TC-F10-03 | TC-WF-06 |
| VISION-FR-006 | — (traced only) | TC-WF-06 |
| VISION-FR-007 | — (traced only) | TC-WF-06 |
| VISION-FR-008 | — (traced only) | TC-WF-06 |
| VISION-FR-009 | TC-F10-02 | TC-WF-06 |
| VISION-FR-010 | — (traced only) | TC-WF-06 |
| VISION-FR-011 | TC-F10-02 | TC-WF-06 |
| VISION-FR-012 | — (traced only) | TC-WF-06 |
| VISION-FR-013 | TC-F11-02, TC-F11-03 | TC-WF-06 |
| VISION-FR-014 | TC-F11-01 | TC-WF-06 |
| VISION-FR-016 | TC-NFR-09 | TC-WF-06 |
| VISION-FR-017 | — (traced only) | TC-WF-06, TC-WF-07 |
| VISION-FR-018 | TC-F14-02 | TC-WF-08 |
| VISION-FR-019 | — (traced only) | TC-WF-06 |
| VISION-FR-020 | — (traced only) | TC-WF-06 |
| EXPERT-FR-001 | — (traced only) | TC-WF-08 |
| EXPERT-FR-002 | — (traced only) | TC-WF-08 |
| EXPERT-FR-003 | TC-F13-01, TC-F13-02, TC-F13-03 | TC-WF-07, TC-WF-08 |
| EXPERT-FR-004 | — (traced only) | TC-WF-02, TC-WF-08 |
| EXPERT-FR-005 | TC-F21-01 | TC-WF-08, TC-WF-11 |
| EXPERT-FR-006 | TC-F16-01 | TC-WF-08, TC-WF-11 |
| EXPERT-FR-007 | TC-F16-02 | TC-WF-08 |
| EXPERT-FR-008 | TC-F14-01, TC-F14-03 | TC-WF-08 |
| EXPERT-FR-009 | TC-F16-03 | TC-WF-08 |
| EXPERT-FR-010 | TC-F15-02 | TC-WF-08 |
| EXPERT-FR-011 | TC-F15-03 | TC-WF-08 |
| EXPERT-FR-012 | TC-F22-01, TC-F22-02, TC-F22-03 | TC-WF-11 |
| EXPERT-FR-013 | TC-F21-02, TC-F21-03 | TC-WF-11 |
| FARM-FR-001 | TC-F18-01 | — |
| FARM-FR-002 | TC-F18-01 | — |
| FARM-FR-003 | TC-F18-01, TC-F18-02, TC-F18-03 | TC-WF-10 |
| FARM-FR-003b | — (traced only) | TC-WF-10 |
| FARM-FR-003c | TC-F19-01 | TC-WF-10 |
| FARM-FR-004 | — (traced only) | TC-WF-06 |
| FARM-FR-005 | TC-F19-02 | TC-WF-03 |
| FARM-FR-006 | TC-F19-02 | TC-WF-10 |
| FARM-FR-007 | — (traced only) | TC-WF-10 |
| FARM-FR-007b | TC-F19-03 | TC-WF-10 |
| FARM-FR-008 | — (traced only) | TC-WF-10 |
| FARM-FR-010 | — (traced only) | TC-WF-10 |
| FARM-FR-011 | — (traced only) | TC-WF-10 |
| FARM-FR-012 | TC-F19-01, TC-F19-02 | TC-WF-10 |

### 4.6 Supporting Regression Tests (not counted in the commitment)

Requirements of priority `S` are kept working by the automated suites that run on every pull request; they are not part of the committed cases above.

| Supporting flow | Requirements | Suites |
| --- | --- | --- |
| SF-02 Remote device maintenance | FARM-FR-009, 013, ENV-FR-013c | backend `technicianAccess.test.ts`, `deviceOnboarding.test.ts` (remote commands, OTA), `audioTracks.test.ts`; firmware `pio test` remote-command suite |
| SF-03 Accounts and access | AUTH-FR-002…012, SYSTEM-FR-001…003 | backend `passwordAndProfile.test.ts`, `invitations.test.ts`, `adminUserLifecycle.test.ts`, `rateLimit.test.ts`, `auditLog.test.ts`, `systemOverview.test.ts`, `systemSettingSingleton.test.ts`, `dataPrivacy.test.ts` |
| SF-04 Harvest logging | HARVEST-FR-001…005 | backend `harvest.test.ts` |

## 5. Responsibilities

Each owner runs the test cases of their features and workflows and records the result (Design Brief, Section 8); a test case is counted for one person only, its owner (BM04). Automated tests of backend code are written by the author of that code.

| Member | Owns and runs | Writes |
| --- | --- | --- |
| Nguyễn Chí Bảo | F-01, 02, 03, 04, 09, 10, 11, 12; WF-01, 03, 06; config sync transitions; NFR-04, 05, 06, 07, 09, 11 | Firmware and AI-node tests; backend tests of MQTT ingestion, configuration, bird counting, push and current sensing |
| Trần Minh Kiệt | F-05, 06, 08, 18, 19; WF-04, 10; device and label transitions; NFR-10 | Backend tests of devices, accounts, alerts, the expert module and daily health (including those of F-07, 13–17, 20–22) |
| Nguyễn Vũ Len | F-07, 17; WF-02, 05, 09; alert and relay transitions; NFR-01 | E2E tests of DS-03, 04, 09, 10, 17, 18 |
| Nguyễn Thị Yến Nhi | F-20, 21, 22; WF-11; daily status and health report transitions; NFR-02, 03, 14 | E2E tests of DS-21, 22; mobile tests |
| Thái Minh Tuấn | F-13, 14, 15, 16; WF-07, 08; verdict, review item and proposal transitions; NFR-08, 13 | E2E tests of DS-13, 14, 15, 16 |

## 6. Test Results at Review 2

Results are reported only from the CI run on the tag `review-2`; the tag has not been created yet, so no case is reported as passed. After the tag: download the three artifacts of that CI run (backend Jest JSON, firmware PlatformIO JUnit, AI-pipeline pytest JUnit; the workflow runs every module on a `review-*` tag), regenerate this report with them, and write the CI run link here. Manual cases are filled from the test report of Defense 1.1. The automated suites also hold tests beyond this list; only the cases above count toward the commitment.

| Test cases | Automated, test written | Automated, to be written | Manual | Passed on the tag |
| --- | --- | --- | --- | --- |
| 136 | 66 (48 %) | 50 (automated in total: 116, 85 %) | 20 | — (no run on the tag yet) |

Committed test cases that are not automated yet are written in Iteration 2 together with the feature they test (Project Tracking, Section 6).

## 7. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.1.0 | 26/10/2026 | Aligned with SRS 3.1.0: 53 state transitions (relay mode 4, device 5, configuration sync 5, daily status 2, assessor rating 5), 136 committed cases; a concrete expected result for every transition; mappings to existing tests corrected (TC-F03-03, PENDING → ONLINE, ONLINE → OFFLINE, RESOLVED → new alert); new cases for breach dwell, pump limit and confirmation, device topics, rain confounder and rating snapshot; results counted only from a run on the tag; a "Requirements verified" column for every feature case and a generated requirement coverage table (Section 4.5); supporting regression suites listed (Section 4.6); the per-zone report test no longer counts for TC-ST-48; table of the FRs of each feature; firmware and AI-pipeline results read from the PlatformIO and pytest JUnit reports; F-10 and F-11 test the pipeline itself (ring crossing, lost tracks, annotated frames); F-22 tests that the API hides the status before rating |
| 1.0.0 | 23/10/2026 | First version for Review 2: test plan, 131 committed test cases, results of the backend and firmware suites |
