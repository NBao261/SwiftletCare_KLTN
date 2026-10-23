# Project Tracking

**SwiftletCare** · updated 23/10/2026 (Review 2) · plan: Report 2 · requirements: Report 3 · tests: Report 5

Status values: **Done** (merged into `develop`, tests pass), **In progress** (partly merged), **Planned** (not started). Owners follow the Design Brief, Section 8.

---

## 1. Milestones

| Milestone | Planned | Status | Note |
| --- | --- | --- | --- |
| Registration v1 | 22/07/2026 | Done | |
| Review 1 | `[TEAM: date]` | Done | Registration v2; scope narrowed to the automated system |
| Iteration 1 | until Review 2 | Done | 90 pull requests merged (#2…#93) |
| Review 2 documents | `[TEAM: date]` | In progress | Registration v3 + BM03, Reports 1–5, Design Brief done as drafts; `[TEAM]` cells, self-review (BM02) and tag `review-2` remain |
| Iteration 2 | `[TEAM: dates]` | Planned | See Section 3 |
| Iteration 3 | `[TEAM: dates]` | Planned | |
| Defense 1.1 | `[TEAM: date]` | Planned | |

## 2. Iteration 1 — Work Merged

Merged pull requests on GitHub, grouped by author account (`NBao261/SwiftletCare_KLTN`, #1…#93; #1 and #22 were closed without merge; #92, these documents, is open).

| Member (account) | Merged PRs | Main content |
| --- | --- | --- |
| Nguyễn Chí Bảo (`NBao261`) | 60 | Backend modules (farm, device, telemetry, alert, analytics, expert, bird counting, stream access); firmware (MQTT contract, speaker, fuzzy control, filters, anomaly, remote restart/OTA); counting pipeline (#85, #88); CI, review rules, SRS/SDD (#59, #50, #77, #84–#88, #90) |
| Trần Minh Kiệt (`minhkiet1001`) | 7 | Admin backend modules, technician backend, device decommission and restore, admin logic fixes (#16, #21, #23, #35, #40, #62, #80) |
| Nguyễn Vũ Len (`VuLen203`) | 13 | Web design rules, sidebar, Farm Owner dashboard, analytics, monitor, farms, harvest, tickets, auth screens; Farm Owner rework with devices, live stream over WHEP, house-level counts, override history and autonomy, marketplace removal (#2, #20, #33, #34, #37, #48, #54, #55, #63, #78, #79, #82, #93) |
| Nguyễn Thị Yến Nhi (`NhiNhi306`) | 6 | Admin web: users and account requests, design-system components, system pages, settings and logs, overview (#26, #27, #28, #47, #49, #72) |
| Thái Minh Tuấn (`Tuaans1807`) | 4 | Technician web screens and logic, Domain Expert web screens (#38, #52, #56, #91) |

Counts are pull requests only; reviewing, testing and field work are not counted here.

## 3. Feature Status (Design Brief, Section 6)

| ID | Feature | Owner | Status | Remaining work | Iteration |
| --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, live dashboard | Nguyễn Chí Bảo | Done | Hardware run record | 2 |
| F-02 | Fuzzy control | Nguyễn Chí Bảo | Done | — | — |
| F-03 | Thresholds, coefficients | Nguyễn Vũ Len | In progress | Roles per Report 3 §2.4 (G1); config version (G3) | 2 |
| F-04 | Offline operation | Nguyễn Chí Bảo | Done | 30-min outage test on the prototype (NFR-06) | 2 |
| F-05 | Self-diagnosis | Nguyễn Chí Bảo | Done | — | — |
| F-06 | Actuator current check | Nguyễn Chí Bảo | Planned | Board with ADS1115 and current transformers; firmware; `ACTUATOR_FAULT` on three sides | 3 |
| F-07 | Alert lifecycle | Trần Minh Kiệt | In progress | `DISMISSED`; acknowledge tests | 2 |
| F-08 | Push and Telegram | Trần Minh Kiệt | In progress | FCM sending; token registration in mobile | 2 |
| F-09 | Forecast warning | Nguyễn Thị Yến Nhi | Done | — | — |
| F-10 | Counting, return rate | Nguyễn Chí Bảo | In progress | Bring PR #89 into `develop` (DF-1); trained model; sessions from buckets; incomplete sessions | 2 |
| F-11 | Annotated live stream | Nguyễn Chí Bảo | In progress | Video push (PR #89); web viewing done on the Farm Owner Vision page (PR #93); mobile screen | 2 |
| F-12 | Abnormal noise | Nguyễn Chí Bảo | Done | — | — |
| F-13 | Expert verdict | Thái Minh Tuấn | In progress | `DISMISSED`, note required, evidence endpoint, owner fallback | 2 |
| F-14 | Tuning, ring, schedule | Thái Minh Tuấn | In progress | Seasonal schedule; ring editor screen | 2 |
| F-15 | Review and suggestions | Thái Minh Tuấn | Planned | Review items, proposals (SM-10, 11) | 2 |
| F-16 | Conclusions, owner notice | Thái Minh Tuấn | In progress | Notify owners of every expert decision; activity history | 2 |
| F-17 | Manual override | Nguyễn Vũ Len | Done | Technician only on an assigned ticket (G1); override history shown on `/analytics` (PR #93) | 2 |
| F-18 | Register by QR | Trần Minh Kiệt | In progress | Farm Owner role; label printing; QR scan in mobile | 2 |
| F-19 | Setup progress, move | Trần Minh Kiệt | In progress | Offline move; progress screen; key re-issue | 2 |
| F-20 | Daily health status | Nguyễn Thị Yến Nhi | Planned | Daily job, levels per house, weather job | 2 |
| F-21 | Reports, PDF/CSV | Nguyễn Thị Yến Nhi | In progress | Reports per house (day/week/month); PDF, CSV | 3 |
| F-22 | Independent rating | Nguyễn Thị Yến Nhi | Planned | Rating route and screens (BR-31) | 2 |

Summary: 8 Done, 10 In progress, 4 Planned.

## 4. Test Progress (Report 5)

| Item | Committed | Automated now | Passing now |
| --- | --- | --- | --- |
| Test cases | 131 | 69 | 69 |
| Backend Jest suite (all tests) | — | 695 | 695 (23/10/2026) |

## 5. Defect List

| ID | Defect | Severity | Found | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| DF-1 | PR #89 (pipeline publishes counts, buckets and heartbeat over MQTT, pushes video to MediaMTX, CI job for pytest) was merged into the branch of PR #88 eleven seconds after #88 itself was merged into `develop`, so none of it reached `develop` | High | 23/10/2026 | Nguyễn Chí Bảo | Open — open a PR from `feat/vision-full-frame-tracking` (or `feat/vision-live-pipeline`) into `develop` |
| DF-2 | Technician and Administrator can edit zone thresholds and fuzzy coefficients; Technician can override relays without an assigned ticket (Report 3 §2.4) | High | Report 3 review | Trần Minh Kiệt | Open (gap G1) |
| DF-3 | Farm Owner cannot register, move or remove devices (MF-10) | High | Report 3 review | Trần Minh Kiệt | Open (gap G1) |
| DF-4 | Firmware connects to MQTT without TLS; cannot reach the staging broker on 8883 | Medium | Staging design | Nguyễn Chí Bảo | Open (gap #39) |
| DF-5 | Domain Expert web screens fall back to mock data (`services/expert/expertFallback.service.ts`, `data/mocks/`) | Medium | Merge of PR #91 | Thái Minh Tuấn | Open (gap G7) |

Severity follows Report 5, Section 2.5. Defense 1.1 requires no open Critical or High defect.

## 6. Gaps Against Report 3

The full list, one row per FR, is `docs/reports/README.md` ("Chỗ lệch", #1…#40); the summary with owners is the Design Brief, Section 5 (G1…G7). Work items with priorities are in `docs/reports/todo-review2.md`.

## 7. Change Log

| Date | Change |
| --- | --- |
| 23/10/2026 | First tracking sheet for Review 2: milestones, Iteration 1 pull requests, feature status, tests, defects |
| 23/10/2026 | After PR #93 (Farm Owner web rework): pull-request counts, F-11 and F-17 |
