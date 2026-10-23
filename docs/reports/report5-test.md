# Report 5 – Software Test Documentation

**SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

| Field | Value |
| --- | --- |
| Project code | `[TEAM: approved project code]` |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | `[TEAM: supervisor name]` |
| Document version | 1.0.0 (Review 2) |
| Date | 23/10/2026 |
| Requirements baseline | Report 3 – SRS 3.0.0; Design Brief (BM01) sections 6–7 and Appendix A |

This file is generated from the test-case list `docs/reports/report5/tc.py` by `docs/reports/report5/gen_report5.py`. Edit the list and regenerate; do not edit the tables by hand. The "Actual result" column of automated backend tests comes from the Jest JSON report of the run named in Section 6.

---

## 1. Introduction

### 1.1 Purpose

This report is the test plan and the test cases of SwiftletCare for Defense 1.1. It maps every mandatory feature (F-01…22), main workflow (WF-01…11), state transition of a main entity (Report 3, Section 6) and committed NFR of the Design Brief to test cases with their expected and actual results.

### 1.2 Scope of Testing

| In scope | Out of scope |
| --- | --- |
| Firmware logic (filters, fuzzy control, pump-dry, noise anomaly, remote commands) on the host; backend services, REST API, MQTT ingestion, jobs, Socket.io authorisation; web pure logic; the counting pipeline's geometry; end-to-end workflows on staging; NFRs on staging, prototype and test house | Items of Report 3, Section 8; load beyond NFR-03; security penetration testing; store builds of the mobile app |

### 1.3 Test Count Committed (Design Brief, Appendix A3)

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | 22 | 3 | 66 |
| Main workflows (end-to-end) | 11 | 1 | 11 |
| State transitions of main entities | 48 | 1 | 48 |
| Committed NFRs | 6 | 1 | 6 |
| **Total** | | | **131** |

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

CI (`.github/workflows/ci.yml`) runs on every pull request, only for the modules it touches: backend lint, type check and Jest with an 80 % line-coverage threshold; web lint, type check, Vitest and build; firmware host tests; mobile lint, type check and Jest; AI pipeline pytest. Test cases marked "Auto (CI)" are part of these suites; "Auto (CI, planned)" are written with the feature they test. Target at Defense 1.1: at least 50 % of the committed test cases automated in CI.

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
| Staging | VPS with backend, web, EMQX (TLS), MongoDB, MinIO, MediaMTX behind Caddy; AI node on the spare PC at the house (`docs/deploy/staging.md`) |
| Prototype | ESP32 controller with the five RS485 sensors, relay module, DFPlayer and speaker; test house in the field run |
| Data | `npm run seed` plus the demo seed (gap G6); recorded entrance clips for counting |

## 4. Test Cases

Columns follow the guideline: ID, feature or workflow, preconditions, steps, data, expected result, how it runs (automatic or manual), actual result.

### 4.1 Mandatory Features (66)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-F01-01 | F-01 | Zone with a controller; dashboard client in the zone room | Ingest telemetry messages for the zone | One reading per second for 30 s | Every reading is pushed to the dashboard; one sample per 10 s is stored | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “persists live readings at most once per 10s but still pushes every reading to the dashboard” | Pass |
| TC-F01-02 | F-01 | Median/Kalman filter initialised | Feed a NaN sample to the filter | Valid samples, then NaN | The filtered value keeps its state; the invalid sample is not used | Auto (CI) – firmware `pio test -e native` `test_filter` › `test_nan_keeps_state` | Pass |
| TC-F01-03 | F-01 | User of another farm with a valid token | Emit JOIN_ZONE for a zone of a farm the user is not a member of | Zone ID of farm B, user of farm A | The socket does not join the room and receives no event | Auto (CI) – backend Jest `tests/integration/socketAuth.test.ts` › “does NOT join the room when the user has no access to the zone” | Pass |
| TC-F02-01 | F-02 | Default fuzzy coefficients | Compute misting output for the worked example of the SDD | Humidity and temperature of the worked example | Output equals the hand-computed value | Auto (CI) – firmware `pio test -e native` `test_fuzzy` › `test_misting_worked_example` | Pass |
| TC-F02-02 | F-02 | Backend port of the fuzzy model | Run the shared test cases on the TypeScript model | Membership, misting, ventilation cases of the firmware tests | Same outputs as the firmware within tolerance | Auto (CI) – backend Jest `tests/unit/utils/fuzzyModel.util.test.ts` › “misting worked example and extremes” | Pass |
| TC-F02-03 | F-02 | Default coefficients | Call the controller with invalid (NaN) inputs | NaN humidity and temperature | Safe state: misting and fan output 0 | Auto (CI) – firmware `pio test -e native` `test_fuzzy` › `test_invalid_inputs_give_safe_state` | Pass |
| TC-F03-01 | F-03 | Zone with thresholds; Farm Owner signed in | PUT a valid partial threshold update | `humidity_min` = 80 | Values stored as numbers; history entry with source MANUAL; other keys unchanged | Auto (CI) – backend Jest `tests/integration/zoneThresholds.test.ts` › “records only the known keys, with source MANUAL, in the threshold history” | Pass |
| TC-F03-02 | F-03 | Same zone | PUT an out-of-range threshold | `humidity_min` = 150 | 400; nothing stored | Auto (CI) – backend Jest `tests/integration/zoneThresholds.test.ts` › “PUT /farms/zones/:id/thresholds answers 400 for an out-of-range value” | Pass |
| TC-F03-03 | F-03 | Technician and Administrator accounts | PUT thresholds and fuzzy tuning as each of them | Valid body | 403 for both (ENV-FR-006, 021) | Auto (CI, planned) – backend jest, `tests/integration/zoneThresholds.test.ts` (gap G1) | Not run – test to be written |
| TC-F04-01 | F-04 | Prototype running in AUTO; logging on | Cut the router uplink for 30 min, then restore it | — | A control decision every 10 s during the outage (100 %) | Manual – prototype, test house | Not run |
| TC-F04-02 | F-04 | Controller reconnects with buffered samples | Ingest flushed offline-buffer readings | Readings with their own timestamps | Stored at their own time; the live dashboard is not touched | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “stores flushed offline-buffer readings at their own time” | Pass |
| TC-F04-03 | F-04 | Prototype running | Block the main loop on purpose (debug build) | — | Watchdog restarts the controller; control resumes; `POWER_OUTAGE` reported | Manual – prototype | Not run |
| TC-F05-01 | F-05 | Humidity below `humidity_min`, pump ON | Simulate 300 s of pump ON without humidity rise | Default `pump_dry_on_sec` = 300, rise 2 % | Detected once and latched; misting output 0 | Auto (CI) – firmware `pio test -e native` `test_pump_dry` › `test_dry_pump_is_detected_once_and_latches` | Pass |
| TC-F05-02 | F-05 | Same detector | Simulate rising humidity while the pump runs | Rise above 2 % | Not detected as dry | Auto (CI) – firmware `pio test -e native` `test_pump_dry` › `test_rising_humidity_is_not_dry` | Pass |
| TC-F05-03 | F-05 | Zone with telemetry | Seed a temperature stuck for 2 h and run the anomaly scan | Constant value | One MEDIUM `SENSOR_ANOMALY`, never escalated; resolved when data is normal | Auto (CI) – backend Jest `tests/integration/sensorAnomaly.test.ts` › “raises one MEDIUM SENSOR_ANOMALY for a stuck sensor” | Pass |
| TC-F06-01 | F-06 | Current detector with learned normal current | Relay ON, current below 50 % of normal for 30 s | Normal 2.0 A; measured 0.8 A | One `ACTUATOR_FAULT` | Auto (CI, planned) – firmware native test `test_actuator_current` (gap G3) | Not run – test to be written |
| TC-F06-02 | F-06 | Detector learning | Relay ON for the first 30 s | Steady 2.0 A | Normal current learned as 2.0 A; no fault while learning | Auto (CI, planned) – firmware native test | Not run – test to be written |
| TC-F06-03 | F-06 | Learned normal current | Relay OFF, current above 20 % of normal for 30 s | Measured 0.6 A | One `ACTUATOR_FAULT` (relay stuck ON) | Auto (CI, planned) – firmware native test | Not run – test to be written |
| TC-F07-01 | F-07 | Open alert of a type for a zone and device | Ingest the same incident again | Same type, zone, device | No new alert; the open one is bumped (occurrence count) | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “folds a repeat into the open alert however old it is” | Pass |
| TC-F07-02 | F-07 | Open `THRESHOLD_BREACH` not seen for 5 min | Run the escalation job | — | Alert resolved; fresh ones stay open | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “auto-resolves threshold alerts not seen for 5 minutes” | Pass |
| TC-F07-03 | F-07 | Open alert; Domain Expert signed in | PUT acknowledge as the expert | Note text | 403; status unchanged | Auto (CI) – backend Jest `tests/integration/domainExpert.test.ts` › “không xác nhận (acknowledge) cảnh báo” | Pass |
| TC-F08-01 | F-08 | Owner linked to the bot; another owner not linked; an expert | Create a CRITICAL alert | — | Telegram message to the linked owner only | Auto (CI) – backend Jest `tests/integration/telegram.test.ts` › “gửi tới chủ farm đã liên kết” | Pass |
| TC-F08-02 | F-08 | Owner with quiet hours | Create a MEDIUM and a CRITICAL alert in quiet hours | — | MEDIUM not sent; CRITICAL sent | Auto (CI) – backend Jest `tests/integration/telegram.test.ts` › “tôn trọng giờ im lặng, trừ cảnh báo CRITICAL” | Pass |
| TC-F08-03 | F-08 | Mobile app signed in with a registered FCM token | Create a CRITICAL alert; sign out; create another | Firebase test project | Push received for the first only; an invalid token reported by FCM is removed | Auto (CI, planned) – backend jest with a mocked Firebase Admin SDK (gap G6) | Not run – test to be written |
| TC-F09-01 | F-09 | 6 h of humidity falling toward `humidity_min` | Run the forecast scan | Seeded 5-minute means | LOW `FORECAST_BREACH` with expected time; resolved when the trend is gone | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “raises a LOW FORECAST_BREACH early warning” | Pass |
| TC-F09-02 | F-09 | Same data | GET the 60-minute forecast | — | Forecast with back-tested MAE predicts the breach | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “forecasts 60 minutes ahead with a backtested error” | Pass |
| TC-F09-03 | F-09 | Only stale data (older than 15 min) | GET the forecast | — | No forecast ("insufficient data") | Auto (CI) – backend Jest `tests/integration/forecastAndRelayUsage.test.ts` › “does not forecast from stale data” | Pass |
| TC-F10-01 | F-10 | House with a registered AI node | Ingest a session message | Morning session counts | One record per camera, session and Vietnam date, linked to the house; `BIRD_COUNT_UPDATE` to the house room | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “upsert 1 bản ghi mỗi (camera, phiên, ngày) gắn House” | Pass |
| TC-F10-02 | F-10 | 3 earlier days at 90 % | Run the return-rate check with today at 60 % | `return_rate_drop_pct` = 20 | One `LOW_RETURN_RATE` for the house; re-run adds none; recovery resolves it | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “3 ngày trước 90%, hôm nay 60%” | Pass |
| TC-F10-03 | F-10 | Fewer than 3 earlier days | Run the check | — | Nothing evaluated; the house threshold is used | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “dùng return_rate_drop_pct của House và cần ít nhất 3 ngày nền” | Pass |
| TC-F11-01 | F-11 | Camera of a farm; its Farm Owner and Domain Expert | GET stream-token as each | — | Token valid 60 s for path `cam-<device_id>` only | Auto (CI) – backend Jest `tests/integration/streamAuth.test.ts` › “Farm Owner và Domain Expert của farm nhận token 60 giây” | Pass |
| TC-F11-02 | F-11 | Viewer token | Ask MediaMTX auth to read the raw feed with it | Path `cam-<id>-raw` | Refused; only the pipeline secret reads the raw feed | Auto (CI) – backend Jest `tests/integration/streamAuth.test.ts` › “hình gốc -raw chỉ pipeline đọc được” | Pass |
| TC-F11-03 | F-11 | Technician; Farm Owner of another farm | GET stream-token as each | — | 403 | Auto (CI) – backend Jest `tests/integration/streamAuth.test.ts` › “Technician (SRS §4.4) và Farm Owner của farm khác bị chặn” | Pass |
| TC-F12-01 | F-12 | Hour with a learned quiet baseline | Feed noise above the baseline for the minimum duration | +20 dB for 12 s of 15 s | Anomaly raised | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_same_loudness_in_a_quiet_hour_triggers` | Pass |
| TC-F12-02 | F-12 | Same baseline | Feed a short burst | +20 dB for 8 s | No anomaly | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_short_noise_does_not_trigger` | Pass |
| TC-F12-03 | F-12 | Speaker playing | Feed loud samples | — | Not evaluated and not learned into the baseline | Auto (CI) – firmware `pio test -e native` `test_noise_anomaly` › `test_speaker_playing_is_ignored_and_not_learned` | Pass |
| TC-F13-01 | F-13 | Inferred alert of a farm with an expert | PUT a verdict as the expert, then change it | CONFIRMED, then REJECTED with note | Stored with author, time, note and audit; can be changed | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Pass |
| TC-F13-02 | F-13 | A measured (non-inferred) alert; an alert of another farm | PUT a verdict on each | — | Rejected | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “từ chối cảnh báo đo trực tiếp và cảnh báo của farm khác” | Pass |
| TC-F13-03 | F-13 | Inferred alert | PUT `REJECTED` without a note; then with a note | — | 422 without note; with note the alert becomes `DISMISSED` | Auto (CI, planned) – backend jest `alertVerdict.test.ts` (gap G2) | Not run – test to be written |
| TC-F14-01 | F-14 | Zone of a farm with an expert | PUT detection tuning as the expert | Five zone parameters | Stored with history and audit; only the five firmware parameters sent to the devices | Auto (CI) – backend Jest `tests/integration/detectionTuning.test.ts` › “Domain Expert lưu tham số kèm lịch sử + audit” | Pass |
| TC-F14-02 | F-14 | Camera of the house | PUT a counting ring as the expert | Ring of 6 vertices | Stored with history and audit, sent to the AI node of the house, no RTSP address returned | Auto (CI) – backend Jest `tests/integration/countingRing.test.ts` › “Domain Expert lưu vòng kèm lịch sử + audit” | Pass |
| TC-F14-03 | F-14 | Farm with an expert | PUT detection tuning as the Farm Owner | Valid values | Read allowed, write rejected (403) | Auto (CI) – backend Jest `tests/integration/detectionTuning.test.ts` › “Farm Owner xem được nhưng không sửa được” | Pass |
| TC-F15-01 | F-15 | ≥ 3 days of telemetry of a fast-drying zone | GET the tuning suggestion | — | Suggestion keeps the zone in range longer; nothing applied | Auto (CI) – backend Jest `tests/integration/tuningSuggestion.test.ts` › “suggests tuning that keeps a fast-drying house in range longer” | Pass |
| TC-F15-02 | F-15 | Farm with an expert | Owner changes thresholds twice; expert reverts | — | One review item kept with the original values; revert restores and resends them | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-F15-03 | F-15 | Farm with an expert; a suggestion | Owner applies the suggestion directly | — | 403; coefficients unchanged | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-F16-01 | F-16 | Health report; expert and another expert | Write a conclusion; edit it; another expert edits it | — | Owner notified; author can edit; the other expert gets 403 | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Pass |
| TC-F16-02 | F-16 | User with notifications | Notify, list, read one, read all | — | Inbox entry with socket event; unread count correct | Auto (CI) – backend Jest `tests/integration/inAppNotification.test.ts` › “notifyUser ghi vào hộp + phát socket” | Pass |
| TC-F16-03 | F-16 | Farm with an expert | Expert changes thresholds, tuning, ring and a verdict | — | Each Farm Owner receives one in-app notification per decision | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-F17-01 | F-17 | Pump in AUTO | Override ON; override the same relay again; clear early | — | One log opened; earlier REPLACED; last CLEARED_EARLY | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “bật tay mở 1 bản ghi” | Pass |
| TC-F17-02 | F-17 | Same device | POST relay with durations outside 1 min–24 h or not integer | 30 s; 25 h; 1.5 | 422 | Auto (CI) – backend Jest `tests/integration/relayCommand.test.ts` › “durationMs của lệnh relay phải là số nguyên” | Pass |
| TC-F17-03 | F-17 | Farm with an expert | POST relay, speaker and schedule as the expert | — | 403 for each | Auto (CI) – backend Jest `tests/integration/domainExpert.test.ts` › “không điều khiển relay, loa hay lịch loa” | Pass |
| TC-F18-01 | F-18 | Device in stock with its key | POST register with the label values | Device ID and key (case-insensitive) | Device `PENDING` in the zone; stock entry marked activated | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Pass |
| TC-F18-02 | F-18 | Same stock | POST register without key; with a wrong key; with an unknown ID | — | 422 without key; 400 with the same message for the other two | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiếu secretKey → 422” | Pass |
| TC-F18-03 | F-18 | Device in service in another farm | POST register | — | 409 with a clear message | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiết bị đã thuộc Farm khác → 409” | Pass |
| TC-F19-01 | F-19 | Registered controller sending heartbeats on another topic | Ingest heartbeats on the right and on a wrong topic | — | `config/reassign` sent only for the wrong topic | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “only sends config/reassign when the topic is wrong” | Pass |
| TC-F19-02 | F-19 | Device `PENDING` for 15 min | Run the activation job; then a first heartbeat | — | Flagged once; the heartbeat clears the flag | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đánh dấu node PENDING quá 15 phút 1 lần” | Pass |
| TC-F19-03 | F-19 | Offline controller | Move it to another zone; then it reconnects | — | Move accepted; at reconnection it receives `config/reassign` for the new zone | Auto (CI, planned) – backend jest `deviceOnboarding.test.ts` (gap G6) | Not run – test to be written |
| TC-F20-01 | F-20 | Seeded house-day: return rate `CLEAR`, humidity `SLIGHT` | Run the daily assessment | Seed of BR-28 | Status `ACTION` with both reasons | Auto (CI, planned) – backend jest `healthAssessment.test.ts` (gap G5) | Not run – test to be written |
| TC-F20-02 | F-20 | Seeded day: return rate `CLEAR` only; same with rain in a session | Run the assessment | — | `WATCH` in both cases; rain shown as context | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-F20-03 | F-20 | Seeded day with an incomplete evening session | Run the assessment | — | `INSUFFICIENT_DATA`, never `GOOD` | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-F21-01 | F-21 | Reports of a farm; user of another farm | List and open reports as owner, expert and outsider | — | Owner and expert read them; outsider 403 | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “Farm Owner và Domain Expert xem danh sách, chi tiết” | Pass |
| TC-F21-02 | F-21 | Seeded month | GET the CSV of daily indicators | — | One row per house and day with every indicator, level, status and ratings; no internal IDs | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-F21-03 | F-21 | A daily report in the web app | Download the PDF and compare with the screen | — | Same figures; no internal IDs | Manual – web, staging | Not run |
| TC-F22-01 | F-22 | Computed day; Farm Owner | Open the day | — | The rating is asked before the status is shown; stored with author and the status of that moment | Auto (CI, planned) – backend jest + web Vitest (gap G5) | Not run – test to be written |
| TC-F22-02 | F-22 | Rated day after the status was shown | Change the rating | — | Rejected; only a note can be added | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-F22-03 | F-22 | Technician, Administrator; a day 8 days ago | Rate as each; rate the old day | — | 403; old day rejected | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |

### 4.2 Main Workflows (11)

The exception scenarios (DS-02, 04, …, 22) are run in the same session and recorded next to their workflow in the test report of Defense 1.1.

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

### 4.3 State Transitions (48)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-ST-01 | SRS 6.1 Alert | Entity in the source state of (new) → ACTIVE | Ingest a device alert | — | Transition (new) → ACTIVE happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “creates an alert in the device farm/zone from the ESP32 payload” | Pass |
| TC-ST-02 | SRS 6.1 Alert | Entity in the source state of ACTIVE → ACTIVE (repeat) | Ingest the same incident again | — | Transition ACTIVE → ACTIVE (repeat) happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “folds a repeat into the open alert” | Pass |
| TC-ST-03 | SRS 6.1 Alert | Entity in the source state of ACTIVE → ACKNOWLEDGED | Farm Owner acknowledges with a note | — | Transition ACTIVE → ACKNOWLEDGED happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI, planned) – backend jest `alertLifecycle.test.ts` | Not run – test to be written |
| TC-ST-04 | SRS 6.1 Alert | Entity in the source state of ACTIVE/ACKNOWLEDGED → DISMISSED | Expert rejects an inferred alert | — | Transition ACTIVE/ACKNOWLEDGED → DISMISSED happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-05 | SRS 6.1 Alert | Entity in the source state of DISMISSED → DISMISSED | Same incident again: counted, no notification | — | Transition DISMISSED → DISMISSED happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-06 | SRS 6.1 Alert | Entity in the source state of DISMISSED → previous status | Verdict changed to CONFIRMED | — | Transition DISMISSED → previous status happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-07 | SRS 6.1 Alert | Entity in the source state of → RESOLVED | Condition recovers / device reconnects | — | Transition → RESOLVED happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “closes the NODE_OFFLINE alert when the device comes back online” | Pass |
| TC-ST-08 | SRS 6.1 Alert | Entity in the source state of DISMISSED/RESOLVED → (rejected) | Acknowledge request returns 409 | — | Transition DISMISSED/RESOLVED → (rejected) happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI, planned) – backend jest `alertLifecycle.test.ts` | Not run – test to be written |
| TC-ST-09 | SRS 6.1 Alert | Entity in the source state of RESOLVED + verdict → unchanged | Verdict kept on an episode that auto-resolved | — | Transition RESOLVED + verdict → unchanged happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI) – backend Jest `tests/integration/alertLifecycle.test.ts` › “đợt đã được chuyên gia kiểm chứng vẫn giữ kết quả sau khi tự đóng” | Pass |
| TC-ST-10 | SRS 6.1 Alert | Entity in the source state of RESOLVED → new alert | Later occurrence creates a new alert | — | Transition RESOLVED → new alert happens (or the invalid one is rejected) as in SRS 6.1 Alert | Auto (CI) – backend Jest `tests/integration/alertLifecycle.test.ts` › “NOISE_ANOMALY/PUMP_DRY không tái phát 60 phút thì đóng” | Pass |
| TC-ST-11 | SRS 6.2 Verdict | Entity in the source state of pending → CONFIRMED/REJECTED | Expert records a verdict | — | Transition pending → CONFIRMED/REJECTED happens (or the invalid one is rejected) as in SRS 6.2 Verdict | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Pass |
| TC-ST-12 | SRS 6.2 Verdict | Entity in the source state of CONFIRMED ↔ REJECTED | Expert changes the verdict | — | Transition CONFIRMED ↔ REJECTED happens (or the invalid one is rejected) as in SRS 6.2 Verdict | Auto (CI) – backend Jest `tests/integration/alertVerdict.test.ts` › “chỉ Domain Expert ghi được kết quả” | Pass |
| TC-ST-13 | SRS 6.3 Relay | Entity in the source state of AUTO → MANUAL | Owner override applied | — | Transition AUTO → MANUAL happens (or the invalid one is rejected) as in SRS 6.3 Relay | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “bật tay mở 1 bản ghi” | Pass |
| TC-ST-14 | SRS 6.3 Relay | Entity in the source state of MANUAL → AUTO | Override expires | — | Transition MANUAL → AUTO happens (or the invalid one is rejected) as in SRS 6.3 Relay | Auto (CI) – backend Jest `tests/integration/relayOverrideLog.test.ts` › “job hết hạn đóng bản ghi với EXPIRED” | Pass |
| TC-ST-15 | SRS 6.3 Relay | Entity in the source state of AUTO → AUTO (rejected) | Expert override 403; bad duration 422 | — | Transition AUTO → AUTO (rejected) happens (or the invalid one is rejected) as in SRS 6.3 Relay | Auto (CI) – backend Jest `tests/integration/relayCommand.test.ts` › “durationMs của lệnh relay phải là số nguyên” | Pass |
| TC-ST-16 | SRS 6.6 Device | Entity in the source state of (new) → PENDING | Register from the label | — | Transition (new) → PENDING happens (or the invalid one is rejected) as in SRS 6.6 Device | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Pass |
| TC-ST-17 | SRS 6.6 Device | Entity in the source state of PENDING → ONLINE | First heartbeat | — | Transition PENDING → ONLINE happens (or the invalid one is rejected) as in SRS 6.6 Device | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đánh dấu node PENDING quá 15 phút 1 lần” | Pass |
| TC-ST-18 | SRS 6.6 Device | Entity in the source state of ONLINE → OFFLINE | No heartbeat for 90 s (AI node) | — | Transition ONLINE → OFFLINE happens (or the invalid one is rejected) as in SRS 6.6 Device | Auto (CI) – backend Jest `tests/integration/birdCount.test.ts` › “heartbeat đặt ONLINE + model_version” | Pass |
| TC-ST-19 | SRS 6.6 Device | Entity in the source state of OFFLINE → ONLINE | Heartbeat received | — | Transition OFFLINE → ONLINE happens (or the invalid one is rejected) as in SRS 6.6 Device | Auto (CI) – backend Jest `tests/integration/deviceMqttContract.test.ts` › “closes the NODE_OFFLINE alert when a heartbeat arrives before any telemetry” | Pass |
| TC-ST-20 | SRS 6.16 Label | Entity in the source state of (new) → IN_STOCK | Admin adds the device | — | Transition (new) → IN_STOCK happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “trả secretKey 1 lần, chỉ lưu hash” | Pass |
| TC-ST-21 | SRS 6.16 Label | Entity in the source state of IN_STOCK → IN_SERVICE | Registered from its label | — | Transition IN_STOCK → IN_SERVICE happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “đúng secretKey → PENDING” | Pass |
| TC-ST-22 | SRS 6.16 Label | Entity in the source state of IN_SERVICE → RELEASED | Device removed | — | Transition IN_SERVICE → RELEASED happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “gỡ bỏ: giữ document” | Pass |
| TC-ST-23 | SRS 6.16 Label | Entity in the source state of RELEASED → IN_SERVICE | Registered again | — | Transition RELEASED → IN_SERVICE happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/deviceOnboarding.test.ts` › “thiết bị đã gỡ lắp lại được” | Pass |
| TC-ST-24 | SRS 6.16 Label | Entity in the source state of IN_STOCK → IN_STOCK (key re-issued) | Admin re-issues the key | — | Transition IN_STOCK → IN_STOCK (key re-issued) happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/adminInventoryAndSearch.test.ts` › “replaces the key of an unclaimed device” | Pass |
| TC-ST-25 | SRS 6.16 Label | Entity in the source state of IN_STOCK → REVOKED | Admin revokes the entry | — | Transition IN_STOCK → REVOKED happens (or the invalid one is rejected) as in SRS 6.16 Label | Auto (CI) – backend Jest `tests/integration/adminInventoryAndSearch.test.ts` › “blocks activation once revoked” | Pass |
| TC-ST-26 | SRS 6.12 Config sync | Entity in the source state of APPLIED → PENDING | New configuration version saved | — | Transition APPLIED → PENDING happens (or the invalid one is rejected) as in SRS 6.12 Config sync | Auto (CI, planned) – backend jest (gap G3) | Not run – test to be written |
| TC-ST-27 | SRS 6.12 Config sync | Entity in the source state of PENDING → APPLIED | Heartbeat reports the version | — | Transition PENDING → APPLIED happens (or the invalid one is rejected) as in SRS 6.12 Config sync | Auto (CI, planned) – backend jest (gap G3) | Not run – test to be written |
| TC-ST-28 | SRS 6.12 Config sync | Entity in the source state of PENDING → MISMATCH | Old version after BR-24; `CONFIG_MISMATCH` | — | Transition PENDING → MISMATCH happens (or the invalid one is rejected) as in SRS 6.12 Config sync | Auto (CI, planned) – backend jest (gap G3) | Not run – test to be written |
| TC-ST-29 | SRS 6.12 Config sync | Entity in the source state of MISMATCH → APPLIED | New version reported; alert resolved | — | Transition MISMATCH → APPLIED happens (or the invalid one is rejected) as in SRS 6.12 Config sync | Auto (CI, planned) – backend jest (gap G3) | Not run – test to be written |
| TC-ST-30 | SRS 6.10 Review item | Entity in the source state of (new) → PENDING_REVIEW | Owner edits thresholds | — | Transition (new) → PENDING_REVIEW happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-31 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → PENDING_REVIEW | Owner edits again; original values kept | — | Transition PENDING_REVIEW → PENDING_REVIEW happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-32 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → ACCEPTED | Expert accepts | — | Transition PENDING_REVIEW → ACCEPTED happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-33 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → REVERTED | Expert reverts | — | Transition PENDING_REVIEW → REVERTED happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-34 | SRS 6.10 Review item | Entity in the source state of PENDING_REVIEW → ADJUSTED | Expert saves new values | — | Transition PENDING_REVIEW → ADJUSTED happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-35 | SRS 6.10 Review item | Entity in the source state of closed → (rejected) | Further action 409 | — | Transition closed → (rejected) happens (or the invalid one is rejected) as in SRS 6.10 Review item | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-36 | SRS 6.11 Proposal | Entity in the source state of (new) → PROPOSED | Owner submits a suggestion | — | Transition (new) → PROPOSED happens (or the invalid one is rejected) as in SRS 6.11 Proposal | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-37 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → APPROVED | Expert approves; applied | — | Transition PROPOSED → APPROVED happens (or the invalid one is rejected) as in SRS 6.11 Proposal | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-38 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → REJECTED | Expert rejects with a note | — | Transition PROPOSED → REJECTED happens (or the invalid one is rejected) as in SRS 6.11 Proposal | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-39 | SRS 6.11 Proposal | Entity in the source state of PROPOSED → SUPERSEDED | Newer proposal for the zone | — | Transition PROPOSED → SUPERSEDED happens (or the invalid one is rejected) as in SRS 6.11 Proposal | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-40 | SRS 6.11 Proposal | Entity in the source state of closed → (rejected) | Further action 409 | — | Transition closed → (rejected) happens (or the invalid one is rejected) as in SRS 6.11 Proposal | Auto (CI, planned) – backend jest (gap G2) | Not run – test to be written |
| TC-ST-41 | SRS 6.17 Daily status | Entity in the source state of (new) → COMPUTED | Daily assessment | — | Transition (new) → COMPUTED happens (or the invalid one is rejected) as in SRS 6.17 Daily status | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-ST-42 | SRS 6.17 Daily status | Entity in the source state of COMPUTED → COMPUTED | Late data recomputes | — | Transition COMPUTED → COMPUTED happens (or the invalid one is rejected) as in SRS 6.17 Daily status | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-ST-43 | SRS 6.17 Daily status | Entity in the source state of COMPUTED → RATED | First rating | — | Transition COMPUTED → RATED happens (or the invalid one is rejected) as in SRS 6.17 Daily status | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-ST-44 | SRS 6.17 Daily status | Entity in the source state of RATED → RATED | Second assessor rates | — | Transition RATED → RATED happens (or the invalid one is rejected) as in SRS 6.17 Daily status | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-ST-45 | SRS 6.17 Daily status | Entity in the source state of COMPUTED → UNRATED | 7 days without a rating | — | Transition COMPUTED → UNRATED happens (or the invalid one is rejected) as in SRS 6.17 Daily status | Auto (CI, planned) – backend jest (gap G5) | Not run – test to be written |
| TC-ST-46 | SRS 6.9 Health report | Entity in the source state of (new) → GENERATED | Report job | — | Transition (new) → GENERATED happens (or the invalid one is rejected) as in SRS 6.9 Health report | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “tạo 1 báo cáo / Zone có dữ liệu” | Pass |
| TC-ST-47 | SRS 6.9 Health report | Entity in the source state of GENERATED → CONCLUDED | Expert writes a conclusion | — | Transition GENERATED → CONCLUDED happens (or the invalid one is rejected) as in SRS 6.9 Health report | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Pass |
| TC-ST-48 | SRS 6.9 Health report | Entity in the source state of CONCLUDED → CONCLUDED | Author edits; another expert 403 | — | Transition CONCLUDED → CONCLUDED happens (or the invalid one is rejected) as in SRS 6.9 Health report | Auto (CI) – backend Jest `tests/integration/healthReport.test.ts` › “chỉ Domain Expert viết; Farm Owner được báo” | Pass |

### 4.4 Non-Functional Requirements (6)

| ID | Feature / workflow | Preconditions | Steps | Data | Expected result | How it runs | Actual result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-NFR-01 | NFR-01 | Environment of the method | Measure as described | Script publishes 200 telemetry messages over MQTT on staging with the send time; a Socket.io client records receive times | Threshold: P95 ≤ 2 s | Manual – script `scripts/nfr01-latency` to write; staging | Not run |
| TC-NFR-02 | NFR-02 | Environment of the method | Measure as described | 30 injected alerts on staging; receive times from the Socket.io client, the mobile log and the Bot API `date` | Threshold: P95 ≤ 5 s per channel | Manual – staging, phone | Not run |
| TC-NFR-06 | NFR-06 | Environment of the method | Measure as described | Router uplink cut for 30 min on the prototype; decision log and stored samples against the 10-s grid | Threshold: 100 % of decisions; 0 samples lost | Manual – prototype, test house | Not run |
| TC-NFR-09 | NFR-09 | Environment of the method | Measure as described | Pipeline counts on `[TEAM: N]` recorded clips against manual counts, daylight and low light | Threshold: `[TEAM: P ≥ X, R ≥ Y, error ≤ Z %]` | Manual – AI node, `tools/track_clip.py` | Not run |
| TC-NFR-13 | NFR-13 | Environment of the method | Measure as described | 5 people who have not set up a device before, timed from power-on to "configuration applied" | Threshold: ≤ 10 min in 5/5; two scans + Wi-Fi | Manual – prototype, mobile app | Not run |
| TC-NFR-14 | NFR-14 | Environment of the method | Measure as described | Statuses and independent ratings over ≥ 14 rated days; agreement and Cohen's kappa (ANALYTICS-FR-014) | Threshold: `[TEAM: ≥ X %, kappa ≥ Y]` | Manual – field run, test house | Not run |

## 5. Responsibilities

Each owner writes and runs the test cases of their features and workflows (Design Brief, Section 8); a test case is counted for one person only (BM04).

| Member | Test cases |
| --- | --- |
| Nguyễn Chí Bảo | F-01, 02, 04, 05, 06, 10, 11, 12; WF-01, 03, 06; config sync transitions; NFR-01, 06, 09 |
| Trần Minh Kiệt | F-07, 08, 18, 19; WF-04, 10; alert, device and label transitions; NFR-02, 13 |
| Nguyễn Vũ Len | F-03, 17; WF-02, 09; relay transitions |
| Nguyễn Thị Yến Nhi | F-09, 20, 21, 22; WF-05, 11; daily status and health report transitions; NFR-14 |
| Thái Minh Tuấn | F-13, 14, 15, 16; WF-07, 08; verdict, review item and proposal transitions |

## 6. Test Results at Review 2

Run: backend Jest on branch `claude/modest-mendel-wz9d7b` (develop + PR #91) on 23/10/2026 — 59 suites, 695 tests, all passed. Firmware host tests: CI run #271 (`https://github.com/NBao261/SwiftletCare_KLTN/actions/runs/39669256224`, job "Firmware (native unit tests)", passed); the firmware has not changed since. Manual and system tests have not been run yet: staging is not deployed (gap G6).

| Source | Test cases | Automated in CI (existing + planned) | Automated now | Pass now | Manual |
| --- | --- | --- | --- | --- | --- |
| Total | 131 | 111 (84 %) | 69 | 69 | 20 |

Committed test cases that are not automated yet are written in Iteration 2 together with the feature they test (Design Brief, Section 5). The full automated suites also hold tests beyond this list (695 backend tests, firmware, web and pipeline tests); only the cases above count toward the commitment.

## 7. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 23/10/2026 | First version for Review 2: test plan, 131 committed test cases, results of the backend and firmware suites |
