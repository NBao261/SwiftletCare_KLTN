# 📋 WORKPLAN – SwiftletCare KLTN
## Kế hoạch Triển khai Chi tiết — 5 Thành viên / 8 Tuần (Tháng 9–10/2026)

> **Dựa trên:** SRS SwiftletCare v1.0.0 (IEEE 830-1998)  
> **Thời gian:** Tuần 1 (08/09/2026) → Tuần 8 (31/10/2026)  
> **Phương pháp:** Sprint 2 tuần × 4 Sprint | Mỗi Sprint có Review + Demo

---

## 📌 Phân công Thành viên Cố định

| Ký hiệu | Vai trò | Chịu trách nhiệm chính |
| ------- | ------- | ---------------------- |
| **M1**  | Hardware Engineer | ESP32 firmware, PID, cảm biến, relay, mạch điện |
| **M2**  | AI/ML Engineer | Dataset, YOLOv8, ByteTrack, RPi deployment |
| **M3**  | Backend Developer | Express API, MongoDB, MQTT, WebSocket, Alert Engine |
| **M4**  | Frontend Developer | ReactJS Dashboard, PWA, charts, realtime UI |
| **M5**  | QA + Tech Writer (Owner) | Integration test, kiểm thử thực tế, KLTN báo cáo |

> ⚠️ **M5 = chủ repo** → review PR, approve merge vào `develop`, maintain GitHub Actions CI, điều phối tech decisions.

---

## 🗓️ Tổng quan 8 Tuần

```
Tuần 1-2   │ SPRINT 1 │ Foundation & Setup
Tuần 3-4   │ SPRINT 2 │ Core Features — Hardware + Backend + AI
Tuần 5-6   │ SPRINT 3 │ Integration & Frontend
Tuần 7-8   │ SPRINT 4 │ Polish, Testing & Thesis Prep
```

---

## ⚙️ QUY TẮC CHUNG

### Git Workflow
- Mỗi task → 1 branch riêng từ `develop`
- Format: `feat/m1-pid-control`, `fix/m3-mqtt-auth`, `docs/m5-srs-update`
- Commit phải qua validator: `python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<msg>"`
- PR vào `develop` cần ≥ 1 approval (M5 review ưu tiên)
- Merge vào `main` chỉ khi sprint demo thành công

### Definition of Done (DoD) — mỗi task
- [ ] Code chạy được, không crash
- [ ] Commit đúng format `type(scope): subject`
- [ ] PR đã được merge vào `develop`
- [ ] Unit test / manual test đã pass
- [ ] Không có secret/credentials bị commit

---

## 🚀 SPRINT 1 — Foundation & Setup
**Thời gian:** Tuần 1–2 (08/09 → 21/09/2026)  
**Sprint Goal:** Toàn bộ môi trường dev sẵn sàng, scaffolding xong, phần cứng mua sắm xong.

---

### 🔧 M1 — Hardware Engineer

#### TASK-M1-001 | Mua sắm & Kiểm tra BOM
- **Branch:** `chore/m1-hardware-bom`
- **Deadline:** 10/09/2026
- **Công việc:**
  - Mua toàn bộ 18 hạng mục theo BOM §7.1 (tổng ≤ 5.410.000 VNĐ)
  - Kiểm tra hoạt động từng linh kiện: SHT31, BH1750, MQ-135, DHT22, MAX9814
  - Kiểm tra relay 4 kênh (active-low, optocoupler)
  - Ghi nhận nhà cung cấp, giá thực tế
- **Output:** Ảnh linh kiện, bảng xác nhận BOM thực tế
- **Commit mẫu:** `chore(hardware): verify all BOM components received and functional`

#### TASK-M1-002 | Setup PlatformIO + ESP32 Project
- **Branch:** `chore/m1-platformio-setup`
- **Deadline:** 12/09/2026
- **Công việc:**
  - Cài PlatformIO IDE + ESP32 board support
  - Tạo project `swiftletcare-firmware/` với `platformio.ini`
  - Cài libraries: `PubSubClient` (MQTT), `ArduinoJson`, `SHT31`, `BH1750`, `DHT`
  - Test blink LED và serial monitor cơ bản
- **Output:** Project compiles thành công trên ESP32-WROOM-32D
- **Commit mẫu:** `chore(hardware): init platformio project with required sensor libraries`

#### TASK-M1-003 | Thiết kế Sơ đồ Mạch
- **Branch:** `docs/m1-circuit-diagram`
- **Deadline:** 14/09/2026
- **Công việc:**
  - Vẽ sơ đồ kết nối ESP32 + 5 cảm biến + relay 4 kênh (dùng Fritzing hoặc EasyEDA)
  - Tính toán nguồn: 12V → 5V (LM2596) → 3.3V (ESP32 onboard)
  - Xác định pin mapping: SHT31 (I2C: SDA=21, SCL=22), BH1750 (I2C), MQ-135 (ADC), DHT22 (GPIO), MAX9814 (ADC)
  - Export PDF sơ đồ mạch
- **Output:** `docs/hardware/circuit-diagram.pdf` + `circuit-diagram.fzz`
- **Commit mẫu:** `docs(hardware): add ESP32 wiring diagram with sensor pin mapping`

#### TASK-M1-004 | Đọc Cảm biến – Basic Firmware
- **Branch:** `feat/m1-sensor-reading`
- **Deadline:** 21/09/2026
- **Công việc:**
  - Implement `SensorTask` chạy trên FreeRTOS (đọc mỗi 10s, §ENV-FR-002)
  - Đọc và validate 5 cảm biến: SHT31 (temp+humidity), BH1750 (lux), MQ-135 (ppm), DHT22 (outdoor), MAX9814 (dB)
  - Serial monitor output dạng JSON: `{"temp":28.5,"humidity":82,"lux":0.1,"co2":450,"sound_db":65}`
  - Hardware Watchdog Timer 30s (§REL-NFR-002)
- **Output:** ESP32 đọc sensor ổn định 30 phút không lỗi
- **SRS refs:** ENV-FR-001, ENV-FR-003, REL-NFR-002

---

### 🤖 M2 — AI/ML Engineer

#### TASK-M2-001 | Setup Raspberry Pi 4 + OS
- **Branch:** `chore/m2-rpi-setup`
- **Deadline:** 11/09/2026
- **Công việc:**
  - Flash Raspberry Pi OS Lite 64-bit Bookworm lên MicroSD 64GB
  - Cài Python 3.10+, pip, venv
  - Cài OpenCV 4.8+, ONNX Runtime, numpy, paho-mqtt
  - Cài PM2 (process manager, §REL-NFR-004)
  - Kết nối RPi vào LAN, cấu hình SSH
- **Output:** RPi SSH được, `python3 -c "import cv2; print(cv2.__version__)"` trả về đúng
- **Commit mẫu:** `chore(rpi): setup raspberry pi 4 with python env and opencv`

#### TASK-M2-002 | Thu thập Dataset Chim Yến
- **Branch:** `feat/m2-dataset-collection`
- **Deadline:** 21/09/2026
- **Công việc:**
  - Ghi RTSP stream từ IP Camera (VLC hoặc `ffmpeg -i rtsp://... -t 300 output.mp4`)
  - Extract frame từ video: mỗi 1 giây lấy 1 frame → ≥ 500 frames raw
  - Thu thập thêm ảnh `rat`, `snake`, `owl` từ Google Images / Open Images
  - Target: ≥ 2.000 raw images, phân bổ tốt theo 4 classes
  - Upload lên Roboflow workspace, tạo project `swiftletcare-v1`
- **Output:** Roboflow project tạo xong, ≥ 2.000 images uploaded
- **SRS refs:** §11.1 — Dataset Requirements

#### TASK-M2-003 | Annotation Dataset (Roboflow)
- **Branch:** `feat/m2-dataset-annotation`
- **Deadline:** 21/09/2026 (song song với M2-002)
- **Công việc:**
  - Annotate bounding box 4 classes: `swiftlet`, `rat`, `snake`, `owl`
  - Target: ≥ 3.000 annotated images (sau augmentation từ Roboflow)
  - Augmentation config: Flip H/V, Brightness ±30%, Blur, Noise, Mosaic
  - Export dataset YOLO format
- **Output:** Dataset YOLO export ≥ 5.000 images, split 70/15/15
- **SRS refs:** §11.1 — Annotation format, Augmentation

---

### 💻 M3 — Backend Developer

#### TASK-M3-001 | Setup Backend Project
- **Branch:** `chore/m3-backend-scaffold`
- **Deadline:** 11/09/2026
- **Công việc:**
  - Init Node.js + Express project: `npm init`, install dependencies
  - Dependencies: `express`, `mongoose`, `socket.io`, `mqtt`, `jsonwebtoken`, `bcryptjs`, `express-validator`, `helmet`, `cors`, `morgan`, `dotenv`
  - Dev: `jest`, `supertest`, `nodemon`
  - Cấu trúc thư mục:
    ```
    backend/
    ├── src/
    │   ├── routes/       # auth, farms, devices, telemetry, alerts
    │   ├── controllers/
    │   ├── services/
    │   ├── models/       # Mongoose schemas
    │   ├── middlewares/  # auth, validation, error handler
    │   ├── mqtt/         # MQTT client + handlers
    │   └── socket/       # Socket.io events
    ├── tests/
    └── .env.example
    ```
  - Setup `.env.example` (không commit `.env` thật)
- **Output:** `npm run dev` chạy được, `GET /health` trả `200 OK`
- **Commit mẫu:** `chore(api): scaffold express project with folder structure and dependencies`

#### TASK-M3-002 | MongoDB Schema + Models
- **Branch:** `feat/m3-mongodb-models`
- **Deadline:** 14/09/2026
- **Công việc:**
  - Implement Mongoose models theo §8.2:
    - `User` model với validation
    - `Farm`, `House`, `Zone` models
    - `SensorNode`, `CameraNode` models
    - `Telemetry` model với TTL index (1 year, §8.2)
    - `Alert` model với enum types
    - `BirdCountRecord` model
  - Tạo compound indexes: `{node_id, timestamp}` cho telemetry (§3.2)
  - Setup MongoDB connection với retry logic
- **Output:** Models compile, connection test thành công với MongoDB Atlas/local
- **SRS refs:** §8.2 — Schema Chi tiết

#### TASK-M3-003 | AUTH Module
- **Branch:** `feat/m3-auth-module`
- **Deadline:** 21/09/2026
- **Công việc:**
  - POST `/auth/register` — đăng ký + OTP email (AUTH-FR-001)
  - POST `/auth/login` — email/password → JWT Access (15m) + Refresh (30d) (AUTH-FR-003)
  - POST `/auth/refresh` — refresh token rotation
  - POST `/auth/logout` — blacklist refresh token
  - POST `/auth/otp/send` + `/auth/otp/verify` (AUTH-FR-001)
  - JWT middleware: validate JWT, attach user to req
  - RBAC middleware: `requireRole('FARM_OWNER')` (AUTH-FR-004)
  - Bcrypt password hash cost=12 (SEC-NFR-003)
  - Rate limiting middleware (SEC-NFR-004)
  - Audit log mọi hành động auth (AUTH-FR-007)
- **Unit tests:** Jest + Supertest cho tất cả auth endpoints
- **SRS refs:** AUTH-FR-001 → AUTH-FR-007

#### TASK-M3-004 | Setup MQTT Broker (EMQX)
- **Branch:** `chore/m3-mqtt-broker`
- **Deadline:** 16/09/2026
- **Công việc:**
  - Deploy EMQX Community via Docker: `docker-compose.yml` với EMQX + MongoDB
  - Cấu hình MQTT TLS (port 8883) — tự ký certificate cho dev (SEC-NFR-001)
  - Cấu hình Authentication: username/password cho devices
  - Test kết nối bằng MQTTX client
  - Backend subscribe MQTT topics (§9.2) qua `mqtt.js`
- **Output:** EMQX dashboard accessible, test publish/subscribe thành công
- **SRS refs:** §9.2 — MQTT Topic Schema, SEC-NFR-001

---

### 🎨 M4 — Frontend Developer

#### TASK-M4-001 | Setup Frontend Project (ReactJS + Vite + PWA)
- **Branch:** `chore/m4-frontend-scaffold`
- **Deadline:** 12/09/2026
- **Công việc:**
  - Init: `npm create vite@latest frontend -- --template react-ts`
  - Install: `tailwindcss`, `react-router-dom@6`, `axios`, `socket.io-client`, `chart.js react-chartjs-2`, `zustand`, `vite-plugin-pwa`, `shadcn/ui`
  - Setup TailwindCSS config
  - Setup PWA: `vite-plugin-pwa` với Service Worker, manifest.json (§UX-NFR-002, §UX-NFR-003)
  - Cấu trúc routing: `/login`, `/dashboard`, `/farms`, `/devices`, `/alerts`, `/analytics`
  - Setup Axios instance với JWT interceptor (auto attach + refresh)
- **Output:** `npm run dev` chạy, PWA installable trên Chrome Android
- **Commit mẫu:** `chore(pwa): scaffold vite react project with tailwind and pwa plugin`

#### TASK-M4-002 | Design System & Layout
- **Branch:** `feat/m4-design-system`
- **Deadline:** 16/09/2026
- **Công việc:**
  - Thiết kế Color palette: primary (green/teal cho nông nghiệp), dark mode support
  - Typography: Inter font (Google Fonts)
  - Layout: Sidebar navigation + Top bar + Main content area
  - Responsive breakpoints: desktop (1920px), tablet (768px), mobile (375px) (§UX-NFR-001)
  - Components cơ bản: Button, Card, Badge, Modal, Toast notification
  - Navigation: sidebar items: Dashboard, Farms, Devices, Alerts, Analytics, Settings
- **Output:** Storybook hoặc demo page với design system components
- **SRS refs:** UX-NFR-001, UX-NFR-004

#### TASK-M4-003 | Login & Auth Pages
- **Branch:** `feat/m4-auth-pages`
- **Deadline:** 21/09/2026
- **Công việc:**
  - Trang `/login`: form email/password, validation, error states
  - Trang `/register`: multi-step form (email → OTP → password)
  - Zustand auth store: `{user, accessToken, isAuthenticated}`
  - JWT auto-refresh logic (khi 401, tự call `/auth/refresh`)
  - Protected route wrapper
  - Trang `/forgot-password` (UI only)
- **Output:** Login flow hoạt động end-to-end với Backend M3
- **SRS refs:** AUTH-FR-001, AUTH-FR-002, AUTH-FR-003

---

### 🔍 M5 — QA & Tech Writer (Owner)

#### TASK-M5-001 | Hoàn thiện Dev Environment
- **Branch:** `chore/m5-dev-environment`
- **Deadline:** 10/09/2026
- **Công việc:**
  - Cập nhật `README.md` với hướng dẫn setup từng service
  - Tạo `docker-compose.yml` cho dev: MongoDB + EMQX + MinIO
  - Tạo `.env.example` đồng bộ với tất cả members
  - Cấu hình GitHub Actions CI (`.github/workflows/ci.yml`)
  - Tạo GitHub Issues cho mỗi task trong workplan này
  - Setup GitHub Projects Kanban board: Todo → In Progress → Review → Done
- **Output:** `docker compose up` bật được MongoDB + EMQX + MinIO local
- **Commit mẫu:** `chore(ci): setup docker compose dev environment with mongodb emqx and minio`

#### TASK-M5-002 | Tạo API Contract (OpenAPI Spec)
- **Branch:** `docs/m5-api-spec`
- **Deadline:** 16/09/2026
- **Công việc:**
  - Viết `docs/api-spec.yaml` (OpenAPI 3.0) cho tất cả endpoints §9.1
  - Include: request/response schemas, error codes, examples
  - Setup Swagger UI hoặc Redoc để view spec
  - Share với M3 và M4 để làm căn cứ develop
- **Output:** `api-spec.yaml` đầy đủ, M3 + M4 đều confirm review xong
- **SRS refs:** §9.1 — REST API Endpoints

#### TASK-M5-003 | Sprint 1 Review + Retrospective
- **Branch:** `docs/m5-sprint1-review`
- **Deadline:** 21/09/2026
- **Công việc:**
  - Kiểm tra DoD của tất cả tasks Sprint 1
  - Viết `docs/sprint-reviews/sprint1.md`
  - Demo progress: BOM xong, sensors đọc được, backend health check, frontend scaffolded
  - Retrospective: ghi lại what went well / what to improve
  - Approve merge `develop` → `main` nếu đủ điều kiện

---

## 🔥 SPRINT 2 — Core Features
**Thời gian:** Tuần 3–4 (22/09 → 05/10/2026)  
**Sprint Goal:** Firmware PID hoạt động, Backend FARM+ENV API xong, AI model v1 trained, Frontend dashboard cơ bản hiển thị dữ liệu thật.

---

### 🔧 M1 — Hardware Engineer

#### TASK-M1-005 | MQTT Client trên ESP32
- **Branch:** `feat/m1-mqtt-client`
- **Deadline:** 25/09/2026
- **Công việc:**
  - Implement `MQTTTask` với `PubSubClient` library
  - Kết nối MQTT Broker (TLS port 8883) — dùng certificate provisioned từ M3-004
  - Subscribe: `swiftletcare/{farmId}/{houseId}/{zoneId}/relay/command`
  - Subscribe: `swiftletcare/{farmId}/{houseId}/{zoneId}/config/update`
  - Publish telemetry mỗi 10s: `swiftletcare/farm/{farmId}/house/{houseId}/zone/{zoneId}/sensors` (ENV-FR-001)
  - Publish heartbeat mỗi 30s (FARM-FR-005)
  - Publish relay status khi thay đổi (ENV-FR-015)
  - QoS 0 cho telemetry, QoS 1 cho alerts/heartbeat (§9.2)
- **Output:** MQTTX verify messages từ ESP32 đến broker
- **SRS refs:** ENV-FR-001, ENV-FR-002, ENV-FR-015, §9.2

#### TASK-M1-006 | PID Control Algorithm
- **Branch:** `feat/m1-pid-control`
- **Deadline:** 29/09/2026
- **Công việc:**
  - Implement PID Controller trong `PIDController.h`:
    - `Kp`, `Ki`, `Kd` tunable qua MQTT config command
    - Anti-windup cho integral term
  - `PIDTask`: chạy mỗi 10s, đọc setpoint từ NVS config
  - Humidity PID: bật Relay Misting (Relay #1) khi humidity < humidity_min (ENV-FR-010)
  - Temperature PID: bật Relay Quạt khi temp > temp_max (ENV-FR-011)
  - Relay Sưởi: bật khi temp < temp_min (ENV-FR-012)
  - Relay Ánh sáng: tắt khi lux > light_max (ENV-FR-013)
  - **Offline Resilience**: PID tiếp tục khi mất internet (ENV-FR-014)
  - Manual Override: nhận command MQTT → tạm dừng PID cho relay đó (ENV-FR-017)
  - Auto-expiry override sau 30 phút (ENV-FR-018)
- **SRS refs:** ENV-FR-010 → ENV-FR-019

#### TASK-M1-007 | Local Buffer + SPIFFS
- **Branch:** `feat/m1-offline-buffer`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Implement SPIFFS filesystem để buffer telemetry khi mất MQTT
  - Format: JSON array, tối đa 1000 records (100KB)
  - Upload batch khi MQTT reconnect (REL-NFR-003)
  - NVS storage cho config: thresholds, PID gains, farmId, houseId, zoneId
- **SRS refs:** REL-NFR-003, ENV-FR-014

#### TASK-M1-008 | Speaker Failure Detection (Audio Anomaly)
- **Branch:** `feat/m1-audio-anomaly`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Đọc MAX9814 ADC mỗi 1s, tính RMS amplitude
  - Tính baseline_amplitude (moving average 5 phút)
  - Nếu amplitude drop > 70% trong 30s → publish `SPEAKER_FAILURE` alert MQTT (THREAT-FR-006)
  - Pattern phát hiện BIRD_PANIC: continuous high dB spike > threshold (THREAT-FR-007)
- **SRS refs:** THREAT-FR-005, THREAT-FR-006, THREAT-FR-007

---

### 🤖 M2 — AI/ML Engineer

#### TASK-M2-004 | Train YOLOv8 Model v1
- **Branch:** `feat/m2-yolov8-train`
- **Deadline:** 29/09/2026
- **Công việc:**
  - Train YOLOv8n trên Kaggle/Colab T4 GPU
  - Dataset từ M2-003 (≥ 5.000 images, 4 classes)
  - Config: `epochs=100`, `batch=16`, `imgsz=640`
  - Evaluate: mAP@0.5, Precision, Recall, Confusion Matrix
  - Target: mAP ≥ 75%, Precision(swiftlet) ≥ 80%, Recall(swiftlet) ≥ 80% (§11.2)
  - Export ONNX format
- **Output:** `model_v1.onnx` + training report + confusion matrix
- **SRS refs:** §11.2 — Model Specifications

#### TASK-M2-005 | Deploy Model lên RPi + Inference Pipeline
- **Branch:** `feat/m2-rpi-inference`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Copy `model_v1.onnx` lên RPi
  - Implement `inference.py`:
    - Kết nối RTSP stream: `cv2.VideoCapture("rtsp://...")`
    - Run ONNX Runtime inference @ target 25+ FPS
    - Non-Maximum Suppression (NMS) post-processing
    - Temporal filtering: confirm detection ≥ 2 consecutive frames (THREAT-FR-003)
  - Test: đo FPS thực tế trên RPi 4
  - Nếu FPS < 25: INT8 quantization bằng ONNX Runtime quantization tools
- **Output:** inference.py chạy ≥ 25 FPS trên RPi, log detections ra console
- **SRS refs:** VISION-FR-001, VISION-FR-002, §11.2, PERF-NFR-004

#### TASK-M2-006 | ByteTrack Integration + Counting Logic
- **Branch:** `feat/m2-bytetrack-counting`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Install ByteTrack: `pip install bytetrack`
  - Integrate ByteTrack vào pipeline sau YOLO inference
  - Implement virtual crossing line (bi-directional) tại cửa ra vào nhà yến
  - Direction detection: track ID vượt line từ ngoài vào → ENTRY; ngược lại → EXIT (VISION-FR-005)
  - Dedup: track ID chỉ được count 1 lần (VISION-FR-004)
  - Publish MQTT mỗi 30s: `{entry_count, exit_count, timestamp, confidence}` (VISION-FR-006)
  - Session detection: Morning (05:30-07:00) → EXIT session; Evening (17:30-19:00) → ENTRY session (VISION-FR-008)
- **SRS refs:** VISION-FR-004, VISION-FR-005, VISION-FR-006, VISION-FR-008

---

### 💻 M3 — Backend Developer

#### TASK-M3-005 | FARM Module API
- **Branch:** `feat/m3-farm-api`
- **Deadline:** 26/09/2026
- **Công việc:**
  - `GET /farms`, `POST /farms` (FARM-FR-001)
  - `GET /farms/:id`, `PUT /farms/:id`, `DELETE /farms/:id` (soft delete)
  - `POST /farms/:id/members` — mời Operator, phân quyền (AUTH-FR-005, FARM-FR-001)
  - `POST /farms/:id/houses`, `GET /farms/:id/houses`
  - `POST /houses/:id/zones`, `GET /houses/:id/zones`
  - Input validation với `express-validator`
  - Unit tests với Jest + Supertest
- **SRS refs:** FARM-FR-001, FARM-FR-002, AUTH-FR-005

#### TASK-M3-006 | Device Registration API
- **Branch:** `feat/m3-device-registration`
- **Deadline:** 29/09/2026
- **Công việc:**
  - `POST /devices/sensor-nodes/register` — đăng ký ESP32 bằng deviceId + secretKey (FARM-FR-003)
  - `POST /devices/camera-nodes/register` — đăng ký RPi node (FARM-FR-004)
  - `GET /devices/sensor-nodes` — danh sách với status online/offline
  - `PUT /devices/sensor-nodes/:id/thresholds` — cập nhật ngưỡng (ENV-FR-006)
  - QR Code generation: library `qrcode` tạo QR cho device onboarding (FARM-FR-003)
  - Emit MQTT `config/update` sau khi thresholds thay đổi
  - Config history log (ENV-FR-009)
- **SRS refs:** FARM-FR-003, FARM-FR-004, FARM-FR-005, ENV-FR-006

#### TASK-M3-007 | MQTT Subscriber + Telemetry Ingestion
- **Branch:** `feat/m3-telemetry-ingestion`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Backend subscribe MQTT topics: `swiftletcare/+/+/+/telemetry`, `swiftletcare/+/+/+/heartbeat`, `swiftletcare/+/+/+/relay/status`
  - Validate MQTT payload schema (THREAT-FR-012 watch)
  - Lưu `TelemetryRecord` vào MongoDB — validate range hợp lệ, flag `is_anomaly` (ENV-FR-004)
  - Update `last_heartbeat` cho SensorNode (FARM-FR-005)
  - Subscribe bird count topic từ RPi: `vision/bird-count` → lưu `BirdCountRecord`
  - Tính `return_rate` sau mỗi Evening Session (VISION-FR-009)
- **SRS refs:** ENV-FR-004, VISION-FR-008, VISION-FR-009, FARM-FR-005

#### TASK-M3-008 | WebSocket với Socket.io
- **Branch:** `feat/m3-websocket`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Setup `socket.io` server
  - Event `JOIN_ZONE`: client subscribe real-time cho một zone
  - Sau khi nhận MQTT telemetry → emit `TELEMETRY_UPDATE` đến clients của zone đó
  - Emit `RELAY_UPDATE` khi relay state thay đổi
  - Emit `BIRD_COUNT_UPDATE` sau mỗi MQTT bird count message
  - Emit `ALERT_NEW` ngay khi alert được tạo
  - Target latency: ≤ 2 giây (PERF-NFR-001)
- **SRS refs:** §9.3 — WebSocket Events, PERF-NFR-001

---

### 🎨 M4 — Frontend Developer

#### TASK-M4-004 | Dashboard Home — Real-time Sensor Cards
- **Branch:** `feat/m4-dashboard-home`
- **Deadline:** 29/09/2026
- **Công việc:**
  - Dashboard layout: sidebar + header + main content
  - Farm/Zone selector dropdown
  - Sensor Cards hiển thị giá trị real-time: Nhiệt độ, Độ ẩm, Ánh sáng, CO2, Âm thanh
  - Kết nối Socket.io → nhận `TELEMETRY_UPDATE` → cập nhật cards (ENV-FR-005)
  - Status indicator: ONLINE (xanh) / OFFLINE (đỏ) theo heartbeat (FARM-FR-005)
  - Relay status panel: 4 relay với icon trạng thái ON/OFF
  - Badge cảnh báo: highlight card khi giá trị vượt ngưỡng
- **SRS refs:** ENV-FR-005, FARM-FR-005

#### TASK-M4-005 | Relay Control UI (Manual Override)
- **Branch:** `feat/m4-relay-control`
- **Deadline:** 03/10/2026
- **Công việc:**
  - Toggle switch cho từng relay: Misting, Ventilation, Heating, Light
  - Xác nhận confirm dialog trước khi override
  - Hiển thị countdown timer khi manual override active (30 phút, ENV-FR-018)
  - Cảnh báo "⚠️ Manual Override Active — PID Paused" (ENV-FR-017)
  - POST `PUT /devices/sensor-nodes/:id/relay` khi toggle
  - Nhận `RELAY_UPDATE` socket event → sync trạng thái UI
- **SRS refs:** ENV-FR-016, ENV-FR-017, ENV-FR-018

#### TASK-M4-006 | Farm & Device Management Pages
- **Branch:** `feat/m4-farm-management`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Trang `/farms`: danh sách farms, create farm form
  - Trang `/farms/:id`: Houses list, Zones list
  - Trang `/devices`: danh sách sensor nodes + camera nodes với status
  - QR Code scanner component (Web API `getUserMedia` hoặc thư viện `html5-qrcode`)
  - Device onboarding flow: Scan QR → confirm zone → submit (FARM-FR-003)
  - Threshold configuration form với validation (ENV-FR-006, ENV-FR-007)
- **SRS refs:** FARM-FR-001→008, ENV-FR-006, ENV-FR-007

---

### 🔍 M5 — QA & Tech Writer

#### TASK-M5-004 | Integration Test: MQTT End-to-End
- **Branch:** `test/m5-mqtt-integration`
- **Deadline:** 03/10/2026
- **Công việc:**
  - Test case §13.2: ESP32 (hoặc mock script) publish → MQTT Broker → Backend subscribe → MongoDB write
  - Viết test script Python `tests/mqtt_e2e_test.py`:
    - Publish mock telemetry payload lên MQTT
    - Query MongoDB sau 5s → verify record tồn tại
  - Test heartbeat: timeout 60s → status OFFLINE (THREAT-FR-009)
  - Ghi kết quả vào `docs/test-reports/mqtt-integration.md`
- **SRS refs:** §13.2 — MQTT End-to-End

#### TASK-M5-005 | Cập nhật WORKPLAN & Issues
- **Branch:** `docs/m5-progress-update`
- **Deadline:** 05/10/2026
- **Công việc:**
  - Update GitHub Issues: đóng tasks Sprint 1 done
  - Cập nhật Kanban board
  - Viết `docs/sprint-reviews/sprint2.md`
  - Identify blockers và technical debt
  - Chuẩn bị demo Sprint 2: firmware live data → backend → dashboard

---

## 🔗 SPRINT 3 — Integration & Frontend Complete
**Thời gian:** Tuần 5–6 (06/10 → 19/10/2026)  
**Sprint Goal:** Toàn bộ luồng dữ liệu end-to-end hoạt động. Alert system live. Dashboard analytics đầy đủ. PWA installable.

---

### 🔧 M1 — Hardware Engineer

#### TASK-M1-009 | Predator Alert Integration
- **Branch:** `feat/m1-power-outage-detection`
- **Deadline:** 10/10/2026
- **Công việc:**
  - Implement Power Outage detection: ESP32 đọc RTC flag khi boot → nếu là unexpected reset → publish `POWER_OUTAGE` alert (THREAT-FR-012)
  - Node Offline watchdog: Backend detect heartbeat timeout > 60s (đã có ở M3, M1 phối hợp test)
  - Test hardware: ngắt nguồn → cắm lại → xác nhận reconnect ≤ 30 giây (§13.4 — Power Recovery)
  - Test Offline Resilience: ngắt WiFi → PID tiếp tục 24h → reconnect → upload buffer
- **SRS refs:** THREAT-FR-009, THREAT-FR-012, REL-NFR-007

#### TASK-M1-010 | Lắp ráp Prototype hoàn chỉnh trong hộp IP65
- **Branch:** `docs/m1-prototype-assembly`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Lắp ráp toàn bộ linh kiện vào hộp IP65 theo sơ đồ mạch (M1-003)
  - Hàn/kết nối: ESP32 + sensors + relay + nguồn 12V + LM2596
  - Bypass switches cơ học cho relay (REL-NFR-005)
  - Cable management, nhãn dán relay
  - Chụp ảnh prototype hoàn chỉnh → đưa vào `docs/hardware/prototype-photos/`
  - Test vận hành thực tế: chạy 48h liên tục, đo sai số cảm biến (§13.4)
- **SRS refs:** REL-NFR-005, §13.4 — Sensor Accuracy

---

### 🤖 M2 — AI/ML Engineer

#### TASK-M2-007 | Predator Detection + Alert Publisher
- **Branch:** `feat/m2-predator-detection`
- **Deadline:** 12/10/2026
- **Công việc:**
  - Tích hợp logic phát hiện `rat`, `snake`, `owl` với confidence ≥ 0.7 (THREAT-FR-001)
  - Temporal filter: ≥ 2 consecutive frames confirm (THREAT-FR-003)
  - Capture frame khi confirm → overlay bounding box → save JPEG
  - Upload JPEG lên MinIO/S3 → nhận URL (THREAT-FR-002)
  - Publish MQTT `vision/alert`: `{type: PREDATOR_DETECTED, class, severity, snapshotUrl, confidence}` (THREAT-FR-001)
  - CRITICAL: snake, owl | HIGH: rat (THREAT-FR-004)
- **SRS refs:** THREAT-FR-001→004

#### TASK-M2-008 | Live Stream Setup (HLS)
- **Branch:** `feat/m2-hls-livestream`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Setup FFmpeg trên RPi để transcode RTSP → HLS: `ffmpeg -i rtsp://... -f hls /tmp/stream.m3u8`
  - Serve HLS via simple HTTP server (Python `http.server`)
  - Hoặc: relay RTSP qua Backend với `ffmpeg` child process
  - Test Video.js trên Frontend play HLS stream
  - Night Vision test: kiểm tra detection accuracy lúc tối (VISION-FR-007)
- **SRS refs:** VISION-FR-013, VISION-FR-007

#### TASK-M2-009 | Return Rate Alert Logic
- **Branch:** `feat/m2-return-rate-alert`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Tính toán daily return_rate sau Evening Session (VISION-FR-009)
  - So sánh với trung bình 7 ngày: nếu giảm > 20% → publish MQTT alert `LOW_RETURN_RATE` (VISION-FR-011)
  - Lưu trend data cho analytics dashboard
- **SRS refs:** VISION-FR-009, VISION-FR-011

---

### 💻 M3 — Backend Developer

#### TASK-M3-009 | Alert Engine
- **Branch:** `feat/m3-alert-engine`
- **Deadline:** 12/10/2026
- **Công việc:**
  - Subscribe MQTT alert topics: `vision/alert`, ESP32 alerts
  - Tạo `Alert` record trong MongoDB với đầy đủ fields (§8.2)
  - Phân loại severity: CRITICAL (snake/owl/power), HIGH (rat/speaker), MEDIUM (pump_dry), LOW (threshold_breach) (ALERT-FR-001)
  - Deduplication: cùng type + zone + 5 phút window → không tạo thêm alert (ALERT-FR-008)
  - Emit `ALERT_NEW` qua Socket.io (§9.3)
  - Gửi Firebase FCM Push Notification (ALERT-FR-002)
  - Gửi Zalo ZNS cho CRITICAL + HIGH (ALERT-FR-003)
  - Respect quiet hours config (ALERT-FR-006)
- **SRS refs:** ALERT-FR-001 → ALERT-FR-009

#### TASK-M3-010 | Telemetry & Analytics API
- **Branch:** `feat/m3-analytics-api`
- **Deadline:** 16/10/2026
- **Công việc:**
  - `GET /telemetry/zones/:id/latest` — giá trị mới nhất (realtime fallback)
  - `GET /telemetry/zones/:id/history?from=&to=&interval=` — time-range query (ANALYTICS-FR-001)
  - MongoDB aggregation: group by hour/day, avg các metrics
  - `GET /analytics/bird-count/daily` (ANALYTICS-FR-002)
  - `GET /analytics/bird-count/trends?range=30d` (ANALYTICS-FR-002)
  - `GET /analytics/correlation` — Pearson correlation giữa temp/humidity vs return_rate (ANALYTICS-FR-003)
  - Performance: compound index test, P95 ≤ 500ms (PERF-NFR-003)
- **SRS refs:** ANALYTICS-FR-001, 002, 003, PERF-NFR-003

#### TASK-M3-011 | Alert API + Notification Preferences
- **Branch:** `feat/m3-alert-api`
- **Deadline:** 19/10/2026
- **Công việc:**
  - `GET /alerts?farmId=&severity=&status=&page=&limit=` — có pagination (ALERT-FR-007)
  - `GET /alerts/:id` — chi tiết alert + snapshot URL (presigned, TTL 15m) (SEC-NFR-006)
  - `PUT /alerts/:id/acknowledge` — ghi note + acknowledged_by (ALERT-FR-009)
  - `PUT /users/me/notification-preferences` — cấu hình kênh + quiet hours (ALERT-FR-005, 006)
- **SRS refs:** ALERT-FR-005 → ALERT-FR-009, SEC-NFR-006

#### TASK-M3-012 | MinIO/S3 Integration
- **Branch:** `feat/m3-minio-integration`
- **Deadline:** 16/10/2026
- **Công việc:**
  - Setup MinIO docker container (S3-compatible local)
  - `StorageService`: upload buffer → MinIO bucket `swiftletcare-snapshots`
  - Generate Presigned URL TTL 15 phút (SEC-NFR-006)
  - API nhận snapshot upload từ RPi (base64 hoặc multipart)
- **SRS refs:** THREAT-FR-002, SEC-NFR-006

---

### 🎨 M4 — Frontend Developer

#### TASK-M4-007 | Alert Center + Notification Center
- **Branch:** `feat/m4-alert-center`
- **Deadline:** 12/10/2026
- **Công việc:**
  - Trang `/alerts`: danh sách alerts với filter (severity, status, date range)
  - Alert card: icon severity, title, zone, time, snapshot thumbnail
  - Modal chi tiết: ảnh snapshot full size, thông tin đầy đủ, nút Acknowledge
  - Notification Bell icon với badge count (unread alerts)
  - Toast notification khi nhận `ALERT_NEW` socket event (ALERT-FR-007)
  - PWA Web Push: đăng ký service worker push (ALERT-FR-002)
- **SRS refs:** ALERT-FR-007, ALERT-FR-009

#### TASK-M4-008 | Analytics Dashboard
- **Branch:** `feat/m4-analytics`
- **Deadline:** 16/10/2026
- **Công việc:**
  - Tab "Môi trường": Line chart lịch sử nhiệt độ + độ ẩm, time selector (1h/6h/24h/7d/30d) (ANALYTICS-FR-001)
  - Tab "Đàn chim": Bar chart entry/exit count theo ngày; Line chart return_rate xu hướng (ANALYTICS-FR-002)
  - Correlation panel: hiển thị insight text (ANALYTICS-FR-003)
  - Heatmap (tùy chọn): nhiệt độ theo giờ trong ngày (ANALYTICS-FR-007)
  - Multi-Zone Comparison: dropdown chọn nhiều zones, overlay chart (ANALYTICS-FR-005)
  - Chart.js responsive, animated
- **SRS refs:** ANALYTICS-FR-001 → ANALYTICS-FR-005

#### TASK-M4-009 | Live Camera Stream + Bird Count Display
- **Branch:** `feat/m4-camera-livestream`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Video player (Video.js) play HLS stream từ RPi
  - Overlay bird count counter (realtime từ Socket.io `BIRD_COUNT_UPDATE`)
  - Session indicator: Morning/Evening session badge
  - Bird count stats: today entry/exit, return rate, trend arrow
  - Trang `/devices/:id/stream` (VISION-FR-013, VISION-FR-012)
- **SRS refs:** VISION-FR-012, VISION-FR-013

#### TASK-M4-010 | PWA & Mobile Optimization
- **Branch:** `feat/m4-pwa-mobile`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Service Worker cache: Dashboard, Alerts, Farms pages
  - Offline fallback UI khi không có internet
  - Web App Manifest: icon, theme color, display standalone
  - Test cài PWA trên iOS Safari + Android Chrome (UX-NFR-002)
  - Lighthouse audit: Performance ≥ 80, PWA ≥ 90 (UX-NFR-007)
  - Responsive check tất cả pages trên 375px, 768px, 1920px (UX-NFR-001)
- **SRS refs:** UX-NFR-002, UX-NFR-003, UX-NFR-007

---

### 🔍 M5 — QA & Tech Writer

#### TASK-M5-006 | Integration Test: Full Alert Pipeline
- **Branch:** `test/m5-alert-pipeline`
- **Deadline:** 14/10/2026
- **Công việc:**
  - Test §13.2: Telemetry breach → Alert Engine → Mock FCM → verify Alert record
  - Test predator: MQTT publish `PREDATOR_DETECTED` → verify Alert created + FCM sent
  - Test deduplication: 2 cùng loại alert trong 5 phút → chỉ 1 record
  - Test `PUT /alerts/:id/acknowledge`
  - Ghi kết quả vào `docs/test-reports/alert-pipeline.md`
- **SRS refs:** §13.2 — Alert Pipeline

#### TASK-M5-007 | Performance Baseline Test
- **Branch:** `test/m5-performance-baseline`
- **Deadline:** 19/10/2026
- **Công việc:**
  - Dùng k6 test API throughput: 100 req/s, P95 ≤ 500ms (PERF-NFR-003)
  - Test WebSocket: 50 concurrent connections, latency ≤ 2s (PERF-NFR-001)
  - Đo RPi FPS thực tế trong pipeline đầy đủ (PERF-NFR-004)
  - Ghi kết quả vào `docs/test-reports/performance-baseline.md`
- **SRS refs:** §13.3 — Performance Testing

---

## 🏁 SPRINT 4 — Polish, Testing & Thesis
**Thời gian:** Tuần 7–8 (20/10 → 31/10/2026)  
**Sprint Goal:** Toàn bộ tính năng MVP hoàn chỉnh, kiểm thử thực tế, demo chuẩn bị bảo vệ.

---

### 🔧 M1 — Hardware Engineer

#### TASK-M1-011 | Hardware Testing & Sensor Calibration
- **Branch:** `test/m1-hardware-validation`
- **Deadline:** 27/10/2026
- **Công việc:**
  - So sánh SHT31 với thiết bị đo chuẩn: sai số ≤ 0.3°C, Humidity ≤ 2% (§13.4)
  - Test Relay Durability: bật/tắt relay 1.000 lần → kiểm tra cơ học (§13.4)
  - Test Power Recovery: ngắt nguồn 3 lần → reconnect trong ≤ 30s
  - Test Offline: ngắt WiFi 2h → PID tiếp tục → reconnect → buffer upload
  - Ghi kết quả vào `docs/test-reports/hardware-testing.md`
- **SRS refs:** §13.4 — Hardware Testing

#### TASK-M1-012 | Viết Tài liệu Firmware
- **Branch:** `docs/m1-firmware-docs`
- **Deadline:** 31/10/2026
- **Công việc:**
  - README cho firmware: setup PlatformIO, flash, config
  - Mô tả FreeRTOS tasks: SensorTask, PIDTask, MQTTTask, OTATask
  - Sơ đồ trạng thái relay
  - PID tuning guide: cách chỉnh Kp/Ki/Kd qua MQTT command
- **SRS refs:** §7.2

---

### 🤖 M2 — AI/ML Engineer

#### TASK-M2-010 | Model v2 Training (Nếu cần)
- **Branch:** `feat/m2-model-v2`
- **Deadline:** 25/10/2026
- **Công việc:**
  - Nếu mAP < 75% hoặc FPS < 25 từ Sprint 3: cải thiện dataset, retrain
  - Thử NCNN INT8 quantization nếu ONNX FPS không đủ
  - So sánh v1 vs v2: mAP, FPS, model size
  - Final model: ≤ 20MB, ≥ 25 FPS, mAP ≥ 75% (§11.2)
- **SRS refs:** §11.2, §11.4

#### TASK-M2-011 | AI Counting Accuracy Test
- **Branch:** `test/m2-counting-accuracy`
- **Deadline:** 31/10/2026
- **Công việc:**
  - Controlled test: cho chính xác N chim đi qua counting line (dùng video test)
  - Đếm thủ công vs hệ thống đếm → tính error rate (§13.5)
  - Target: error ≤ 5% trên 100 con (§13.5)
  - False Positive Rate cho predator: ≤ 5% (§13.5)
  - Ghi kết quả vào `docs/test-reports/ai-model-evaluation.md`
- **SRS refs:** §13.5 — AI Model Evaluation

#### TASK-M2-012 | Viết Tài liệu AI Pipeline
- **Branch:** `docs/m2-ai-pipeline-docs`
- **Deadline:** 31/10/2026
- **Công việc:**
  - README cho AI pipeline trên RPi: setup, install, run
  - Training pipeline documentation (§11.4)
  - Model performance report: training curves, confusion matrix, eval metrics
  - Deployment guide: copy model, configure camera, PM2 autostart
- **SRS refs:** §11.4

---

### 💻 M3 — Backend Developer

#### TASK-M3-013 | Security Hardening
- **Branch:** `feat/m3-security`
- **Deadline:** 24/10/2026
- **Công việc:**
  - Helmet.js headers (SEC-NFR-002)
  - Rate limiting `express-rate-limit`: 100 req/min (SEC-NFR-004)
  - MQTT ACL: device chỉ pub/sub topic của chính nó (SEC-NFR-005)
  - Input sanitization tất cả endpoints
  - Audit log: ghi mọi action vào collection `audit_logs`
  - Không log PII ra stdout (§12.3)
  - Kiểm tra: không có secret trong code (scan với `gitleaks`)
- **SRS refs:** §12 — Security Requirements

#### TASK-M3-014 | ENV Config & Threshold API
- **Branch:** `feat/m3-env-config`
- **Deadline:** 24/10/2026
- **Công việc:**
  - `PUT /zones/:id/thresholds` — validate range hợp lệ, lưu history (ENV-FR-006, ENV-FR-009)
  - `POST /devices/sensor-nodes/:id/relay` — Manual Override API (ENV-FR-016)
  - Override timeout cron job: sau 30p tự reset về AUTO mode (ENV-FR-018)
  - `GET /zones/:id/control-history` — lịch sử relay overrides (ENV-FR-019)
- **SRS refs:** ENV-FR-006, ENV-FR-016, ENV-FR-018, ENV-FR-019

#### TASK-M3-015 | Nest Growth Logging API
- **Branch:** `feat/m3-nest-logging`
- **Deadline:** 28/10/2026
- **Công việc:**
  - `POST /farms/:id/nest-harvest` — nhập số lượng tổ thu hoạch (ANALYTICS-FR-004)
  - `GET /farms/:id/nest-harvest/trends` — xu hướng theo tháng
  - Schema `nest_harvest_records`
- **SRS refs:** ANALYTICS-FR-004

#### TASK-M3-016 | Backend Docs + API Finalization
- **Branch:** `docs/m3-api-final`
- **Deadline:** 31/10/2026
- **Công việc:**
  - Hoàn thiện Swagger/OpenAPI docs
  - Environment variables documentation
  - PM2 cluster mode setup guide (§7.4)
  - Deploy checklist
- **SRS refs:** §7.4

---

### 🎨 M4 — Frontend Developer

#### TASK-M4-011 | Settings & Notification Preferences
- **Branch:** `feat/m4-settings`
- **Deadline:** 24/10/2026
- **Công việc:**
  - Trang `/settings`: profile, đổi mật khẩu
  - Notification preferences: toggle FCM/Zalo, quiet hours setup (ALERT-FR-005, 006)
  - Zone threshold configuration UI: form đầy đủ với validation + slider (ENV-FR-006)
  - Language toggle: Tiếng Việt / English (UX-NFR-004)
- **SRS refs:** ALERT-FR-005, ALERT-FR-006, ENV-FR-006, UX-NFR-004

#### TASK-M4-012 | Export & Nest Growth Logging
- **Branch:** `feat/m4-export-nest`
- **Deadline:** 28/10/2026
- **Công việc:**
  - Export CSV: `GET /telemetry/...` → download file (ANALYTICS-FR-006)
  - Export PDF báo cáo (thư viện `jsPDF` hoặc backend template) (ANALYTICS-FR-006)
  - Trang nhập liệu Nest Harvest: date picker + số lượng tổ (ANALYTICS-FR-004)
  - Chart xu hướng nest growth theo tháng
- **SRS refs:** ANALYTICS-FR-004, ANALYTICS-FR-006

#### TASK-M4-013 | UI Polish & Bug Fixes
- **Branch:** `fix/m4-ui-polish`
- **Deadline:** 31/10/2026
- **Công việc:**
  - Lighthouse audit và fix performance: LCP ≤ 3s trên 4G (UX-NFR-006)
  - Code splitting + lazy loading routes
  - Empty states cho danh sách trống
  - Loading skeletons
  - Error boundaries + error pages (404, 500)
  - Cross-browser test: Chrome, Firefox, Safari
- **SRS refs:** UX-NFR-006, UX-NFR-007

---

### 🔍 M5 — QA & Tech Writer

#### TASK-M5-008 | End-to-End System Test
- **Branch:** `test/m5-e2e-system`
- **Deadline:** 26/10/2026
- **Công việc:**
  - Test Flow 1: Onboarding ESP32 qua QR Code — hoàn thành trong < 3 phút (UX-NFR-005)
  - Test Flow 2: Closed-loop humidity control — relay bật khi humidity < min
  - Test Flow 3: Counting session — chim đi qua → count đúng
  - Test Flow 4: Predator alert → push notification → ảnh snapshot
  - Test Flow 5: Speaker failure detection
  - Ghi kết quả chi tiết vào `docs/test-reports/e2e-system-test.md`
- **SRS refs:** §10 — Business Flows, §13.2

#### TASK-M5-009 | Viết Báo cáo KLTN (Chương 3 + 4)
- **Branch:** `docs/m5-kltn-chapter3-4`
- **Deadline:** 31/10/2026
- **Công việc:**
  - Chương 3: Phân tích và Thiết kế Hệ thống (từ SRS)
  - Chương 4: Cài đặt và Triển khai
    - Hardware setup
    - AI pipeline setup
    - Backend setup
    - Frontend setup
  - Screenshots giao diện thực tế
  - Sơ đồ kiến trúc (từ §3.1)
  - Bảng kết quả test

#### TASK-M5-010 | Sprint 4 Review + Demo Chuẩn bị
- **Branch:** `docs/m5-sprint4-demo`
- **Deadline:** 31/10/2026
- **Công việc:**
  - Viết `docs/sprint-reviews/sprint4.md`
  - Chuẩn bị demo script: 10 phút demo toàn hệ thống
  - Deploy backend lên server/VPS (nếu có)
  - Merge `develop` → `main` (release MVP)
  - Tạo Git tag: `git tag -a v1.0.0-mvp -m "MVP Demo Release"`
  - GitHub Release notes
- **Commit mẫu:** `chore(ci): release v1.0.0 MVP for sprint 4 demo`

---

## 📊 Tổng hợp Tasks theo Thành viên

| Thành viên | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Tổng Tasks |
|---|---|---|---|---|---|
| **M1 Hardware** | M1-001~004 (4 tasks) | M1-005~008 (4 tasks) | M1-009~010 (2 tasks) | M1-011~012 (2 tasks) | **12 tasks** |
| **M2 AI/ML** | M2-001~003 (3 tasks) | M2-004~006 (3 tasks) | M2-007~009 (3 tasks) | M2-010~012 (3 tasks) | **12 tasks** |
| **M3 Backend** | M3-001~004 (4 tasks) | M3-005~008 (4 tasks) | M3-009~012 (4 tasks) | M3-013~016 (4 tasks) | **16 tasks** |
| **M4 Frontend** | M4-001~003 (3 tasks) | M4-004~006 (3 tasks) | M4-007~010 (4 tasks) | M4-011~013 (3 tasks) | **13 tasks** |
| **M5 QA/Lead** | M5-001~003 (3 tasks) | M5-004~005 (2 tasks) | M5-006~007 (2 tasks) | M5-008~010 (3 tasks) | **10 tasks** |
| **TỔNG** | **17** | **16** | **15** | **15** | **63 tasks** |

---

## 🔗 Dependency Map

```
M3-001 (backend scaffold)
  ├── M3-002 (models) → M3-003 (auth) → M3-005 (farm api)
  ├── M3-004 (mqtt) → M3-007 (telemetry) → M3-008 (websocket) → M3-009 (alert engine)
  └── M3-010 (analytics) → M3-011 (alert api) → M3-013 (security)

M1-002 (firmware setup)
  ├── M1-004 (sensors) → M1-005 (mqtt) → M1-006 (pid) → M1-007 (buffer)
  └── M1-008 (audio) → Test với M3-009 (alert engine)

M2-001 (rpi setup)
  ├── M2-002+003 (dataset) → M2-004 (train) → M2-005 (deploy) → M2-006 (bytetrack)
  └── M2-007 (predator) → cần M3-012 (minio) xong trước

M4-001 (frontend scaffold)
  ├── M4-002 (design) → M4-003 (auth pages) ← cần M3-003 (auth api)
  ├── M4-004 (dashboard) ← cần M3-008 (websocket)
  └── M4-007 (alerts) ← cần M3-009 (alert engine) + M3-011 (alert api)

M5-001 (dev env) → M5-002 (api spec) → unblocks M3 và M4
```

---

## ⚠️ Rủi ro & Giải pháp

| Rủi ro | Xác suất | Giải pháp |
|---|---|---|
| RPi FPS < 25 với model ONNX | Cao | Thử NCNN INT8; giảm input resolution 480×480 |
| Dataset chim yến khó thu thập | Trung bình | Dùng Open Images + synthetic augmentation |
| MQTT latency cao | Thấp | Switch QoS 0 cho telemetry; tune EMQX |
| Zalo ZNS approval mất thời gian | Cao | Mock ZNS trong dev; dùng email/SMS làm fallback |
| Hardware lắp ráp lỗi | Thấp | Test từng linh kiện riêng trước (M1-001) |
| Scope creep (tùy chọn features) | Trung bình | Chỉ làm "Bắt buộc" trong Sprint 1-3; "Tùy chọn" chỉ khi còn thời gian |

---

## 📁 Cấu trúc Repository Đề xuất

```
SwiftletCare_KLTN/
├── firmware/                 # M1: ESP32 PlatformIO project
│   ├── src/
│   │   ├── main.cpp
│   │   ├── sensors/
│   │   ├── mqtt/
│   │   ├── pid/
│   │   └── storage/
│   └── platformio.ini
├── ai-pipeline/              # M2: Python RPi pipeline
│   ├── inference.py
│   ├── tracker.py
│   ├── counting.py
│   ├── alert_publisher.py
│   ├── models/               # .onnx files
│   └── requirements.txt
├── backend/                  # M3: Node.js Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middlewares/
│   │   ├── mqtt/
│   │   └── socket/
│   ├── tests/
│   └── package.json
├── frontend/                 # M4: ReactJS + Vite + PWA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── services/
│   └── package.json
├── docs/                     # M5: Documentation
│   ├── hardware/
│   ├── api-spec.yaml
│   ├── test-reports/
│   └── sprint-reviews/
├── .github/
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── workflows/ci.yml
├── docker-compose.yml        # MongoDB + EMQX + MinIO
├── SRS_SwiftletCare.md
├── WORKPLAN.md               # File này
├── GITHUB_SETUP.md
└── CHANGELOG.md
```

---

## 📋 Checklist Tuần

> Dán vào GitHub Projects, dùng làm weekly standup template.

**Mỗi thứ Hai — Standup:**
- [ ] Mỗi thành viên báo cáo: tuần qua làm gì, tuần này làm gì, blocker gì?
- [ ] M5 review PRs còn pending
- [ ] Update GitHub Kanban board

**Mỗi thứ Sáu — Weekly Check:**
- [ ] Push tất cả work-in-progress lên remote branch
- [ ] Không để code untracked quá 3 ngày
- [ ] Report tiến độ theo WORKPLAN này

**Mỗi Sprint End (Chủ Nhật):**
- [ ] Tất cả tasks của sprint phải merge vào `develop`
- [ ] M5 chạy integration tests
- [ ] Demo 15 phút cho team: show what works
- [ ] Retrospective 10 phút: ghi chú vào sprint-review.md
- [ ] Merge `develop` → `main` nếu đủ điều kiện

---

_Tài liệu này được tạo bởi AI dựa trên SRS SwiftletCare v1.0.0._  
_Mọi thay đổi phạm vi cần được cập nhật vào file này và review bởi M5 (Owner)._  
_Cập nhật lần cuối: 07/09/2026_
