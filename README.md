# SwiftletCare

**An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

Hệ thống IoT tự động điều khiển vi khí hậu và giám sát sức khỏe đàn chim cho nhà yến. Đồ án tốt nghiệp (Capstone Project, KLTN) — ngành Software Engineering, FPT University, học kỳ FA26.

[![CI](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml/badge.svg)](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml)

> Phạm vi hiện hành là **SRS v2** (phiếu đăng ký bản sửa sau Review 1) — xem [`SwiftletCare_SRS.md`](./SwiftletCare_SRS.md) mục 0. Những gì còn phải làm theo từng module nằm ở SRS mục 0.5.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc](#kiến-trúc)
- [Công nghệ](#công-nghệ)
- [Trạng thái phát triển](#trạng-thái-phát-triển)
- [Cấu trúc repository](#cấu-trúc-repository)
- [Chạy trên máy local](#chạy-trên-máy-local)
- [Kiểm thử và CI](#kiểm-thử-và-ci)
- [Quy trình đóng góp](#quy-trình-đóng-góp)
- [Tài liệu](#tài-liệu)
- [Nhóm phát triển](#nhóm-phát-triển)

## Tổng quan

Nhà yến cần giữ nhiệt độ, độ ẩm và ánh sáng ổn định suốt ngày đêm; người nuôi thường chỉnh tay và chỉ phát hiện sự cố khi đã muộn. SwiftletCare đặt bộ điều khiển ESP32 tại từng Zone của nhà yến để đo và điều khiển tự động, đưa dữ liệu lên máy chủ để theo dõi từ xa, cảnh báo khi có bất thường và để chuyên gia nuôi yến xác nhận các kết luận về sức khỏe đàn chim.

Luồng chính của hệ thống:

1. **Điều khiển vi khí hậu tự động** — bộ điều khiển mờ (fuzzy) trên ESP32 bật/tắt phun sương và quạt theo nhiệt độ, độ ẩm.
2. **Đếm chim ra/vào** — camera tại cửa ra vào, model YOLOv8 + ByteTrack đếm chim và phát live stream có khung nhận diện.
3. **Giám sát sức khỏe đa nguồn có chuyên gia tham gia** — kết hợp dữ liệu môi trường, khí, tiếng ồn và số chim; Domain Expert kiểm chứng cảnh báo và viết kết luận cho chủ nhà yến.

Vai trò người dùng:

| Vai trò | Việc chính |
|---|---|
| Farm Owner | Theo dõi nhà yến, điều khiển tay khi cần, nhận cảnh báo, ghi nhận thu hoạch, mời thành viên |
| Domain Expert | Chuyên gia nuôi yến: kiểm chứng cảnh báo suy luận, chỉnh ngưỡng và hệ số điều khiển, viết kết luận báo cáo sức khỏe (chỉ đọc phần vận hành) |
| Technician | Lắp đặt, bảo trì thiết bị, xử lý ticket kỹ thuật |
| Admin | Quản trị tài khoản, cấu hình hệ thống, giám sát toàn cục |

## Tính năng chính

**Điều khiển môi trường**
- Đọc 5 cảm biến RS485 (nhiệt độ + độ ẩm, NH3, CO2, ánh sáng, tiếng ồn); nhiệt độ và độ ẩm được lọc nhiễu (median + Kalman) trước khi vào bộ điều khiển.
- Điều khiển mờ Sugeno cho phun sương và quạt; hệ số và ngưỡng chỉnh được theo từng Zone, đẩy xuống thiết bị qua MQTT và lưu trong NVS.
- Trạng thái an toàn: mất số đo hợp lệ thì tắt relay nhưng vòng điều khiển vẫn chạy; tự ngừng phun khi phát hiện bơm khô.
- Can thiệp tay có thời hạn (1 phút – 24 giờ), tự trở về chế độ tự động và được ghi lịch sử; tỷ lệ thời gian chạy tự động được thống kê.
- Loa phát âm thanh dẫn dụ theo lịch, quản lý file từ web.

**Cảnh báo và giám sát**
- Cảnh báo vượt ngưỡng, thiết bị mất kết nối, bơm khô, tiếng ồn bất thường, cảm biến bất thường, dự báo sắp vượt ngưỡng (60 phút tới); NH3/CO2 chỉ cảnh báo, không điều khiển quạt.
- Gửi cảnh báo ngoài ứng dụng qua **Telegram bot**; khử trùng lặp theo sự cố, tự đóng khi sự cố qua.
- Domain Expert xác nhận hoặc bác bỏ cảnh báo suy luận; báo cáo sức khỏe Zone tự tổng hợp hằng tuần, chuyên gia viết kết luận.
- Dashboard thời gian thực qua Socket.io, biểu đồ và phân tích hiệu quả điều khiển.

**Vận hành (luồng phụ)**
- Ticket kỹ thuật có SLA, tự định tuyến, lịch hẹn trong khung 07:00–18:00, checklist nghiệm thu; bảo trì định kỳ tự sinh ticket.
- Ghi nhận mẻ thu hoạch, tự lưu kèm số liệu môi trường và đàn chim của Zone tại thời điểm thu hoạch.

## Kiến trúc

```
                 ┌──────────────── Nhà yến ────────────────┐
 Cảm biến RS485 ─┤► ESP32 (firmware) ──► relay phun sương / │
                 │        │               quạt / loa ru     │
 Camera IP ──────┤        │                                 │
   │ RTSP        └────────┼─────────────────────────────────┘
   ▼                      │ MQTT (TLS khi deploy)
 AI node ── MQTT ──────►  EMQX broker
 (YOLOv8 + ByteTrack)     │
                          ▼
                 Backend (Node.js / Express) ──► MongoDB
                 REST + Socket.io, cron jobs ──► MinIO (file)
                          │                  ──► Telegram (cảnh báo)
                          ▼
              Web dashboard (React)  ·  Mobile app (Expo)
```

Sơ đồ chi tiết (draw.io): [`docs/diagrams/`](./docs/diagrams/). Hợp đồng API: [`docs/api/api-spec.yaml`](./docs/api/api-spec.yaml) (OpenAPI 3.0, backend phục vụ Swagger UI tại `/api-docs`).

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Firmware | ESP32, PlatformIO + Arduino, FreeRTOS, Modbus RTU (RS485), MQTT, NVS/SPIFFS |
| Backend | Node.js 22, Express, TypeScript, MongoDB (Mongoose), MQTT (EMQX), Socket.io, node-cron, Jest |
| Frontend | React 18, Vite, TypeScript, TailwindCSS, React Query, Zustand, Vitest, PWA |
| Mobile | Expo, Expo Router, React Native, React Query, Zustand |
| AI pipeline | Python, OpenCV, YOLOv8 (ONNX Runtime), ByteTrack |
| Hạ tầng | Docker Compose (MongoDB, EMQX, MinIO, Redis), GitHub Actions |

## Trạng thái phát triển

Trạng thái chi tiết theo từng yêu cầu (FR) nằm ở cột "Trạng thái Backend" trong SRS mục 5.

| Module | Trạng thái |
|---|---|
| `backend/` | Theo SRS v2. Đủ các module AUTH, FARM, Device, Telemetry, Alert, Analytics, Ticket, System, Harvest, Expert. Còn thiếu phần nhận số đếm chim (handler MQTT mới ghi log). |
| `firmware/` | Bản 1.3.0 theo SRS v2; đã build và chạy unit test trên máy tính, **chưa nạp và thử trên board thật**. |
| `frontend/` | Chạy được nhưng còn theo phạm vi cũ (v1.24): chưa có màn hình Domain Expert, còn Marketplace và relay sưởi cần gỡ. |
| `mobile/` | Khung ứng dụng; phần lớn màn hình chưa làm. |
| `ai-pipeline/` | Khung code; đang làm theo [`docs/bird-counting-plan.md`](./docs/bird-counting-plan.md). Chưa có model. |

## Cấu trúc repository

```
SwiftletCare_KLTN/
├── backend/              # REST API + MQTT + Socket.io
├── frontend/             # Web dashboard / PWA
├── mobile/               # Ứng dụng di động
├── firmware/             # ESP32: cảm biến, điều khiển, MQTT, loa ru
├── ai-pipeline/          # Đếm chim yến (YOLOv8 + ByteTrack)
├── docs/                 # API spec, phần cứng, sơ đồ, kế hoạch, checklist
├── .github/              # CI, CODEOWNERS, PR template
├── docker-compose.yml    # Môi trường dev
└── SwiftletCare_SRS.md   # Đặc tả yêu cầu
```

Mỗi module là một project độc lập, không import code của nhau; chúng giao tiếp qua REST, Socket.io và MQTT. Chi tiết từng thư mục: [`docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md).

## Chạy trên máy local

### Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 22 (bản CI đang dùng) và npm
- [PlatformIO Core](https://platformio.org/install/cli) — chỉ khi làm firmware
- Python 3.10–3.12 — chỉ khi làm AI pipeline

### 1. Hạ tầng

```bash
docker compose up -d mongodb emqx        # thêm "minio" nếu cần lưu file (âm thanh loa ru)
```

| Dịch vụ | Địa chỉ |
|---|---|
| MongoDB | `localhost:27017` |
| EMQX (MQTT) | `localhost:1883` (dev, không TLS) · `8883` (TLS) · dashboard `http://localhost:18083` |
| MinIO | API `localhost:9000` · console `http://localhost:9001` |

Dữ liệu MongoDB nằm trong Docker volume, giữ nguyên qua các lần khởi động lại.

### 2. Backend

```bash
cd backend
cp .env.example .env        # lần đầu; đọc chú thích trong file
npm install
npm run seed                # lần đầu: tạo dữ liệu mẫu
npm run dev                 # http://localhost:3000 · health: /health · Swagger: /api-docs
```

Khi dev, `MQTT_BROKER_URL` phải là `mqtt://localhost:1883` (EMQX dev tự ký chứng chỉ trên cổng 8883 nên Node từ chối). Chưa dựng MinIO thì đặt `STORAGE_DRIVER=local` trong `.env`.

`npm run seed` tạo một Farm/House/Zone/thiết bị mẫu và ba tài khoản (mật khẩu `Test1234!`, **chỉ dùng cho dev**):

| Email | Vai trò |
|---|---|
| `owner@swiftletcare.dev` | Farm Owner |
| `expert@swiftletcare.dev` | Domain Expert |
| `tech@swiftletcare.dev` | Technician |

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (Vite proxy /api và /socket.io sang backend :3000)
```

### 4. Mobile

```bash
cd mobile
cp .env.example .env        # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WS_URL
npm install
npx expo start
```

### 5. Firmware

```bash
cd firmware
pio run -e esp32dev                  # build
pio run -e esp32dev --target upload  # nạp qua USB (giữ nút BOOT nếu board không tự reset)
pio device monitor -b 115200         # xem log
```

Thông tin WiFi/MQTT mặc định đặt trong `firmware/src/config/Secrets.h` (tạo từ `Secrets.h.example`, không commit). Đổi mạng không cần nạp lại: thiết bị tự tìm broker qua mDNS, hoặc mở portal cấu hình. Chạy `npm run mdns` trong `backend/` để broker được tìm thấy với tên `swiftletcare-broker.local`.

### 6. AI pipeline

Chưa triển khai — xem [`ai-pipeline/README.md`](./ai-pipeline/README.md) và [`docs/bird-counting-plan.md`](./docs/bird-counting-plan.md).

## Kiểm thử và CI

| Module | Lệnh |
|---|---|
| Backend | `npm run lint` · `npm run build:check` · `npm test` (Jest + mongodb-memory-server, ngưỡng coverage 80% số dòng) |
| Frontend | `npm run lint` · `npx tsc --noEmit` · `npx vitest run` · `npm run build` |
| Firmware | `pio test -e native` (unit test chạy trên máy tính) |
| Mobile | `npm run lint` · `npm run typecheck` · `npx jest` (chưa có test) |

GitHub Actions ([`ci.yml`](./.github/workflows/ci.yml)) chạy trên mọi PR: kiểm tra commit message (commitlint), quét secret (gitleaks), rồi chạy bộ kiểm tra của **những module mà PR thay đổi**. AI pipeline chưa có job CI.

## Quy trình đóng góp

1. Tạo nhánh từ `develop` với tiền tố `feat/`, `fix/`, `docs/` hoặc `chore/`; mở PR về `develop` (`main` chỉ dùng khi deploy).
2. Commit theo [Conventional Commits](https://www.conventionalcommits.org/) với `type`/`scope` trong [`.commitlintrc.json`](./.commitlintrc.json), ví dụ `feat(alert): ...`, `fix(api): ...`. Mỗi dòng tối đa 100 ký tự.
3. Điền mẫu PR ([`.github/pull_request_template.md`](./.github/pull_request_template.md)); chạy các lệnh kiểm thử của module trước khi push.
4. Mỗi module có quy tắc riêng trong `<module>/CLAUDE.md` (frontend thêm `frontend/FE_Design_Claude.md`); PR được review theo quy tắc của module mà nó thay đổi.
5. Không commit secret (`.env`, `Secrets.h`, chứng chỉ), model, clip hay dataset.

Chi tiết quy trình Git của nhóm: [`docs/github-setup.md`](./docs/github-setup.md).

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [`SwiftletCare_SRS.md`](./SwiftletCare_SRS.md) | Đặc tả yêu cầu — mục 0 là phạm vi hiện hành, mục 5 là trạng thái từng FR |
| [`docs/api/`](./docs/api/README.md) | OpenAPI spec và hướng dẫn xem API |
| [`docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md) | Cấu trúc thư mục, file nào đặt ở đâu |
| [`docs/hardware/`](./docs/hardware/) | BOM, hướng dẫn linh kiện và đấu nối |
| [`docs/diagrams/`](./docs/diagrams/) | Context diagram, kiến trúc hệ thống |
| [`docs/bird-counting-plan.md`](./docs/bird-counting-plan.md) | Kế hoạch triển khai đếm chim |
| [`docs/task-checklist.md`](./docs/task-checklist.md) | Checklist công việc theo sprint |
| `<module>/README.md` | Hướng dẫn riêng từng module |

## Nhóm phát triển

| Thành viên | Vai trò | Phụ trách |
|---|---|---|
| M1 | Hardware Engineer | `firmware/` |
| M2 | AI/ML Engineer | `ai-pipeline/` |
| M3 | Backend Developer | `backend/` |
| M4 | Frontend Developer | `frontend/` |
| M5 (Owner) | QA + Tech Writer | `docs/`, CI |

---

<sub>SwiftletCare · Capstone Project FA26 · Software Engineering · FPT University</sub>
