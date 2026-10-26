# SwiftletCare

**An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming**

Hệ thống IoT tự động điều khiển vi khí hậu và giám sát sức khỏe đàn chim cho nhà yến. Đồ án tốt nghiệp (Capstone Project, KLTN) — ngành Software Engineering, FPT University, học kỳ FA26.

[![CI](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml/badge.svg)](https://github.com/NBao261/SwiftletCare_KLTN/actions/workflows/ci.yml)

> Yêu cầu chính thức là **Report 3 – SRS** ([`docs/reports/report3-srs.md`](./docs/reports/report3-srs.md)), thiết kế là **Report 4 – SDD** ([`docs/reports/report4-sdd.md`](./docs/reports/report4-sdd.md)), theo phiếu đăng ký bản sửa sau Review 1. Những chỗ code còn lệch với Report 3 nằm ở [`docs/reports/project-tracking.md`](./docs/reports/project-tracking.md) §6. `SwiftletCare_SRS.md` chỉ còn là ghi chú nội bộ.

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
2. **Đếm chim ra/vào** — camera tại cửa ra vào, model YOLO26n + ByteTrack đếm chim và phát live stream có khung nhận diện.
3. **Giám sát sức khỏe đa nguồn có chuyên gia tham gia** — kết hợp dữ liệu môi trường, khí, tiếng ồn và số chim; Domain Expert kiểm chứng cảnh báo và viết kết luận cho chủ nhà yến.

Một bản cài đặt SwiftletCare phục vụ một chủ nhà yến và các farm của chủ đó: Admin tạo tài khoản, thành viên vào bằng lời mời, không có đăng ký công khai; không có mua bán, ticket hay điều phối dịch vụ.

Report 3 chia thành 11 luồng chính (MF-01…11), gồm cả việc chủ nhà yến tự gắn bộ điều khiển vào tầng bằng hai lần quét QR (MF-10) và trạng thái sức khỏe nhà yến theo ngày kèm báo cáo ngày/tuần/tháng (MF-11).

Vai trò người dùng:

| Vai trò | Việc chính |
|---|---|
| Farm Owner | Theo dõi nhà yến, tự lắp và gán thiết bị bằng QR, điều khiển tay khi cần, nhận cảnh báo, ghi nhận thu hoạch, mời thành viên; quyết thay chuyên gia khi farm chưa có chuyên gia |
| Domain Expert | Chuyên gia nuôi yến: kiểm chứng cảnh báo suy luận, chỉnh ngưỡng và hệ số điều khiển, duyệt thay đổi của chủ farm, viết kết luận báo cáo sức khỏe (chỉ đọc phần vận hành); mọi quyết định đều báo cho chủ farm |
| Technician | Vai trò kỹ thuật: xem thiết bị và cảnh báo thiết bị của mọi farm, lắp/dời/gỡ thiết bị, khởi động lại, đẩy cấu hình, cập nhật firmware từ xa; không bật/tắt relay, không xem dữ liệu môi trường |
| Admin | Tạo tài khoản Farm Owner và Technician, khoá/mở tài khoản, xử lý yêu cầu xoá dữ liệu, kho thiết bị và in nhãn QR, ngưỡng mặc định, audit log, tổng quan kỹ thuật; không quản lý farm |

## Tính năng chính

**Điều khiển môi trường**
- Đọc 5 cảm biến RS485 (nhiệt độ + độ ẩm, NH3, CO2, ánh sáng, tiếng ồn); nhiệt độ và độ ẩm được lọc nhiễu (median + Kalman) trước khi vào bộ điều khiển.
- Điều khiển mờ Sugeno cho phun sương và quạt; hệ số và ngưỡng chỉnh được theo từng Zone, đẩy xuống thiết bị qua MQTT và lưu trong NVS.
- Trạng thái an toàn: mất số đo hợp lệ thì tắt relay nhưng vòng điều khiển vẫn chạy; tự ngừng phun khi phun mà độ ẩm không tăng (`MISTING_INEFFECTIVE`). Đây là kiểm tra phần mềm; bảo vệ điện của tải vẫn là tủ điện của nhà yến.
- Can thiệp tay có thời hạn riêng cho từng relay (bơm tối đa 30 phút và phải xác nhận khi đang có cảnh báo cảm biến hoặc phun sương; quạt và loa 1 phút – 24 giờ), tự trở về chế độ tự động và được ghi lịch sử; tỷ lệ thời gian chạy tự động được thống kê.
- Loa phát âm thanh dẫn dụ theo lịch, quản lý file từ web.

**Cảnh báo và giám sát**
- Cảnh báo vượt ngưỡng (có thời gian chờ để không báo khi điều khiển đang kéo về), thiết bị mất kết nối, phun không tăng ẩm, khởi động lại bất thường, tiếng ồn bất thường, cảm biến bất thường, dự báo sắp vượt ngưỡng (60 phút tới); NH3/CO2 chỉ cảnh báo, không điều khiển quạt.
- Gửi cảnh báo ngoài ứng dụng qua **Telegram bot** và **push FCM** (Telegram đã gửi thật, FCM đang làm); khử trùng lặp theo sự cố, tự đóng khi sự cố qua.
- Domain Expert xác nhận hoặc bác bỏ cảnh báo suy luận (bác bỏ thì cảnh báo thành `DISMISSED`).
- Mỗi nhà yến có một trạng thái sức khỏe theo ngày (chỉ báo theo luật, không phải chẩn đoán) và báo cáo ngày/tuần/tháng theo nhà, xuất PDF/CSV; chủ farm và chuyên gia tự đánh giá ngày trước khi xem trạng thái của hệ thống để đo mức trùng khớp; chuyên gia viết kết luận.
- Dashboard thời gian thực qua Socket.io, biểu đồ và phân tích hiệu quả điều khiển.

**Thiết lập thiết bị (MF-10)**
- Chủ farm quét nhãn QR trên bộ điều khiển (Device ID + mã kích hoạt) và mã QR dán ở tầng trong app mobile; cài Wi-Fi qua AP-mode, không nạp lại firmware; không phải nhập farm/zone trên thiết bị — farm, nhà và tầng chỉ lưu ở backend, thiết bị chỉ nhận cấu hình của tầng.
- Dời bộ điều khiển sang tầng khác từ xa, lịch sử dữ liệu đi theo thiết bị.

**Vận hành (luồng phụ)**
- Không còn ticket, SLA, phân vùng Technician (Report 3 §8): cảnh báo chưa ai xác nhận được gửi lại, bơm/quạt chạy quá giới hạn sinh cảnh báo bảo trì. Code ticket, SLA và vùng Technician đã gỡ (PR #103–#106).
- Ghi nhận mẻ thu hoạch (chỉ để theo dõi nội bộ, không mua bán), tự lưu kèm số liệu môi trường của Zone và đàn chim của nhà yến trước thời điểm thu hoạch.

## Kiến trúc

```
                 ┌──────────────── Nhà yến ────────────────┐
 Cảm biến RS485 ─┤► ESP32 (firmware) ──► relay phun sương / │
                 │        │               quạt / loa ru     │
 Camera IP ──────┤        │                                 │
   │ RTSP        └────────┼─────────────────────────────────┘
   ▼                      │ MQTT (TLS khi deploy)
 AI node ── MQTT ──────►  EMQX broker
 (YOLO26 + ByteTrack)     │
                          ▼
                 Backend (Node.js / Express) ──► MongoDB
                 REST + Socket.io, cron jobs ──► MinIO (file)
                          │                  ──► Telegram (cảnh báo)
                          ▼
              Web dashboard (React)  ·  Mobile app (Expo)
```

Sơ đồ draw.io cũ ở [`docs/diagrams/`](./docs/diagrams/) vẽ theo phạm vi trước Review 1 (PID, SMS, vai trò Operator); sơ đồ hiện hành là sơ đồ Mermaid trong Report 4 (`docs/reports/report4-sdd.md` §2.1, §8–9, §11). Hợp đồng API: [`docs/api/api-spec.yaml`](./docs/api/api-spec.yaml) (OpenAPI 3.0, backend phục vụ Swagger UI tại `/api-docs`).

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Firmware | ESP32, PlatformIO + Arduino, FreeRTOS, Modbus RTU (RS485), MQTT, NVS/SPIFFS |
| Backend | Node.js 22, Express, TypeScript, MongoDB (Mongoose), MQTT (EMQX), Socket.io, node-cron, Jest |
| Frontend | React 18, Vite, TypeScript, TailwindCSS, React Query, Zustand, Vitest, PWA |
| Mobile | Expo, Expo Router, React Native, React Query, Zustand |
| AI pipeline | Python, OpenCV, YOLO26n (ONNX Runtime), ByteTrack |
| Hạ tầng | Docker Compose (MongoDB, EMQX, MinIO, Redis), GitHub Actions |

## Trạng thái phát triển

Những yêu cầu của Report 3 mà code chưa đáp ứng được liệt kê theo từng FR ở [`docs/reports/project-tracking.md`](./docs/reports/project-tracking.md) §6 (gap G-01…G-19).

| Module | Trạng thái |
|---|---|
| `backend/` | Đủ các module AUTH, FARM, Device, Telemetry, Alert, Analytics, System, Harvest, Expert và phần nhận số đếm chim; quyền theo Report 3 §2.4, gửi lại cảnh báo và `MAINTENANCE_DUE` đã xong, ticket/SLA/vùng đã gỡ (PR #100–#106). Còn thiếu: bỏ đăng ký công khai, đổi tên cảnh báo, `DISMISSED`, topic MQTT theo thiết bị, đồng bộ cấu hình, duyệt thay đổi của chủ farm, đánh giá sức khỏe theo ngày, push FCM thật… (G-01…G-14) |
| `firmware/` | Bản 1.4.0 (thêm khởi động lại và OTA từ xa có rollback); đã chạy trên board ESP32 thật, nhưng chưa ghi lại kịch bản nào đã thử. Chưa gửi version cấu hình trong heartbeat (ENV-FR-027). |
| `frontend/` | Có màn Farm Owner, Domain Expert (PR #91, còn dữ liệu giả dự phòng), Technician và Admin; Marketplace đã gỡ (PR #93). Còn thiếu: màn setup bằng QR, trạng thái sức khỏe theo ngày và chấm điểm, vẽ vòng đếm; còn trường relay sưởi và tùy chọn Zalo/SMS cần gỡ (G-01, G-09, G-11, G-15) |
| `mobile/` | Khung ứng dụng; phần lớn màn hình chưa làm. |
| `ai-pipeline/` | Theo vết cả khung, đếm qua vòng quanh lỗ, gửi số đếm và heartbeat qua MQTT, đẩy video có khung (PR #88, #95); chưa có model swiftlet tự train, chưa chạy với staging ([`docs/bird-counting-plan.md`](./docs/bird-counting-plan.md), G-12) |

## Cấu trúc repository

```
SwiftletCare_KLTN/
├── backend/              # REST API + MQTT + Socket.io
├── frontend/             # Web dashboard / PWA
├── mobile/               # Ứng dụng di động
├── firmware/             # ESP32: cảm biến, điều khiển, MQTT, loa ru
├── ai-pipeline/          # Đếm chim yến (YOLO26n + ByteTrack)
├── docs/                 # Report 3–4 (SRS, SDD), API spec, database script, phần cứng, sơ đồ, kế hoạch
├── .github/              # CI, CODEOWNERS, PR template
├── docker-compose.yml    # Môi trường dev
└── SwiftletCare_SRS.md   # Ghi chú SRS nội bộ (đặc tả chính thức: docs/reports/report3-srs.md)
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
| [`docs/reports/report3-srs.md`](./docs/reports/report3-srs.md) | **Report 3 – SRS**: yêu cầu chính thức (FR, BR, NFR, vòng đời, truy vết) |
| [`docs/reports/report4-sdd.md`](./docs/reports/report4-sdd.md) | **Report 4 – SDD**: kiến trúc, công nghệ, quyết định thiết kế, ERD, giao diện, sơ đồ trạng thái và hoạt động |
| [`docs/reports/project-tracking.md`](./docs/reports/project-tracking.md) §6 | Trạng thái tiến độ: tính năng, test, defect và các gap G-01…G-19 của code so với Report 3/Report 4 |
| [`docs/database/init.mongo.js`](./docs/database/init.mongo.js) | Database script (sinh từ model bằng `npm run db:script`) |
| [`SwiftletCare_SRS.md`](./SwiftletCare_SRS.md) | Ghi chú SRS nội bộ (tiếng Việt): lịch sử phạm vi, mô tả luồng chi tiết — không còn là đặc tả chính thức |
| [`docs/api/`](./docs/api/README.md) | OpenAPI spec và hướng dẫn xem API |
| [`docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md) | Cấu trúc thư mục, file nào đặt ở đâu |
| [`docs/hardware/`](./docs/hardware/) | BOM, hướng dẫn linh kiện và đấu nối |
| [`docs/diagrams/`](./docs/diagrams/) | Context diagram, kiến trúc hệ thống (bản cũ trước Review 1; bản hiện hành trong Report 4) |
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
