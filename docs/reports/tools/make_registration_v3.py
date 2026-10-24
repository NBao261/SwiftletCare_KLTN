"""Build registration form v3 from the v2 Word file.

The v2 file holds the members' phone numbers, so it stays outside the repository and the
phone cells of the output are emptied; add them to the copy that is submitted.

Usage: python3 docs/reports/tools/make_registration_v3.py <v2.docx> <out.docx>
"""
import copy, re, sys, docx
SRC=sys.argv[1]
OUT=sys.argv[2]
d=docx.Document(SRC)
P=d.paragraphs

def set1(i, text):
    p=P[i]; p.runs[0].text=text
    for r in p.runs[1:]: r.text=''
def set2(i, label, body):
    p=P[i]; p.runs[0].text=label; p.runs[1].text=' '+body
    for r in p.runs[2:]: r.text=''
inserts=[]  # (after_index, label or None, body)
def after(i, label, body): inserts.append((i,label,body))

# B. Proposed solutions
set1(22,'We propose SwiftletCare, an automated control and monitoring system consisting of an edge controller with industrial sensors, actuators and load-current sensing in each zone of the house, an AI camera pipeline that reads the camera at the bird entrance and runs on a desktop PC, and a cloud backend with web and mobile applications.')
set1(25, P[25].runs[0].text+' Current transformers on the pump and fan circuits let the controller check that each load actually runs when its relay is on.')
set1(27,'A lightweight detection and tracking pipeline (YOLO + ByteTrack) processes the video of the bird entrance, counts birds leaving in the morning and returning in the evening by their crossings of a closed ring drawn around the entrance hole, and computes the daily return rate of the house. The video is streamed live with a bounding box drawn on every tracked bird, so that the count can be verified visually.')
set1(29,'The system combines three sources of evidence (environmental sensors, noise level, and flock movement from the camera) to assess the condition of the house and of its own equipment: faulty or drifting sensors, a pump running dry, a pump or fan that draws no current, speaker failure, device offline, abnormal noise, forecast threshold breaches and drops in the return rate. Each day the system gives every house one health status that combines the sources by agreement between them, with its reasons and with the day\'s weather from a public weather service as context; daily, weekly and monthly reports can be downloaded as PDF or CSV. The system acts as the primary, automatic expert; a human Domain Expert reviews its assessments, confirms or rejects its inferred alerts, and adjusts thresholds and control coefficients. The Farm Owner and the Domain Expert rate each day from their own observation, and the agreement between the system and these ratings is measured.')
# C.1
set2(34,'Self-Protection & Self-Diagnosis:','Detect sensor faults and RS485 bus failure, implausible sensor behaviour (stuck values, impossible jumps, drift between devices), a pump running dry, a pump or fan that does not draw current as commanded, speaker failure, power loss and device offline; move the affected actuator to a safe state where applicable and raise an alert.')
set2(37,'Health Assessment & Alerts:','Classify alerts by severity, merge repeated occurrences of the same incident, close them automatically when conditions recover; give each house one daily health status combining environment, air quality, return rate and abnormal noise by agreement, with its reasons and the weather of the day, and produce daily, weekly and monthly health reports exportable to PDF and CSV.')
# C.2
after(39,'Device Setup:','Add a controller to a zone in the mobile app by scanning the QR code on its label (device ID and activation key) and the QR code of the floor; only the Wi-Fi network is entered on the device. Move a controller to another floor or remove it the same way, and follow the setup until the configuration is applied.')
after(41,'Daily Health & Reports:','See the daily health status of each house with its reasons, read and download the daily, weekly and monthly reports, and rate each day from own observation before the status is shown.')
set2(42,'Alerts:','Receive real-time alerts in the web and mobile applications, and on the phone through both mobile push notifications and a Telegram bot; acknowledge them with a note.')
# C.3
set2(47,'Review:','Access the environmental data, control performance, flock trends, daily health statuses and health reports of the farms the expert is invited to.')
after(49,'Rating:','Rate each day of the house from own observation before the system status is shown, so that the agreement between the system and the practitioners can be measured.')
# C.4
set2(52,'Technician:','Install devices on an installation ticket (following the same setup steps as the Farm Owner), and handle maintenance requests and firmware updates.')
set2(53,'Administrator:','Manage user accounts, the device stock with its printed labels, and system-wide default settings.')
# D
set2(60,'Flow 6: Bird Counting Session:','During the morning exit and evening return sessions, the AI pipeline detects and tracks birds at the entrance, counts their crossings of the ring around the entrance hole in each direction and publishes the counts of the house, while the live stream shows a box on each tracked bird. At the end of the day the return rate is computed; a drop of more than the house\'s threshold (default 20%) against the average of the previous 7 days raises an alert.')
set2(62,'Flow 8: Expert Validation & Tuning:','The system produces the health reports and, when enough data is available, a suggested set of control coefficients. The Domain Expert reviews them, confirms or rejects the inferred alerts, approves or adjusts the parameters, and writes a conclusion for the Farm Owner. The new parameters are sent to the controller and their effect is visible in the control-performance chart.')
set2(63,'Flow 9: Manual Override:','The Farm Owner switches an actuator from the application for a limited duration; the controller applies it, reports manual mode, and returns to automatic control when the duration expires. If the controller itself fails, the existing electrical switches of the house, outside the system, remain the manual fallback, and the current sensing reports when a load does not run as commanded.')
set2(64,'Flow 10: Device Setup by the Farm Owner:','The Administrator adds the device to the stock and prints its label. The Farm Owner scans the label and the QR code of the floor in the mobile app and enters the Wi-Fi network on the device; the backend registers the device to that zone, sends it its zone and configuration at its first connection, and the application shows when the configuration is applied. Nothing about the farm is typed on the device.')
after(64,'Flow 11: Daily Health Assessment & Periodic Reports:','After the evening session, the system rates the environment, air quality, return rate and abnormal noise of each house against the house\'s levels, combines them by agreement into one daily status (good, watch, action or insufficient data) with its reasons and the weather of the day, and notifies the Farm Owner and the Domain Expert. Each of them rates the day from their own observation before the status is shown. Weekly and monthly reports aggregate the days, and every report can be downloaded as PDF or CSV.')
inserts.append((64,'Supporting flows:','Maintenance requests (tickets), account and access management, and harvest logging support the main flows; a Technician performs device setup only on an installation ticket.'))
# E
set2(69,'Accuracy & Evidence:','Counting accuracy is evaluated against manual counts on recorded video under different lighting conditions (Precision, Recall, counting error); the forecast error is reported as mean absolute error; the agreement between the daily health status and the practitioners\' independent ratings is reported.')
# 3.2
set1(75,'AI / Computer Vision: OpenCV, YOLO (nano/lightweight; the version is declared in the design document), ByteTrack (Object tracking), ONNX Runtime.')
set1(76,'Backend: NodeJS / Express (TypeScript), MongoDB, MQTT Broker (EMQX), Socket.io, MinIO (file storage); a public weather API (Open-Meteo) for weather context.')
set1(79,'An operational IoT Hardware Controller Prototype (ESP32 with RS485 sensors, relay module, load-current sensing and attractant speaker) performing autonomous micro-climate control, and an AI Camera Node for the bird entrance (IP camera and a desktop PC running the pipeline).')
set1(81,'A fully functional Web & Mobile Application for monitoring environmental data, viewing swiftlet count analytics and the annotated live stream, receiving alerts, manual override, device setup by QR code, daily health status and reports with PDF/CSV export, harvest logging, and expert validation and tuning.')
set1(82,'A scalable Cloud Backend handling real-time time-series telemetry, swiftlet counting logs, alert dispatching, forecasting, daily health assessment and periodic reports.')
set1(83,'An evaluation report: control performance (time in range, relay switching), counting accuracy, response latency, the results of the offline-recovery and fault scenarios, and the agreement between the daily health status and the practitioners\' ratings.')
set1(85,'Task 1: Design circuit schematics (controller board with load-current sensing), assemble the prototype (sensors, relays, speaker), and code ESP32 firmware for sensor reading and filtering, fuzzy control, fault detection, offline buffering, and MQTT communication.')
set1(87,'Task 3: Build Backend API (NodeJS/Express), set up MQTT Broker, design database schemas (MongoDB) for sensor telemetry, count logs, alerts, harvests and daily health statuses, and implement the alert engine, forecasting, daily health assessment, periodic reports and WebSocket channels.')
set1(88,'Task 4: Build Web Dashboard (React.js) and Mobile App (React Native) for the Farm Owner and the Domain Expert: monitoring, swiftlet counting analytics and live stream, real-time alert notifications, manual override, device setup by QR code, daily health status, reports and ratings, harvest logging, and expert validation and tuning.')
set1(89,'Task 5: Define the automation scenarios, deploy empirical system runs in a simulated/real swiftlet environment, measure control performance, counting accuracy (Precision/Recall), response latency and the agreement of the daily health status with the practitioners\' ratings, review the related literature, obtain validation from a swiftlet-farming practitioner, test, and write the thesis/scientific paper.')
# 4
set1(91,'The hardware prototype will be built with fail-safe hardware watchdogs and load-current sensing on the pump and fan. The test house is borrowed and its electrical installation cannot be modified, so no bypass switch is added: if the controller fails, the house\'s existing switches remain the manual fallback.')
rv=[
 'Scope adjustments at Review 2 (version 3, see the Record of Changes BM03):',
 '(8) The detection model is named "YOLO" without a version (declared in the design document), and birds are counted by crossings of a closed ring around the entrance hole instead of a virtual line.',
 '(9) Device setup becomes a main flow of the Farm Owner (Flow 10): scanning the device label and the floor QR code in the mobile app; the Technician installs devices only on an installation ticket.',
 '(10) The health assessment becomes a daily status per house combining the sources by agreement, with daily, weekly and monthly reports exportable to PDF and CSV, rated by the Farm Owner and the Domain Expert (Flow 11).',
 '(11) Weather data from a public weather API is used as context for the health assessment, never to drive the actuators.',
 '(12) The controller board measures the current of the pump and the fan to detect a load that does not run as commanded.',
 '(13) Bypass switches are removed: the test house is borrowed and cannot be rewired; its existing switches remain the manual fallback.',
 '(14) Both mobile push notifications and a Telegram bot are committed, and predator detection is removed from the possible extensions.',
]
# apply inserts from the bottom up so indices stay valid
def clone_after(src_par, ref_par):
    new=copy.deepcopy(src_par._p); ref_par._p.addnext(new)
    return docx.text.paragraph.Paragraph(new, ref_par._parent)
ref=P[101]
for t in rv:
    np_=clone_after(P[101], ref); np_.runs[0].text=t
    for r in np_.runs[1:]: r.text=''
    ref=np_
# group inserts by index, keep order: for the same index the later one goes after the earlier
from collections import defaultdict
g=defaultdict(list)
for i,l,b in inserts: g[i].append((l,b))
for i in sorted(g, reverse=True):
    ref=P[i]
    for l,b in g[i]:
        np_=clone_after(P[i], ref); np_.runs[0].text=l; np_.runs[1].text=' '+b
        for r in np_.runs[2:]: r.text=''
        ref=np_
# drop phone numbers (personal data stays out of the repository)
for t in d.tables:
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                if re.fullmatch(r'\s*0\d{9}\s*', p.text):
                    for r in p.runs: r.text=''
d.save(OUT)
