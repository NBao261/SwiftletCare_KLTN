# Report 2 – Project Management Plan

**SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

| Field | Value |
| --- | --- |
| Project code | FA26SE158 |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | Nguyễn Văn Chiến, Trương Long |
| Document version | 1.5.0 (Review 2, final scope) |
| Date | 09/11/2026 |
| Scope baseline | Registration form v3 with Record of Changes (BM03) |

Dates after Review 2 are the team's proposal and are fixed in the Review 2 Commitment (BM04). Progress against this plan is kept in Project Tracking (`project-tracking.md`).

---

## 1. Project Overview

### 1.1 Scope and Estimation

Scope is the final registration form v3: main flows MF-01…08 and supporting flows SF-01…06 (Report 3, Section 2.2). The work breakdown follows the five tasks of the registration form (section 3.2 c). Effort is in person-days; "done" is the share already in the repository at the `review-2` tag, judged from the feature status and the gap list of Project Tracking (Sections 3 and 6). Both columns are the team's estimates at 03/11/2026.

| WBS | Work package | Main deliverable | Owner | Estimate (person-days) | Done at Review 2 |
| --- | --- | --- | --- | --- | --- |
| 1 | Hardware and firmware (Task 1) | Controller prototype; firmware 1.6.x (sensing, fuzzy control with weather offset, self-diagnosis, run hours, offline buffer, OTA); controller board with current sensing | Bảo, Kiệt | 50 | About 70 % (board, current check, config version and MQTT TLS remain) |
| 2 | Vision (Task 2) | Labelled dataset, trained YOLO model, counting pipeline, annotated stream, accuracy report | Nguyễn Chí Bảo | 40 | About 55 % (pipeline, MQTT publishing, video push and tests done; first YOLOv8n and YOLO11n models trained on the team's labelled frames on 03/11/2026; evaluation on held-out clips, device topics remain) |
| 3 | Backend (Task 3) | REST API, MQTT ingestion, alert engine with routing and escalation, Work Orders and maintenance, forecasting and weather offset, expert module with profiles and recommendation rules, daily health assessment, reports, farm overview and comparison, harvest cycles | Kiệt, Bảo | 115 | About 50 % (final scope); before Review 2 about 80 % (expert loop, review items, proposals, breach dwell and invitation-only accounts done; MF-06, manual override limits, config sync, FCM remain) |
| 4 | Web and mobile (Task 4) | Farm Owner, Domain Expert and Admin web screens (overview, comparison, Work Orders, plans, profiles, rules, harvest cycles); mobile app for the Farm Owner and the Farm Technician with QR setup, push, Work Orders and checklists | Len, Nhi, Tuấn, Bảo | 105 | Web about 50 %, mobile about 20 % (final scope) |
| 5 | Evaluation and thesis (Task 5) | Staging, device simulator, field run, NFR measurements, practitioner interview, test report, thesis | Whole team, led by Bảo | 45 | About 15 % (camera installed in the test house, 3 days of clips recorded) |
| 6 | Project management and documents | Reports 1–7, reviews, tracking | Bảo (lead), whole team | 20 | Reports 1–5 drafted |

### 1.2 Project Objectives

| Objective | Target | Measured by |
| --- | --- | --- |
| Scope | Every mandatory feature of the Design Brief (F-01…17, F-20…29) done and in at least one main workflow | Project Tracking; Report 5 |
| Defense 1.1 thresholds | 100 % of the 8 main workflows run end-to-end on staging; 100 % main and ≥ 80 % exception demo scenarios pass; ≥ 90 % of test cases pass, 100 % of main-path tests; ≥ 50 % automated in CI; no open Critical or High defect | Report 5; CI on the submitted tag |
| Quality of code | Every pull request passes CI and one review; backend line coverage ≥ 80 % | CI (`.github/workflows/ci.yml`) |
| Non-functional | The seven committed NFRs of the Design Brief measured with their stated method | Report 5, NFR test cases |
| Field evidence | ≥ 14 rated days in the test house (NFR-14); counting accuracy on recorded clips (NFR-09) | Evaluation report |

### 1.3 Project Risks

| ID | Risk | Probability | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| RK-1 | The count error of the swiftlet model stays above the 10 % of NFR-09 (model v1, trained 03/11/2026: about 10 % against hand counts); the spare PC is too slow for 25 fps | High | High | Retrain (v2) on hard frames (fast birds, belly views, birds rising from below), measured on the same test days and clips as v1; measure fps on the PC in Iteration 2; fall back to a smaller input or one tile; demo on clips through the same pipeline | Nguyễn Chí Bảo |
| RK-2 | Daily health assessment built late, leaving fewer than 14 rated days | Medium | High | Build MF-06 first in Iteration 2; start the field run as soon as the system is installed | Nguyễn Thị Yến Nhi |
| RK-3 | Staging not ready or unreachable from the defence room | Medium | High | Staging in Iteration 2; rehearse from the university network; 4G hotspot and recorded demo as back-up (`docs/deploy/staging.md`) | Nguyễn Chí Bảo |
| RK-4 | Test house unavailable (borrowed), power or Internet cuts at the house | Medium | Medium | Bench prototype with the same firmware; offline operation is itself tested (MF-01) | Nguyễn Chí Bảo |
| RK-5 | Web screens lag behind the backend scope | Medium | Medium | Remove v1.24.0 leftovers first; one owner per role screen set; weekly integration on `develop` | Nguyễn Vũ Len |
| RK-6 | Thresholds or health levels without a source | Medium | Medium | Evidence register and practitioner interview; constants declared in Report 3 §4.5 | Nguyễn Chí Bảo |
| RK-7 | A member cannot explain the part they own at Review 2 or Defense 1.1 | Low | High | Ownership Map; each owner presents their workflow at internal rehearsals | Nguyễn Chí Bảo |
| RK-8 | The mobile application must cover the whole scope of the registration form (3.2 b) while the same members build the web screens | High | High | Split by platform and role: Len owns the Farm Owner mobile app (sign-in, push, QR setup, daily status, live stream) while Nhi builds the Farm Owner web, Tuấn the expert screens; reuse the web API hooks and types; Farm Owner flows first (Project Tracking G-16) | Nguyễn Vũ Len |
| RK-9 | The move to device topics, `esp-mqtt` and TLS (Report 4 D3) breaks the link between controllers, AI node and backend | Medium | High | One pull request for firmware, backend and AI node; bench test with two controllers and the AI node before staging; old firmware reflashed over USB if needed (Project Tracking G-07) | Nguyễn Chí Bảo |
| RK-10 | The scope grew at Review 2 (Farm Technician, Work Orders, maintenance, weather offset, recommendations, overview, harvest cycles) with seven weeks left | High | High | One owner per work package (Project Tracking G-20…G-27); simulator and Work Orders first in Iteration 2; the duty roster (optional) last; weekly integration on `develop` | Nguyễn Chí Bảo |

## 2. Management Approach

### 2.1 Project Process

The team works in iterations of two-week sprints with Scrum-style ceremonies, adapted to a student team:

| Practice | How |
| --- | --- |
| Sprint planning | At the start of each sprint, tasks are taken from the gap list of Project Tracking (Section 6) and assigned to their owner |
| Weekly meeting | One online meeting a week with the supervisor; progress, blockers, decisions |
| Sprint review and retrospective | At the end of each sprint, recorded in `docs/sprint-reviews/` |
| Definition of Done | Code merged into `develop` through a pull request that passes CI and one review; tests written with the feature (backend service logic: mandatory); docs and API contract updated in the same pull request |
| Change control | Scope changes only through the Record of Changes (BM03) until Review 2; after Review 2 the scope is frozen |

### 2.2 Schedule and Milestones

| Milestone | Date | Content |
| --- | --- | --- |
| Registration | 22/07/2026 | Registration form v1 |
| Review 1 | 30/09/2026 | Registration v2; scope narrowed to the automated system |
| Iteration 1 | until Review 2 | Firmware 1.5.0, backend of the main flows except MF-06, with the expert loop (MF-04), review items and proposals (MF-05) and the breach dwell time, counting pipeline with MQTT publishing and video push, Farm Owner, Admin and Domain Expert web screens, test house camera |
| **Review 2** | 04/11/2026 | Registration v3, Reports 1–5, Design Brief, self-review |
| Iteration 2 | 05/11–02/12/2026 (4 weeks) | Gaps due "It. 2" in Project Tracking: device topics and TLS; MF-06 backend; manual override limits; config sync; FCM; QR setup on mobile; pipeline against staging; trained model; staging; field run starts |
| Iteration 3 | 03/12–23/12/2026 (3 weeks) | Current sensing; reports and export; remaining screens; all committed test cases; NFR measurements; evaluation report |
| **Defense 1.1** | Per the course schedule | Workflows, scenarios, tests and NFRs against the Commitment |
| Viva | Per the course schedule | Thesis (Report 7), final package |

### 2.3 Quality Management

| Activity | Practice |
| --- | --- |
| Requirements | Report 3 is the baseline; every mandatory FR has a testable acceptance criterion; every threshold has a source or is declared as an engineering constant (§4.5) |
| Design | Report 4 with diagrams kept as Mermaid in the repository; design decisions recorded with their options |
| Code review | Every pull request is reviewed against the rules of its module (`*/CLAUDE.md`, `frontend/FE_Design_Claude.md`) by one human reviewer and the automated review routine (`.claude/commands/review-pr.md`) |
| Continuous integration | commitlint, gitleaks, and per touched module: backend lint, type check, Jest with 80 % coverage; web lint, type check, Vitest, build; firmware host tests; mobile lint, type check, Jest |
| Testing | Report 5: unit, integration, system (end-to-end on staging) and field tests; Defense 1.1 thresholds |
| Self-review | Standard review prompt run on the `review-2` tag; findings answered in BM02 |

### 2.4 Training Plan

| Topic | Who | How |
| --- | --- | --- |
| Swiftlet farming basics, house practice | Whole team | Visits to the test house; interview with the practitioner |
| ESP32, RS485 Modbus, MQTT | Bảo, Kiệt | Vendor datasheets; prototype on the bench |
| YOLO training, ONNX Runtime, ByteTrack | Bảo | Ultralytics and supervision documentation; Colab |
| Roboflow labelling, Playwright | Len, Nhi, Tuấn | Roboflow documentation; `frontend/FE_Design_Claude.md` §13.17 |
| Node.js, TypeScript, MongoDB, Socket.io | Kiệt, Bảo | Backend codebase and its `CLAUDE.md` |
| React, Vite, TailwindCSS, Expo | Len, Nhi, Tuấn | `frontend/FE_Design_Claude.md`; Expo Router documentation |
| Testing with Jest, Vitest, Unity | Whole team | Existing tests in each module |

## 3. Project Deliverables

| Deliverable | Due | Form |
| --- | --- | --- |
| Registration v3, BM03 | Review 2 | `…_R2_Registration.pdf` |
| Reports 1–5, Project Tracking | Review 2 | `…_R2_Report<n>.pdf`; Markdown in `docs/reports/` |
| Design Brief with Appendix A (BM01) | Review 2 | `…_R2_DesignBrief.pdf` |
| Self-review report (BM02) | Review 2 | `…_R2_SelfReview.pdf` |
| Review 2 Commitment (BM04) | 3 working days after Review 2 | `…_R2_Commitment.pdf` |
| Source code, database script, tests, CI | Review 2 (tag `review-2`), Defense 1.1 | GitHub repository |
| Controller prototype, AI node, trained model | Defense 1.1 | Hardware at the test house; model file outside the repository |
| Report 6, Full Software Package | Defense 1.1 | PDF; repository tag |
| Report 7 (thesis), defence slides | Viva | PDF |

## 4. Responsibility Assignments

R = responsible, A = accountable, C = consulted.

| Area | Bảo | Kiệt | Len | Nhi | Tuấn |
| --- | --- | --- | --- | --- | --- |
| Project management, reports | A, R | R | R | R | R |
| Firmware, hardware | A, R | R | | | |
| AI pipeline, model | A, R | | | | |
| Dataset labelling, manual clip counts | A | | R | R | R |
| Backend MQTT ingestion, configuration sync, bird counting, push, current sensing, weather offset, profiles, recommendation rules, overview and comparison, harvest cycles, simulator | A, R | C | | | |
| Backend devices, accounts, alerts, setup | C | A, R | C | C | C |
| Backend expert module | C | A, R | | | C |
| Backend daily health and reports | C | A, R | | C | |
| Backend Farm Technician, routing, escalation, Work Orders, maintenance plans | C | A, R | C | C | |
| Web – Farm Owner (overview, comparison, Work Order approval, plans, harvest cycles) | | | C | A, R | |
| Web – Administrator, role matrix | | | | A, R | |
| Web – Domain Expert (verdicts, profiles, weather and recommendation rules, season conclusions), Admin device console | | | | | A, R |
| Mobile – sign-in, push, QR setup, daily status | C | | A, R | | |
| Mobile – Farm Owner screens, live stream | | | A, R | | |
| Mobile – Farm Technician (alerts, Work Orders, checklists, rating, harvest entry) | | C | A, R | | |
| Mobile – Domain Expert screens | | | C | | A, R |
| E2E tests of the demo scenarios | A | C | R | R | R |
| Staging and deployment | A, R | R | R | R | R |
| Tests and Report 5 | A | R | R | R | R |

Staging and documents are shared: Bảo is accountable and runs the infrastructure and the final documents, and every member is responsible for their part (Kiệt the backend image, migrations, seed and backup; Nhi the web build; Len the mobile build; Tuấn the E2E runs on staging; each member the report sections of their own workflows). Backend code is written only by Bảo and Kiệt. Len, Nhi and Tuấn are consulted on the backend of the features they own and answer for those features working end to end (Project Tracking, Section 3).

Main workflows owned (Design Brief, Section 8): Bảo WF-01, 03; Kiệt WF-05; Len WF-02, 07; Nhi WF-06; Tuấn WF-04, 08. Since 03/11/2026 the Farm Owner screens are split by platform: Len the mobile app, Nhi the web. Work order per person before the `review-2` tag and in Iteration 2: `docs/reports/todo-review2.md` §0.

## 5. Project Communications

| Channel | Purpose | Frequency |
| --- | --- | --- |
| Meeting with the supervisor | Progress, decisions, review preparation | Weekly |
| Team chat (Zalo and Discord groups) | Daily coordination | Daily |
| GitHub issues and pull requests | Tasks, code review, decisions on code | Continuous |
| Sprint review notes | Results and retrospective | Every sprint, `docs/sprint-reviews/` |
| Practitioner interview | Thresholds, health levels, validation | At least once before Defense 1.1, recorded in `docs/evidence-register.md` |

## 6. Configuration Management

### 6.1 Document Management

All reports are Markdown files in `docs/reports/`, versioned with the code; diagrams are Mermaid inside Reports 3 and 4. Each report has a revision table. The PDF versions for submission are exported from these files. Forms (BM01, BM03) are generated from their Markdown tables into the course templates (`docs/reports/design-brief/`, `docs/reports/registration/`).

### 6.2 Source Code Management

| Item | Rule |
| --- | --- |
| Repository | GitHub `NBao261/SwiftletCare_KLTN`, one repository for every module |
| Branches | `develop` (integration, default), `main` (releases); work branches `feat/…`, `fix/…`, `docs/…`, `chore/…`, `hotfix/…` |
| Protection | `develop`: pull request with 1 approval, no force push; `main`: code-owner approval, required checks, linear history |
| Commits | Conventional Commits with project types and scopes, checked by commitlint |
| Tags | `review-2`, then one tag per defence (`defense-1.1`, `viva`) |
| Secrets | Environment variables only; gitleaks in CI; device keys, camera passwords and model weights never committed |

### 6.3 Tools and Infrastructure

| Category | Tool |
| --- | --- |
| Source and CI | GitHub, GitHub Actions |
| IDE | VS Code, PlatformIO |
| Backend and data | Node.js 22, MongoDB 7, EMQX 5.7, MinIO, MediaMTX, Docker Compose |
| Front-end and mobile | React 18, Vite, TailwindCSS, Expo |
| AI | Python, ONNX Runtime, supervision, Roboflow, Google Colab |
| Testing | Jest, Vitest, Unity (PlatformIO native), pytest, k6 (load) |
| Environments | Development on members' machines; staging on a VPS with the AI node on the spare PC at a member's home (Report 4, Section 3.4) |
| AI assistants | Declared in Report 4, Section 3.5 |

## 7. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.5.0 | 09/11/2026 | Eight main flows (harvest season summary is supporting flow SF-06): 27 mandatory features and 170 committed test cases |
| 1.4.0 | 09/11/2026 | Final scope of Review 2 (SRS 4.0.0): work packages of the new scope (Kiệt operations backend; Bảo firmware weather offset, knowledge and analytics backend, simulator; Len technician mobile; Tuấn expert web; Nhi owner web), workflows WF-07…09, 28 mandatory features and 186 committed test cases, risk of the larger scope |
| 1.3.0 | 03/11/2026 | Six business main flows (SRS 3.2.0): workflow owners, Defense 1.1 thresholds and milestones follow MF-01…06; device setup is supporting flow SF-01 |
| 1.2.0 | 27/10/2026 | Work re-split by role: backend code by Bảo and Kiệt only; web and mobile per role, E2E tests, client-side NFR measurements and dataset labelling by Len, Nhi and Tuấn; WBS owners, RACI (staging and documents shared, led by Bảo; Farm Owner web to Nhi, mobile to Len on 03/11/2026), skills, workflow owners, RK-3 and RK-8 |
| 1.1.0 | 26/10/2026 | Aligned with SRS 3.1.0 and SDD 1.1.0: progress judged from Project Tracking, Iteration 1 and 2 content corrected, RACI wording, risks RK-8 (mobile scope) and RK-9 (move to device topics) |
| 1.0.0 | 23/10/2026 | First version for Review 2 |
