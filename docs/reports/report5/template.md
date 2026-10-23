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
| Unit | Firmware control and detection logic; backend utilities (fuzzy model, forecast, anomaly, thresholds); web pure logic; pipeline geometry | Unity (`pio test -e native`), Jest, Vitest, pytest | CI on every pull request (pytest: local until the AI-pipeline CI job exists) | Module owner |
| Integration | Backend routes, services, jobs and MQTT handlers against an in-memory MongoDB; role checks | Jest + supertest + mongodb-memory-server | CI | Module owner |
| System (end-to-end) | Each main workflow through real devices or simulators, backend, web and mobile | Manual, following the demo scenarios | Staging (Report 4, Section 3.4) with the demo seed | Workflow owner |
| Field | Control, counting, health assessment in the test house | Manual measurement, scripts | Test house, AI node | Whole team |
| Non-functional | NFR-01, 02, 06, 09, 13, 14 | Scripts (latency), stopwatch, evaluation scripts | Staging, prototype, test house | Owner in Section 5 |

### 2.2 Test Types per Feature

Each mandatory feature has three test cases (guideline §9.3): one main path, one data or business-rule check, and one exception or permission check. Each state transition has one test, including transitions that must be rejected. Each workflow has one end-to-end test that follows its main demo scenario; the exception scenarios of Appendix A2 are run at the same time and reported in Section 4.2.

### 2.3 Automation

CI (`.github/workflows/ci.yml`) runs on every pull request, only for the modules it touches: backend lint, type check and Jest with an 80 % line-coverage threshold; web lint, type check, Vitest and build; firmware host tests; mobile lint, type check and Jest. Test cases marked "Auto (CI)" are part of these suites; "Auto (CI, planned)" are written with the feature they test. Target at Defense 1.1: at least 50 % of the committed test cases automated in CI.

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
| CI | GitHub Actions, Ubuntu runner, Node 22, Python 3 + PlatformIO, MongoDB in memory |
| Local | Members' machines with `docker compose` (MongoDB, EMQX, MinIO, MediaMTX) |
| Staging | VPS with backend, web, EMQX (TLS), MongoDB, MinIO, MediaMTX behind Caddy; AI node on the spare PC at the house (`docs/deploy/staging.md`) |
| Prototype | ESP32 controller with the five RS485 sensors, relay module, DFPlayer and speaker; test house in the field run |
| Data | `npm run seed` plus the demo seed (gap G6); recorded entrance clips for counting |

## 4. Test Cases

Columns follow the guideline: ID, feature or workflow, preconditions, steps, data, expected result, how it runs (automatic or manual), actual result.

### 4.1 Mandatory Features (66)

{{F}}

### 4.2 Main Workflows (11)

The exception scenarios (DS-02, 04, …, 22) are run in the same session and recorded next to their workflow in the test report of Defense 1.1.

{{WF}}

### 4.3 State Transitions (48)

{{ST}}

### 4.4 Non-Functional Requirements (6)

{{NFR}}

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

{{SUMMARY}}

Committed test cases that are not automated yet are written in Iteration 2 together with the feature they test (Design Brief, Section 5). The full automated suites also hold tests beyond this list (695 backend tests, firmware, web and pipeline tests); only the cases above count toward the commitment.

## 7. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 23/10/2026 | First version for Review 2: test plan, 131 committed test cases, results of the backend and firmware suites |
