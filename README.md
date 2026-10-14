# SwiftletCare – KLTN FA26

> **Hệ thống tự động hóa và giám sát nhà yến** sử dụng IoT + Edge AI + Cloud
>
> **Phạm vi hiện hành:** SRS v2.0.0, theo phiếu đăng ký bản sửa sau Review 1 (`SwiftletCare_SRS.md` mục 0). Code còn theo phạm vi cũ ở nhiều chỗ — danh sách việc cần sửa theo module ở SRS mục 0.5.

[![CI](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml/badge.svg)](https://github.com/NBao261/SwiftletCare_KLTN/actions)

## Cấu trúc Repository

```
SwiftletCare_KLTN/
├── firmware/          # ESP32 PlatformIO – RS485 sensor, PID, MQTT, loa ru
├── ai-pipeline/       # Đếm chim yến – YOLOv8 + ByteTrack trên PC/máy chủ (chưa triển khai)
├── backend/           # Node.js Express API + MQTT + Socket.io
├── frontend/          # React web dashboard (Vite + Tailwind)
├── mobile/            # Expo/React Native app
├── docs/              # Tài liệu: api/ (OpenAPI spec), hardware/, diagrams/, task-checklist, github-setup — xem docs/FOLDER_STRUCTURE.md
├── docker-compose.yml # Dev environment (MongoDB, EMQX, MinIO, Redis)
└── SwiftletCare_SRS.md
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

### 5. AI Pipeline (PC tại nhà yến hoặc máy chủ, chưa triển khai)

```bash
cd ai-pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python src/stream.py
```

## Tài liệu

- [SRS](./SwiftletCare_SRS.md) – Software Requirements Specification (phạm vi hiện hành: mục 0)
- [Cấu trúc thư mục](./docs/FOLDER_STRUCTURE.md) – file nào đặt ở đâu, quy tắc từng module
- [Components Guide](./docs/hardware/components-guide.md) – BOM & đấu nối phần cứng
- [Task Checklist](./docs/task-checklist.md) – Việc theo sprint, đánh dấu tiến độ
- [GitHub setup](./docs/github-setup.md) – Git workflow cho team
- [Sơ đồ](./docs/diagrams/) – context diagram, kiến trúc hệ thống (draw.io)
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
