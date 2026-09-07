# SwiftletCare – KLTN FA26

> **Hệ thống tự động hóa và giám sát nhà yến** sử dụng IoT + Edge AI + Cloud

[![CI](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml/badge.svg)](https://github.com/NBao261/SwiftletCare_KLTN/actions)

## 📁 Cấu trúc Repository

```
SwiftletCare_KLTN/
├── firmware/          # ESP32 PlatformIO – sensor, PID, MQTT
├── ai-pipeline/       # Raspberry Pi 4 – YOLOv8 + ByteTrack
├── backend/           # Node.js Express API + MQTT + WebSocket
├── frontend/          # ReactJS PWA – Dashboard + Mobile
├── docs/              # Tài liệu kỹ thuật và test reports
├── docker-compose.yml # Dev environment (MongoDB, EMQX, MinIO)
├── SRS_SwiftletCare.md
├── WORKPLAN.md
└── GITHUB_SETUP.md
```

## 🚀 Quick Start

### 1. Khởi động Dev Environment
```bash
docker compose up -d
# MongoDB: localhost:27017
# EMQX:    localhost:18083 (admin/public)
# MinIO:   localhost:9001  (minioadmin/minioadmin123)
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # điền thông tin thực tế
npm install
npm run dev
# API: http://localhost:3000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

### 4. AI Pipeline (trên Raspberry Pi)
```bash
cd ai-pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Sao chép model vào models/
python src/stream.py
```

### 5. Firmware (ESP32)
```bash
cd firmware
# Mở PlatformIO IDE
# Cấu hình src/config/Config.h
# PlatformIO: Build → Upload
```

## 📖 Tài liệu

- [SRS](./SRS_SwiftletCare.md) – Software Requirements Specification
- [WORKPLAN](./WORKPLAN.md) – Kế hoạch 8 tuần 5 thành viên
- [GITHUB_SETUP](./GITHUB_SETUP.md) – Git workflow cho team
- [API Docs](./docs/api/README.md) – REST API reference
- [BOM](./docs/hardware/BOM.md) – Bill of Materials phần cứng

## 👥 Team

| Thành viên | Vai trò | Module |
|---|---|---|
| M1 | Hardware Engineer | firmware/ |
| M2 | AI/ML Engineer | ai-pipeline/ |
| M3 | Backend Developer | backend/ |
| M4 | Frontend Developer | frontend/ |
| M5 (Owner) | QA + Tech Writer | docs/ + CI |

---
*SwiftletCare KLTN FA26 – Software Engineering, FPT University*
