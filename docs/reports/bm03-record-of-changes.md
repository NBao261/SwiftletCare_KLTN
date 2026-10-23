# BM03 – Registration Form: Record of Changes

Draft of form BM03, which goes with the proposed final registration form (`registration-v3.md`). The filled Word file is `registration/SWP490_R2_BM03_Record_of_Changes_SwiftletCare.docx`. It is generated from the table below, so edit this file first and then regenerate the Word file. The approved project code and title stay unchanged.

## 1. Project Information

| Field | Value |
| --- | --- |
| Project code | `[TEAM: approved project code]` |
| Project name | SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming |
| Team | Nguyễn Chí Bảo (Leader), Trần Minh Kiệt, Nguyễn Vũ Len, Nguyễn Thị Yến Nhi, Thái Minh Tuấn |
| Supervisor | `[TEAM: supervisor name]` |
| Current registration version | v2 (after Review 1) |
| Proposed version | v3 |
| Version | 1.0 |
| Date | 23/10/2026 |

## 2. Changes

☐ No changes to the current registration form

| No. | Section | Current content | Proposed content | Reason | Proposed by |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.1 B (Entry/Exit Counting), D Flow 6, 3.2 a) | "YOLOv8 + ByteTrack … counts birds … by virtual-line crossing"; "YOLOv8 (nano/lightweight)" | "YOLO + ByteTrack … by their crossings of a closed ring drawn around the entrance hole"; the model version is declared in the SDD | Iteration 1 finding: on the entrance clips (22/10/2026) a bird at the hole is a 1–2-frame blur and leaves in every direction, so a straight line misses birds; the model version changes while training and is a design choice, not scope | Team |
| 2 | 3.1 C.2, C.4, D (supporting flow "Installation & Activation") | A Technician installs, activates and provisions every device; device setup is a supporting flow | Main Flow 10 "Device Setup by the Farm Owner": the Farm Owner scans the device label QR code and the floor QR code in the mobile app and enters only Wi-Fi; the Administrator keeps the device stock and prints labels; a Technician does the same steps only on an installation ticket | Review 1 feedback: the supervisor asked that setting up a device be as simple as possible for the owner | Supervisor (Review 1) |
| 3 | 3.1 B (Multi-Modal Health), C.1 Health Assessment, C.2, C.3, D Flow 8, new Flow 11, E Accuracy, 3.2 b) c) | "Produce a periodic health summary for each zone"; no report export | One daily health status per house that combines environment, air quality, return rate and abnormal noise by agreement, with its reasons; daily, weekly and monthly reports exportable to PDF and CSV; the Farm Owner and the Domain Expert rate each day before seeing the status; agreement measured | Makes "multi-modal health monitoring" a concrete, measurable output instead of a list of alerts; reports per house match the farm's daily practice | Team |
| 4 | 3.1 B, 3.2 a) | No weather data | Hourly weather of the farm's location from a public weather API (Open-Meteo), used as context for the health status and the charts, never to drive the actuators | Rain explains a low return rate and avoids false alarms; no extra hardware is needed | Team |
| 5 | 3.1 B (Micro-Climate Control), C.1 Self-Protection, 3.2 b), Task 1, section 4 | No measurement of the actuator current | The team's controller board measures the current of the pump and the fan (current transformers) and raises an alert when a load does not run as its relay commands | Iteration 1: a relay state alone does not show whether the pump or fan really runs (burnt motor, tripped breaker, welded relay) | Team |
| 6 | 3.1 D Flow 9, Task 1, section 4 | Physical bypass switches at the cabinet so that the pump and fan can be run by hand | Removed; when the controller fails, the existing switches of the house, outside the system, are the manual fallback, and the current sensing reports a load that does not run | Constraint from the partner: the test house is borrowed and its electrical installation cannot be modified | Team |
| 7 | 3.1 C.2 Alerts, section 4 (6) | Telegram bot **or** mobile push | Both mobile push notifications (FCM) and a Telegram bot | Team decision: push reaches users of the mobile app, Telegram reaches owners who do not open it | Team |
| 8 | Section 4 (4) | Predator detection kept as a possible extension if time allows | Predator detection removed; vision is one class (swiftlet) | Review 1 feedback: focus the computer-vision work on counting | Team |

Accepted reasons follow the Review 2 guideline: Review 1 feedback, findings from Iteration 1, or constraints from data, partners or technology. None of these changes reduces the business complexity of the project: changes 2, 3, 4 and 5 add work, change 6 is forced by the partner, and change 1 replaces one counting geometry with a harder one.

## 3. Decision at Review 2 (completed by reviewers)

| No. | Decision (Accepted / Adjusted / Rejected) | Reviewer note |
| --- | --- | --- |
| 1–8 | | |
