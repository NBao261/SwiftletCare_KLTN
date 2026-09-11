# 📋 WORKPLAN – SwiftletCare KLTN

## Kế hoạch Triển khai Chi tiết — 5 Thành viên / 16 Tuần (Tháng 9–12/2026)

> **Dựa trên:** SRS SwiftletCare v1.4.0 (IEEE 830-1998)  
> **Thời gian:** Tuần 1 (02/09/2026) → Tuần 16 (20/12/2026)  
> **Phương pháp:** Sprint 2 tuần × 8 Sprint | Mỗi Sprint có Review + Demo  
> **Repo:** GitHub – Branch strategy: `develop` ← `feat/*`, `fix/*`, `docs/*`

---

## 📌 Phân công Thành viên Cố định

| Ký hiệu | Vai trò                      | Chịu trách nhiệm chính                                                       |
| ------- | ---------------------------- | ---------------------------------------------------------------------------- |
| **M1**  | Hardware / Firmware Engineer | ESP32-S3 firmware, RS485 Modbus, PID, relay, mạch điện, sensor integration   |
| **M2**  | AI / ML Engineer             | Dataset, YOLO11 training, ByteTrack, RPi 5 Edge AI deployment, threat detect |
| **M3**  | Backend Developer            | Express API, MongoDB, MQTT, WebSocket, Alert Engine, MARKET module           |
| **M4**  | Frontend Developer           | ReactJS Dashboard, PWA, charts, realtime UI, Marketplace UI                  |
| **M5**  | QA + Tech Writer (Team Lead) | Integration test, E2E, kiểm thử thực tế, KLTN báo cáo, DevOps                |

> ⚠️ **M5 = chủ repo** → review PR, approve merge vào `develop`, maintain CI/CD, điều phối tech decisions.

---

## 🗓️ Tổng quan 16 Tuần (8 Sprints)

```
Sprint 1 (Tuần 1–2)   : 02/09 – 15/09  → Setup + Cơ sở hạ tầng + Hardware prototype
Sprint 2 (Tuần 3–4)   : 16/09 – 29/09  → Module AUTH + FARM + ENV (firmware)
Sprint 3 (Tuần 5–6)   : 30/09 – 13/10  → Module ENV (full) + VISION (AI pipeline)
Sprint 4 (Tuần 7–8)   : 14/10 – 27/10  → Module THREAT + ALERT + Real-time integration
Sprint 5 (Tuần 9–10)  : 28/10 – 10/11  → Module ANALYTICS + Dashboard charts
Sprint 6 (Tuần 11–12) : 11/11 – 24/11  → Module MARKET + PWA + Marketplace UI
Sprint 7 (Tuần 13–14) : 25/11 – 08/12  → Integration testing + Performance tuning + Bug fix
Sprint 8 (Tuần 15–16) : 09/12 – 20/12  → Final demo + Báo cáo KLTN + Deployment
```

---

## 🏗️ SPRINT 1 — Setup & Cơ sở hạ tầng (02/09 – 15/09)

> **Mục tiêu:** Toàn bộ team có thể dev/test độc lập trên môi trường riêng. Hardware prototype v1 lên breadboard.

### M1 — Hardware / Firmware

- [ ] Lắp breadboard ESP32-S3 + MAX485 + cảm biến SHT40 (Addr:1)
- [ ] Đấu nối RS485 daisy-chain: SHT40 → Lux → MultiGas → dB → SHT40-Out → Relay
- [ ] Test giao tiếp Modbus RTU cơ bản (đọc 1 register từ SHT40)
- [ ] Cấu hình PlatformIO project: `platformio.ini`, library dependencies
- [ ] Flash firmware skeleton lên ESP32-S3 (WiFi connect + Serial debug)

### M2 — AI / ML

- [ ] Setup Raspberry Pi 5: cài OS Bookworm 64-bit, Python 3.12+, OpenCV 4.10+
- [ ] Cấu hình IP Camera PoE: đấu nối qua Switch PoE, test RTSP stream
- [ ] Test RTSP capture trên RPi 5 (30 FPS, 2K resolution confirmed)
- [ ] Tạo Roboflow project cho dataset swiftlet: classes `swiftlet`, `rat`, `snake`, `owl`
- [ ] Thu thập batch ảnh đầu tiên (100+ frames từ camera thực tế hoặc YouTube)

### M3 — Backend

- [ ] Khởi tạo project: `npm init`, Express.js 5.x, TypeScript setup
- [ ] Cấu hình MongoDB Atlas (hoặc local Docker): tạo database `swiftletcare`
- [ ] Setup EMQX broker (Docker): test publish/subscribe cơ bản
- [ ] Tạo cấu trúc folder backend: `src/routes`, `src/models`, `src/services`, `src/middleware`
- [ ] Cấu hình ESLint + Prettier + Jest + Supertest
- [ ] Setup `.env` template: MONGO_URI, MQTT_URL, JWT_SECRET, S3_BUCKET

### M4 — Frontend

- [ ] Khởi tạo Vite 6 + React 19 + TypeScript project
- [ ] Cài đặt TailwindCSS 4, React Router v7, shadcn/ui
- [ ] Setup design system: color palette, typography, dark mode tokens
- [ ] Tạo layout shell: Sidebar + Header + Main content area
- [ ] Cài đặt Axios, socket.io-client, zustand, react-chartjs-2
- [ ] Setup Vite PWA plugin (`vite-plugin-pwa`) + Service Worker skeleton

### M5 — QA / Tech Lead

- [ ] Setup GitHub repo: branch protection rules, PR template, issue labels
- [ ] Cấu hình GitHub Actions CI: lint + build + test on PR
- [ ] Viết README.md: setup guide cho từng member
- [ ] Tạo Project Board (GitHub Projects): Sprint 1 backlog
- [ ] Setup Docker Compose: MongoDB + EMQX + Backend (dev environment)
- [ ] Viết test plan skeleton cho từng module (theo SRS section 13)

---

## 🔐 SPRINT 2 — AUTH + FARM + ENV Firmware (16/09 – 29/09)

> **Mục tiêu:** Đăng nhập hoạt động. CRUD Farm/House/Zone. ESP32 đọc được tất cả sensor.

### M1 — Firmware (ENV)

- [ ] Implement **Modbus Polling Task**: đọc lần lượt 5 sensor (SHT40, Lux, MultiGas, dB, SHT40-Out)
- [ ] Parse Modbus registers: temperature, humidity, lux, nh3_ppm, h2s_ppm, co2_ppm, tvoc_ppb, sound_db
- [ ] Implement **MQTT Publish Task**: publish JSON telemetry lên topic `swiftletcare/{farmId}/{houseId}/{zoneId}/telemetry`
- [ ] Implement **Heartbeat Task**: publish heartbeat mỗi 15 giây
- [ ] Implement **NVS Storage**: lưu WiFi credentials + MQTT config + sensor addresses
- [ ] Implement **OTA Update skeleton**: nhận firmware URL từ MQTT config topic
- [ ] Test offline: sensor đọc chính xác khi không có WiFi (log ra Serial)

### M3 — Backend (AUTH + FARM)

- [ ] **AUTH-FR-001/002**: API đăng ký (`POST /auth/register`) + đăng nhập (`POST /auth/login`)
- [ ] **AUTH-FR-003**: JWT Access Token (15 phút) + Refresh Token (30 ngày) middleware
- [ ] **AUTH-FR-004**: Role-based middleware: FARM_OWNER, OPERATOR, ADMINISTRATOR
- [ ] **AUTH-FR-005**: API mời Operator (`POST /farms/:id/members/invite`)
- [ ] **AUTH-FR-007**: Audit log middleware: ghi log mọi action vào collection `audit_logs`
- [ ] Mongoose schema: `users`, `farms`, `houses`, `zones`, `farm_memberships`
- [ ] **FARM-FR-001/002**: CRUD Farm + House + Zone APIs
- [ ] **FARM-FR-003/004**: API đăng ký thiết bị IoT Node + Camera Node (QR onboarding)
- [ ] **FARM-FR-007**: API gán thiết bị vào Zone

### M4 — Frontend (AUTH + FARM)

- [ ] Trang Login: email/password form + Google OAuth2 button
- [ ] Trang Register: form đăng ký + OTP verification UI
- [ ] Auth context (Zustand): JWT storage, auto-refresh, redirect logic
- [ ] Protected Route wrapper: redirect nếu chưa đăng nhập
- [ ] Trang Dashboard Home: layout placeholder cho các widget
- [ ] Trang Farm Management: list farms, create/edit farm modal
- [ ] Trang House & Zone: tree view farm → house → zone, CRUD modals
- [ ] Trang Device Management: list devices, status indicators, register device modal

### M2 — AI / ML (Dataset)

- [ ] Annotate 500+ frames trên Roboflow (bounding box cho 4 classes)
- [ ] Augmentation pipeline: flip, rotate, brightness, noise
- [ ] Export dataset: YOLOv8/YOLO11 format (train 80%, val 10%, test 10%)
- [ ] Train YOLO11n trên Google Colab GPU: 100 epochs, batch 16
- [ ] Evaluate mAP50, mAP50-95 → target: mAP50 ≥ 0.75

### M5 — QA

- [ ] Review + merge Sprint 2 PRs
- [ ] Viết test cases: AUTH module (đăng ký, đăng nhập, JWT refresh, phân quyền)
- [ ] Viết test cases: FARM module (CRUD farm, gán thiết bị)
- [ ] Test API bằng Postman: tạo collection `SwiftletCare API`
- [ ] Sprint 2 Demo: login → tạo farm → tạo zone → gán thiết bị

---

## 🌡️ SPRINT 3 — ENV Full + VISION AI Pipeline (30/09 – 13/10)

> **Mục tiêu:** Telemetry end-to-end: ESP32 → MQTT → Backend → Dashboard realtime. AI đếm chim chạy trên RPi.

### M1 — Firmware (ENV PID + Relay)

- [ ] **ENV-FR-010**: Implement PID Controller cho relay phun sương (humidity control)
- [ ] **ENV-FR-011**: Implement fan trigger logic: temp > max || NH3 > max || H2S > max || CO2 > max || TVOC > max
- [ ] **ENV-FR-012**: Implement heater trigger: temp < min
- [ ] **ENV-FR-013**: Implement light control: lux > max
- [ ] **ENV-FR-014**: Offline resilience: PID tiếp tục chạy khi mất WiFi
- [ ] **ENV-FR-015**: Relay status publish lên MQTT khi thay đổi
- [ ] **ENV-FR-016/017**: Manual Override nhận lệnh từ MQTT `relay/command` topic
- [ ] **ENV-FR-018**: Manual Override auto-expire sau 30 phút (timer task)
- [ ] Test PID tuning: Kp, Ki, Kd parameters cho humidity control

### M3 — Backend (ENV + Telemetry)

- [ ] MQTT subscriber service: listen `*/telemetry` topic, parse + validate payload
- [ ] **ENV-FR-004**: Lưu telemetry vào MongoDB time-series collection (`telemetry_records`)
- [ ] Anomaly detection: đánh dấu `is_anomaly = true` khi giá trị ngoài ngưỡng
- [ ] **ENV-FR-005**: WebSocket (socket.io) emit `TELEMETRY_UPDATE` khi nhận telemetry mới
- [ ] **ENV-FR-006/008**: API cấu hình ngưỡng (`PUT /devices/sensor-nodes/:id/thresholds`)
- [ ] **ENV-FR-009**: Ghi lịch sử thay đổi config vào `config_history` collection
- [ ] **ENV-FR-016**: API điều khiển relay (`POST /devices/sensor-nodes/:id/relay`)
- [ ] **ENV-FR-019**: Ghi log override history
- [ ] Mongoose schema: `sensor_nodes`, `telemetry_records`, `threshold_configs`

### M4 — Frontend (ENV Dashboard)

- [ ] Zone Dashboard: hiển thị real-time sensor cards (temp, humidity, lux, NH3, H2S, CO2, TVOC, dB)
- [ ] WebSocket integration: connect socket.io, listen `TELEMETRY_UPDATE`
- [ ] Gauge/Number cards: animated value updates khi nhận data mới
- [ ] Relay control panel: 4 relay buttons (Pump, Fan, Heater, Light) + ON/OFF toggle
- [ ] Manual Override UI: toggle mode, countdown timer hiển thị
- [ ] Threshold config modal: form input cho tất cả ngưỡng (temp, humidity, lux, 4 loại khí)
- [ ] Status bar: hiển thị device online/offline, last heartbeat time
- [ ] Outdoor vs Indoor comparison widget: SHT40 indoor vs SHT40 outdoor side-by-side

### M2 — AI / ML (VISION Pipeline)

- [ ] **VISION-FR-001**: RTSP capture pipeline trên RPi 5 (OpenCV VideoCapture)
- [ ] **VISION-FR-002**: YOLO11 inference loop: ONNX Runtime, target ≥ 25 FPS
- [ ] **VISION-FR-004**: Tích hợp ByteTrack tracker: maintain track IDs across frames
- [ ] **VISION-FR-005**: Virtual crossing line logic: detect ENTRY vs EXIT based on vector
- [ ] **VISION-FR-006**: MQTT publish bird count: `{entry_count, exit_count, timestamp, confidence}`
- [ ] PM2 process manager: auto-restart pipeline on crash
- [ ] Benchmark: log FPS, latency per frame, memory usage

### M5 — QA

- [ ] Test end-to-end: ESP32 → MQTT → Backend → WebSocket → Dashboard
- [ ] Viết integration test: telemetry ingestion pipeline
- [ ] Viết test cases: ENV threshold config + relay control
- [ ] Test offline resilience: ngắt WiFi ESP32, verify PID vẫn chạy
- [ ] Sprint 3 Demo: live sensor data → dashboard realtime → relay control

---

## ⚡ SPRINT 4 — THREAT + ALERT + Integration (14/10 – 27/10)

> **Mục tiêu:** Phát hiện thiên địch + Hệ thống cảnh báo đa kênh hoạt động end-to-end.

### M1 — Firmware (THREAT Audio)

- [ ] **THREAT-FR-005**: Đọc cảm biến tiếng ồn RS485 (dB sensor Addr:4)
- [ ] **THREAT-FR-006**: Detect speaker failure: dB giảm đột ngột > 70% baseline → publish alert
- [ ] **THREAT-FR-007**: Detect bird panic: spike noise pattern, continuous high dB → publish alert
- [ ] **THREAT-FR-009**: Heartbeat timeout logic: ESP32 self-monitor + reconnect
- [ ] **THREAT-FR-012**: Power outage detection: Watchdog reset → publish POWER_OUTAGE on boot
- [ ] **THREAT-FR-011**: Pump dry detection: relay ON + humidity không tăng sau 5 phút → alert

### M2 — AI / ML (THREAT Vision)

- [ ] **THREAT-FR-001**: Detect rat/snake/owl class với confidence ≥ 0.7
- [ ] **THREAT-FR-003**: Temporal filtering: ≥ 2 frames liên tiếp trước khi alert
- [ ] **THREAT-FR-002**: Capture snapshot frame (with bounding box) → upload S3/MinIO
- [ ] **THREAT-FR-004**: Severity mapping: snake/owl → CRITICAL, rat → HIGH
- [ ] MQTT publish threat alert: `{class, confidence, snapshot_url, severity, timestamp}`
- [ ] **THREAT-FR-010**: Self-monitor inference FPS: alert nếu < 10 FPS
- [ ] **VISION-FR-007**: Test Night Vision IR mode: verify detection accuracy in low light

### M3 — Backend (ALERT Engine)

- [ ] **ALERT-FR-001**: Alert Engine service: classify severity (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] **ALERT-FR-008**: Deduplication logic: same type + same zone within 5-minute window
- [ ] **ALERT-FR-002**: Firebase FCM integration: push notification < 3 giây
- [ ] **ALERT-FR-003**: Zalo ZNS integration: send template notification
- [ ] **ALERT-FR-004**: SMS fallback (Twilio/ESMS): send when network poor
- [ ] **ALERT-FR-005**: API cấu hình notification channels per event type
- [ ] **ALERT-FR-006**: Quiet hours logic: suppress non-CRITICAL during configured hours
- [ ] **ALERT-FR-009**: API acknowledge alert + add note
- [ ] Mongoose schema: `alerts`, `notification_configs`
- [ ] MQTT subscriber: listen `*/vision/alert`, `*/telemetry` anomaly, `*/heartbeat` timeout

### M4 — Frontend (ALERT UI)

- [ ] Notification Center page: list all alerts, filter by severity/type/zone
- [ ] Alert detail modal: snapshot image, severity badge, timestamp, acknowledge button
- [ ] Real-time alert toast: popup khi nhận `ALERT_NEW` WebSocket event
- [ ] Notification settings page: toggle channels (Push/Zalo/SMS) per event type
- [ ] Quiet hours config UI: time picker start/end
- [ ] Alert badge on sidebar: unread count indicator
- [ ] Sound alert: play warning sound on CRITICAL/HIGH alerts

### M5 — QA

- [ ] Test alert flow: sensor vượt ngưỡng → backend alert → FCM push → dashboard notification
- [ ] Test threat detection: giả lập chuột/rắn → snapshot capture → alert
- [ ] Test deduplication: trigger same alert nhiều lần trong 5 phút → chỉ 1 notification
- [ ] Test quiet hours: verify non-CRITICAL bị chặn
- [ ] Sprint 4 Demo: threat detection → multi-channel alert → acknowledge

---

## 📊 SPRINT 5 — ANALYTICS + Dashboard Charts (28/10 – 10/11)

> **Mục tiêu:** Dashboard analytics đầy đủ chart. Bird counting statistics + correlation report.

### M1 — Firmware (Stabilization)

- [ ] PID tuning: fine-tune Kp, Ki, Kd dựa trên data thực tế từ Sprint 3-4
- [ ] Fix bugs firmware từ Sprint 3-4 testing feedback
- [ ] Implement relay auto-resume after Manual Override timeout
- [ ] Stress test: chạy liên tục 72h → monitor memory leak, watchdog reset
- [ ] Optimize Modbus polling: reduce latency giữa các sensor reads

### M2 — AI / ML (Bird Statistics)

- [ ] **VISION-FR-008**: Backend logic: aggregate bird count by session (Morning OUT / Evening IN)
- [ ] **VISION-FR-009**: Calculate daily return rate formula
- [ ] **VISION-FR-010**: Store daily bird count history (MongoDB aggregation pipeline)
- [ ] **VISION-FR-011**: Alert when return_rate drops > 20% vs 7-day average
- [ ] Improve model accuracy: add more training data, retrain if mAP50 < 0.80
- [ ] **VISION-FR-013**: HLS live stream setup: FFmpeg → HLS → Video.js player
- [ ] **VISION-FR-015**: Video recording: save clips on event trigger (7-day retention)

### M3 — Backend (ANALYTICS APIs)

- [ ] **ANALYTICS-FR-001**: API `/telemetry/zones/:id/history` — query by time range + interval
- [ ] **ANALYTICS-FR-002**: API `/analytics/bird-count/daily` — entry/exit/return_rate per day
- [ ] **ANALYTICS-FR-002**: API `/analytics/bird-count/trends` — weekly/monthly bird trend
- [ ] **ANALYTICS-FR-003**: API `/analytics/correlation` — env metrics vs return rate correlation
- [ ] **ANALYTICS-FR-004**: API nest growth logging: CRUD manual nest count entries
- [ ] **ANALYTICS-FR-005**: API multi-zone comparison: aggregate telemetry across zones
- [ ] **ANALYTICS-FR-006**: API export PDF/CSV (use `pdfkit` + `csv-stringify`)
- [ ] **VISION-FR-012**: WebSocket emit `BIRD_COUNT_UPDATE` realtime during peak hours

### M4 — Frontend (Analytics Dashboard)

- [ ] **ANALYTICS-FR-001**: Telemetry history charts (Chart.js): line chart, time range selector (1h/6h/24h/7d/30d)
- [ ] **ANALYTICS-FR-002**: Bird count bar chart: daily entry/exit + return rate line overlay
- [ ] Bird trend chart: weekly/monthly trend line
- [ ] **ANALYTICS-FR-003**: Correlation scatter plot: temperature vs return_rate, humidity vs return_rate
- [ ] **ANALYTICS-FR-004**: Nest growth chart: manual entry form + trend visualization
- [ ] **ANALYTICS-FR-005**: Multi-zone comparison view: side-by-side zone charts
- [ ] **ANALYTICS-FR-007**: Heatmap component: temperature/humidity by hour-of-day
- [ ] **ANALYTICS-FR-006**: Export buttons: download PDF report, download CSV data
- [ ] **VISION-FR-012**: Live bird count widget: realtime counter during peak hours (5:30-7:00, 17:30-19:00)
- [ ] **VISION-FR-013**: Live camera stream page: Video.js HLS player + bounding box overlay

### M5 — QA

- [ ] Validate analytics data accuracy: compare backend aggregation vs raw telemetry
- [ ] Test chart rendering: various time ranges, empty data, large datasets
- [ ] Test export: verify PDF/CSV format + data completeness
- [ ] Performance test: dashboard load time ≤ 3 giây on 4G
- [ ] Sprint 5 Demo: analytics dashboard + bird statistics + live camera

---

## 🛒 SPRINT 6 — MARKET Module + PWA (11/11 – 24/11)

> **Mục tiêu:** Marketplace đăng bán yến hoạt động. PWA installable. Truy xuất nguồn gốc QR code.

### M1 — Firmware (Final Hardening)

- [ ] Đóng gói mạch vào hộp IP65: layout, domino wiring, DIN Rail mount relay
- [ ] Label tất cả dây: RS485 A/B, power 12V/5V, relay output
- [ ] Test toàn hệ thống trong hộp IP65: nhiệt độ hoạt động, ventilation
- [ ] Final OTA update flow: backend push firmware URL → ESP32 tải + flash
- [ ] Viết tài liệu hướng dẫn lắp đặt phần cứng (cho báo cáo KLTN)

### M2 — AI / ML (Final Model)

- [ ] Final model training: YOLO11s (larger variant) nếu mAP chưa đạt target
- [ ] Quantize model: ONNX → NCNN INT8 cho RPi 5
- [ ] Benchmark final model: FPS, mAP50, memory usage
- [ ] Edge case testing: nhiều chim bay cùng lúc, ánh sáng yếu, rain/fog
- [ ] Viết tài liệu AI pipeline (cho báo cáo KLTN): kiến trúc, dataset, metrics

### M3 — Backend (MARKET)

- [ ] Mongoose schema: `harvest_batches`, `nest_listings`, `contact_inquiries`
- [ ] **MARKET-FR-001**: API tạo Harvest Batch (`POST /harvests`)
- [ ] **MARKET-FR-002/003**: Auto-attach env_snapshot (7d avg) + flock_snapshot (30d return rate)
- [ ] **MARKET-FR-004**: Auto-generate Trace Code (UUID v4) + QR code generation
- [ ] **MARKET-FR-005**: API update/soft-delete Harvest Batch
- [ ] **MARKET-FR-006**: API tạo Nest Listing (`POST /marketplace/listings`)
- [ ] **MARKET-FR-008**: Public API: list Nest Listings (no auth) with filter/sort/pagination
- [ ] **MARKET-FR-009**: Public API: get Listing detail + Traceability Card data
- [ ] **MARKET-FR-010**: API send contact inquiry (`POST /marketplace/inquiries`)
- [ ] **MARKET-FR-011**: Public API: lookup by Trace Code (`GET /marketplace/trace/:code`)
- [ ] **MARKET-FR-012**: API listing analytics: view count, inquiry count
- [ ] **MARKET-FR-013**: Public API: farm profile (`GET /marketplace/farms/:id/profile`)

### M4 — Frontend (Marketplace + PWA)

- [ ] Harvest Management page (Owner): list batches, create batch form, image upload
- [ ] Nest Listing Management page (Owner): create listing from batch, pricing, status toggle
- [ ] **Public Marketplace page** (Buyer, no auth): grid of listings, filter sidebar, search
- [ ] **Listing Detail page** (Buyer): product images, traceability card, env charts, farm info
- [ ] **QR Trace page** (Buyer): scan QR code or input trace code → show traceability info
- [ ] Contact Owner form: email/phone/Zalo inquiry submission
- [ ] Owner Analytics page: listing views, inquiry count per listing
- [ ] PWA finalization: manifest.json, icons, splash screen, offline dashboard cache
- [ ] PWA install prompt: "Add to Home Screen" banner
- [ ] Mobile responsive: test on 375px, 768px, 1920px breakpoints

### M5 — QA

- [ ] Test Marketplace flow: create harvest → create listing → buyer views → trace QR
- [ ] Test env_snapshot accuracy: compare snapshot data vs actual telemetry records
- [ ] Test PWA: install on iOS Safari + Android Chrome, offline mode
- [ ] Lighthouse audit: target Performance ≥ 80, PWA ≥ 90
- [ ] Sprint 6 Demo: marketplace + QR traceability + PWA install

---

## 🔧 SPRINT 7 — Integration Testing + Performance (25/11 – 08/12)

> **Mục tiêu:** Toàn hệ thống hoạt động ổn định. Fix bugs. Tối ưu performance.

### M1 — Hardware (Field Testing)

- [ ] Lắp đặt hệ thống trong nhà yến thực tế (nếu có access)
- [ ] Chạy liên tục 5–7 ngày: monitor stability, sensor drift, relay cycling
- [ ] Calibrate sensors: so sánh giá trị sensor với thiết bị đo chuẩn
- [ ] Fix hardware bugs: loose connections, power stability, EMI issues
- [ ] Document: bảng số liệu hiệu chuẩn, ảnh chụp lắp đặt

### M2 — AI (Field Testing)

- [ ] Deploy AI pipeline trong môi trường thực tế
- [ ] Thu thập thêm data thực tế → fine-tune model
- [ ] Đánh giá false positive/negative rate trong 5 ngày liên tục
- [ ] Optimize memory: reduce RAM usage nếu cần
- [ ] Night vision test: verify detection accuracy at dawn/dusk

### M3 — Backend (Performance + Security)

- [ ] API performance audit: response time P95 ≤ 500ms (k6 load test)
- [ ] MongoDB indexing: compound indexes on telemetry, alerts, listings
- [ ] WebSocket load test: 100 concurrent connections (Artillery)
- [ ] Security hardening: rate limiting, input sanitization, helmet headers
- [ ] **AUTH-FR-006**: Implement 2FA TOTP (Google Authenticator) — tùy chọn
- [ ] Fix all backend bugs from Sprint 1-6
- [ ] API documentation: Swagger/OpenAPI spec

### M4 — Frontend (Polish + Accessibility)

- [ ] UI polish: loading states, empty states, error states cho mọi page
- [ ] Responsive testing: fix layout issues on mobile/tablet
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation
- [ ] Dark mode refinement: ensure all components work in dark theme
- [ ] Animation: smooth transitions, skeleton loading
- [ ] Fix all frontend bugs from Sprint 1-6

### M5 — QA (E2E + Performance)

- [ ] **E2E Test Suite**: Playwright automated tests cho critical flows:
  - [ ] Auth flow: register → login → refresh token → logout
  - [ ] Farm flow: create farm → create zone → register device
  - [ ] ENV flow: view telemetry → control relay → set threshold
  - [ ] Alert flow: trigger alert → receive notification → acknowledge
  - [ ] Market flow: create harvest → create listing → buyer trace
- [ ] **Performance testing**: k6 load test report (100 req/s target)
- [ ] **MQTT stress test**: 1000 msg/s throughput (MQTT Bench)
- [ ] **Hardware test**: offline resilience 24h test
- [ ] Bug triage: classify P0/P1/P2, assign to responsible member
- [ ] Regression testing: re-run all test cases after bug fixes

---

## 🎓 SPRINT 8 — Final Demo + Báo cáo KLTN (09/12 – 20/12)

> **Mục tiêu:** Demo hoàn chỉnh trước giảng viên. Nộp báo cáo KLTN. Deployment.

### M1 — Hardware (Documentation)

- [ ] Chương 4 báo cáo KLTN: Thiết kế phần cứng (BOM, sơ đồ, RS485 topology)
- [ ] Chương 5 báo cáo KLTN: Firmware (PID, Modbus polling, MQTT protocol)
- [ ] Ảnh chụp sản phẩm phần cứng: breadboard, hộp IP65, lắp đặt
- [ ] Video demo firmware: sensor readings, relay control, offline resilience
- [ ] Bàn giao: source code firmware + schematic + hướng dẫn lắp đặt

### M2 — AI (Documentation)

- [ ] Chương 6 báo cáo KLTN: Computer Vision (dataset, YOLO11, ByteTrack, deployment)
- [ ] Training results: confusion matrix, mAP charts, FPS benchmarks
- [ ] Demo video: bird counting real-time, threat detection
- [ ] Bàn giao: trained model files (.onnx, .ncnn), training notebooks, dataset

### M3 — Backend (Deployment + Documentation)

- [ ] Deploy backend lên VPS/Cloud: Docker Compose production stack
- [ ] Setup Nginx reverse proxy: HTTPS, WebSocket, CORS
- [ ] Database backup strategy: daily mongodump scheduled
- [ ] Chương 7 báo cáo KLTN: Backend architecture (API, MQTT, MongoDB, Alert Engine)
- [ ] API documentation final: Swagger hosted, Postman collection exported

### M4 — Frontend (Deployment + Documentation)

- [ ] Build production: `npm run build` → deploy lên Vercel/Cloudflare Pages
- [ ] Domain + SSL: configure custom domain nếu có
- [ ] Chương 8 báo cáo KLTN: Frontend (React, PWA, Dashboard, Marketplace)
- [ ] Screenshots: tất cả màn hình chính cho báo cáo
- [ ] Demo video: walkthrough toàn bộ UI flows

### M5 — QA / Team Lead (Final Delivery)

- [ ] Chương 1-3 báo cáo KLTN: Giới thiệu, tổng quan, phân tích yêu cầu
- [ ] Chương 9 báo cáo KLTN: Kiểm thử (test plan, test results, performance report)
- [ ] Chương 10 báo cáo KLTN: Kết luận + Hướng phát triển
- [ ] Tổng hợp báo cáo: format theo template KLTN, mục lục, danh mục hình/bảng
- [ ] Chuẩn bị slide thuyết trình (15-20 slides)
- [ ] Demo rehearsal: chạy thử demo trước team ít nhất 2 lần
- [ ] Final deployment verification: tất cả hệ thống online + stable
- [ ] Submit: nộp source code + báo cáo + video demo

---

## 📐 Ma trận Trách nhiệm (RACI)

| Module        | M1 (HW)       | M2 (AI)     | M3 (BE)     | M4 (FE)     | M5 (QA)            |
| ------------- | ------------- | ----------- | ----------- | ----------- | ------------------ |
| **AUTH**      | —             | —           | **R**       | **R**       | C/A                |
| **FARM**      | C             | —           | **R**       | **R**       | C/A                |
| **ENV**       | **R**         | —           | **R**       | **R**       | C/A                |
| **VISION**    | —             | **R**       | **R**       | **R**       | C/A                |
| **THREAT**    | **R**         | **R**       | **R**       | **R**       | C/A                |
| **ALERT**     | C             | C           | **R**       | **R**       | C/A                |
| **ANALYTICS** | —             | C           | **R**       | **R**       | C/A                |
| **MARKET**    | —             | —           | **R**       | **R**       | C/A                |
| **Hardware**  | **R**         | —           | —           | —           | C/A                |
| **AI Model**  | —             | **R**       | —           | —           | C/A                |
| **DevOps**    | —             | —           | C           | C           | **R**              |
| **Báo cáo**   | **R** (Ch4-5) | **R** (Ch6) | **R** (Ch7) | **R** (Ch8) | **R** (Ch1-3,9-10) |

> **R** = Responsible (thực hiện), **A** = Approve, **C** = Consulted

---

## ⚡ Quy tắc Làm việc

### Git Workflow

- Branch naming: `feat/<module>-<task>`, `fix/<module>-<bug>`, `docs/<section>`
- Mỗi task = 1 PR vào `develop` → M5 review + approve
- Commit message: theo `.agents/skills/git-commit-convention`
- Không push thẳng vào `main` — chỉ merge từ `develop` khi release

### Sprint Ceremony

- **Sprint Planning** (Thứ 2 đầu Sprint): phân task, estimate, set Sprint Goal
- **Daily Standup** (15 phút): mỗi ngày hoặc mỗi 2 ngày tùy team
- **Sprint Review** (Thứ 6 cuối Sprint): demo cho team + giảng viên (nếu có)
- **Sprint Retro** (sau Review): what went well / what to improve

### Definition of Done

- [ ] Code reviewed + approved bởi ít nhất 1 member khác
- [ ] Unit tests passed (nếu applicable)
- [ ] No lint errors
- [ ] Feature hoạt động trên môi trường develop
- [ ] Documentation cập nhật (nếu API/schema thay đổi)

---

> **Cập nhật lần cuối:** 11/09/2026 — Dựa trên SRS v1.4.0  
> **Tổng task:** ~220 tasks | **Sprint:** 8 × 2 tuần | **Team:** 5 members
