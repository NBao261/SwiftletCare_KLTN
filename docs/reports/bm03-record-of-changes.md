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
| Version | 1.1 |
| Date | 26/10/2026 |

## 2. Changes

☐ No changes to the current registration form

| No. | Section | Current content | Proposed content | Reason | Proposed by |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.1 B (Entry/Exit Counting), D Flow 6, 3.2 a) | "YOLOv8 + ByteTrack … counts birds … by virtual-line crossing"; "YOLOv8 (nano/lightweight)" | "YOLO + ByteTrack … by their crossings of a closed ring drawn around the entrance hole"; the model version is declared in the SDD | Iteration 1 finding: on the entrance clips (22/10/2026) a bird at the hole is a 1–2-frame blur and leaves in every direction, so a straight line misses birds; the model version changes while training and is a design choice, not scope | Team |
| 2 | 3.1 C.2, C.4, D (supporting flow "Installation & Activation") | A Technician installs, activates and provisions every device; device setup is a supporting flow | Main Flow 10 "Device Setup by the Farm Owner": the Farm Owner scans the device label QR code and the floor QR code in the mobile app and enters only Wi-Fi; the Administrator keeps the device stock and prints labels; a Technician may follow the same steps on any farm of the installation, and the Farm Owners are notified of each such action | Review 1 feedback: the supervisor asked that setting up a device be as simple as possible for the owner | Supervisor (Review 1) |
| 3 | 3.1 B (Multi-Modal Health), C.1 Health Assessment, C.2, C.3, D Flow 8, new Flow 11, E Accuracy, 3.2 b) c) | "Produce a periodic health summary for each zone"; no report export | One daily health status per house that combines environment, air quality, return rate and abnormal noise by agreement, with its reasons; daily, weekly and monthly reports exportable to PDF and CSV; the Farm Owner and the Domain Expert rate each day before seeing the status; agreement measured | Makes "multi-modal health monitoring" a concrete, measurable output instead of a list of alerts; reports per house match the farm's daily practice | Team |
| 4 | 3.1 B, 3.2 a) | No weather data | Hourly weather of the farm's location from a public weather API (Open-Meteo), used as context for the health status and the charts, never to drive the actuators | Rain explains a low return rate and avoids false alarms; no extra hardware is needed | Team |
| 5 | 3.1 B (Micro-Climate Control), C.1 Self-Protection, 3.2 b), Task 1, section 4 | No measurement of the actuator current | The team's controller board measures the current of the pump and the fan and raises an alert when a load does not run as its relay commands | Iteration 1: a relay state alone does not show whether the pump or fan really runs (burnt motor, tripped breaker, welded relay) | Team |
| 6 | 3.1 D Flow 9, Task 1, section 4 | Physical bypass switches at the cabinet so that the pump and fan can be run by hand | Removed; when the controller fails, the existing switches of the house, outside the system, are the manual fallback, and the current sensing reports a load that does not run | Constraint from the partner: the test house is borrowed and its electrical installation cannot be modified | Team |
| 7 | 3.1 C.2 Alerts, section 4 (6) | Telegram bot **or** mobile push | Both mobile push notifications (FCM) and a Telegram bot | Team decision: push reaches users of the mobile app, Telegram reaches owners who do not open it | Team |
| 8 | Section 4 (4) | Predator detection kept as a possible extension if time allows | Predator detection removed; vision is one class (swiftlet) | Review 1 feedback: focus the computer-vision work on counting | Team |
| 9 | 3.1 C.4, D (supporting flows), Flow 4 | The Technician installs devices on an installation ticket and handles maintenance requests; supporting flow "Maintenance requests (tickets)" with routing by region, service levels (SLA), ticket statistics, chat and periodic maintenance; the Administrator also manages farms | No tickets, SLA, Technician regions, ticket statistics or chat. The Technician is the system's technical role: works on the devices of every farm (setup, move, removal, remote diagnosis, restart, configuration push, firmware update) without controlling relays or seeing environmental data, and the Farm Owners are notified of every such action. Device faults reach the Farm Owner as alerts that are sent again until acknowledged; pump or fan wear raises a maintenance alert. Only Farm Owners create and manage farms | Review 1 feedback: the project looked "more like a platform than a system"; the supervisor asked to keep the Technician only as a role for technical work | Review 1 council, supervisor |
| 10 | 3.1 B, C.4 Administrator, section 4 | Any Farm Owner signs up publicly; the health status is described as "the primary, automatic expert" | One installation serves one owner of swiftlet houses and that owner's farms: the Administrator creates the Farm Owner's account, co-owners and the Domain Expert join by invitation, no public sign-up. The health status is a rule-based indicator, not an automatic expert | Same Review 1 feedback as row 9: open sign-up for unrelated owners is what a multi-customer platform does; a system for one owner's houses does not need it. "Automatic expert" claimed a diagnosis that the rules cannot give | Team |
| 11 | 3.1 B, C.1, D Flows 4 and 9 | "Pump running dry" alert; "power loss" alert; manual override of any length up to the general limit | "Misting that does not raise the humidity" (the system cannot tell a dry pump from an empty tank, a clogged nozzle or an open door); "unexpected restart" with its reset reason; a manual pump ON lasts at most 30 minutes and needs a confirmation while a sensor or misting alert is open | Iteration 1 review of the specification: the alert names must not claim a cause the sensors cannot measure, and a remote manual pump command must not run unattended for hours on a faulty sensor | Team |

Accepted reasons follow the Review 2 guideline: Review 1 feedback, findings from Iteration 1, or constraints from data, partners or technology. Changes 1–8 do not reduce the business complexity of the project: changes 2, 3, 4 and 5 add work, change 6 is forced by the partner, and change 1 replaces one counting geometry with a harder one. Change 9 removes only supporting functions that serve a service company rather than the house; no main flow loses a step, and Flow 4 gains the repeated alert and the maintenance alert. Change 10 removes only the public sign-up page; every role and main flow stays. Change 11 renames two alerts and adds a limit and a confirmation; it removes nothing.

## 3. Decision at Review 2 (completed by reviewers)

| No. | Decision (Accepted / Adjusted / Rejected) | Reviewer note |
| --- | --- | --- |
| 1–11 | | |
