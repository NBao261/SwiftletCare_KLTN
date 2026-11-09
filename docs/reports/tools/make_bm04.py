"""Fill form BM04 (Review 2 Commitment).

Usage (repository root): python3 docs/reports/tools/make_bm04.py

Workflows, features and demo scenarios follow the Design Brief (BM01, Appendix A); every count is
computed from docs/reports/report5/tc.py, so sections 6-8 always equal Report 5. A test case is
counted for one member and one workflow only (ALLOCATION below). Signatures, the reviewers' names,
the reviewers' verification and the conclusion are left blank for the review board.
"""
import copy, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPORTS = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPORTS, 'report5'))
import docx
from docx.shared import Pt
from docxfill import set_cell, fill_table, set_kv, drop_grey
from tc import TC, WF, ST, NFR, SUPPORTING

B, K, L, N, T = 'Nguyễn Chí Bảo', 'Trần Minh Kiệt', 'Nguyễn Vũ Len', 'Nguyễn Thị Yến Nhi', 'Thái Minh Tuấn'
FO, FT, DE = 'Farm Owner', 'Farm Technician', 'Domain Expert'

# ---- allocation: each committed case belongs to one workflow and one member ----
FEATURES = [  # id, name, actors, acceptance criteria, workflows, owner (Project Tracking)
    ('F-01', 'Telemetry and live dashboard', f'{FO}, {DE}', 'A reading reaches the dashboard within 2 s; a sensor without data is shown stale; a user of another farm receives no event', ['WF-01'], B),
    ('F-02', 'Fuzzy control', 'Controller (automatic)', 'One decision every 10 s ± 1 s; firmware and backend give the same output on the shared cases', ['WF-01'], B),
    ('F-03', 'Thresholds and fuzzy coefficients', f'{DE}, {FO}', 'Every change kept in the history and sent to the controllers; out of range 400; Administrator 403', ['WF-05'], B),
    ('F-04', 'Offline operation', 'Controller (automatic)', 'During a 30-min Internet outage no decision and no sample is lost; the buffer is uploaded on reconnection', ['WF-01'], B),
    ('F-05', 'Self-diagnosis', 'Controller (automatic)', 'Pump ON 300 s without a 2-point humidity rise raises MISTING_INEFFECTIVE', ['WF-02'], K),
    ('F-06', 'Actuator current check', 'Controller (automatic)', 'Relay ON with a current below 50 % of normal for 30 s raises ACTUATOR_FAULT', ['WF-02'], K),
    ('F-07', 'Alert lifecycle', f'{FT}, {FO}', 'Repeats of an incident merge into one alert; 10 min out of range raises a breach; acknowledging a resolved alert gives 409', ['WF-02'], L),
    ('F-08', 'Push and Telegram', f'{FT}, {FO}', 'A CRITICAL alert arrives on both channels within 5 s; nothing is sent after sign-out', ['WF-02'], K),
    ('F-09', 'Forecast warning', 'Backend (automatic)', 'A forecast crossing within 60 min raises FORECAST_BREACH', ['WF-02'], B),
    ('F-10', 'Counting and return rate', 'AI node, backend (automatic)', 'Counts stored per house and session; a drop beyond the house limit raises one LOW_RETURN_RATE', ['WF-03'], B),
    ('F-11', 'Annotated live stream', f'{FO}, {DE}', 'A box on each tracked bird; a 60-s stream token; users of other farms get 403', ['WF-03'], B),
    ('F-12', 'Abnormal noise', 'Controller (automatic)', '+20 dB over the hourly baseline for 12 s of 15 raises NOISE_ANOMALY', ['WF-04'], B),
    ('F-13', 'On-site check and expert verdict', f'{FT}, {DE}', "Technician's observation in the alert evidence; rejection without a note 422, with a note DISMISSED", ['WF-04'], T),
    ('F-14', 'Tuning, counting ring, schedule', f'{DE}, {FT}', 'History kept; a value out of range 400; a ring of 13 vertices 422', ['WF-03', 'WF-05'], T),
    ('F-15', 'Review items and suggestions', f'{DE}, {FO}', "An owner's change opens a review item; an owner applying a suggestion on a farm with an expert gets 403", ['WF-05'], T),
    ('F-16', 'Conclusions and owner notices', f'{DE}, {FO}', 'Each expert decision notifies every Farm Owner of the farm', ['WF-04'], T),
    ('F-17', 'Manual override', f'{FO}, {FT}', 'Each relay keeps its own expiry and returns to AUTO; pump ON for 31 min 422', ['WF-01'], L),
    ('F-20', 'Daily health status', 'Backend (automatic)', 'Return rate CLEAR and humidity SLIGHT give ACTION with both reasons', ['WF-06'], N),
    ('F-21', 'Reports, PDF and CSV', f'{FO}, {DE}', 'Daily, weekly and monthly report per house; the files show the same figures as the screen', ['WF-06'], N),
    ('F-22', 'Independent rating and disagreement review', f'{FT}, {FO}, {DE}', 'The day is rated on site before the status is shown; the expert reviews the days that disagree', ['WF-06'], N),
    ('F-23', 'Alert routing and escalation', f'{FT}, {FO}', 'A HIGH alert goes to the technician of the house, to the Farm Owners after 15 min without acknowledgement', ['WF-02'], K),
    ('F-24', 'Work Orders closed by the data', f'{FT}, {FO}', 'Closes only after 10 min of recovered data and the Farm Owner’s approval', ['WF-02'], K),
    ('F-25', 'Preventive maintenance', f'{FT}, {FO}', 'A 500 h pump plan becomes due and opens a Work Order; the record resets the counter', ['WF-07'], L),
    ('F-26', 'Weather compensation of misting', f'Backend, controller; {DE}', 'A +5-point rule turns a 40 % target into 45 %; 0 after expiry or offline; 12 points 400', ['WF-01'], B),
    ('F-27', 'Recommendation rules', f'{DE}, {FO}', 'A rule met raises one recommendation with evidence; its effect is measured after 7 days', ['WF-08'], T),
    ('F-28', 'Configuration profiles and house stage', f'{DE}, {FO}', 'Applying a profile creates new configuration versions; an attracting house is rated without the return rate', ['WF-05'], T),
    ('F-29', 'Farm overview and house comparison', FO, 'Cells follow BR-44; 1 A × 12 V × 10 h = 0.12 kWh', ['WF-06'], N),
]
FEAT = {f[0]: f for f in FEATURES}
COUNT_IN = {f[0]: f[4][-1] for f in FEATURES}  # F-14 is counted in WF-05, listed in WF-03 too
ST_MAP = {'6.1 Alert': ('WF-02', L), '6.2 ExpertVerdict': ('WF-04', T), '6.3 Controller relay': ('WF-01', L),
          '6.6 Controller/CameraNode': ('WF-01', K), '6.16 DeviceStockItem': ('WF-03', K), '6.12 Controller config': ('WF-05', B),
          '6.10 ReviewItem': ('WF-05', T), '6.11 CoefficientProposal': ('WF-05', T), '6.17 DailyHealthStatus': ('WF-06', N),
          '6.18 DailyRating': ('WF-06', N), '6.9 HealthReport': ('WF-06', N), '6.19 WorkOrder': ('WF-02', K),
          '6.20 MaintenancePlan': ('WF-07', L), '6.21 Recommendation': ('WF-08', T)}
NFR_MAP = {'NFR-01': ('WF-01', N), 'NFR-06': ('WF-01', B), 'NFR-02': ('WF-02', L), 'NFR-15': ('WF-02', K),
           'NFR-09': ('WF-03', B), 'NFR-13': ('WF-05', T), 'NFR-14': ('WF-06', N)}


def kind(src):
    if isinstance(src, list):
        ks = [kind(s) for s in src]
        return 'todo' if 'todo' in ks else ks[0]
    return {'jest': 'auto', 'pio': 'auto', 'pytest': 'auto', 'todo-auto': 'todo', 'manual': 'manual'}[src[0]]


CASES = []  # (id, type, workflow, member, kind)
for t in TC:
    if t[1] not in SUPPORTING:
        CASES.append((t[0], 'feature', COUNT_IN[t[1]], FEAT[t[1]][5], kind(t[6])))
WF_OWNER = {'WF-01': B, 'WF-02': L, 'WF-03': B, 'WF-04': T, 'WF-05': K, 'WF-06': N, 'WF-07': L, 'WF-08': T}
for w, ds in WF:
    CASES.append(('TC-' + w, 'e2e', w, WF_OWNER[w], 'manual'))
for i, s in enumerate(ST, 1):
    w, m = ST_MAP[s[0]]
    CASES.append((f'TC-ST-{i:02d}', 'st', w, m, kind(s[4])))
for n in NFR:
    w, m = NFR_MAP[n[0]]
    CASES.append(('TC-' + n[0], 'nfr', w, m, kind(n[3])))
assert len(CASES) == 170 and len({c[0] for c in CASES}) == 170, len(CASES)


def count(**k):
    c = [x for x in CASES if all(x[{'ty': 1, 'wf': 2, 'm': 3}[a]] == v for a, v in k.items())]
    return len(c), sum(1 for x in c if x[4] != 'manual'), sorted({x[3] for x in c})


TOTAL, AUTO, _ = count()


def ranges(ids):
    """['TC-ST-01', 'TC-ST-02', 'TC-ST-05'] -> '01…02, 05'"""
    ns, out = sorted(int(i[-2:]) for i in ids), []
    for n in ns:
        if out and n == out[-1][1] + 1: out[-1][1] = n
        else: out.append([n, n])
    return ', '.join(f'{a:02d}' if a == b else f'{a:02d}…{b:02d}' for a, b in out)

# ---- workflows (Design Brief A1, A2) ----
WORKFLOWS = [
    ('WF-01', 'Automatic micro-climate control (MF-01)', B, [L, K], f'{FO}, {FT}',
     '10-s control cycle; a new forecast; loss of the Internet, a controller hang or a power loss; a relay switched by hand',
     'Misting and fan follow humidity and temperature, with the bounded weather offset, also offline; an override lasts a limited time and returns to automatic',
     'Controller relay: AUTO → MANUAL → AUTO; Controller: ONLINE → OFFLINE → ONLINE', 'Report 4 §9.1 (AD-01)',
     [('DS-01', 'Main', 'Zone with a controller online; humidity below humidity_min', 'Watch the dashboard; cut the router uplink for 5 min and reconnect; the Farm Owner forces the pump ON for 1 min', 'Misting power rises within one cycle; relays keep switching offline, no gap after reconnection; relay MANUAL, then AUTO after 1 min, override in the history'),
      ('DS-02', 'Exception', 'Same zone; a SENSOR_FAULT open', 'Pump ON for 31 min; pump ON without confirming the alert; the Domain Expert tries an override', '422; 409; 403; relay stays AUTO')]),
    ('WF-02', 'Incident handling (MF-02)', L, [K, N], f'{FT}, {FO}',
     'A breach after the dwell time, NH3/CO2 above the limit, an equipment fault, an unexpected restart, a device offline, a forecast crossing',
     'The alert reaches the technician of the house and escalates to the Farm Owner; the fault is repaired as a Work Order closed by the data; the loop is held safe',
     'Alert: ACTIVE → ACKNOWLEDGED → RESOLVED; WorkOrder: OPEN → IN_PROGRESS → VERIFYING → AWAITING_APPROVAL → CLOSED', 'Report 4 §9.2 (AD-02)',
     [('DS-03', 'Main', 'House with a technician; pump tank emptied (or simulated MISTING_INEFFECTIVE)', 'The technician receives push and Telegram and does not acknowledge for 15 min; then repairs, records the cause and a photo; the Farm Owner approves', 'Farm Owner notified after 15 min; Work Order OPEN → VERIFYING → AWAITING_APPROVAL after 10 min recovered → CLOSED; MTTR shown'),
      ('DS-04', 'Exception', 'Work Order VERIFYING', 'Misting fails again during verification; a technician of another house tries to acknowledge', 'Work Order back to IN_PROGRESS; 403')]),
    ('WF-03', 'Bird counting session (MF-03)', B, [L, T], f'{FT}, {DE}',
     'Morning and evening sessions of the house schedule; the counting ring drawn on site; the seasonal schedule set by the expert',
     'Counts and return rate of the house; an alert on an abnormal drop; annotated live stream',
     'CameraNode: PENDING → ONLINE; Alert LOW_RETURN_RATE: ACTIVE → RESOLVED', 'Report 4 §9.3 (AD-03)',
     [('DS-05', 'Main', 'AI node online; 7 seeded days of counts', 'Play a recorded entrance clip through the AI node during a session window', 'Counts of the house rise on the page; the live stream shows boxes; the next return-rate check raises LOW_RETURN_RATE for the seeded drop'),
      ('DS-06', 'Exception', 'Session in progress', 'Stop the AI node', 'EDGE_AI_DEGRADED after 90 s; the day is incomplete and not evaluated')]),
    ('WF-04', 'Expert validation of inferred alerts (MF-04)', T, [K, L], f'{FT} (on-site check), {DE} (verdict; {FO} on a farm without an expert, BR-22)',
     'An inferred alert: abnormal noise, implausible sensor behaviour, early warning, return-rate drop',
     'The technician checks the house on site; the expert confirms or rejects with a note; a rejected alert is dismissed; the Farm Owner is notified of every verdict',
     'Alert: ACTIVE → DISMISSED; ExpertVerdict: pending → REJECTED', 'Report 4 §9.4 (AD-04)',
     [('DS-07', 'Main', 'Speaker off; seeded hourly baseline', 'Play loud noise near the sensor for the sustain period; the technician checks the house on site; the expert rejects with a note', "NOISE_ANOMALY shown with bird counts; the technician's observation in the evidence; status DISMISSED, Farm Owner notified"),
      ('DS-08', 'Exception', 'Farm with a Domain Expert', 'The Farm Owner tries to record a verdict', '403')]),
    ('WF-05', 'Control-parameter tuning (MF-05)', K, [T, B], f'{DE}, {FO}, {FT} (counting ring)',
     "The Farm Owner's change of a threshold or coefficient; a coefficient suggestion; a configuration profile; a change of detection parameters or counting ring",
     'Changes reviewed, the suggestion approved, profiles applied; the new configuration version applied on the controllers and the AI node; the Farm Owner notified',
     'ReviewItem: PENDING_REVIEW → ADJUSTED; CoefficientProposal: PROPOSED → APPROVED; Controller configuration: PENDING → APPLIED', 'Report 4 §9.5 (AD-05)',
     [('DS-09', 'Main', 'Farm with an expert; a pending suggestion', 'The Farm Owner changes a threshold and submits the suggestion; the expert adjusts the change and approves the suggestion', 'Review item ADJUSTED, proposal APPROVED, configuration applied on the controllers, Farm Owner notified of each decision'),
      ('DS-10', 'Exception', 'Same farm', 'The Farm Owner applies the suggestion directly', '403; coefficients unchanged')]),
    ('WF-06', 'Daily health assessment and periodic reports (MF-06)', N, [K, L], f'{FT}, {FO} (ratings), {DE} (disagreement review, levels, conclusions)',
     'End of each day after the evening session; every week; every month',
     'A daily status per house with its reasons; the day rated on site before the status is seen; reports downloaded and concluded; houses compared',
     'DailyHealthStatus: (new) → COMPUTED; DailyRating: PENDING → RATED; HealthReport: GENERATED → CONCLUDED', 'Report 4 §9.6 (AD-06)',
     [('DS-11', 'Main', 'Seeded day: return rate CLEAR, humidity SLIGHT', 'Run the daily job; the technician rates the day on site; download PDF and CSV', 'Status ACTION with both reasons; rating asked before the status; the files show the same figures'),
      ('DS-12', 'Exception', 'Seeded day with an incomplete evening session', 'Run the daily job', 'INSUFFICIENT_DATA, never GOOD; the reason names the missing session')]),
    ('WF-07', 'Preventive maintenance (MF-07)', L, [K, N], f'{FO}, {FT}',
     'A maintenance plan falls due by run hours, switch count or calendar',
     'A preventive Work Order done with its checklist and photos; the counter reset and the next due point set; an overdue plan escalated',
     'MaintenancePlan: SCHEDULED → DUE → SCHEDULED; WorkOrder: OPEN → CLOSED', 'Report 4 §9.7 (AD-07)',
     [('DS-13', 'Main', 'Pump plan of 500 h; counter seeded at 499 h', 'Run the pump 1 h; the technician follows the checklist and records it', 'MAINTENANCE_DUE and a preventive Work Order; counter reset, next due point shown'),
      ('DS-14', 'Exception', 'Plan due for 7 days', 'Run the due job; answer a checklist item "defect"', 'Plan OVERDUE, Farm Owner notified; repair Work Order opened')]),
    ('WF-08', 'Recommendation loop (MF-08)', T, [B, K], f'{DE}, {FO}, {FT}',
     "An active recommendation rule of the Domain Expert holds for a house",
     'A recommendation with its evidence accepted (Work Order or proposed parameter change) or rejected with a reason; its effect measured after 7 days',
     'Recommendation: OPEN → ACCEPTED → MEASURED', 'Report 4 §9.8 (AD-08)',
     [('DS-15', 'Main', 'Rule "NH3 above the limit 4 h a day for 3 days"; seeded days', 'Run the daily job; the Farm Owner accepts; run the effect job on the seeded later days', 'Recommendation with evidence; Work Order created; effect shown on the rule page'),
      ('DS-16', 'Exception', 'Open recommendation', 'The Farm Owner rejects without a reason; 7 days pass', '422; then EXPIRED')]),
]
assert [w[0] for w in WORKFLOWS] == [w for w, _ in WF]

NFRS = [  # Design Brief section 7, owner = NFR_MAP
    ('NFR-01', 'Performance', 'Sensor publish → dashboard', 'P95 ≤ 2 s', '200 messages on staging; Socket.io client times'),
    ('NFR-02', 'Performance', 'Alert → app, push, Telegram', 'P95 ≤ 5 s per channel', '30 injected alerts on staging'),
    ('NFR-06', 'Reliability', 'Decisions kept; data lost offline', '100 %; 0 in 30 min', 'Router uplink cut on the prototype'),
    ('NFR-09', 'Accuracy', 'Detection precision, recall; count error', '≥ 0.80; ≤ 10 %', 'Days kept out of training, per lighting'),
    ('NFR-13', 'Usability', 'Power-on → "configuration applied"', '≤ 10 min for 5 of 5 users', '5 first-time users, stopwatch'),
    ('NFR-14', 'Accuracy', 'Agreement of ratings and daily status', '≥ 70 % with its 95 % CI', '≥ 14 rated days in the test house'),
    ('NFR-15', 'Performance', 'Escalation and recovery verification delay', 'P95 ≤ 60 s', 'Device simulator on staging'),
]
assert sorted(n[0] for n in NFRS) == sorted(n[0] for n in NFR)

OUT_OF_SCOPE = [
    ('Predator detection, bird-call classification, audio recording', 'One vision class (swiftlet); the noise sensor gives a level in dB only'),
    ('Heating and light actuators; fan driven by NH3/CO2 or by the weather', 'No equipment in the prototype; no established limits; the weather only shifts misting within BR-38'),
    ('Marketplace, buyer role, nest trading, yield prediction', 'Removed after Review 1; too few seasons of data; harvests are recorded per cycle only (SF-06)'),
    ('External service providers, regions, job queues, chat, contracts, payroll', 'Platform and human-resources functions (Review 1); Work Orders stay inside the owner’s organisation'),
    ('Public sign-up; several unrelated owners on one installation; Google sign-in, two-factor authentication', 'One installation serves one owner (BM03 row 10); not in the registration form'),
    ('Zalo and SMS notifications', 'Replaced by mobile push and the Telegram bot'),
    ('Bypass switches; camera settings, PTZ, cloud video; app-store publication; 24/7 production operation', 'Borrowed test house cannot be rewired; one fixed camera setup; internal build; prototype and staging only'),
]

FIXES = [  # id, item, workflow, owner, due  (Review 2 feedback, then BM02 Planned items; one owner each)
    ('RV-01', 'Review 2 – scope small for five members: Farm Technician on assigned houses, alert routing and escalation, Work Orders closed by the data (BM03 row 13; G-20, G-21)', 'WF-02', K, '02/12/2026'),
    ('RV-02', 'Review 2 – maintenance only reactive: preventive maintenance plans by run hours, switch count and calendar, with checklists (BM03 row 14; G-22)', 'WF-07', K, '23/12/2026'),
    ('RV-03', 'Review 2 – monitoring only displays data: recommendation rules with measured effect; configuration profiles and house stage (BM03 rows 15, 17; G-24)', 'WF-08, WF-05', B, '23/12/2026'),
    ('RV-04', 'Review 2 – control judged simple: weather compensation of misting within ±10 points, at most 2 h, zero offline, rules approved by the expert (BM03 row 4; G-23)', 'WF-01', B, '02/12/2026'),
    ('RV-05', 'Review 2 – one house cannot show the business: farm overview, house comparison, energy estimate and device simulator (BM03 rows 17, 18; G-25, G-27)', 'WF-06', B, '23/12/2026'),
    ('RV-06', 'Review 2 – abnormal sound is the hard part: no panic classification is claimed; NOISE_ANOMALY stays an inferred alert, checked on site by the Farm Technician and validated by the expert (EXPERT-FR-021; G-21)', 'WF-04', K, '02/12/2026'),
    ('RV-07', 'Review 2 discussion – return-rate alert with the rainfall of the session; weekly and monthly flock trend (BM03 row 19; G-25)', 'WF-03', B, '23/12/2026'),
    ('S-02', 'Trace ENV-FR-013c to the Farm Owner items of the form (Report 3 §7.1)', 'SF-02', B, '11/11/2026'),
    ('S-03', 'FARM-FR-003c: the AP-mode page asks only for Wi-Fi; the broker address is set at flashing (BR-27)', 'SF-01', B, '11/11/2026'),
    ('R-01', 'Add "Team (evaluation)" to the actor table of Report 3 §2.3', 'WF-03, WF-06', B, '11/11/2026'),
    ('R-02', 'Add "All users" and "Invitee" to the actor table of Report 3 §2.3', 'SF-03', B, '11/11/2026'),
    ('R-03', 'Write the maximum number of chart points per range into ANALYTICS-FR-001', 'WF-01', B, '11/11/2026'),
    ('R-04', 'State the learning length of THREAT-FR-007 and §6.8 as a sample count', 'WF-04', B, '11/11/2026'),
    ('R-05', 'Testable criteria for THREAT-FR-005, ANALYTICS-FR-005 and AUTH-FR-012 (30-day limit)', 'WF-04, WF-01, SF-03', B, '11/11/2026'),
    ('D-01', 'Collections househealthdays, househealthreports, weatherobservations, pushtokens (G-14, G-11, G-10)', 'WF-06, WF-02', K, '02/12/2026'),
    ('D-02', 'Remove the zonehealthreports model after its migration (G-14)', 'WF-06', K, '02/12/2026'),
    ('D-03', 'Control attributes of the ERD in the schema: configuration version, per-relay state, baseline, event ID, validity fields (G-14)', 'WF-01, WF-02', K, '02/12/2026'),
    ('D-04a', 'Counting fields: counting schedule, session window, complete, fps (G-12)', 'WF-03', B, '02/12/2026'),
    ('D-04b', 'House health_levels (G-11)', 'WF-06', K, '02/12/2026'),
    ('D-05a', 'Field names aligned with the ERD: user status, device keys, audit fields (G-14)', 'SF-03, SF-01', K, '02/12/2026'),
    ('D-05b', 'default_threshold_history (G-18)', 'SF-05', K, '23/12/2026'),
    ('D-06', 'Unique indexes telemetries(node_id, timestamp) and partial alerts(node_id, event_id) (G-14)', 'WF-01, WF-02', K, '02/12/2026'),
    ('D-07', 'Enumerations aligned with the ERD; TECHNICIAN replaced by FARM_TECHNICIAN (G-14, G-20)', 'WF-02', K, '02/12/2026'),
    ('ST-01', 'Restore transition DECOMMISSIONED → previous state within 24 h in SM-06 (Report 3 §6.6, Report 4 §8.6)', 'SF-02', B, '11/11/2026'),
    ('ST-02', 'Per-relay mode and expiry; end reasons as in ENV-FR-019 (G-06)', 'WF-01', K, '02/12/2026'),
    ('ST-03a', 'SM-12 starts at PENDING; UNKNOWN exits to APPLIED (Report 3 §6.12, Report 4 §8.12)', 'WF-05', B, '11/11/2026'),
    ('ST-03b', 'Configuration version in code (G-08)', 'WF-05', B, '02/12/2026'),
    ('ST-04', 'User status field (G-14)', 'SF-03', K, '02/12/2026'),
    ('ST-05', 'Key re-issue of a released device (G-09)', 'SF-01', K, '02/12/2026'),
    ('ST-06', 'Name the triggering FR on every transition label of Report 4 §8', 'All', B, '11/11/2026'),
    ('ST-07', 'Add "any → not evaluated" to SM-08 (Report 4 §8.8)', 'WF-04', B, '11/11/2026'),
    ('F-01a', 'Daily status and ratings with their tests (G-11)', 'WF-06', K, '02/12/2026'),
    ('F-01b', 'Daily, weekly and monthly reports per house (G-11)', 'WF-06', K, '23/12/2026'),
    ('F-02', 'Configuration version and CONFIG_MISMATCH (G-08); counting schedule (G-12), with their tests', 'WF-05, WF-03', B, '02/12/2026'),
    ('F-03', 'Sessions from buckets, incomplete sessions, trained model, NFR-09 measurement (G-12)', 'WF-03', B, '02/12/2026'),
    ('F-04a', 'FCM sending (G-10) and event IDs (G-07)', 'WF-02', B, '02/12/2026'),
    ('F-04b', 'ACTUATOR_FAULT with the current-sensing board (G-13)', 'WF-02', B, '23/12/2026'),
    ('F-05', 'QoS 1 upload kept until PUBACK; native test of StorageManager (G-07)', 'WF-01', B, '02/12/2026'),
    ('F-06a', 'QR scan of label and floor in the mobile app (G-09)', 'SF-01', L, '02/12/2026'),
    ('F-06b', 'Label and floor-code printing on the web (G-09)', 'SF-01', N, '02/12/2026'),
    ('F-07', 'Staging compose and Nginx (G-17); TC-WF-01…08 run there by the workflow owners', 'All', B, '02/12/2026'),
    ('A-01', 'mDNS broker discovery named as a development aid in Report 4 §3.3', 'SF-01', B, '11/11/2026'),
    ('A-02', 'Register the FCM device token as in Report 4 §5.4 (G-10)', 'WF-02', L, '02/12/2026'),
    ('A-03a', 'E-mail service in the Report 4 §2.1 diagram', 'SF-03', B, '11/11/2026'),
    ('A-03b', 'Real e-mail sending (G-02)', 'SF-03', K, '02/12/2026'),
    ('A-04a', '/internal/mqtt-auth, device TLS, Nginx and Certbot (G-07, G-17)', 'WF-01', B, '02/12/2026'),
    ('A-04b', 'Open-Meteo weather job (G-11)', 'WF-06', K, '02/12/2026'),
    ('A-04c', 'ADS1115 current sensing in the firmware (G-13)', 'WF-02', B, '23/12/2026'),
    ('A-05', 'Remove the unused speakeasy and qrcode packages from the backend', 'SF-03', B, '11/11/2026'),
    ('A-06a', 'Mobile library versions in Report 4 §3.2 from mobile/package.json', 'All', B, '11/11/2026'),
    ('A-06b', 'esp-mqtt and ADS1X15 in the firmware (G-07, G-13)', 'WF-01', B, '02/12/2026'),
    ('A-07', 'List expertReview, tuningSuggestion, alertEvidence, storage, deletionRequestReminder in Report 4 §5.3', 'WF-04, WF-05', B, '11/11/2026'),
    ('C-01', 'Device topics, per-device credential, config/reassign removed, identity kept only in the backend (G-07)', 'WF-01, SF-01', B, '02/12/2026'),
    ('C-02', 'FARM_TECHNICIAN on assigned houses replaces TECHNICIAN; remote commands for the Administrator; Administrator creates Farm Owner accounts (G-20, G-02)', 'WF-02, SF-02, SF-03', K, '02/12/2026'),
    ('C-03', 'Pump limit, confirmation (409), command freshness and the constants of Report 4 §5.5 (G-06)', 'WF-01', K, '02/12/2026'),
    ('C-04', 'Daily, weekly and monthly reports per house (EXPERT-FR-005, BR-33; G-11)', 'WF-06', K, '23/12/2026'),
    ('C-05', 'Source required and history of default thresholds (ENV-FR-007; G-18)', 'SF-05', K, '23/12/2026'),
]
assert len({f[0] for f in FIXES}) == len(FIXES)

MEMBERS = [  # name, student code, role, modules/entities, decisions, documentation kept current
    (B, 'SE183383', 'Leader; IoT and AI', 'Firmware (controller, weather offset); AI pipeline (AI node); backend of bird counting, configuration sync, knowledge rules, farm overview, harvest cycles; device simulator; staging. Entities: Controller configuration, CameraNode, BirdCountRecord, ConfigProfile, RecommendationRule, Recommendation, HarvestCycle', 'D1, D2', 'Reports 1–5 and Project Tracking (editor); Report 4 §2–4, §8'),
    (K, 'SE182180', 'Backend', 'Backend of devices, accounts, alerts, the expert module, daily health and operations (routing, Work Orders, maintenance plans). Entities: Device, DeviceStockItem, Alert, ReviewItem, CoefficientProposal, HouseHealthDay, WorkOrder, MaintenancePlan', 'D4, D6', 'Report 4 §5–6 (backend, data model, database script)'),
    (L, 'SE182055', 'Mobile', 'Mobile app for the Farm Owner and the Farm Technician: alerts, manual override, Work Orders, checklists, QR setup, counting ring, daily rating, push token', '—', 'Report 4 §9.2, §9.7 (AD-02, AD-07)'),
    (N, 'SE184223', 'Web: Farm Owner, Administrator', 'Web for the Farm Owner and the Administrator: overview, house comparison, daily status, reports PDF/CSV, Work Order approval, maintenance plans, harvest cycles, labels', 'D5', 'Report 4 §9.6 (AD-06)'),
    (T, 'SE181850', 'Web: Domain Expert', 'Web for the Domain Expert: verdicts, tuning, review items, suggestions, profiles, recommendation and weather rules, counting ring, season conclusions; Administrator device console', 'D3', 'Report 4 §9.4, §9.5, §9.8 (AD-04, AD-05, AD-08)'),
]
NFR_OWNER = {m: [n for n, (w, o) in NFR_MAP.items() if o == m] for m, *_ in MEMBERS}
DUE = '23/12/2026 (end of Iteration 3, before Defense 1.1)'

# ---- build ----
d = docx.Document(os.path.join(REPORTS, 'templates', 'SWP490_R2_BM04_Review2_Commitment.docx'))
body = d.element.body


def heading(text):
    return next(p for p in d.paragraphs if p.text.strip().startswith(text))


def block(start_text, end_text):
    """Body elements from the paragraph starting with start_text up to (not including) end_text."""
    els, on = [], False
    for el in body.iterchildren():
        if el is heading(start_text)._p: on = True
        if on and el is heading(end_text)._p: break
        if on: els.append(el)
    return els


# eight workflow blocks: copy block 6.5 three times
src = block('6.5 Workflow WF-05', '7. Individual Commitments')
anchor = heading('7. Individual Commitments')._p
for n in (6, 7, 8):
    for el in src:
        anchor.addprevious(copy.deepcopy(el))
# rename the copied headings and the demo IDs
wf_heads = [p for p in d.paragraphs if p.text.strip().startswith('6.') and 'Workflow WF-' in p.text]
assert len(wf_heads) == 8, len(wf_heads)
for i, p in enumerate(wf_heads, 1):
    for r in p.runs[1:]: r._r.getparent().remove(r._r)
    p.runs[0].text = f'6.{i} Workflow WF-{i:02d}'

mem_heads = [p for p in d.paragraphs if p.text.strip().startswith('7.') and 'Member' in p.text]
assert len(mem_heads) == 5, len(mem_heads)
for i, p in enumerate(mem_heads):
    for r in p.runs[1:]: r._r.getparent().remove(r._r)
    p.runs[0].text = f'7.{i + 1} {[B, K, L, N, T][i]}'
drop_grey(d)
tb = d.tables
set_kv(tb[0], {'Project code': 'FA26SE158',
               'Project name': 'SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming',
               'Team': f'{B} (Leader), {K}, {L}, {N}, {T}', 'Supervisor': 'Nguyễn Văn Chiến, Trương Long',
               'Review 2 date': '04/11/2026', 'Reviewer 1': '', 'Reviewer 2': '', 'Version': '1.0', 'Date': '09/11/2026'})
set_kv(tb[1], {'Final version': 'Registration form v3 (final) with BM03 Record of Changes 1.3 (rows 1–19); Report 3 SRS 4.2.0, Report 4 SDD 2.2.0, Report 5 1.5.0, Design Brief 2.0',
               'Approved at Review 2 (Yes/No)': 'Yes – final scope agreed with the supervisor on 09/11/2026 after the Review 2 feedback; confirmed by the signatures in section 11',
               'Attached file name': 'SWP490_FA26SE158_R2_Registration.pdf (registration form v3 + BM03)'})
fill_table(tb[2], [(f[0], f[1], f[2], f[3], ', '.join(f[4]), f[5]) for f in FEATURES])
fill_table(tb[3], [(n[0], n[1], n[2], n[3], n[4], NFR_MAP[n[0]][1]) for n in NFRS])
fill_table(tb[4], OUT_OF_SCOPE)

ti = 5
for w in WORKFLOWS:
    wid, name, owner, supp, actors, trig, outcome, states, ad, ds = w
    set_kv(tb[ti], {'Workflow name': name, 'Owner (one member)': owner, 'Supporting members': ', '.join(supp),
                    'Actors': actors, 'Trigger': trig, 'Business outcome': outcome, 'Main entity state path': states,
                    'Activity diagram (Report 4 section)': ad})
    rows = []
    for f in FEATURES:
        if wid in f[4]:
            n = int(f[0][2:])
            ids = f'TC-F{n:02d}-01…03' + ('' if COUNT_IN[f[0]] == wid else f' (counted in {COUNT_IN[f[0]]})')
            rows.append((f[0], f[1], f[3], ids))
    fill_table(tb[ti + 1], rows)
    fill_table(tb[ti + 2], [(i, ty, pre, steps, exp, owner) for i, ty, pre, steps, exp in ds])
    fc, fa, fm = count(wf=wid, ty='feature'); ec, ea, em = count(wf=wid, ty='e2e')
    sc, sa, sm = count(wf=wid, ty='st'); nc, na, nm = count(wf=wid, ty='nfr'); tc_, ta, tm = count(wf=wid)
    st_ids = [c[0] for c in CASES if c[2] == wid and c[1] == 'st']
    nfr_ids = [c[0] for c in CASES if c[2] == wid and c[1] == 'nfr']
    rows = [('Feature tests (≥ 3 per feature)', str(fc), str(fa), ', '.join(fm)),
            ('End-to-end workflow test (≥ 1)', f'{ec} (TC-{wid})', f'{ea} (manual on staging)', ', '.join(em)),
            ('State transition tests (≥ 1 per transition)', f'{sc} (TC-ST-{ranges(st_ids)})', str(sa), ', '.join(sm))]
    if nc: rows.append(('NFR tests', f'{nc} ({", ".join(nfr_ids)})', f'{na} (measured on staging, prototype or test house)', ', '.join(nm)))
    rows.append(('Total for this workflow', str(tc_), f'{ta} ({100 * ta // tc_} %)', ', '.join(tm)))
    fill_table(tb[ti + 3], rows)
    set_kv(tb[ti + 4], {'Exception scenarios passing': f'1 of 1 ({ds[1][0]})', 'Test pass rate for this workflow': '≥ 90 %; 100 % of the main-path feature tests'})
    ti += 6

for m, code, role, modules, dec, docs_ in MEMBERS:
    set_kv(tb[ti], {'Full name': m, 'Student ID': code, 'Role in team': role})
    owned_wf = [w[0] for w in WORKFLOWS if w[2] == m]
    feats = [f[0] for f in FEATURES if f[5] == m]
    set_kv(tb[ti + 1], {'Main workflow(s) owned': ', '.join(owned_wf), 'Mandatory features owned': ', '.join(feats),
                        'Modules / entities owned': modules, 'Design decisions owned (D-IDs)': dec,
                        'NFRs responsible': ', '.join(NFR_OWNER[m]) or '—'})
    for r in tb[ti + 1].rows[1:]:
        if r.cells[0].text.startswith('Main workflow'): set_cell(r.cells[2], 'Presents its demo scenarios at Defense 1.1')
    c, a, _ = count(m=m)
    ds = [s[0] for w in WORKFLOWS if w[2] == m for s in w[9]]
    fixes = [f[0] for f in FIXES if f[3] == m]
    vals = {'Functional test cases written': (f'{c} (feature, end-to-end, state transition and NFR cases of Report 5 counted for this member)', DUE),
            'Of which automated in CI': (f'{a}', DUE),
            'Demo scenarios presented': (f'{len(ds)}: {", ".join(ds)}', 'Defense 1.1'),
            'Required fixes owned (section 9)': (f'{len(fixes)}: {", ".join(fixes)}', 'As in section 9'),
            'Documentation sections (Report / section)': (docs_, 'With each change')}
    for r in tb[ti + 2].rows[1:]:
        k = r.cells[0].text.strip()
        if k in vals: set_cell(r.cells[1], vals[k][0]); set_cell(r.cells[2], vals[k][1])
    ti += 5

rows = []
for w in WORKFLOWS:
    c, a, _ = count(wf=w[0])
    rows.append((w[0], w[2], ', '.join(f[0] for f in FEATURES if w[0] in f[4]), '1 / 1', str(c), str(a)))
rows.append(('Total', '5 members', f'{len(FEATURES)} mandatory features', f'{len(WORKFLOWS)} / {len(WORKFLOWS)}', str(TOTAL), f'{AUTO} ({100 * AUTO // TOTAL} %)'))
fill_table(tb[ti], rows)
rows = []
for m, *_ in MEMBERS:
    c, a, _ = count(m=m)
    rows.append((m, ', '.join(w[0] for w in WORKFLOWS if w[2] == m), ', '.join(f[0] for f in FEATURES if f[5] == m),
                 str(c), str(a), str(sum(len(w[9]) for w in WORKFLOWS if w[2] == m)), ''))
rows.append(('Total', str(len(WORKFLOWS)), str(len(FEATURES)), str(TOTAL), str(AUTO), str(2 * len(WORKFLOWS)), ''))
fill_table(tb[ti + 1], rows)
set_kv(tb[ti + 2], {'Number of main workflows': str(len(WORKFLOWS)),
                    'Number of demo scenarios (main / exception)': f'{len(WORKFLOWS)} / {len(WORKFLOWS)}',
                    'Committed functional test cases': f'{TOTAL} (Report 5 1.5.0: {3 * len(FEATURES)} feature, {len(WF)} end-to-end, {len(ST)} state transition, {len(NFR)} NFR)',
                    'Of which automated in CI': f'{AUTO} designed as automated ({sum(1 for c in CASES if c[4] == "auto")} written and passing on the tag review-2); at least {(TOTAL + 1) // 2} (50 %) by Defense 1.1'})
agreed = {'Main workflows': f'100 % ({len(WORKFLOWS)} of {len(WORKFLOWS)}) run end-to-end on staging',
          'Demo scenarios': f'100 % main ({len(WORKFLOWS)}); ≥ 80 % exception (at least 7 of {len(WORKFLOWS)})',
          'Test case count': f'≥ {TOTAL}', 'Test pass rate': '≥ 90 % overall; 100 % of main-path tests of mandatory features',
          'Automation': f'≥ 50 % in CI (at least {(TOTAL + 1) // 2} of {TOTAL})', 'Defects': 'No open Critical or High defect',
          'Individual': 'Each member demos the workflows they own and meets section 7'}
for r in tb[ti + 3].rows[1:]:
    k = r.cells[0].text.strip()
    if k in agreed: set_cell(r.cells[2], agreed[k])
fill_table(tb[ti + 4], [(i if i.startswith('RV') else f'{i} (BM02)', *rest) for i, *rest in FIXES])
for r in tb[ti + 5].rows[1:]:
    if r.cells[0].text.strip() == 'Team leader': set_cell(r.cells[1], B)

# compact tables
for t in d.tables:
    for row in t.rows:
        for c in row.cells:
            for p_ in c.paragraphs:
                for r in p_.runs: r.font.size = Pt(8.5)
out = os.path.join(REPORTS, 'registration', 'SWP490_R2_BM04_Review2_Commitment_SwiftletCare.docx')
d.save(out)
print(out, 'cases', TOTAL, 'automated', AUTO, 'fixes', len(FIXES))
for m, *_ in MEMBERS: print(' ', m, count(m=m)[:2], [f[0] for f in FIXES if f[3] == m].__len__())
