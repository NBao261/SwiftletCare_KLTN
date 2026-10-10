# SwiftletCare – KLTN FA26

> **Hệ thống tự động hóa và giám sát nhà yến** sử dụng IoT + Edge AI + Cloud

[![CI](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml/badge.svg)](https://github.com/NBao261/SwiftletCare_KLTN/actions)

## Cấu trúc Repository

```
SwiftletCare_KLTN/
├── firmware/          # ESP32 PlatformIO – RS485 sensor, PID, MQTT, loa ru
├── ai-pipeline/       # Raspberry Pi 4 – YOLOv8 + ByteTrack (chưa triển khai)
├── backend/           # Node.js Express API + MQTT + Socket.io
├── frontend/          # React web dashboard (Vite + Tailwind)
├── mobile/            # Expo/React Native app
├── docs/              # Tài liệu kỹ thuật (docs/api/api-spec.yaml = OpenAPI spec)
├── docker-compose.yml # Dev environment (MongoDB, EMQX, MinIO, Redis)
├── SwiftletCare_SRS.md
├── SwiftletCare_Components_Guide_v3.11.md
├── SwiftletCare_TASK_DETAIL_Checklist.md
└── GITHUB_SETUP.md
```

## Chạy local (sau khi restart máy)

### 1. Docker — MongoDB + EMQX (MQTT broker)

Mở Docker Desktop trước, đợi sẵn sàng, rồi:

```bash
docker compose up -d mongodb emqx
```

Data MongoDB đã lưu trong Docker volume — **không cần chạy lại `npm run seed`** ở các lần sau, chỉ cần lần đầu setup máy mới.

### 2. Backend

```bash
cd backend
cp .env.example .env   # chỉ cần lần đầu — sửa theo comment trong file (Mongo/MQTT dev dùng cổng 1883 non-TLS)
npm install
npm run dev
# API: http://localhost:3000 — health check: GET /health
# Swagger UI: http://localhost:3000/api-docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173 (Vite proxy /api -> backend :3000, không cần cấu hình CORS thủ công)
```

### 4. Firmware (ESP32)

Chỉ cần **cấp nguồn** (USB hoặc 12V qua Buck) — firmware lưu vĩnh viễn trong chip, không cần nạp lại trừ khi đổi code. Tự kết nối WiFi/MQTT bằng thông tin trong `firmware/src/config/Secrets.h` (file cục bộ, không commit — xem `firmware/src/config/Secrets.h.example`).

Chỉ nạp lại khi sửa firmware:
```bash
cd firmware
# Cắm USB, giữ nút BOOT trên board khi upload nếu auto-reset không hoạt động
"$USERPROFILE/.platformio/penv/Scripts/platformio.exe" run -e esp32dev -t upload
```

### 5. AI Pipeline (trên Raspberry Pi, chưa triển khai)

```bash
cd ai-pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python src/stream.py
```

## Tài liệu

- [SRS](./SwiftletCare_SRS.md) – Software Requirements Specification v1.11.0
- [Components Guide](./SwiftletCare_Components_Guide_v3.11.md) – BOM & đấu nối phần cứng
- [Task Checklist](./SwiftletCare_TASK_DETAIL_Checklist.md) – Việc theo sprint, đánh dấu tiến độ
- [GITHUB_SETUP](./GITHUB_SETUP.md) – Git workflow cho team
- [API Docs](./docs/api/README.md) – OpenAPI spec (`docs/api/api-spec.yaml`) + Swagger UI
- Từng module có README riêng: `backend/README.md`, `frontend/README.md`, `firmware/README.md`, `mobile/README.md`, `ai-pipeline/README.md`

## Team

| Thành viên | Vai trò | Module |
|---|---|---|
| M1 | Hardware Engineer | firmware/ |
| M2 | AI/ML Engineer | ai-pipeline/ |
| M3 | Backend Developer | backend/ |
| M4 | Frontend Developer | frontend/ |
| M5 (Owner) | QA + Tech Writer | docs/ + CI |

---
*SwiftletCare KLTN FA26 – Software Engineering, FPT University*
