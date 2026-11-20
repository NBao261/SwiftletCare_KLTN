# Môi trường staging — đề xuất cho Review 2 và Defense 1.1

Tài liệu này giải thích **staging là gì**, cấu hình nhóm chọn và các bước dựng nó. Report 4 §3.4, §11 và quyết định D5 là bản chính thức bằng tiếng Anh. Các file chạy thật nằm ở `deploy/` và `backend/Dockerfile` (mục 3); mẫu cũ ở `docs/bird-counting-plan.md` §15.3–15.5 dùng Caddy và bốn tên miền, nay thay bằng **Nginx + Certbot** và **một tên miền**. Mục 15.2 và mục 18 của plan còn giả định model chạy trên VPS. Tài liệu này thay hai mục đó: **model chạy trên PC cũ đặt tại nhà một thành viên**. PC kéo hình camera qua Internet, nhờ IP tĩnh của đường VNPT ở nhà yến.

## 1. Staging là gì, vì sao phải có

| Môi trường | Ở đâu | Dùng để |
| --- | --- | --- |
| Dev | Máy từng thành viên (`docker compose up -d`, `npm run dev`) | Viết code, chạy test |
| **Staging** | Một máy chủ công khai, cấu hình giống thật, dữ liệu mẫu | Demo cho hội đồng, đo NFR, chạy thử trước khi gắn tag |
| Production | Không vận hành thương mại (Report 3 §8) | — |

Hướng dẫn Review 2 bắt buộc demo chạy trên staging đã khai báo trong Report 4, không chạy trên máy cá nhân (§9.2). Dữ liệu mẫu phải nạp bằng script trong repo để demo lặp lại được. Hội đồng có thể chọn kịch bản bất kỳ và đổi dữ liệu đầu vào. Các NFR-01, 02, 03 cũng ghi rõ cách đo là "on staging".

## 2. Cấu hình đề xuất

```
                ┌──────────── VPS (Docker) ─────────────┐
 Người dùng ──443──► Nginx (TLS) ─► backend, web, MediaMTX (WHEP)
 (web/mobile)  ─8189/udp──────────► MediaMTX (WebRTC)
                │  Nginx 8883 ─► EMQX ◄─1883 nội bộ─ backend
                │  Nginx 8322 ─► MediaMTX (nhận video)
                │  MongoDB, file (volume backend): chỉ trong mạng Docker
                └────────────────────────────────────────┘
                        ▲ 8883 MQTT TLS     ▲ 8322 RTSPS
 Nhà yến ──────── ESP32 ┘                   │
   Camera (IP tĩnh, mở cổng 18554)          │
      │ RTSP qua TCP, qua Internet          │
      ▼                                     │
 Nhà thành viên ── PC cũ (AI node: stream.py) ┘
```

### 2.1. VPS

- **Cỡ máy:** 2 vCPU, 4 GB RAM, ≥ 60 GB SSD, Ubuntu 24.04 LTS. Model không chạy trên VPS nên không cần máy 4 vCPU / 8 GB như plan §15.2 bước 1.
- **Vị trí:** Singapore hoặc Việt Nam, để video ít trễ.
- **Nhà cung cấp, theo thứ tự ưu tiên:**
  1. Tín dụng của GitHub Student Developer Pack (DigitalOcean).
  2. Azure for Students.
  3. VPS trả phí trong nước.

  Kiểm tra ưu đãi còn hiệu lực ở `education.github.com/pack`, vì gói sinh viên duyệt mất vài ngày.
- **Tên miền:** **một** tên (`DOMAIN`), một bản ghi A trỏ về IP của VPS. Web ở `/`, API ở `/api`, Socket.io ở `/socket.io`, WHEP ở `/stream`; MQTT TLS ở cổng 8883 và RTSPS ở cổng 8322 của cùng tên. Một chứng chỉ, một lần xin.

### 2.2. Các service trên VPS

| Service | Vai trò | Cổng mở ra Internet |
| --- | --- | --- |
| Nginx | Reverse proxy: phục vụ web đã build; chuyển `/api`, `/socket.io` (WebSocket) vào backend; chuyển trang WHEP sang MediaMTX; chặn `/internal/*`. Module `stream` bọc TLS cho MQTT (8883 → EMQX 1883) và cho luồng đẩy video (8322 → MediaMTX 8554). Một chứng chỉ Let's Encrypt cho `DOMAIN` | 80, 443, 8883, 8322 |
| Certbot | Xin chứng chỉ lần đầu bằng `deploy/staging-cert.sh`; container `certbot` gia hạn mỗi 12 giờ (webroot qua cổng 80); cron trên VPS nạp lại Nginx (mục 3) | không |
| backend | API, Socket.io, job nền; nối EMQX qua `mqtt://emqx:1883` trong mạng Docker | không |
| EMQX | Broker; xác thực qua `/internal/mqtt-auth`, quyền theo `deploy/emqx/acl.conf`, tắt anonymous; dashboard 18083 chỉ mở cho `127.0.0.1` và vào qua SSH tunnel | không (đi qua Nginx 8883) |
| EMQX, biến môi trường | `EMQX_AUTHENTICATION__1__URL=http://backend:3000/internal/mqtt-auth?key=<MQTT_AUTH_KEY>`; `MQTT_USERNAME` của backend phải là `backend-service` như `deploy/emqx/acl.conf` | không |
| MongoDB | Dữ liệu | không |
| File (âm thanh, ảnh Work Order, ảnh mùa vụ) | `STORAGE_DRIVER=local`: volume `backend_storage` của backend, tải qua `/api/files/<key>`. Không dùng MinIO vì ảnh `minio/minio` và `minio/mc` không còn phát công khai (Docker Hub, Quay). Key có UUID ngẫu nhiên nên link không đoán được, nhưng **không hết hạn** như URL ký của MinIO | không |
| MediaMTX | Nhận video có khung từ PC cũ (AI node); phát WebRTC cho web (trang WHEP qua `/stream`) và HLS cho app mobile (qua `/hls`); hỏi backend `/internal/stream-auth` ở mỗi lần đẩy hoặc xem | 8189 TCP + UDP (WebRTC tự mã hoá) |

Không cổng nào truyền dữ liệu dạng rõ ra Internet. **Cổng 1883 không mở ra ngoài**, trừ phương án lùi ở mục 4.

### 2.3. PC cũ đặt tại nhà (AI node)

- **Vị trí:** nhà một thành viên. Máy để nơi khô ráo, có người trông, sửa lỗi và đo FPS trực tiếp được. Không phải để máy tính trong nhà yến, nơi ẩm và ít người lui tới.
- **Lấy hình camera qua Internet:**
  - Đường VNPT ở nhà yến dùng **IP tĩnh**, không cần DDNS.
  - Cổng 18554 trên modem đã mở về `192.168.1.163:554` của camera (plan §19.7).
  - PC dùng `rtsp://<tài khoản>:<mật khẩu>@<IP tĩnh nhà yến>:18554/stream1`, kéo qua TCP (`stream.py` đặt sẵn `OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;tcp`).
  - URL và mật khẩu chỉ nằm trong `.env` của PC, không commit.
- **Đường truyền:**
  - Luồng chính 1080p, 25 fps, khoảng 2 Mbps đi qua upload của nhà yến và download của nhà thành viên trong khung giờ đếm.
  - Video có khung (khoảng 1–2 Mbps) đi tiếp từ nhà thành viên lên VPS.
  - Đo upload thật của cả hai đường, ghi vào `[TEAM]`.
- **Bảo mật camera** (Report 3 NFR-10 e):
  - Đặt mật khẩu camera thật mạnh, đổi mật khẩu mặc định.
  - Trên modem nhà yến (gói IP tĩnh VNPT, Advance → Security): luật lọc IP nguồn cho cổng 18554, **chỉ cho IP tĩnh của nhà thành viên** (AI node), chặn mọi nguồn khác. Chuyển cổng (Virtual Server) một mình không chặn ai.
  - Kiểm tra: từ điện thoại dùng 4G và từ một mạng khác, kiểm tra cổng + mở `rtsp://…:18554` bằng VLC phải **thất bại**; cùng lúc AI node vẫn kéo được hình. Ghi kết quả và ảnh chụp vào `docs/evidence-register.md`.
  - Đổi modem hoặc đổi đường mạng của AI node thì sửa luật và kiểm tra lại.
  - Bật ghi thẻ microSD của camera để có bản đối chiếu khi mạng rớt (plan §19.7).
- **Kiểm tra trước khi chốt** (bắt buộc, plan §19.5 cổng 3b):
  1. Kéo hình liên tục 24 giờ: PC tự nối lại khi mất mạng; ghi số lần rớt và tổng thời gian mất hình.
  2. Đếm cùng một clip theo hai cách: chạy trực tiếp từ file, và phát lại clip đó qua đường Internet. Mục đích là chắc rằng mất khung không làm đếm sót chim ở miệng lỗ, nơi mỗi con chỉ hiện 1–2 khung.
  3. Lệch nhiều thì quay về phương án đặt PC tại nhà yến, cắm dây LAN cùng modem (Report 4 D5 có ghi phương án này).
- **Phần mềm:** Python 3.11–3.12 và `ai-pipeline`.
  - `stream.py` chạy như một service: Ubuntu dùng `systemd` với `Restart=always`; Windows dùng NSSM hoặc Task Scheduler "At startup".
  - Model ONNX tải về máy, không commit vào repo.
- **Kết nối lên VPS:**
  - MQTT TLS tới `<DOMAIN>:8883` (số đếm, số đếm 5 phút, heartbeat). Nhận vòng đếm qua `config` retained của thiết bị.
  - Đẩy video có khung bằng RTSPS tới `<DOMAIN>:8322`, xác thực bằng `STREAM_PUBLISH_SECRET`.
- **Tự chạy lại sau sự cố:**
  - Bật BIOS "Restore on AC power loss = Power On".
  - Tắt sleep/hibernate.
  - Tắt cập nhật tự khởi động lại, hoặc đặt giờ cập nhật ngoài khung đếm.
- **Khi mất mạng:** mạng nhà yến hoặc nhà thành viên rớt trong phiên thì phiên đó là **phiên không đầy đủ** (VISION-FR-020). Hệ thống không so tỷ lệ chim về của ngày đó nên không báo nhầm.
- **Đo NFR-04 trên đúng máy này:** fps trong log `stream.py` trên toàn bộ video đánh giá.
  - Ghi cấu hình máy (CPU, RAM, GPU nếu có) vào Report 3 §2.5 và Report 4 §3.2.
  - Trên laptop, 2 ô với model COCO mới đạt khoảng 7–12 fps (số đo chưa tin cậy), trong khi NFR-04 cần 25 fps. Đây là **rủi ro lớn nhất** của phần đếm (Design Brief R1).
  - Nếu không đạt, có thể thử: giảm kích thước ảnh vào model, bỏ một ô, hoặc dùng GPU của PC (nếu có) qua ONNX Runtime DirectML/CUDA. Giá trị cuối cùng phải là số đo thật; không đổi ngưỡng mà không ghi lý do.

### 2.4. ESP32

- **Broker:** `DOMAIN` của staging, nạp cùng device ID lúc flash (`flash_identity.py`, FARM-FR-003c). mDNS chỉ dùng trong LAN dev.
- **TLS:** build bằng `pio run -e esp32prod` (cổng 8883, CA ISRG Root X1), broker phải là tên miền, không dùng IP.
- **Tài khoản:** nạp device ID và broker secret bằng `firmware/tools/flash_identity.py`.

  Việc này là gap G-07 ở `docs/reports/project-tracking.md` §6.

## 3. Triển khai, rollback, sao lưu

File trong repo (G-17):

| File | Nội dung |
| --- | --- |
| `deploy/docker-compose.staging.yml` | MongoDB, EMQX, backend, MediaMTX, Nginx, Certbot; không Redis (chưa module nào dùng), không MinIO (mục 2.2) |
| `backend/Dockerfile` | Backend chạy bằng `tsx` như lúc dev, bằng user `node` (không phải root), kèm `docs/api/api-spec.yaml` (Swagger, kiểm tra route). Volume `backend_storage` tạo bởi ảnh cũ chạy root thì đổi quyền một lần: `docker run --rm -v swiftletcare-staging_backend_storage:/s alpine chown -R 1000:1000 /s` |
| `deploy/nginx/Dockerfile`, `nginx.conf`, `templates/` | Build web (`VITE_STREAM_URL=/stream`) rồi phục vụ bằng Nginx; site HTTPS và khối `stream` (8883, 8322) điền `DOMAIN` lúc khởi động |
| `deploy/.env.staging.example` | Mọi biến, mật khẩu là placeholder; chép thành `deploy/.env.staging` trên VPS (bị `.gitignore`) |
| `deploy/staging-cert.sh` | Chứng chỉ lần đầu: tạo chứng chỉ tạm, bật Nginx, xin chứng chỉ Let's Encrypt, nạp lại Nginx |
| `deploy/secrets/` | Chỗ đặt `firebase-service-account.json` trên VPS; chỉ có `.gitignore` trong repo |
| `deploy/staging-backup.sh` | `mongodump` vào `~/backup`, giữ 7 bản, chép ra ngoài VPS bằng rclone khi đặt `BACKUP_REMOTE` |

Backend không ghi `/internal/*` vào log truy cập, vì khoá EMQX và MediaMTX nằm trong query `?key=`.

Lần đầu trên VPS (mở cổng 80, 443, 8883, 8322, 8189 TCP + UDP; bản ghi A của `DOMAIN` đã trỏ về VPS):

```bash
git clone <repo> swiftletcare && cd swiftletcare && git checkout <tag>
cp deploy/.env.staging.example deploy/.env.staging   # điền mọi CHANGE_ME (openssl rand -hex 32)
C="docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging"
$C up -d --build mongodb emqx backend mediamtx
sh deploy/staging-cert.sh                            # thử trên máy: --self-signed, DOMAIN=localhost
$C up -d certbot
$C exec backend npm run seed                         # chỉ khi DB trống
# crontab -e của VPS: sao lưu 03:00 (chép ra Google Drive của nhóm qua rclone), Nginx đọc chứng chỉ đã gia hạn lúc 04:00
# 0 3 * * * cd ~/swiftletcare && BACKUP_REMOTE=gdrive:swiftletcare-backup sh deploy/staging-backup.sh
# 0 4 * * * cd ~/swiftletcare && docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging exec -T nginx nginx -s reload
```

Khôi phục một bản sao lưu (ghi đè DB hiện tại):

```bash
$C exec -T mongodb sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --drop --archive --gzip'   < ~/backup/swiftletcare-2026-12-20-0300.gz
```

Docker Desktop trên Windows với Compose v5 build qua bake và báo lỗi quyền `--allow=fs.read=...`; khi đó build từng ảnh rồi bật không build:

```bash
docker build -f backend/Dockerfile -t swiftletcare-staging-backend .
docker build -f deploy/nginx/Dockerfile -t swiftletcare-staging-nginx .
$C up -d --no-build
```

Triển khai một tag mới:

```bash
git fetch --tags && git checkout review-2
sh deploy/staging-backup.sh                 # bản ngay trước khi triển khai
# Migration nào đổi chỉ mục (VD migrate:review-targets của G-31) phải chạy TRƯỚC khi backend mới nhận request:
# dựng ảnh mới, chạy migration bằng ảnh đó, rồi mới khởi động
$C build backend && $C run --rm backend npm run migrate:review-targets
$C up -d --build
$C exec backend npm run migrate:retention   # và các migrate:* còn chờ
```

Đã chạy thử trên máy (18/11/2026, `DOMAIN=localhost`, chứng chỉ tự ký): web và đường dẫn SPA trả 200; `/api/health`, Swagger, đăng nhập và cookie refresh qua HTTPS; Socket.io; `/api/internal/*` trả 404; HTTP chuyển 301 sang HTTPS; WHEP tới được MediaMTX; MQTT TLS 8883 nhận `backend-service`, từ chối mật khẩu sai và thiết bị lạ; RTSPS 8322: ffmpeg đẩy luồng thử bằng `STREAM_PUBLISH_SECRET`, backend cho phép; HLS qua `/hls` với token 60 giây phát liên tục 100 giây (có và không có cookie), không token, token sai hay đường `-raw` đều 401; `staging-backup.sh` ra bản dump và chỉ giữ số bản đã đặt; cổng 1883, 3000, 8554, 8889 không mở ra ngoài; ảnh backend không chứa `.env`. Chưa chạy trên VPS thật, chưa thử AI node và ESP32 nối vào.

| Việc | Cách làm |
| --- | --- |
| Kiểm tra sau triển khai | Như lần thử trên máy ở trên, cộng các bước ở plan §15.9 (HTTPS, cookie refresh, Socket.io, cổng nội bộ không lộ, `/internal` bị chặn, MQTT từ AI node, đẩy video, chặn xem không token, xem video, thử từ Wi-Fi của trường) |
| Rollback | Checkout tag trước, chạy lại `$C up -d --build`; nếu dữ liệu đã đổi thì khôi phục bản sao lưu ngay trước lần triển khai (lệnh ở trên) |
| Sao lưu | `deploy/staging-backup.sh`: cron 03:00 mỗi ngày, giữ 7 bản (plan §15.9), cộng một bản trước mỗi lần triển khai; chép ra ngoài VPS bằng `rclone` (`rclone config` một lần trên VPS, remote là Google Drive của nhóm) |
| Bí mật | `deploy/.env.staging` chỉ nằm trên VPS, không commit; đổi mật khẩu các tài khoản seed trước khi đưa link cho người ngoài |
| Push FCM (ALERT-FR-002) | Đặt file service account Firebase lên VPS (không commit), mount vào container backend và trỏ `FIREBASE_SERVICE_ACCOUNT_PATH` tới nó; thiếu thì backend không gửi push, các kênh khác vẫn chạy |
| App mobile trỏ tới staging | Đặt biến của môi trường `preview` trên EAS một lần, rồi `eas build --profile preview --platform android` (bản APK cài trực tiếp): `eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://<DOMAIN>/api`, tương tự `EXPO_PUBLIC_WS_URL=wss://<DOMAIN>` và `EXPO_PUBLIC_STREAM_URL=https://<DOMAIN>/hls` |
| Sau bảo vệ | Hạ cỡ hoặc tắt VPS để không phát sinh phí |

## 4. Phương án lùi

| Sự cố | Phương án |
| --- | --- |
| PC cũ không đạt 25 fps | Demo đếm trên clip quay sẵn bằng `tools/track_clip.py` (cùng `FramePipeline`); báo cáo fps đo được, không sửa ngưỡng âm thầm |
| Mất mạng hoặc mất điện ở nhà yến hay ở nhà đặt PC lúc demo | Camera demo phát lặp clip (plan §15.8); ESP32 dự phòng đặt tại chỗ demo, nối vào cùng staging |
| Wi-Fi trường chặn UDP 8189 | MediaMTX có WebRTC qua TCP 8189; dự phòng điện thoại phát 4G |

## 5. Dữ liệu demo

`npm run seed` tạo các tài khoản mẫu (owner@, tech@, expert@) và farm "Nhà Yến Demo" có `node_001` cho ESP32 lúc dev. Sau đó `npm run seed:demo` (`backend/src/scripts/seed-demo.script.ts`) dựng điều kiện đầu của DS-01…16 (Design Brief Phụ lục A2):

- Mỗi lần chạy, script xoá rồi dựng lại hai farm demo. Chạy lại ngay trước mỗi buổi tổng duyệt, vì các kịch bản làm đổi dữ liệu.
- Script đi qua service thật, như khi dùng app: Administrator nhập kho, Farm Owner tạo nhà và đăng ký thiết bị, cảnh báo qua Alert Engine, thợ báo xong Work Order.
- Chỉ dữ liệu quá khứ được ghi thẳng vào DB: telemetry 10 giây, số đếm phiên, một khuyến nghị đã chấp nhận từ 10 ngày trước.
- Activation key và broker secret của các thiết bị `demo-*` được sinh mới mỗi lần và chỉ in ra màn hình. Nạp chúng vào ESP32 thật bằng `firmware/tools/flash_identity.py`, hoặc dùng cho bộ giả lập.

```bash
$C exec -e DEMO_PASSWORD='<mật khẩu>' backend npm run seed:demo   # staging bắt buộc DEMO_PASSWORD; máy dev: npm run seed:demo
$C exec backend npm run job:run -- <job> # chạy ngay một job nền thay cho chờ lịch của nó
```

Tài khoản demo: cả 6 tài khoản dùng chung mật khẩu `DEMO_PASSWORD`, kể cả 3 tài khoản `npm run seed` đã tạo. Trên staging (`NODE_ENV=production`) script từ chối chạy khi thiếu biến này; trên máy dev và CI mặc định là `Test1234!`. Test E2E đọc cùng biến đó.

| Tài khoản | Vai trò |
| --- | --- |
| owner@ | Farm Owner của "Trại yến Demo A2" |
| expert@ | Domain Expert của farm đó |
| tech@ | Farm Technician, thợ chính nhà A, B, C |
| tech2@ | Farm Technician, thợ chính nhà D |
| admin@ | Administrator |
| owner2@ | Farm Owner của "Trại yến không chuyên gia" (BR-22) |

| DS | Seed dựng sẵn | Làm trực tiếp lúc demo | Job (`job:run`) | E2E (`frontend/e2e/`) |
| --- | --- | --- | --- | --- |
| 01 | Nhà A, controller `demo-ctl-a1` (nạp vào ESP32 thật) | Rút mạng router 5 phút; Farm Owner bật bơm 1 phút (cần xác nhận vì có `SENSOR_FAULT`) | — | — |
| 02 | `SENSOR_FAULT` đang mở ở tầng A | Bơm 31 phút; bơm không xác nhận; chuyên gia bật relay | — | `ds-01-02` |
| 03 | Nhà B có thợ chính | Bộ giả lập gửi `MISTING_INEFFECTIVE` (simulator `--alerts`), chờ 15 phút; thợ sửa, ghi nguyên nhân và ảnh | `escalation`, `recovery` nếu không muốn chờ | `ds-03-04` |
| 04 | Work Order nhà B đang `VERIFYING` | Gửi lại `MISTING_INEFFECTIVE` của `demo-ctl-b1`; tech2@ xác nhận cảnh báo | — | `ds-03-04` |
| 05 | Nhà B: camera `demo-cam-b1`, 7 ngày số đếm, tỷ lệ về ≈ 97 % | Đăng ký AI node thật vào nhà B, phát clip cửa ra vào trong khung phiên | — | — |
| 06 | Như DS-05 | Tắt AI node | — | — |
| 07 | `NOISE_ANOMALY` ở tầng A chờ kết luận, đã gửi yêu cầu kiểm tra tại chỗ cho thợ | Phát tiếng ồn cạnh cảm biến; thợ ghi kiểm tra; chuyên gia bác bỏ có lý do | — | `ds-07-08` |
| 08 | Như DS-07 | Farm Owner ghi kết luận | — | `ds-07-08` |
| 09 | Tầng A: 14 ngày dữ liệu phun sương, có gợi ý hệ số | Farm Owner sửa ngưỡng và gửi gợi ý; chuyên gia chỉnh và duyệt | — | `ds-09-10` |
| 10 | Như DS-09 | Farm Owner áp gợi ý trực tiếp | — | `ds-09-10` |
| 11 | Nhà C, ngày hôm kia: chim về 65 % so với nền 96 %, độ ẩm trong ngưỡng 85 % thời gian; đã đánh giá → `ACTION` | Thợ chấm ngày (trước khi thấy trạng thái); tải PDF, CSV | `health <ngày>` để tính lại | `ds-11-12` |
| 12 | Nhà C, hôm qua: phiên chiều không đầy đủ → `INSUFFICIENT_DATA` | Mở ngày đó | `health <ngày>` | `ds-11-12` |
| 13 | Kế hoạch bơm 500 giờ, bộ đếm `demo-ctl-a1` ở 499 giờ | Chạy bơm thêm 1 giờ (ESP32 thật hoặc bộ giả lập); thợ làm checklist | `relay-usage`, rồi `maintenance` | `ds-13-14` |
| 14 | Kế hoạch béc phun đến hạn từ 7 ngày, Work Order phòng ngừa đang mở | Thợ ghi một mục checklist "hỏng" | `maintenance` → `OVERDUE` (job mỗi giờ cũng tự làm) | `ds-13-14` |
| 15 | Luật NH3 ≥ 4 giờ/ngày trong 3 ngày; nhà A 3 ngày gần nhất 4,5 giờ; lần chấp nhận trước từ 10 ngày | Farm Owner chấp nhận khuyến nghị mới | `recommendations` (xét hôm qua) → khuyến nghị; `effects` → hiệu quả của lần trước (−3,5 giờ) | `ds-15-16` |
| 16 | Khuyến nghị đang mở ở nhà C (luật thời gian trong ngưỡng dưới 90 %) | Từ chối không lý do | `expire 8` (như đã qua 8 ngày) → `EXPIRED` | `ds-15-16` |

Giới hạn đã biết:
- DS-03: 15 phút sau seed, cảnh báo của nhà B leo thang tới Farm Owner (`alertEscalation.job`), nên muốn trình bày "thợ nhận trước" thì chạy `seed:demo` ngay trước DS-03. Test E2E chỉ kiểm điều không đổi theo thời gian.
- DS-04: Work Order của nhà B không có telemetry, nên giữ `VERIFYING` cho tới khi cảnh báo tự đóng sau 60 phút không lặp lại (`alertEscalation.job`) cộng 10 phút kiểm. Vì vậy phải chạy `seed:demo` trong vòng 1 giờ trước DS-04.
- DS-14: kế hoạch tự sang `OVERDUE` ở lần chạy kế của job bảo trì mỗi giờ.
- Nhà A không có camera, nên mọi ngày của nó là `INSUFFICIENT_DATA` (thiếu số đếm). Luật NH3 chỉ đọc số giờ không khí vượt ngưỡng, không bị ảnh hưởng.

E2E: job CI `e2e` chạy `seed`, rồi `seed:demo`, rồi `npx playwright test`. Các file `ds-*.spec.ts` gọi API qua proxy `/api` của web (đúng đường app gọi) và kiểm kết quả mong đợi của từng DS. Màn hình của từng DS vẫn được kiểm bằng mắt ở buổi tổng duyệt.

## 6. Staging hỏng thì làm gì

Lệnh dùng chung: `C="docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging"`, chạy từ `~/swiftletcare` trên VPS. Xem trạng thái: `$C ps`; xem log một service: `$C logs --tail 200 <service>`. Sau mỗi lần triển khai, mỗi người kiểm nhanh phần của mình theo cột thứ hai.

| Người | Kiểm nhanh sau triển khai | Triệu chứng → cách xử lý |
| --- | --- | --- |
| Bảo — Nginx, chứng chỉ, EMQX, MediaMTX, AI node | `curl -I https://<DOMAIN>` 200; AI node có heartbeat (camera `ONLINE`); xem được live stream | Trình duyệt báo chứng chỉ hết hạn → `$C run --rm certbot renew` rồi `$C exec nginx nginx -s reload`. Thiết bị không nối được MQTT → `$C logs emqx` (từ chối do `/internal/mqtt-auth`: so `MQTT_AUTH_KEY` của EMQX và backend), rồi `$C restart emqx`. Video đen → `$C logs mediamtx`, kiểm AI node còn đẩy RTSPS 8322 |
| Kiệt — backend, MongoDB, migration, seed, sao lưu | `curl https://<DOMAIN>/api/health`; đăng nhập được; bản sao lưu đêm qua có trong `~/backup` và trên Drive | API 502 → `$C logs backend` (thiếu biến môi trường thì báo ngay lúc khởi động), `$C restart backend`. Dữ liệu hỏng sau triển khai → khôi phục bản trước triển khai (mục 3). Cron sao lưu báo lỗi → chạy tay `sh deploy/staging-backup.sh` xem thông báo |
| Nhi — bản build web, màn Farm Owner và Admin | Mở trang tổng quan, cảnh báo, Work Order, bảo trì của Farm Owner; trang người dùng và kho thiết bị của Admin | Trang trắng hoặc lỗi tải file JS → build lại ảnh Nginx (`$C up -d --build nginx`), xoá cache trình duyệt (PWA giữ bản cũ). Gọi API lỗi CORS → `CORS_ORIGIN` phải là `https://<DOMAIN>` |
| Len — bản build mobile, push | Bản APK `preview` đăng nhập được, nhận push của một cảnh báo thử, mở được live stream | App không nối được → biến `EXPO_PUBLIC_*` của môi trường `preview` trên EAS (mục 3), build lại. Không có push → backend thiếu `deploy/secrets/firebase-service-account.json` (log backend báo khi khởi động). Live stream không mở → thử `https://<DOMAIN>/hls/<path>/index.m3u8?token=…` trên trình duyệt |
| Tuấn — màn chuyên gia, console thiết bị của Admin, E2E | Hàng chờ kết luận, tham số phát hiện, luật khuyến nghị; console thiết bị của Admin; chạy bộ E2E trước mỗi buổi tổng duyệt | E2E trên staging: chạy `seed:demo` trong container backend (mục 5) rồi `DEMO_PASSWORD=<mật khẩu> E2E_BASE_URL=https://<DOMAIN> npx playwright test` ở `frontend/`. Test hỏng vì dữ liệu đã đổi ở lần chạy trước → chạy lại `seed:demo` |
