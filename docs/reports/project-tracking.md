# Project Tracking

**SwiftletCare** · updated 26/10/2026 (Review 2) · plan: Report 2 · requirements: Report 3 · design: Report 4 · tests: Report 5

This sheet is the only record of progress. Report 3 and Report 4 describe what the system must do and how it is built, without status; the Design Brief (Section 5) summarises the gaps below. Status values: **Done** (merged into `develop`, its committed tests pass, and it runs end to end from the client), **In progress** (partly merged, or the backend works without its client), **Planned** (not started). Owners follow the Design Brief, Section 8.

---

## 1. Milestones

| Milestone | Planned | Status | Note |
| --- | --- | --- | --- |
| Registration v1 | 22/07/2026 | Done | |
| Review 1 | `[TEAM: date]` | Done | Registration v2; scope narrowed to the automated system |
| Iteration 1 | until Review 2 | Done | Pull requests #2…#107 |
| Review 2 documents | `[TEAM: date]` | In progress | Registration v3 + BM03 1.1, Reports 1–5, Design Brief 1.1 aligned on 26/10/2026; enumeration PR (G-01) merged 29/10/2026; left: `[TEAM]` cells, the invitation-only account PR (G-02 P0), tag `review-2`, CI run on the tag, BM02 |
| Iteration 2 | `[TEAM: dates]` | Planned | Gaps due "It. 2" in Section 6 |
| Iteration 3 | `[TEAM: dates]` | Planned | Gaps due "It. 3" |
| Defense 1.1 | `[TEAM: date]` | Planned | Thresholds of the guideline §9.4 |

## 2. Iteration 1 — Work Merged

Merged pull requests on GitHub, grouped by author account (`NBao261/SwiftletCare_KLTN`, #1…#107; #1 and #22 were closed without merge).

| Member (account) | Merged PRs | Main content |
| --- | --- | --- |
| Nguyễn Chí Bảo (`NBao261`) | `[TEAM: recount after #107]` | Backend modules (farm, device, telemetry, alert, analytics, expert, bird counting, stream access); firmware (MQTT contract, speaker, fuzzy control, filters, anomaly, remote restart/OTA); counting pipeline (#85, #88, #95); CI, review rules, SRS/SDD; scope removal of tickets, SLA and regions (#100–#107) |
| Trần Minh Kiệt (`minhkiet1001`) | 7 | Admin backend modules, technician backend, device decommission and restore, admin logic fixes (#16, #21, #23, #35, #40, #62, #80) |
| Nguyễn Vũ Len (`VuLen203`) | 14 | Web design rules, sidebar, Farm Owner dashboard, analytics, monitor, farms, harvest, auth screens; Farm Owner rework with devices, live stream over WHEP, house-level counts, override history and autonomy, marketplace removal, farm → house → zone scope filter (#2, #20, #33, #34, #37, #48, #54, #55, #63, #78, #79, #82, #93, #94) |
| Nguyễn Thị Yến Nhi (`NhiNhi306`) | 6 | Admin web: users and account requests, design-system components, system pages, settings and logs, overview (#26, #27, #28, #47, #49, #72) |
| Thái Minh Tuấn (`Tuaans1807`) | 4 | Technician web screens and logic, Domain Expert web screens (#38, #52, #56, #91) |

Counts are pull requests only; reviewing, testing and field work are not counted here.

## 3. Feature Status (Design Brief, Section 6)

"Evidence" names the pull requests that built the feature and the committed test cases of Report 5 that run today. A feature whose backend works without its client is In progress. The owner is accountable for the feature working end to end and runs its committed test cases; backend code is written only by Nguyễn Chí Bảo and Trần Minh Kiệt, and their pull requests are listed with the client ones.

| ID | Feature | Owner | Status | Evidence (PR; tests) | Remaining work (gap) | Iteration |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Telemetry, live dashboard | Nguyễn Chí Bảo | Done | `[TEAM: PR]`; TC-F01-01..03 | — | — |
| F-02 | Fuzzy control | Nguyễn Chí Bảo | Done | `[TEAM: PR]`; TC-F02-01..03 | — | — |
| F-03 | Thresholds, coefficients | Nguyễn Chí Bảo | In progress | #100, #101; TC-F03-01..03 | Configuration version (G-08) | 2 |
| F-04 | Offline operation | Nguyễn Chí Bảo | In progress | `[TEAM: PR]`; TC-F04-02 | 30-min outage run on the prototype (NFR-06); alerts kept until PUBACK (G-07) | 2 |
| F-05 | Self-diagnosis | Trần Minh Kiệt | In progress | `[TEAM: PR]`; TC-F05-01..03 | Board test of misting without humidity rise and of an unplugged sensor, recorded in `firmware/README.md` (G-19) | 2 |
| F-06 | Actuator current check | Trần Minh Kiệt | Planned | — | Board with ADS1115 and shunt resistors on the DC demo loads; firmware; `ACTUATOR_FAULT` (G-13) | 3 |
| F-07 | Alert lifecycle | Nguyễn Vũ Len | In progress | #103; TC-F07-01, 03 | Breach dwell (G-05); event IDs (G-07); `DISMISSED` (G-03) | 2 |
| F-08 | Push and Telegram | Trần Minh Kiệt | In progress | `[TEAM: PR]`; TC-F08-01, 02 | FCM sending and mobile token (G-10) | 2 |
| F-09 | Forecast warning | Nguyễn Chí Bảo | Done | `[TEAM: PR]`; TC-F09-01..03 | — | — |
| F-10 | Counting, return rate | Nguyễn Chí Bảo | In progress | #85, #88, #95; TC-F10-01..03 | Trained model; sessions from buckets; incomplete sessions (G-12) | 2 |
| F-11 | Annotated live stream | Nguyễn Chí Bảo | In progress | #89 (via #95), #93; TC-F11-01..03 | Run against staging (G-17); mobile HLS screen (G-16) | 2 |
| F-12 | Abnormal noise | Nguyễn Chí Bảo | Done | `[TEAM: PR]`; TC-F12-01..03 | — | — |
| F-13 | Expert verdict | Thái Minh Tuấn | In progress | #91; TC-F13-01, 02 | `DISMISSED`, note required, evidence, owner fallback (G-03) | 2 |
| F-14 | Tuning, ring, schedule | Thái Minh Tuấn | In progress | #91; TC-F14-01..03 | Seasonal schedule; ring editor (G-12) | 2 |
| F-15 | Review and suggestions | Thái Minh Tuấn | Planned | TC-F15-01 (suggestion only) | Review items, proposals (G-04) | 2 |
| F-16 | Conclusions, owner notice | Thái Minh Tuấn | In progress | #91; TC-F16-01, 02 | Owner notice of every expert decision; activity history (G-03) | 2 |
| F-17 | Manual override | Nguyễn Vũ Len | In progress | #93, #100, #101; TC-F17-01, 03 | Pump limit, confirmation, per-relay expiry, command freshness (G-06) | 2 |
| F-18 | Farm structure and device registration | Trần Minh Kiệt | In progress | #100; TC-F18-01..03 | Label printing; QR scan in mobile (G-09) | 2 |
| F-19 | Device lifecycle, diagnostics and setup progress | Trần Minh Kiệt | In progress | TC-F19-02 | Device topics and retained configuration (G-07); progress screen (G-09); version (G-08) | 2 |
| F-20 | Daily health status | Nguyễn Thị Yến Nhi | Planned | — | Daily job, levels, weather (G-11) | 2 |
| F-21 | Reports, PDF/CSV | Nguyễn Thị Yến Nhi | In progress | TC-F21-01 | Reports per house (day/week/month); PDF, CSV (G-11) | 3 |
| F-22 | Independent rating | Nguyễn Thị Yến Nhi | Planned | — | Rating route, snapshot, screens (G-11) | 2 |

Summary: 4 Done, 14 In progress, 4 Planned.

## 4. Test Progress (Report 5)

Results count only when they come from a CI run on the tag being reported (Report 5, Section 6). Until the tag `review-2` exists, no committed test case is reported as passed.

| Item | Count |
| --- | --- |
| Committed test cases | 136 |
| Automated, test written | 66 (49 %; the Defense 1.1 bar of 50 % is met once the tests of Iteration 2 are written) |
| Automated, to be written with its feature | 50 |
| Mandatory requirements verified by a committed case | 62 of 102; the other 40 are only traced to their workflow's end-to-end test (Report 5, Section 4.5) |
| Manual (staging, prototype, test house) | 20 |
| Passed on the tag | — (tag not created) |

## 5. Defect List

| ID | Defect | Severity | Found | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| DF-1 | PR #89 (pipeline publishes counts, buckets and heartbeat over MQTT, pushes video to MediaMTX, CI job for pytest) was merged into the branch of PR #88 eleven seconds after #88 itself was merged into `develop`, so none of it reached `develop` | High | 23/10/2026 | Nguyễn Chí Bảo | Closed 23/10/2026 — merged into `develop` by PR #95 |
| DF-2 | Technician and Administrator can edit zone thresholds and fuzzy coefficients; Technician can override relays and acknowledge alerts (Report 3 §2.4) | High | Report 3 review | Trần Minh Kiệt | Closed 24/10/2026 — PR #100 (routes), PR #101 (web buttons) |
| DF-3 | Farm Owner cannot register, move or remove devices (MF-10) | High | Report 3 review | Trần Minh Kiệt | Closed 24/10/2026 — PR #100 |
| DF-4 | Firmware connects to MQTT without TLS; OTA download uses `setInsecure()` | High | Staging design, specification review | Nguyễn Chí Bảo | Open (G-07) |
| DF-5 | Domain Expert web screens fall back to mock data (`services/expert/expertFallback.service.ts`, `data/mocks/`) | Medium | Merge of PR #91 | Thái Minh Tuấn | Open (G-15) |
| DF-6 | `THRESHOLD_BREACH` is raised on the first out-of-range sample, so a controlled humidity dip raises an alert | Medium | Specification review 26/10/2026 | Trần Minh Kiệt | Open (G-05) |

Severity follows Report 5, Section 2.5. Defense 1.1 requires no open Critical or High defect.

## 6. Gaps

Differences between Report 3 / Report 4 and the code. A pull request that closes a gap updates its own row here in the same change (only that row). The first owner named leads the gap and opens its pull request. Work steps per gap: `docs/reports/todo-review2.md`.

| ID | Gap | Requirement / design | Modules | Owner | Due |
| --- | --- | --- | --- | --- | --- |
| G-01 | Shared enumerations: rename `PUMP_DRY` → `MISTING_INEFFECTIVE` and `POWER_OUTAGE` → `UNEXPECTED_RESTART` (with `reset_reason`); add `DISMISSED`, `CONFIG_MISMATCH`, `ACTUATOR_FAULT`; remove `PREDATOR_DETECTED`, Zalo/SMS preferences, the `heating` relay field, device states `ERROR`/`DEGRADED`, harvest state `ARCHIVED`; migration of stored data | THREAT-FR-011, 012, BR-15, Report 3 §6, §8; SDD 6.4 | backend, web, mobile, firmware, `api-spec.yaml`, database script | Trần Minh Kiệt (lead); Len, Tuấn, Nhi (web, mobile types) | Before tag — **closed** by the G-01 pull request (branch `refactor/g01-enum-cleanup`, 29/10/2026) |
| G-02 | Public sign-up still open (`/auth/register` in code and `api-spec.yaml`, sign-up screens on web and mobile); passwordless OTP login (`/auth/otp/send`, `/auth/otp/verify`) remains although it is outside the final SRS; the Administrator cannot create a Farm Owner; an invitee without an account cannot create it from the link; no real e-mail (temporary passwords, password-reset codes and invitations are only logged) | Report 3 §1.2, AUTH-FR-005c, 009, 010; SM-14; Report 4 §3.1 (SMTP) | backend, web, mobile, `api-spec.yaml` | Trần Minh Kiệt (backend); Nguyễn Thị Yến Nhi (web, mobile) | Public sign-up and OTP login removed and account creation from the invitation link built before the tag (backend done 29/10/2026 on `refactor/g02-invitation-accounts`: routes removed, `POST /invitations/{token}/create-account`; web and mobile done 30/10/2026: sign-up page and `/register` removed, account form on the invitation page, OTP sign-in calls removed from mobile); Administrator-created Farm Owner and real e-mail It. 2 |
| G-03 | Expert loop: `DISMISSED` with `previous_status` and required note; owner fallback without an expert (BR-22); owner notice of every expert decision and one activity history (EXPERT-FR-009); evidence of an inferred alert (ALERT-FR-014) | SM-01, EXPERT-FR-003, 009, ALERT-FR-014, BR-22 | backend, web | Trần Minh Kiệt (backend); Thái Minh Tuấn (web) | It. 2 |
| G-04 | Review items and coefficient proposals | EXPERT-FR-010, 011; SM-10, 11 | backend, web | Trần Minh Kiệt (backend); Thái Minh Tuấn (web) | It. 2 |
| G-05 | `THRESHOLD_BREACH` without dwell time; alert details (metric, observed value, threshold, direction, start) | ALERT-FR-012, BR-34 | backend | Trần Minh Kiệt | It. 2 |
| G-06 | Manual override: one expiry per controller instead of per relay; no 30-min pump limit; no confirmation (409); no command freshness | ENV-FR-016…018, BR-08, 20, 35; SDD D15 | backend, firmware, web, mobile | Trần Minh Kiệt (backend); Nguyễn Chí Bảo (firmware); Nguyễn Vũ Len (web, mobile) | It. 2 |
| G-07 | MQTT design: topics per zone instead of per device; shared credential; no `/internal/mqtt-auth` or broker authorisation rule; ESP32 on PubSubClient (QoS 0 only), port 1883 without TLS; no event ID on alerts, no command envelope, no retained configuration; `config/reassign` still used; AI node on house topics; OTA with `setInsecure()` | SDD D3, 5.1, 7.2, 10; FARM-FR-003c, 010, BR-27, 35, NFR-06 c, NFR-10 d | firmware, backend, AI node, deploy | Nguyễn Chí Bảo | It. 2 |
| G-08 | Configuration version and `CONFIG_MISMATCH` | ENV-FR-027, BR-24; SM-12 | firmware, backend | Nguyễn Chí Bảo | It. 2 |
| G-09 | MF-10 screens: label printing in the stock screen, floor code printing, QR scan, AP-mode guide, setup progress; key re-issue of a released device | FARM-FR-010…012, BR-26; AD-10 | web, mobile, backend | Trần Minh Kiệt (backend); Nguyễn Thị Yến Nhi (labels, mobile QR); Nguyễn Vũ Len (floor codes); Thái Minh Tuấn (web setup) | It. 2 |
| G-10 | FCM sending and push tokens | ALERT-FR-002 | backend, mobile | Nguyễn Chí Bảo (backend); Nguyễn Thị Yến Nhi (mobile) | It. 2 |
| G-11 | MF-11: health assessment job, `househealthdays` with current status and rating snapshots, levels per house, house reports (day, week, month), PDF and CSV, weather job, evaluation (agreement, CI, weighted kappa, AC1) | ANALYTICS-FR-012…014, EXPERT-FR-005, 012, 013, BR-28…31, 33; SM-17, AD-14 | backend, web, mobile | Trần Minh Kiệt (backend); Nguyễn Thị Yến Nhi (web, mobile) | It. 2–3 |
| G-12 | Counting: trained one-class model; sessions computed by the backend from buckets per the house schedule; incomplete sessions; AI heartbeat with fps; ring editor screen | VISION-FR-003, 008, 016, 018–020, THREAT-FR-010 | AI node, backend, web | Nguyễn Chí Bảo (AI node, backend); Thái Minh Tuấn (ring editor); Len, Tuấn, Nhi (labelling, clip counts) | It. 2 |
| G-13 | Actuator current sensing on the team's board | THREAT-FR-014, BR-32 | hardware, firmware, backend | Nguyễn Chí Bảo | It. 3 |
| G-14 | Data model behind the ERD: user `status`, audit source fields, harvest type and photo, notification references, telemetry validity fields, per-relay override, alert `metadata` renamed `details` (e.g. `reset_reason`); database script regenerated | SDD 6.1–6.4 | backend | Trần Minh Kiệt | It. 2 |
| G-15 | Web leftovers: Domain Expert screens on mock fallback and outside the FE_Design folder plan; `/stream/:id` routed to the `FarmOwnerLiveStreamPage` stub (Raspberry Pi wording); "PLC" wording; routes, menu and buttons not per Report 3 §2.4 (`OPS_ROLES` lets Admin into `/devices`, `/alerts`, `/farms`, `/onboarding`, `/ota`, `/stream/:id`; `HARVEST_ROLES` includes Admin) | Report 3 §2.4; FE_Design §7, §12, §13.14 | web | Thái Minh Tuấn (expert, Technician); Nguyễn Thị Yến Nhi (role matrix); Nguyễn Vũ Len ("PLC"); Nguyễn Chí Bảo (`/stream/:id`) | It. 2 (role matrix and "PLC" wording done 01/11/2026 on `feat/g15-expert-technician-ui`: one role group per permission, Admin out of farm pages, Domain Expert reads the Farm Owner pages, `/ota` Technician only, Vitest role → path table; "PLC" done by Nhi for Len; `/stream/:id` route and stub page removed 01/11/2026, live view only on `/vision`, no Raspberry Pi wording left; expert screens pending) |
| G-16 | Mobile: login, dashboard, alerts with acknowledge, manual override, QR setup, analytics and HLS live stream, daily status and rating, reports, harvests, expert validation and tuning; screens and buttons per role; socket clean-up | Registration 3.2 b, SDD 5.4 | mobile | Nguyễn Thị Yến Nhi (sign-in, push, QR setup, daily status); Nguyễn Vũ Len (Farm Owner, live stream); Thái Minh Tuấn (expert) | It. 2–3 |
| G-17 | Staging: compose file, Dockerfiles, Caddy, TLS proxy, EMQX authentication and authorisation files, demo seed for every scenario of Appendix A2, backup off the VPS | SDD 3.4, 11 | deploy | Whole team, led by Nguyễn Chí Bảo (Bảo infrastructure, Kiệt backend image, migrations, seed and backup, Len web build, Nhi mobile build, Tuấn E2E runs); scenario conditions and E2E tests by the workflow owners | It. 2 |
| G-18 | Smaller rules: source required for default thresholds (ENV-FR-007); harvest validation (HARVEST-FR-001); optional ENV-FR-026; optional device ID from the MAC address | ENV-FR-007, 026, HARVEST-FR-001 | backend, firmware | Trần Minh Kiệt | It. 3 |
| G-19 | Evidence and field work: sources in `docs/evidence-register.md`, practitioner interviews (BR-01, 02, 28–30), field run of ≥ 14 rated days, hardware test record (NFR-05…07), NFR measurements | REF-5, NFR-04…14 | team | Nguyễn Chí Bảo; labelling and clip counts by Len, Tuấn, Nhi; each NFR by its owner (Report 5 §5) | It. 2–3 |

## 7. Change Log

| Date | Change |
| --- | --- |
| 23/10/2026 | First tracking sheet for Review 2: milestones, Iteration 1 pull requests, feature status, tests, defects |
| 23/10/2026 | After PR #93 (Farm Owner web rework): pull-request counts, F-11 and F-17 |
| 23/10/2026 | After PR #94 (scope filter by farm, house and zone; support requests opened in place): pull-request counts |
| 23/10/2026 | After PR #95 (live pipeline on `develop`): DF-1 closed, F-10 and F-11 updated |
| 24/10/2026 | Tickets, SLA and Technician regions removed from scope (BM03 row 9): F-07, F-17 and DF-2 updated |
| 26/10/2026 | After PR #100–#106 (roles per Report 3 §2.4; tickets, SLA, regions and Admin farm pages removed from the code): DF-2, DF-3 closed; F-03, F-07, F-17, F-18 and the Jest count updated |
| 26/10/2026 | Aligned with SRS 3.1.0 and SDD 1.1.0: this sheet becomes the only progress record (gap list G-01…G-19 replaces the README table and SDD §12); feature evidence column; F-04, F-05, F-17 back to In progress; DF-4 raised to High, DF-6 added; test progress counted on the tag only |
| 27/10/2026 | Work re-split by role: backend code only by Bảo and Kiệt (Bảo also FCM sending and current sensing); Len, Tuấn, Nhi own the web and mobile screens of their role, the E2E tests of their demo scenarios, client-side NFR measurements and the dataset labelling; owners of F-03, F-05, F-06, F-07, F-09, the gaps and DF-6 changed |
| 28/10/2026 | Staging and documents shared by the whole team, led by Bảo: G-17 split per member; each member writes the documents of their own workflows |
| 29/10/2026 | G-01 closed: shared enumerations aligned with SRS 3.1.0 on backend, web, mobile and firmware 1.5.0, `migrate:alert-types` added; F-05 remaining work updated |
| 29/10/2026 | G-02 backend part (before the tag): public sign-up and OTP sign-in removed, account creation from the invitation link added; web and mobile pending |
| 30/10/2026 | G-02 web and mobile part (before the tag): sign-up page, `/register` route and sign-up link removed; the invitation page creates the account and the login page fills in the e-mail; mobile OTP sign-in calls removed. P0 of G-02 done; P1 (Administrator-created Farm Owner, real e-mail) stays for It. 2 |
| 01/11/2026 | G-15 role matrix and "PLC" wording: routes, menus and buttons per Report 3 §2.4 (`OPS_ROLES` replaced; Administrator no longer reaches `/devices`, `/alerts`, `/farms`, `/harvests`, `/onboarding`, `/ota`; Domain Expert reads `/dashboard`, `/analytics`, `/vision`, `/farms`, `/devices`, `/harvests` without write buttons; `/ota` Technician only); the controller is called "Bộ điều khiển" (Len's step, done by Nhi on Len's request) |
| 01/11/2026 | G-15 `/stream/:id`: the route and the `FarmOwnerLiveStreamPage` stub are removed, the Farm Owner and the Domain Expert watch the annotated stream on `/vision` (WHEP, 60-second token); no Raspberry Pi wording is left on the web |
