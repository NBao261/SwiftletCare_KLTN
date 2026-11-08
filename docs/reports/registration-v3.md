# Capstone Project Register — SwiftletCare (final version v3)

> Text of the registration form finalised at Review 2 (`registration/FA26_SE_Capstone_Project_Register_SwiftletCare_v3.docx`, generated from this file by `tools/make_registration_v3.py`), kept in Markdown so that the self-review prompt and the reports can cite it. Changes from v2 are listed in the Record of Changes (`bm03-record-of-changes.md`) and in section 4, items (8)–(23); items (19)–(23) and the Farm Technician role were agreed with the supervisor after the Review 2 session (09/11/2026). Phone numbers are left out of the repository copy; the team adds them to the submitted file.

| Field | Value |
| --- | --- |
| Duration | July 2026 – December 2026 |
| Profession | Software Engineering |
| Supervisor | Nguyễn Văn Chiến, Trương Long |
| Current version | v2 (after Review 1) |
| Proposed version | v3 (final, Review 2) |

## 2. Students

| # | Full name | Student code | E-mail | Role |
| --- | --- | --- | --- | --- |
| 1 | Nguyễn Chí Bảo | SE183383 | baoncse183383@fpt.edu.vn | Leader |
| 2 | Trần Minh Kiệt | SE182180 | kiettmse182180@fpt.edu.vn | Member |
| 3 | Nguyễn Vũ Len | SE182055 | lennvse182055@fpt.edu.vn | Member |
| 4 | Nguyễn Thị Yến Nhi | SE184223 | nhintyse184223@fpt.edu.vn | Member |
| 5 | Thái Minh Tuấn | SE181850 | tuantmse181850@fpt.edu.vn | Member |

## 3. Register content of Capstone Project

## 3.1. Capstone Project name

**English:** SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming.

**Vietnamese:** SwiftletCare: Hệ thống tự động hóa điều khiển môi trường và giám sát sức khỏe nhà yến đa phương thức.

**Abbreviation:** SwiftletCare

### A. Context

Commercial swiftlet farming is highly lucrative but extremely sensitive to the micro-climate inside the house (temperature, humidity, air quality, light) and to its acoustic environment. A swiftlet house is a closed, multi-floor building with nobody inside, and owners usually visit only every few days. Most houses still run their misting pumps and attractant speakers on fixed timers, or on low-cost devices that only measure and switch. When humidity stays below 75% or temperature rises above 31°C, nests degrade and birds may abandon the house, and such drift usually goes unnoticed until the next visit.

Three further gaps remain. First, owners have no objective way to follow the flock: the daily difference between birds leaving in the morning and returning in the evening is the earliest indicator of flock growth or desertion, yet it cannot be observed without continuous automated counting. Second, an owner with several houses relies on technicians on site, but has no way to send each fault to the person in charge of that house, to check that a repair really worked, or to plan maintenance before equipment fails. Third, an automated house raises the question of who guarantees that its decisions are correct: thresholds and control parameters must be grounded in domain knowledge and verified by a person with swiftlet-farming expertise. Therefore, a low-cost system is needed that regulates the environment by itself, diagnoses its own equipment, monitors the flock by computer vision, routes every problem to the person who must act on it, and keeps a domain expert in the loop to validate and improve its behaviour.

### B. Proposed Solutions

We propose SwiftletCare, an automated control and monitoring system consisting of an edge controller with industrial sensors, actuators and load-current sensing in each zone of the house, an AI camera pipeline that reads the camera at the bird entrance and runs on a desktop PC, and a cloud backend with web and mobile applications.

One installation of SwiftletCare serves one owner of swiftlet houses (a person or a business) and the farms of that owner, with the owner's own staff. Accounts are created by the installation's Administrator or by invitation; there is no public sign-up. SwiftletCare does not connect buyers and sellers, dispatch external service providers, handle payments or host third parties: every function serves the operation of the owner's houses.

The system works as one closed loop: it senses, controls and detects problems by itself; people act only where the system asks them to (the Farm Technician on site, the Farm Owner deciding, the Domain Expert validating), and their decisions return to the system as new configuration. Its research focus and value lie in three components:

**Autonomous Micro-Climate Control:**

An ESP32 controller reads five RS485 Modbus sensors (temperature and humidity, CO2, NH3, light, noise level) every second, filters the signals, and uses a fuzzy-logic controller to set the power level of the misting pump and the ventilation fan, and plays the attractant speaker on schedule. The control loop runs entirely on the controller, so it keeps working without an internet connection. Within limits approved by the Domain Expert, the weather forecast of the farm's location shifts the misting level by a small, time-limited amount ahead of hot or rainy hours. NH3 and CO2 are monitored as air-quality indicators and reported; they do not drive the actuators. Current sensing on the pump and fan circuits lets the controller check that each load actually runs when its relay is on, and counts the run hours of each load.

**Swiftlet Entry/Exit Counting by Computer Vision:**

A lightweight detection and tracking pipeline (YOLO + ByteTrack) processes the video of the bird entrance, counts birds leaving in the morning and returning in the evening by their crossings of a closed ring drawn around the entrance hole, and computes the daily return rate and the weekly flock trend of the house. The video is streamed live with a bounding box drawn on every tracked bird, so that the count can be verified visually.

**Multi-Modal Health Monitoring with People in the Loop:**

The system combines three sources of evidence (environmental sensors, noise level, and flock movement from the camera) to assess the condition of the house and of its own equipment: faulty or drifting sensors, misting that does not raise the humidity (dry pump, empty tank, clogged nozzle), a pump or fan that draws no current, speaker failure, device offline, abnormal noise, threshold and forecast breaches and drops in the return rate. Each problem reaches the Farm Technician of the house first and the Farm Owner when nobody acknowledges it in time; a fault that needs a visit becomes a Work Order, closed only when the data confirm recovery, and maintenance is planned from the measured run hours. Each day the system gives every house one health status that combines the sources by agreement between them, with its reasons and with the day's weather as context; daily, weekly and monthly reports can be downloaded as PDF or CSV, and the owner compares houses on one overview. The status comes from transparent rules and is an indicator for people to act on, not a diagnosis: a human Domain Expert confirms or rejects the inferred alerts, adjusts thresholds and control coefficients, writes recommendation rules whose effect is measured, and draws conclusions on each harvest season. The Farm Technician, the Farm Owner and the Domain Expert rate each day from their own observation, and the agreement between the system and these ratings is measured.

### C. Functional requirement

#### 1. System (automatic operation: edge controller, AI pipeline and background services)

**Sensing & Telemetry:** Read all sensors every second, validate and filter the readings, publish telemetry over MQTT, and buffer it on the device while offline for later synchronisation; fetch the hourly weather and forecast of each farm.

**Closed-Loop Control:** Regulate humidity and temperature with fuzzy logic (misting, ventilation), apply the weather compensation approved by the Domain Expert (at most ±10% for at most 2 hours), and play the attractant sound on schedule, without user action.

**Self-Protection & Self-Diagnosis:** Detect sensor faults and RS485 bus failure, implausible sensor behaviour (stuck values, impossible jumps, drift between devices), misting that does not raise the humidity, a pump or fan that does not draw current as commanded, speaker failure, an unexpected restart and device offline; move the affected actuator to a safe state where applicable and raise an alert. These checks monitor the equipment; the electrical protection of the loads (breaker, thermal relay, float switch) stays in the house's own panel.

**Forecasting & Tuning Suggestion:** Forecast humidity and temperature for the next 60 minutes and warn before a threshold is crossed; measure control performance (time in range, relay switching); suggest fuzzy-control coefficients from recorded data.

**Bird Counting:** Detect, track and count swiftlets entering and exiting; aggregate the counts per morning and evening session; compute the daily return rate and the flock trend, and alert when the return rate drops abnormally, with the rainfall of the session; stream the annotated video.

**Alert Routing & Work Orders:** Classify alerts by severity, merge repeated occurrences of the same incident and close them automatically when conditions recover; send each alert first to the Farm Technician of the house and escalate it to the Farm Owner when it is not acknowledged within 15 minutes (critical alerts reach both at once); open a Work Order for a fault that needs a visit and close it only after the data have stayed recovered for 10 minutes; measure the time to acknowledge and to resolve (MTTA, MTTR).

**Preventive Maintenance & Recommendations:** Count the run hours of the pump and the fan from the relay state, confirmed by the measured current, raise a maintenance alert and a preventive Work Order when a plan falls due; evaluate the Domain Expert's recommendation rules every day and measure the effect of each accepted recommendation after 7 days.

**Health Assessment & Analytics:** Give each house one daily health status combining environment, air quality, return rate and abnormal noise by agreement, with its reasons and the weather of the day (houses still attracting birds are rated without the return rate); produce daily, weekly and monthly health reports exportable to PDF and CSV; show a farm overview and compare houses on operational indicators (time in range, healthy days, return rate, open alerts, MTTR, estimated energy, yield per cycle); close each harvest cycle with its yield and health summary.

#### 2. Farm Owner

**Farm, House & Team Management:** Register farms, houses (with their stage: attracting birds or occupied) and zones; invite co-owners, the Domain Expert and Farm Technicians, and assign each technician to houses with a duty roster.

**Device Setup:** Add a controller to a zone in the mobile app by scanning the QR code on its label (device ID and activation key) and the QR code of the floor; only the Wi-Fi network is entered on the device. Move a controller to another floor or remove it the same way, and follow the setup until the configuration is applied.

**Real-Time Monitoring & Farm Overview:** View live sensor values, actuator state and control mode, historical charts and a comparison across zones; see every house on one overview and compare houses on their indicators.

**Flock Monitoring & Live View:** View entry/exit counts, return-rate and flock trends and the live annotated camera stream.

**Alerts & Work Orders:** Receive escalated and critical alerts in the web and mobile applications, and on the phone through both mobile push notifications and a Telegram bot; create and assign Work Orders, and approve the ones the system has verified as recovered.

**Maintenance Planning:** Define preventive maintenance plans by run hours and by calendar, with their checklists, and follow on-time maintenance.

**Recommendations & Configuration:** Accept or reject the recommendations raised by the expert's rules, apply configuration profiles approved by the Domain Expert to several houses at once, and change zone thresholds and coefficients (each change is reviewed by the expert).

**Daily Health, Reports & Harvest Seasons:** See the daily health status of each house with its reasons, read and download the reports, confirm the harvests entered by the technicians and compare harvest cycles.

**Manual Override (exception path):** Switch an actuator by hand for a limited time, for example during harvesting, cleaning or maintenance; the system returns to automatic mode when the time expires and every override is logged.

#### 3. Farm Technician (the owner's employee on site, assigned to houses)

**Alerts First:** Receive the alerts of the assigned houses first, acknowledge them and record the cause found on site with a photo when an equipment alert is closed.

**Work Orders:** Carry out repair and preventive Work Orders, record the work, the cause and photos; the Work Order goes to the Farm Owner only after the data confirm recovery.

**Inspection & Calibration:** Follow periodic inspection checklists (water tank, nozzles, fans, doors, signs of rats or snakes) and record maintenance and sensor calibration.

**On-Site Operation:** Switch an actuator by hand for a limited time and restart a controller in the assigned houses.

**Rating & Harvest Entry:** Rate each day of the assigned houses from own observation before the system status is shown, and enter nest harvests (date, zone, nest count, weight, nest type, photo) for the Farm Owner to confirm.

#### 4. Domain Expert (swiftlet-farming specialist)

**Review:** Access the environmental data, control performance, flock trends, daily health statuses, health reports and harvest cycles of the farms the expert is invited to.

**Validation:** Confirm or reject alerts inferred by the system (abnormal noise, sensor anomaly, forecast breach, return-rate drop), so that detection thresholds can be calibrated.

**Tuning & Profiles:** Approve or adjust environmental thresholds and fuzzy-control coefficients, including those suggested by the system; tune the detection parameters of the alerts, the counting ring and schedule, the weather compensation and the house stage; prepare configuration profiles that the Farm Owner applies to several houses. Every change is recorded with its author and time.

**Recommendation Rules:** Write rules that turn a pattern in the data into a recommended action (for example, NH3 above its limit for 3 days → clean the guano), and follow how effective each rule has been.

**Rating & Conclusions:** Rate each day from own observation before the system status is shown; write conclusions on the health reports and on each harvest season.

#### 5. Supporting roles (outside the main flow)

**Administrator:** Technical administrator of the installation: create the Farm Owner's account, lock accounts and handle data-deletion requests, keep the device stock with its printed labels, the system-wide default thresholds with their sources and the audit log, see every device with its device alerts, diagnose it remotely and send restarts, configuration pushes and firmware updates; no relay control and no access to the environmental data. The Administrator does not create or manage farms.

### D. Main flow

**Flow 1: Automatic Micro-Climate Control:** Sensors are read every second. Every 10 seconds the fuzzy controller converts humidity and temperature into a power level for misting and ventilation, adds the weather compensation still in force, and applies it over a time window; as conditions return to range, the output decreases gradually, and the measured current confirms that each load runs. Readings and actuator state are reported to the cloud and shown on the dashboard. When the internet connection is lost, the controller keeps regulating with its stored configuration (the weather compensation falls back to zero) and buffers telemetry in flash memory, uploaded when the connection returns; if the controller hangs, the hardware watchdog restarts it. The Farm Owner or the Farm Technician of the house may switch an actuator from the application for a limited duration (the pump for at most 30 minutes, and only after confirming any open sensor or misting alert); the controller reports manual mode and returns to automatic control when the duration expires. If the controller itself fails, the existing electrical switches of the house, outside the system, remain the manual fallback.

**Flow 2: Incident Handling:** An incident raises one alert with its severity and details: a reading outside its threshold for its dwell time; NH3 or CO2 above the alert limit set by the Domain Expert (no established limits exist for swiftlet houses, so these readings never drive the fan); misting that does not raise the humidity within an accumulated 5 minutes (automatic misting then stops for that session); a sensor that stops responding or returns implausible values (excluded from control, the loop holds a safe state); a speaker whose sound stays far below its baseline; a pump or fan that does not draw current as commanded; an unexpected restart; a device offline; or a forecast that a value still in range will cross its threshold within 60 minutes. The alert reaches the Farm Technician of the house in the applications and on the phone through both mobile push and a Telegram bot, and the Farm Owner when it is critical or not acknowledged within 15 minutes. A fault that needs a visit opens a Work Order; the technician repairs it, records the cause and a photo, and the system waits until the data have stayed recovered for 10 minutes before the Farm Owner approves it, or reopens it. The time to acknowledge and to resolve is recorded. The Administrator sees the device alerts of every farm.

**Flow 3: Bird Counting Session:** During the morning exit and evening return sessions, the AI pipeline detects and tracks birds at the entrance, counts their crossings of the ring around the entrance hole in each direction and publishes the counts of the house, while the live stream shows a box on each tracked bird. At the end of the day the return rate is computed; a drop of more than the house's threshold (default 20%) against the average of the previous 7 days raises an alert that shows the rainfall of the session. Morning exits are aggregated per week and month into a flock trend.

**Flow 4: Expert Validation of Inferred Alerts:** Some alerts are inferred rather than measured: abnormal noise (noise sustained well above the baseline the controller learned for that hour while the speaker is off), implausible sensor behaviour, early warnings and return-rate drops. They are never treated as conclusions on their own: each is presented with the readings and the bird counts of the same period as evidence, and the Domain Expert confirms or rejects it with a note; a rejected alert is dismissed, and a confirmed one that needs a visit opens a Work Order as in Flow 2. The Farm Owner is informed of every verdict; on a farm without a Domain Expert, the Farm Owner records it.

**Flow 5: Control-Parameter Tuning:** A change comes from the Farm Owner (applied at once and opening a review item that the Domain Expert accepts, adjusts or reverts), from the system's coefficient suggestion (applied only when the Domain Expert approves it), or from a configuration profile prepared by the Domain Expert and applied by the Farm Owner to several houses. The parameters are thresholds, control coefficients, detection parameters, the counting ring and schedule, the speaker schedule and the weather compensation. Every applied change is sent to the controllers as a new configuration version, the application shows when it is applied, its effect is visible in the control-performance chart, and the Farm Owner is informed of every expert decision.

**Flow 6: Daily Health Assessment & Periodic Reports:** After the evening session, the system rates the environment, air quality, return rate and abnormal noise of each house against the house's levels (a house still attracting birds is rated without the return rate), combines them by agreement into one daily status (good, watch, action or insufficient data) with its reasons and the weather of the day. The Farm Technician, the Farm Owner and the Domain Expert each rate the day from their own observation before the status is shown. Weekly and monthly reports aggregate the days, the Domain Expert writes a conclusion on them, every report can be downloaded as PDF or CSV, and the farm overview and the comparison of houses are updated.

**Flow 7: Preventive Maintenance:** The Farm Owner defines maintenance plans for each kind of equipment, by run hours (pump, fan) and by calendar (cleaning sensors and nozzles, calibration), with their checklists. The system counts the run hours from the relay state, confirmed by the measured current; when a plan falls due it raises a maintenance alert and opens a preventive Work Order for the Farm Technician of the house, who follows the checklist, records the work and photos. Recording the work resets the counter and schedules the next due date; an overdue plan escalates to the Farm Owner, and a defect found on the way opens a repair Work Order (Flow 2).

**Flow 8: Recommendation Loop:** The Domain Expert writes rules made of a condition on the data, a time window and a recommended action. Every day the system evaluates the rules for each house and raises a recommendation with the charts that triggered it. The Farm Owner accepts it (it then becomes a Work Order or a proposed parameter change) or rejects it with a reason; 7 days after an accepted recommendation the system measures the related indicator again and compares it with the period before, so the Domain Expert can see how effective each rule is. The system never concludes a cause nor changes a parameter by itself.

**Flow 9: Harvest Season Assessment:** The Farm Technician enters a harvest (date, zone, nest count, weight, nest type, photo) and the Farm Owner confirms it. The system closes the harvest cycle of that zone (from its previous harvest), computes its yield and compares it with the previous cycle and the same period of the previous year, together with the share of healthy days, the average return rate and the time in range of the cycle. The Domain Expert writes a conclusion and recommendations for the next season, which the Farm Owner may turn into parameter changes (Flow 5) or recommendation rules (Flow 8). The comparison shows relations, not causes.

**Supporting flows:** (1) Device setup by the Farm Owner: the Administrator adds the device to the stock and prints its label; the Farm Owner scans the label and the QR code of the floor in the mobile app and enters only the Wi-Fi network on the device; the backend links the device to that zone and sends it that zone's configuration. (2) Remote device maintenance by the Administrator (diagnosis, restart, configuration push, firmware update), each notified to the Farm Owner. (3) Account and access management, including technician assignment and duty rosters. (4) Notification settings: channels per alert type and quiet hours, critical alerts always delivered. (5) System administration: default thresholds with their sources, audit log and technical overview.

### E. Non-functional requirement

**Reliability & Offline Resiliency:** Edge nodes continue executing local automated control (misting, ventilation) even if the internet connection to the cloud server is temporarily lost, and recover by themselves after a hang or power loss.

**Performance:** Real-time sensor data updates on the dashboard within 2 seconds using WebSockets/MQTT; alerts are delivered to the applications within 3–5 seconds; the control decision cycle is 10 seconds. A device simulator drives the load tests with many controllers and cameras.

**Autonomy:** The system is expected to run in automatic mode for the large majority of the time. The share of time in automatic mode and the share of time the environment stays within its thresholds are measured and reported, with and without the weather compensation.

**Accuracy & Evidence:** Counting accuracy is evaluated against manual counts on recorded video under different lighting conditions (Precision, Recall, counting error); the forecast error is reported as mean absolute error; the agreement between the daily health status and the practitioners' independent ratings is reported; the time to acknowledge and to resolve incidents and the measured effect of accepted recommendations are reported.

**Cost-Efficiency:** Designed using affordable, robust hardware components (ESP32, industrial RS485 sensors, an IP camera) and open-source software.

### 3.2. Main proposal content (including result and product)

**a) Theory and practice (document):**

- Application of IoT architecture patterns, closed-loop control with fuzzy logic and weather-based feed-forward compensation, signal filtering (median and Kalman filters), time-series forecasting and anomaly detection, rule-based recommendation with measured effect, maintenance management (work orders, preventive maintenance, MTTA/MTTR), Computer Vision & Deep Learning (Object Detection & Multi-Object Tracking), Embedded Systems Programming, and the MQTT Protocol.
- Embedded/Hardware: ESP32, RS485 Modbus RTU industrial sensors, relay module, load-current sensing, audio playback module, FreeRTOS/Arduino framework, MQTT Protocol.
- AI / Computer Vision: OpenCV, YOLO (nano/lightweight; the version is declared in the design document), ByteTrack (Object tracking), ONNX Runtime.
- Backend: NodeJS / Express (TypeScript), MongoDB, MQTT Broker (EMQX), Socket.io, MinIO (file storage); a public weather API (Open-Meteo) for weather and forecasts.
- Frontend/Mobile: React.js, TailwindCSS, React Native.

**b) Products:**

- An operational IoT Hardware Controller Prototype (ESP32 with RS485 sensors, relay module, load-current sensing and attractant speaker) performing autonomous micro-climate control with weather compensation, and an AI Camera Node for the bird entrance (IP camera and a desktop PC running the pipeline).
- A trained AI Model for Swiftlet Entry/Exit Counting, with its evaluation results.
- A fully functional Web & Mobile Application for the Farm Owner, the Farm Technician and the Domain Expert: monitoring and farm overview, swiftlet count analytics and the annotated live stream, alerts with escalation, Work Orders and preventive maintenance, manual override, device setup by QR code, daily health status and reports with PDF/CSV export, house comparison, recommendations, configuration profiles, harvest cycles, and expert validation and tuning.
- A scalable Cloud Backend handling real-time time-series telemetry, swiftlet counting logs, alert routing and escalation, Work Orders, maintenance plans, forecasting, recommendation rules, daily health assessment, periodic reports and operational indicators, with a device simulator for load tests.
- An evaluation report: control performance (time in range, relay switching, with and without weather compensation), counting accuracy, response latency, MTTA and MTTR, the effect of accepted recommendations, the results of the offline-recovery and fault scenarios, and the agreement between the daily health status and the practitioners' ratings.

**c) Proposed Tasks for students:**

Task 1: Design circuit schematics (controller board with load-current sensing), assemble the prototype (sensors, relays, speaker), and code ESP32 firmware for sensor reading and filtering, fuzzy control with weather compensation, run-hour counting, fault detection, offline buffering, and MQTT communication.

Task 2: Collect/annotate a swiftlet dataset, train a lightweight AI model (YOLO + Object Tracking) for entry/exit counting, build the vision pipeline and the annotated live stream, and evaluate its accuracy.

Task 3: Build Backend API (NodeJS/Express), set up MQTT Broker, design database schemas (MongoDB) for sensor telemetry, count logs, alerts, Work Orders, maintenance plans, recommendation rules, harvest cycles and daily health statuses, and implement the alert engine with routing and escalation, Work Orders, preventive maintenance, forecasting, recommendations, daily health assessment, periodic reports, operational indicators and WebSocket channels.

Task 4: Build Web Dashboard (React.js) and Mobile App (React Native) for the Farm Owner, the Farm Technician and the Domain Expert: monitoring and farm overview, swiftlet counting analytics and live stream, real-time alert notifications, Work Orders and checklists, manual override, device setup by QR code, daily health status, reports and ratings, house comparison, recommendations and profiles, harvest cycles, and expert validation and tuning.

Task 5: Define the automation scenarios, build the device simulator, deploy empirical system runs in a simulated/real swiftlet environment, measure control performance, counting accuracy (Precision/Recall), response latency, MTTA/MTTR, the effect of recommendations and the agreement of the daily health status with the practitioners' ratings, review the related literature, obtain validation from a swiftlet-farming practitioner, test, and write the thesis/scientific paper.

## 4. Other comment (propose all relative things if have)

The hardware prototype will be built with fail-safe hardware watchdogs and load-current sensing on the pump and fan. The test house is borrowed and its electrical installation cannot be modified, so no bypass switch is added: if the controller fails, the house's existing switches remain the manual fallback.

The entrance camera will support Infrared Night Vision; counting accuracy will be reported separately for daylight and low-light sessions (early morning departures and late evening returns).

Default temperature, humidity and light thresholds are taken from the swiftlet-farming literature and reviewed by a swiftlet-farming practitioner; the review is documented in the thesis. NH3 and CO2 alert limits have no established reference for swiftlet houses and are set by the Domain Expert.

**Scope adjustments after Review 1, compared with the first registration:**

(1) Industrial RS485 sensors replace DHT22/SHT31, and NH3 and noise-level sensing are added.

(2) Fuzzy-logic control replaces PID/rule-based control for misting and ventilation.

(3) A Domain Expert role is added to validate the system's conclusions and tune its parameters.

(4) Predator detection by camera is removed; the camera pipeline detects one class (swiftlet) for counting.

(5) Acoustic monitoring is limited to noise level (speaker failure and abnormal noise) and does not classify bird calls.

(6) Notifications are delivered in the applications and on the phone through both a Telegram bot and mobile push notifications; Zalo and SMS channels are out of scope.

(7) Administrator functions are supporting features outside the main flow; online trading of nests is out of scope and only harvest logging is included.

**Scope adjustments at Review 2 (version 3, see the Record of Changes BM03):**

(8) The detection model is named "YOLO" without a version (declared in the design document), and birds are counted by crossings of a closed ring around the entrance hole instead of a virtual line.

(9) Device setup by the Farm Owner is a supporting flow done with two QR scans in the mobile app (the device label and the floor code).

(10) The health assessment becomes a daily status per house combining the sources by agreement, with daily, weekly and monthly reports exportable to PDF and CSV, rated by the Farm Technician, the Farm Owner and the Domain Expert (Flow 6).

(11) Weather data from a public weather API is used as context for the health assessment and, within limits approved by the Domain Expert (at most ±10% for at most 2 hours), to shift the misting level ahead of hot or rainy hours; it never switches an actuator by itself, and NH3 and CO2 never drive the fan.

(12) The controller board measures the current of the pump and the fan to detect a load that does not run as commanded and to count run hours.

(13) Bypass switches are removed: the test house is borrowed and cannot be rewired; its existing switches remain the manual fallback.

(14) Both mobile push notifications and a Telegram bot are committed, and predator detection is removed from the possible extensions.

(15) Repairs and maintenance are internal Work Orders of the owner's organisation: each is linked to one house and one alert or plan, assigned to that house's Farm Technician, and closed only when the data confirm recovery; response targets (MTTA, MTTR) are internal goals that trigger escalation. There are no external service providers, regions, queues or chat.

(16) One installation serves one owner of swiftlet houses and that owner's farms: the Administrator creates the Farm Owner's account, co-owners, the Domain Expert and Farm Technicians join by invitation, and there is no public sign-up. The health status is described as a rule-based indicator, not as an automatic expert.

(17) The main flows are grouped by business process, one outcome each: offline operation and manual override become paths of the automatic control (Flow 1); air-quality limits, equipment faults and early warnings become one incident-handling flow (Flow 2); the expert's verdicts on inferred alerts (Flow 4) and the review of control parameters (Flow 5) are separate flows.

(18) A Farm Technician role is added: an employee of the owner assigned to houses, who receives their alerts first, carries out Work Orders, inspections and calibration, may switch actuators and restart controllers there, enters harvests and rates days. Device setup stays with the Farm Owner and remote restarts, configuration pushes and firmware updates with the Administrator.

(19) Preventive maintenance by run hours and by calendar, with checklists and preventive Work Orders, becomes a main flow (Flow 7).

(20) Recommendation rules written by the Domain Expert, accepted or rejected by the Farm Owner and measured 7 days later, become a main flow (Flow 8).

(21) Harvest logging becomes a main flow on harvest cycles (Flow 9): technician entry, owner confirmation, comparison with the previous cycle and season, and the Domain Expert's conclusion.

(22) Houses have a stage (attracting birds or occupied); the Domain Expert prepares configuration profiles that the Farm Owner applies to several houses; a farm overview compares houses on operational indicators, including the estimated energy of the pump and the fan.

(23) A device simulator generates many controllers and cameras for the load tests and for demonstrating several houses when only one real house is available.
