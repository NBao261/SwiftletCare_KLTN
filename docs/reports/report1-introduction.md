# Report 1 – Introduction

**SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

| Field | Value |
| --- | --- |
| Project code | `[TEAM: approved project code]` |
| Course | SWP490 – Capstone Project, FA26 |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | `[TEAM: supervisor name]` |
| Duration | July 2026 – December 2026 |
| Document version | 1.0.0 (Review 2) |
| Date | 23/10/2026 |
| Scope baseline | Registration form v3 (`docs/reports/registration-v3.md`) with Record of Changes (`bm03-record-of-changes.md`) |
| Repository | `https://github.com/NBao261/SwiftletCare_KLTN/tree/review-2` |

---

## 1. Project Information

| Item | Value |
| --- | --- |
| English name | SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming |
| Vietnamese name | SwiftletCare: Hệ thống tự động hóa điều khiển môi trường và giám sát sức khỏe nhà yến đa phương thức |
| Abbreviation | SwiftletCare |
| Profession | Software Engineering |
| Field partner | A practitioner's swiftlet house lent to the team as the test house; practitioners with long swiftlet-farming experience act as Domain Experts (Report 3, A-6) |

### 1.1 Team

| Member | Student code | Role in the team |
| --- | --- | --- |
| Nguyễn Chí Bảo | SE183383 | Leader; firmware, AI pipeline, backend core |
| Trần Minh Kiệt | SE182180 | Backend devices and device setup; mobile application |
| Nguyễn Vũ Len | SE182055 | Web application – Farm Owner |
| Nguyễn Thị Yến Nhi | SE184223 | Web application – Administrator, health reports |
| Thái Minh Tuấn | SE181850 | Web application – Domain Expert |

Responsibilities in detail are in Report 2, Section 4, and in the Ownership Map of the Design Brief.

## 2. Background

Edible-nest swiftlets are farmed in closed, multi-floor concrete houses that imitate a cave. The nests are the farmer's product, and their quantity and quality depend on the micro-climate inside the house — mainly humidity and temperature — and on whether the flock stays and grows. The field studies collected for this project (Report 3, REF-11) report humidity of roughly 80–90 % and temperatures of about 26–33 °C in productive houses (`docs/evidence-register.md`).

A swiftlet house has nobody inside, and owners usually visit only every few days, because each visit disturbs the birds. Three problems follow:

1. **The environment drifts unnoticed.** Misting pumps and attractant speakers usually run on fixed timers or on simple devices that only measure and switch. When humidity stays low or the temperature rises, nests degrade and birds may leave, and the drift is found only at the next visit.
2. **The flock cannot be followed.** The difference between birds leaving in the morning and returning in the evening is the earliest sign of growth or desertion, but nobody can count thousands of birds at dusk by eye.
3. **Nobody checks the automation.** A timer or controller that runs dry, a broken sensor or a wrong threshold silently does the wrong thing. The parameters of an automated house must come from domain knowledge and be checked by someone who knows swiftlets.

## 3. Existing Solutions

The team's market survey `[TEAM: add the named products and prices found in the survey, with links]` groups what farmers use today into four kinds:

| Kind | What it does | What it lacks for this problem |
| --- | --- | --- |
| Timers and simple humidity switches | Run the misting pump and speaker by time or by a single humidity set-point | No remote view, no alert when the pump runs dry or a sensor fails, no record over time |
| Generic smart-home or IoT sensors with a phone app | Show temperature and humidity remotely and send threshold alerts | Not built for a closed house: no control loop that works offline, no air-quality or noise evidence, no swiftlet-specific thresholds |
| CCTV at the entrance | Lets the owner look at the birds | Counting is manual; nothing turns the video into a return rate or an alert |
| Research prototypes of swiftlet-house monitoring (REF-11, REF-12) | Measure the micro-climate or count birds on video | Each covers one source; none combines control, counting and an expert's validation into one system |

## 4. Business Opportunity

Swiftlet farming is a significant agricultural business in Southeast Asia, and Vietnam has a large number of house farms `[TEAM: cite a figure with its source]`. A house is a large investment whose return depends on keeping the flock, yet it is supervised by occasional visits. A low-cost system that keeps the environment in range by itself, reports equipment faults at once, shows the flock's daily trend and asks an experienced farmer to confirm what it infers gives the owner:

- fewer losses from unnoticed drift and failed equipment;
- an objective daily indicator of the flock (return rate) and of the house (daily health status);
- a record over time that an expert can read remotely, so advice no longer needs a site visit.

The system runs on affordable commodity hardware (ESP32, industrial RS485 sensors, an IP camera, a spare PC) and open-source software (registration form, section E; Report 3, C-4).

## 5. Software Product Vision

> For swiftlet-farm owners who cannot be at their houses every day, SwiftletCare is an automated control and monitoring system that keeps each floor's micro-climate in range by itself, counts the flock at the entrance and gives every house one daily health status with its reasons. Unlike timers and generic IoT sensors, it diagnoses its own equipment, combines environment, air quality, noise and flock movement, and keeps an experienced swiftlet farmer in the loop to validate what it infers and tune how it behaves.

Users and what they do (Report 3, Section 2.3):

| User | Main goals |
| --- | --- |
| Farm Owner | Watch the houses live, receive alerts by push and Telegram, override an actuator for a limited time, set up devices by scanning QR codes, read the daily status and reports, rate each day, record harvests |
| Domain Expert | Review data and reports, confirm or reject inferred alerts, tune thresholds, coefficients, detection parameters and the counting ring, write conclusions, rate each day |
| Technician (supporting) | Set up, move and remove devices on any farm, diagnose them remotely, send restarts, configuration pushes and firmware updates; no relay control and no environmental data |
| Administrator (supporting) | Manage accounts (including Technician accounts), the device stock and its labels, system-wide defaults and the audit log; no farm management |

## 6. Project Scope and Limitations

### 6.1 Major Features

The main flows of the registration form v3 (Report 3, Section 2.2):

| ID | Flow | In one sentence |
| --- | --- | --- |
| MF-01 | Automatic micro-climate regulation | Every 10 s a fuzzy controller on each floor sets misting and fan power from humidity and temperature |
| MF-02 | Air-quality monitoring | NH3 and CO2 above the limit set by the expert raise an alert; they never drive the fan |
| MF-03 | Offline operation and recovery | Control continues without Internet; buffered data is uploaded later; a hang restarts the controller |
| MF-04 | Equipment fault handling | Misting that does not raise the humidity, a failed sensor, a silent speaker or a load drawing no current is detected and reported |
| MF-05 | Early warning by forecast | A 60-minute forecast warns before a threshold is crossed |
| MF-06 | Bird counting session | Birds crossing a ring around the entrance hole are counted per session; the return rate is computed; the annotated video is streamed |
| MF-07 | Abnormal noise | Noise above the learned hourly baseline is shown with the bird counts and judged by the expert |
| MF-08 | Expert validation and tuning | The expert validates inferred alerts, reviews the owner's changes, applies tuning suggestions and writes conclusions |
| MF-09 | Manual override | The owner switches an actuator for a limited time; the system returns to automatic control |
| MF-10 | Device setup by the Farm Owner | Scanning the device label and the floor code puts a new controller online in the right zone |
| MF-11 | Daily health assessment and reports | Each house gets a daily status by agreement between sources, with daily, weekly and monthly reports in PDF and CSV, rated by the owner and the expert |

Supporting flows: remote device maintenance by the Technician (SF-02), accounts and access (SF-03), harvest logging (SF-04). There are no maintenance tickets: faults reach the Farm Owner as alerts that are sent again until acknowledged (MF-04).

### 6.2 Limitations and Exclusions

- Out of scope (Report 3, Section 8): predator detection, bird-call classification, heating and light control, fan control from NH3, CO2 or weather, marketplace and buyer role, Zalo and SMS, bypass switches, store publication, commercial 24/7 operation.
- The daily health status is an indicator, not a diagnosis: it lists its reasons and the expert concludes (Report 3, Section 8.1).
- Weather comes from a regional model for the farm's coordinates, not a measurement at the house; it is context only (C-6).
- The system is evaluated in one borrowed test house; results are reported for that house and its season.

## 7. Related Documents

| Document | Location |
| --- | --- |
| Registration form v3 and Record of Changes (BM03) | `docs/reports/registration-v3.md`, `docs/reports/bm03-record-of-changes.md`, `docs/reports/registration/` |
| Report 2 – Project Management Plan | `docs/reports/report2-project-management-plan.md` |
| Report 3 – Software Requirements Specification | `docs/reports/report3-srs.md` |
| Report 4 – Software Design Description | `docs/reports/report4-sdd.md` |
| Report 5 – Software Test Documentation | `docs/reports/report5-test.md` |
| Project Tracking | `docs/reports/project-tracking.md` |
| Design Brief (BM01) | `docs/reports/design-brief.md` |

## 8. Revision History

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 23/10/2026 | First version for Review 2, written from the registration form v3 |
