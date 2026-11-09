# Report 5 – Software Test Documentation

**SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

| Field | Value |
| --- | --- |
| Project code | FA26SE158 |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | Nguyễn Văn Chiến, Trương Long |
| Document version | 1.5.0 (Review 2, final scope) |
| Date | 09/11/2026 |
| Requirements baseline | Report 3 – SRS 4.2.0; Design Brief (BM01) 2.0 sections 6–7 and Appendix A |

This file is generated from the test-case list `docs/reports/report5/tc.py` by `docs/reports/report5/gen_report5.py`. Edit the list and regenerate; do not edit the tables by hand. The generator checks that every automated case names a test that exists; the "Actual result" column is filled only from a CI run on the tag named in Section 6.

---

## 1. Introduction

### 1.1 Purpose

This report is the test plan and the test cases of SwiftletCare for Defense 1.1. It maps every mandatory feature (F-01…17, F-20…29), main workflow (WF-01…08), state transition of a main entity (Report 3, Section 6) and committed NFR of the Design Brief to test cases with their expected and actual results.

### 1.2 Scope of Testing

| In scope | Out of scope |
| --- | --- |
| Firmware logic (filters, fuzzy control, misting check, noise anomaly, remote commands) on the host; backend services, REST API, MQTT ingestion, jobs, Socket.io authorisation; web pure logic; the counting pipeline's geometry; end-to-end workflows on staging; NFRs on staging, prototype and test house | Items of Report 3, Section 8; load beyond NFR-03; security penetration testing; store builds of the mobile app |

### 1.3 Test Count Committed (Design Brief, Appendix A3)

| Source | Count | Minimum per item | Subtotal |
| --- | --- | --- | --- |
| Mandatory features | {{NF}} | 3 | {{NF3}} |
| Main workflows (end-to-end) | {{NWF}} | 1 | {{NWF}} |
| State transitions of main entities | {{NST}} | 1 | {{NST}} |
| Committed NFRs | 7 | 1 | 7 |
| **Total** | | | **{{TOTAL}}** |

## 2. Test Strategy

### 2.1 Test Levels

| Level | What | Tool | Where | Run by |
| --- | --- | --- | --- | --- |
| Unit | Firmware control and detection logic; backend utilities (fuzzy model, forecast, anomaly, thresholds); web pure logic; pipeline geometry | Unity (`pio test -e native`), Jest, Vitest, pytest | CI on every pull request that touches the module (pytest job since PR #95) | Module owner |
| Integration | Backend routes, services, jobs and MQTT handlers against an in-memory MongoDB; role checks | Jest + supertest + mongodb-memory-server | CI | Module owner |
| System (end-to-end) | Each main workflow through real devices or simulators, backend, web and mobile | Manual, following the demo scenarios | Staging (Report 4, Section 3.4) with the demo seed | Workflow owner |
| Field | Control, counting, health assessment in the test house | Manual measurement, scripts | Test house, AI node | Whole team |
| Non-functional | NFR-01, 02, 06, 09, 13, 14, 15 | Scripts (latency), device simulator, stopwatch, evaluation scripts | Staging, prototype, test house | Owner in Section 5 |

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
| High | A mandatory feature gives a wrong result or a permission is wrong | An Administrator can edit thresholds |
| Medium | Wrong result with a workaround, or a non-mandatory feature broken | Wrong label in a report |
| Low | Cosmetic | Alignment, wording |

Every defect is fixed by a pull request that adds a test failing without the fix. Open defects are listed in Project Tracking.

## 3. Test Environment

| Environment | Content |
| --- | --- |
| CI | GitHub Actions, Ubuntu runner, Node 22, Python 3 + PlatformIO, Python + pytest for the AI pipeline, MongoDB in memory |
| Local | Members' machines with `docker compose` (MongoDB, EMQX, MinIO, MediaMTX) |
| Staging | VPS with backend, web, EMQX (TLS), MongoDB, MinIO, MediaMTX behind Nginx; AI node on the spare PC at a member's home, reading the camera over the Internet (`docs/deploy/staging.md`) |
| Prototype | ESP32 controller with the five RS485 sensors, relay module, DFPlayer and speaker; test house in the field run |
| Data | `npm run seed` plus the demo seed (Project Tracking G-17); recorded entrance clips for counting |

## 4. Test Cases

Columns follow the guideline: ID, feature or workflow, preconditions, steps, data, expected result, how it runs (automatic or manual), actual result.

### 4.1 Mandatory Features ({{NF3}})

Requirements covered by each mandatory feature:

{{FEATURES}}

{{F}}

### 4.2 Main Workflows ({{NWF}})

{{WF}}

Exception scenarios of the Design Brief (Appendix A2), run in the same session as their workflow. They are demo evidence for the guideline's threshold of 80 % of exception scenarios passing and are **not counted** among the committed cases.

{{WFX}}

### 4.3 State Transitions ({{NST}})

{{ST}}

### 4.4 Non-Functional Requirements (7)

{{NFR}}

### 4.5 Requirement Coverage

Generated from the "Requirements verified" column of Section 4.1, the NFR cases that measure a requirement (TC-NFR-09 for VISION-FR-016, TC-NFR-14 for ANALYTICS-FR-014) and the requirement lists of the main flows (Report 3, Section 2.2). "Verified" means a committed case has steps and an expected result for that requirement; "traced" means only that the requirement belongs to a workflow whose end-to-end test runs. {{COVSUM}} The traced-only requirements are covered by the module suites or get a case when their gap is closed (Project Tracking, Section 6).

{{COVERAGE}}

### 4.6 Supporting Regression Tests (not counted in the commitment)

Requirements of priority `S` are kept working by the automated suites that run on every pull request; they are not part of the committed cases above.

| Supporting flow | Requirements | Suites |
| --- | --- | --- |
| SF-01 Device setup by the Farm Owner | FARM-FR-001…003c, 005…008, 010…012, ENV-FR-027 | Features F-18 and F-19 below, written and run like the committed ones |
| SF-06 Harvest recording and season summary | HARVEST-FR-001…007, ANALYTICS-FR-004, EXPERT-FR-020 | Feature F-30 below, written and run like the committed ones |
| SF-02 Remote device maintenance | FARM-FR-009, 013, ENV-FR-013c | backend `technicianAccess.test.ts`, `deviceOnboarding.test.ts` (remote commands, OTA), `audioTracks.test.ts`; firmware `pio test` remote-command suite |
| SF-03 Accounts and access | AUTH-FR-002…012, FARM-FR-001, 002 | backend `passwordAndProfile.test.ts`, `invitations.test.ts`, `adminUserLifecycle.test.ts`, `rateLimit.test.ts`, `dataPrivacy.test.ts`, `roleMatrix.test.ts` |
| SF-04 Notification settings | ALERT-FR-005, 006, 013 | backend `notification.test.ts`, `telegram.test.ts`; feature F-08 above |
| SF-05 System administration | ENV-FR-007, SYSTEM-FR-001…003 | backend `auditLog.test.ts`, `systemOverview.test.ts`, `systemSettingSingleton.test.ts`, `zoneThresholds.test.ts` |

Test cases of the features of the supporting flows SF-01 (device setup) and SF-06 (harvest recording), {{NSUP}} cases:

{{FS}}

## 5. Responsibilities

Each owner runs the test cases of their features and workflows and records the result (Design Brief, Section 8); a test case is counted for one person only, its owner (BM04). Automated tests of backend code are written by the author of that code.

| Member | Owns and runs (counted for this member in BM04) | Writes |
| --- | --- | --- |
| Nguyễn Chí Bảo | F-01, 02, 03, 04, 09, 10, 11, 12, 26; WF-01, 03; configuration sync transitions; NFR-06, 09 (36 cases) | Firmware and AI-node tests; backend tests of MQTT ingestion, configuration, bird counting, push, weather compensation, knowledge rules and current sensing; DS-01, 02, 05, 06 on staging |
| Trần Minh Kiệt | F-05, 06, 08, 23, 24; supporting F-18, 19; WF-05; device connection, device label and Work Order transitions; NFR-15 (38 cases) | Backend tests of devices, accounts, alerts, the expert module, daily health and operations (including those of F-07, 13–17, 20–22, 25); DS-09, 10 |
| Nguyễn Vũ Len | F-07, 17, 25; WF-02, 07; alert status, relay mode and maintenance plan transitions; NFR-02 (31 cases) | E2E tests of DS-03, 04, 13, 14; mobile tests |
| Nguyễn Thị Yến Nhi | F-20, 21, 22, 29; supporting F-30; WF-06; daily status, rating, health report and recommendation transitions; NFR-01, 13, 14 (32 cases) | E2E tests of DS-11, 12; web tests |
| Thái Minh Tuấn | F-13, 14, 15, 16, 27, 28; WF-04, 08; verdict, review item and proposal transitions (33 cases) | E2E tests of DS-07, 08, 15, 16; web tests |

## 6. Test Results at Review 2

Results come only from the CI run on the tag `review-2` (commit `7d5e643b`, 04/11/2026): https://github.com/NBao261/SwiftletCare_KLTN/actions/runs/41801124931. Every module passed there: backend lint, type check and Jest (599 of 599 tests in 61 suites), web lint, type check, Vitest and build, firmware host tests (50 of 50), mobile lint, type check and Jest, AI-pipeline pytest (50 of 50). The "Actual result" column above is generated from that run's three artifacts (backend Jest JSON, firmware PlatformIO JUnit, AI-pipeline pytest JUnit). Cases whose test is still to be written and manual cases are "Not run"; TC-F17-02 and TC-ST-14, whose tests were merged after the tag (PR #124, G-06), are "Not run on the tag" and count as written; manual cases are filled from the test report of Defense 1.1. The automated suites also hold tests beyond this list; only the cases above count toward the commitment.

{{SUMMARY}}

Committed test cases that are not automated yet are written in Iteration 2 together with the feature they test (Project Tracking, Section 6).

## 7. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.5.0 | 09/11/2026 | Eight main workflows: WF-09 removed, F-30 (harvest cycles) becomes a supporting feature of SF-06, the transitions of HarvestBatch and HarvestCycle leave the committed list; F-13 covers the on-site check (EXPERT-FR-021) |
| 1.4.0 | 09/11/2026 | Final scope of Review 2 (SRS 4.0.0): features F-23…F-30 (alert routing and escalation, Work Orders closed by the data, preventive maintenance, weather compensation, recommendation rules, profiles and house stage, farm overview and house comparison, harvest cycles), workflows WF-07…09 with demo scenarios DS-13…18, transitions of HarvestBatch, WorkOrder, MaintenancePlan, Recommendation and HarvestCycle, NFR-15. The results of Section 6 are still those of the run on the tag `review-2`; the new cases are written in Iterations 2 and 3 |
| 1.3.0 | 04/11/2026 | Results of the CI run on the tag `review-2` (Section 6): 83 of the 83 automated cases with a written test pass; the generator reads the PlatformIO JUnit report, whose suite name sits on the test suite |
| 1.2.0 | 03/11/2026 | Six business main workflows (SRS 3.2.0): WF-01…06 with demo scenarios DS-01…12; device-setup features F-18, F-19 move to supporting flow SF-01 (still tested, not counted) |
| 1.1.0 | 26/10/2026 | Aligned with SRS 3.1.0: 53 state transitions (relay mode 4, device 5, configuration sync 5, daily status 2, assessor rating 5), 136 committed cases; a concrete expected result for every transition; mappings to existing tests corrected (TC-F03-03, PENDING → ONLINE, ONLINE → OFFLINE, RESOLVED → new alert); new cases for breach dwell, pump limit and confirmation, device topics, rain confounder and rating snapshot; results counted only from a run on the tag; a "Requirements verified" column for every feature case and a generated requirement coverage table (Section 4.5); supporting regression suites listed (Section 4.6); the per-zone report test no longer counts for TC-ST-48; table of the FRs of each feature; firmware and AI-pipeline results read from the PlatformIO and pytest JUnit reports; F-10 and F-11 test the pipeline itself (ring crossing, lost tracks, annotated frames); F-22 tests that the API hides the status before rating |
| 1.0.0 | 23/10/2026 | First version for Review 2: test plan, 131 committed test cases, results of the backend and firmware suites |
