# Capstone Project Register — SwiftletCare (proposed final version v3)

> Text of the registration form submitted for Review 2 (`registration/FA26_SE_Capstone_Project_Register_SwiftletCare_v3.docx`), kept in Markdown so that the self-review prompt and the reports can cite it. Changes from v2 are listed in the Record of Changes (`bm03-record-of-changes.md`) and in section 4, items (8)–(16). Phone numbers are left out of the repository copy; the team adds them to the submitted file.

| Field | Value |
| --- | --- |
| Duration | July 2026 – December 2026 |
| Profession | Software Engineering |
| Supervisor | `[TEAM: supervisor name]` |
| Current version | v2 (after Review 1) |
| Proposed version | v3 (Review 2) |

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

Two further gaps remain. First, owners have no objective way to follow the flock: the daily difference between birds leaving in the morning and returning in the evening is the earliest indicator of flock growth or desertion, yet it cannot be observed without continuous automated counting. Second, an automated house raises the question of who guarantees that its decisions are correct: thresholds and control parameters must be grounded in domain knowledge and verified by a person with swiftlet-farming expertise. Therefore, a low-cost system is needed that regulates the environment by itself, diagnoses its own equipment, monitors the flock by computer vision, and keeps a domain expert in the loop to validate and tune its behaviour.

### B. Proposed Solutions

We propose SwiftletCare, an automated control and monitoring system consisting of an edge controller with industrial sensors, actuators and load-current sensing in each zone of the house, an AI camera pipeline that reads the camera at the bird entrance and runs on a desktop PC, and a cloud backend with web and mobile applications.

One installation of SwiftletCare serves one owner of swiftlet houses (a person or a business) and the farms of that owner. Accounts are created by the installation's Administrator or by invitation; there is no public sign-up. SwiftletCare does not connect buyers and sellers, dispatch technical services, handle payments or host third parties: every function serves the operation of the owner's houses.

The system is designed so that the house regulates and protects itself; people supervise, validate and intervene only as an exception. Its research focus and value lie in three components:

**Autonomous Micro-Climate Control:**

An ESP32 controller reads five RS485 Modbus sensors (temperature and humidity, CO2, NH3, light, noise level) every second, filters the signals, and uses a fuzzy-logic controller to set the power level of the misting pump and the ventilation fan, and plays the attractant speaker on schedule. The control loop runs entirely on the controller, so it keeps working without an internet connection. NH3 and CO2 are monitored as air-quality indicators and reported; they do not drive the actuators. Current sensing on the pump and fan circuits lets the controller check that each load actually runs when its relay is on.

**Swiftlet Entry/Exit Counting by Computer Vision:**

A lightweight detection and tracking pipeline (YOLO + ByteTrack) processes the video of the bird entrance, counts birds leaving in the morning and returning in the evening by their crossings of a closed ring drawn around the entrance hole, and computes the daily return rate of the house. The video is streamed live with a bounding box drawn on every tracked bird, so that the count can be verified visually.

**Multi-Modal Health Monitoring with an Expert in the Loop:**

The system combines three sources of evidence (environmental sensors, noise level, and flock movement from the camera) to assess the condition of the house and of its own equipment: faulty or drifting sensors, misting that does not raise the humidity (dry pump, empty tank, clogged nozzle), a pump or fan that draws no current, speaker failure, device offline, abnormal noise, threshold and forecast breaches and drops in the return rate. Each day the system gives every house one health status that combines the sources by agreement between them, with its reasons and with the day's weather from a public weather service as context; daily, weekly and monthly reports can be downloaded as PDF or CSV. The status comes from transparent rules and is an indicator for people to act on, not a diagnosis: a human Domain Expert reviews the system's assessments, confirms or rejects its inferred alerts, and adjusts thresholds and control coefficients. The Farm Owner and the Domain Expert rate each day from their own observation, and the agreement between the system and these ratings is measured.

### C. Functional requirement

#### 1. System (automatic operation: edge controller, AI pipeline and background services)

**Sensing & Telemetry:** Read all sensors every second, validate and filter the readings, publish telemetry over MQTT, and buffer it on the device while offline for later synchronisation.

**Closed-Loop Control:** Regulate humidity and temperature with fuzzy logic (misting, ventilation), and play the attractant sound on schedule, without user action.

**Self-Protection & Self-Diagnosis:** Detect sensor faults and RS485 bus failure, implausible sensor behaviour (stuck values, impossible jumps, drift between devices), misting that does not raise the humidity, a pump or fan that does not draw current as commanded, speaker failure, an unexpected restart and device offline; move the affected actuator to a safe state where applicable and raise an alert. These checks monitor the equipment; the electrical protection of the loads (breaker, thermal relay, float switch) stays in the house's own panel.

**Forecasting & Tuning Suggestion:** Forecast humidity and temperature for the next 60 minutes and warn before a threshold is crossed; measure control performance (time in range, relay switching); suggest fuzzy-control coefficients from recorded data.

**Bird Counting:** Detect, track and count swiftlets entering and exiting; aggregate the counts per morning and evening session; compute the daily return rate and alert when it drops abnormally; stream the annotated video.

**Health Assessment & Alerts:** Classify alerts by severity, merge repeated occurrences of the same incident, close them automatically when conditions recover; give each house one daily health status combining environment, air quality, return rate and abnormal noise by agreement, with its reasons and the weather of the day, and produce daily, weekly and monthly health reports exportable to PDF and CSV.

#### 2. Farm Owner

**House & Zone Management:** Register farms, houses and zones (floors) and view the devices installed in each zone.

**Device Setup:** Add a controller to a zone in the mobile app by scanning the QR code on its label (device ID and activation key) and the QR code of the floor; only the Wi-Fi network is entered on the device. Move a controller to another floor or remove it the same way, and follow the setup until the configuration is applied.

**Real-Time Monitoring:** View live sensor values, actuator state and control mode, historical charts, and a comparison across zones.

**Flock Monitoring & Live View:** View entry/exit counts, return-rate trends and the live annotated camera stream.

**Daily Health & Reports:** See the daily health status of each house with its reasons, read and download the daily, weekly and monthly reports, and rate each day from own observation before the status is shown.

**Alerts:** Receive real-time alerts in the web and mobile applications, and on the phone through both mobile push notifications and a Telegram bot; acknowledge them with a note.

**Manual Override (exception path):** Switch an actuator by hand for a limited time, for example during harvesting, cleaning or maintenance; the system returns to automatic mode when the time expires and every override is logged.

**Harvest Logging:** Record nest harvests (date, zone, nest count, weight) and view them against environmental and flock data.

**Expert Collaboration:** Invite a Domain Expert to the farm and read the expert's conclusions and recommendations.

#### 3. Domain Expert (swiftlet-farming specialist)

**Review:** Access the environmental data, control performance, flock trends, daily health statuses and health reports of the farms the expert is invited to.

**Validation:** Confirm or reject alerts inferred by the system (abnormal noise, sensor anomaly, forecast breach, return-rate drop), so that detection thresholds can be calibrated.

**Tuning:** Approve or adjust environmental thresholds and fuzzy-control coefficients, including those suggested by the system, and tune the detection parameters of the alerts (abnormal-noise margin, misting-check and speaker-failure criteria, return-rate drop); every change is recorded with its author and time.

**Rating:** Rate each day of the house from own observation before the system status is shown, so that the agreement between the system and the practitioners can be measured.

**Conclusions:** Write conclusions and recommendations for the Farm Owner.

#### 4. Supporting roles (outside the main flow)

**Technician:** Set up, move and remove devices on any farm with the same steps as the Farm Owner, diagnose them remotely, and send restarts, configuration pushes and firmware updates; no relay control and no access to the environmental data.

**Administrator:** Technical administrator of the installation: create the accounts of the Farm Owner and the Technicians, lock accounts and handle data-deletion requests, keep the device stock with its printed labels, the system-wide default thresholds and the audit log. The Administrator does not create or manage farms.

### D. Main flow

**Flow 1: Automatic Micro-Climate Regulation:** Sensors are read every second. Every 10 seconds the fuzzy controller converts humidity and temperature into a power level for misting and ventilation, applied over a time window; as conditions return to range, the output decreases gradually. Readings and actuator state are reported to the cloud and shown on the dashboard.

**Flow 2: Air-Quality Monitoring:** NH3 and CO2 are measured continuously and shown with their trends. NH3 comes mainly from bird droppings, which farmers also use as an attractant, and no established NH3 or CO2 limits for swiftlet houses are available in the literature. The system therefore does not ventilate automatically on these readings: the alert limits are set and adjusted by the Domain Expert, and a reading above its limit raises an alert for the Farm Owner and the Domain Expert to assess.

**Flow 3: Offline Operation & Recovery:** When the internet connection is lost, the controller keeps regulating with its stored configuration and buffers telemetry in flash memory; when the connection returns, the buffered data is uploaded. If the controller hangs, the hardware watchdog restarts it and an unexpected-restart alert is reported.

**Flow 4: Equipment Fault Handling:** If the pump has run for an accumulated 5 minutes without humidity rising, the system stops automatic misting for that session and raises a misting-ineffective alert that asks to check the water, the nozzles, the pump and the doors. If a sensor stops responding or returns implausible values, its reading is excluded from control decisions, the affected loop holds a safe state, and a sensor alert is raised. If the speaker is on but the measured sound level stays far below its baseline, a speaker-failure alert is raised. An alert that nobody acknowledges is sent again, and a pump or fan that reaches its service limit raises a maintenance alert.

**Flow 5: Early Warning by Forecast:** Every 10 minutes the system forecasts humidity and temperature for the next 60 minutes; if a value that is still in range is predicted to cross its threshold, an early-warning alert is raised with the expected time.

**Flow 6: Bird Counting Session:** During the morning exit and evening return sessions, the AI pipeline detects and tracks birds at the entrance, counts their crossings of the ring around the entrance hole in each direction and publishes the counts of the house, while the live stream shows a box on each tracked bird. At the end of the day the return rate is computed; a drop of more than the house's threshold (default 20%) against the average of the previous 7 days raises an alert.

**Flow 7: Abnormal Noise:** The controller learns a noise baseline for each hour of the day while the speaker is off. Noise sustained well above the baseline of that hour raises an abnormal-noise indication. It is never treated as a conclusion on its own: it is presented together with the bird-count data of the same period and requires confirmation by the Domain Expert.

**Flow 8: Expert Validation & Tuning:** The system produces the health reports and, when enough data is available, a suggested set of control coefficients. The Domain Expert reviews them, confirms or rejects the inferred alerts, approves or adjusts the parameters, and writes a conclusion for the Farm Owner. The new parameters are sent to the controller and their effect is visible in the control-performance chart.

**Flow 9: Manual Override:** The Farm Owner switches an actuator from the application for a limited duration (the pump for at most 30 minutes, and only after confirming any open sensor or misting alert); the controller applies it, reports manual mode, and returns to automatic control when the duration expires. If the controller itself fails, the existing electrical switches of the house, outside the system, remain the manual fallback, and the current sensing reports when a load does not run as commanded.

**Flow 10: Device Setup by the Farm Owner:** The Administrator adds the device to the stock and prints its label. The Farm Owner scans the label and the QR code of the floor in the mobile app and enters the Wi-Fi network on the device; the backend links the device to that zone in its database and sends it that zone's configuration at its first connection, and the application shows when the configuration is applied. Nothing about the farm is typed on the device.

**Flow 11: Daily Health Assessment & Periodic Reports:** After the evening session, the system rates the environment, air quality, return rate and abnormal noise of each house against the house's levels, combines them by agreement into one daily status (good, watch, action or insufficient data) with its reasons and the weather of the day, and notifies the Farm Owner and the Domain Expert. Each of them rates the day from their own observation before the status is shown. Weekly and monthly reports aggregate the days, and every report can be downloaded as PDF or CSV.

**Supporting flows:** Remote device maintenance by the Technician, account and access management, and harvest logging support the main flows; there are no maintenance tickets.

### E. Non-functional requirement

**Reliability & Offline Resiliency:** Edge nodes continue executing local automated control (misting, ventilation) even if the internet connection to the cloud server is temporarily lost, and recover by themselves after a hang or power loss.

**Performance:** Real-time sensor data updates on the dashboard within 2 seconds using WebSockets/MQTT; alerts are delivered to the applications within 3–5 seconds; the control decision cycle is 10 seconds.

**Autonomy:** The system is expected to run in automatic mode for the large majority of the time. The share of time in automatic mode and the share of time the environment stays within its thresholds are measured and reported.

**Accuracy & Evidence:** Counting accuracy is evaluated against manual counts on recorded video under different lighting conditions (Precision, Recall, counting error); the forecast error is reported as mean absolute error; the agreement between the daily health status and the practitioners' independent ratings is reported.

**Cost-Efficiency:** Designed using affordable, robust hardware components (ESP32, industrial RS485 sensors, an IP camera) and open-source software.

### 3.2. Main proposal content (including result and product)

**a) Theory and practice (document):**

- Application of IoT architecture patterns, closed-loop control with fuzzy logic, signal filtering (median and Kalman filters), time-series forecasting and anomaly detection, Computer Vision & Deep Learning (Object Detection & Multi-Object Tracking), Embedded Systems Programming, and the MQTT Protocol.
- Embedded/Hardware: ESP32, RS485 Modbus RTU industrial sensors, relay module, audio playback module, FreeRTOS/Arduino framework, MQTT Protocol.
- AI / Computer Vision: OpenCV, YOLO (nano/lightweight; the version is declared in the design document), ByteTrack (Object tracking), ONNX Runtime.
- Backend: NodeJS / Express (TypeScript), MongoDB, MQTT Broker (EMQX), Socket.io, MinIO (file storage); a public weather API (Open-Meteo) for weather context.
- Frontend/Mobile: React.js, TailwindCSS, React Native.

**b) Products:**

- An operational IoT Hardware Controller Prototype (ESP32 with RS485 sensors, relay module, load-current sensing and attractant speaker) performing autonomous micro-climate control, and an AI Camera Node for the bird entrance (IP camera and a desktop PC running the pipeline).
- A trained AI Model for Swiftlet Entry/Exit Counting, with its evaluation results.
- A fully functional Web & Mobile Application for monitoring environmental data, viewing swiftlet count analytics and the annotated live stream, receiving alerts, manual override, device setup by QR code, daily health status and reports with PDF/CSV export, harvest logging, and expert validation and tuning.
- A scalable Cloud Backend handling real-time time-series telemetry, swiftlet counting logs, alert dispatching, forecasting, daily health assessment and periodic reports.
- An evaluation report: control performance (time in range, relay switching), counting accuracy, response latency, the results of the offline-recovery and fault scenarios, and the agreement between the daily health status and the practitioners' ratings.

**c) Proposed Tasks for students:**

Task 1: Design circuit schematics (controller board with load-current sensing), assemble the prototype (sensors, relays, speaker), and code ESP32 firmware for sensor reading and filtering, fuzzy control, fault detection, offline buffering, and MQTT communication.

Task 2: Collect/annotate a swiftlet dataset, train a lightweight AI model (YOLO + Object Tracking) for entry/exit counting, build the vision pipeline and the annotated live stream, and evaluate its accuracy.

Task 3: Build Backend API (NodeJS/Express), set up MQTT Broker, design database schemas (MongoDB) for sensor telemetry, count logs, alerts, harvests and daily health statuses, and implement the alert engine, forecasting, daily health assessment, periodic reports and WebSocket channels.

Task 4: Build Web Dashboard (React.js) and Mobile App (React Native) for the Farm Owner and the Domain Expert: monitoring, swiftlet counting analytics and live stream, real-time alert notifications, manual override, device setup by QR code, daily health status, reports and ratings, harvest logging, and expert validation and tuning.

Task 5: Define the automation scenarios, deploy empirical system runs in a simulated/real swiftlet environment, measure control performance, counting accuracy (Precision/Recall), response latency and the agreement of the daily health status with the practitioners' ratings, review the related literature, obtain validation from a swiftlet-farming practitioner, test, and write the thesis/scientific paper.

## 4. Other comment (propose all relative things if have)

The hardware prototype will be built with fail-safe hardware watchdogs and load-current sensing on the pump and fan. The test house is borrowed and its electrical installation cannot be modified, so no bypass switch is added: if the controller fails, the house's existing switches remain the manual fallback.

The entrance camera will support Infrared Night Vision; counting accuracy will be reported separately for daylight and low-light sessions (early morning departures and late evening returns).

Default temperature, humidity and light thresholds are taken from the swiftlet-farming literature and reviewed by a swiftlet-farming practitioner; the review is documented in the thesis. NH3 and CO2 alert limits have no established reference for swiftlet houses and are set by the Domain Expert.

**Scope adjustments after Review 1, compared with the first registration:**

(1) Industrial RS485 sensors replace DHT22/SHT31, and NH3 and noise-level sensing are added.

(2) Fuzzy-logic control replaces PID/rule-based control for misting and ventilation.

(3) A Domain Expert role is added to validate the system's conclusions and tune its parameters.

(4) Predator detection by camera is no longer a committed deliverable; it is kept only as a possible extension if time allows.

(5) Acoustic monitoring is limited to noise level (speaker failure and abnormal noise) and does not classify bird calls.

(6) Notifications are delivered in the applications and on the phone through a Telegram bot or mobile push; Zalo and SMS channels are out of scope.

(7) Technician and Administrator functions are supporting features outside the main flow; online trading of nests is out of scope and only harvest logging is included.

**Scope adjustments at Review 2 (version 3, see the Record of Changes BM03):**

(8) The detection model is named "YOLO" without a version (declared in the design document), and birds are counted by crossings of a closed ring around the entrance hole instead of a virtual line.

(9) Device setup becomes a main flow of the Farm Owner (Flow 10): scanning the device label and the floor QR code in the mobile app; a Technician may follow the same steps on any farm.

(10) The health assessment becomes a daily status per house combining the sources by agreement, with daily, weekly and monthly reports exportable to PDF and CSV, rated by the Farm Owner and the Domain Expert (Flow 11).

(11) Weather data from a public weather API is used as context for the health assessment, never to drive the actuators.

(12) The controller board measures the current of the pump and the fan to detect a load that does not run as commanded.

(13) Bypass switches are removed: the test house is borrowed and cannot be rewired; its existing switches remain the manual fallback.

(14) Both mobile push notifications and a Telegram bot are committed, and predator detection is removed from the possible extensions.

(15) Maintenance tickets, service levels (SLA), Technician regions and ticket statistics are removed: the Technician is the technical role that works on the devices of every farm without controlling relays; faults reach the Farm Owner as alerts that are sent again until acknowledged, and pump or fan wear raises a maintenance alert.

(16) One installation serves one owner of swiftlet houses and that owner's farms: the Administrator creates the Farm Owner's account, co-owners and the Domain Expert join by invitation, and there is no public sign-up. The health status is described as a rule-based indicator, not as an automatic expert.
