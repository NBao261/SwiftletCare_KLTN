# Môi trường staging — đề xuất cho Review 2 và Defense 1.1

Tài liệu này giải thích **staging là gì**, cấu hình nhóm chọn và các bước dựng nó. Report 4 §3.4, §11 và quyết định D5 là bản chính thức bằng tiếng Anh. Phần Dockerfile, compose và Caddyfile mẫu nằm ở `docs/bird-counting-plan.md` §15.3–15.5 (bản thiết kế, **chưa chạy thử**). Mục 15.2 và mục 18 của plan còn giả định model chạy trên VPS. Tài liệu này thay hai mục đó: **model chạy trên PC cũ đặt tại nhà một thành viên**. PC kéo hình camera qua Internet, nhờ IP tĩnh của đường VNPT ở nhà yến.

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
 Người dùng ──443──► Caddy (TLS) ─► backend, web, MediaMTX (WHEP)
 (web/mobile)  ─8189/udp──────────► MediaMTX (WebRTC)
                │  tls-proxy 8883 ─► EMQX ◄─1883 nội bộ─ backend
                │  tls-proxy 8322 ─► MediaMTX (nhận video)
                │  MongoDB, MinIO: chỉ trong mạng Docker
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
- **Tên miền:** một tên miền có 4 bản ghi A trỏ về IP của VPS: `app.`, `api.`, `stream.`, `mqtt.`. Có thể dùng chung một tên cho `app` và `api`, như plan §15.1.

### 2.2. Các service trên VPS

| Service | Vai trò | Cổng mở ra Internet |
| --- | --- | --- |
| Caddy | HTTPS tự động (Let's Encrypt); phục vụ web đã build; chuyển `/api`, `/socket.io` vào backend; chuyển trang WHEP sang MediaMTX; chặn `/internal/*` | 80, 443 |
| tls-proxy (nginx stream) | Bọc TLS cho MQTT và cho luồng đẩy video, dùng lại chứng chỉ của Caddy | 8883, 8322 |
| backend | API, Socket.io, job nền; nối EMQX qua `mqtt://emqx:1883` trong mạng Docker | không |
| EMQX | Broker; bắt buộc mật khẩu (tắt anonymous); dashboard 18083 chỉ mở cho `127.0.0.1` và vào qua SSH tunnel | không (đi qua tls-proxy) |
| MongoDB, MinIO | Dữ liệu, file âm thanh | không |
| MediaMTX | Nhận video có khung từ PC cũ (AI node); phát WebRTC; hỏi backend `/internal/stream-auth` ở mỗi lần đẩy hoặc xem | 8189 TCP + UDP (WebRTC tự mã hoá) |

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
- **Bảo mật camera** (cổng 18554 đang mở cho mọi nơi):
  - Đặt mật khẩu camera thật mạnh, đổi mật khẩu mặc định.
  - Xem trong modem (Advance → Security) có giới hạn được IP nguồn không. Nhà thành viên có IP tĩnh thì chỉ cho IP đó vào.
  - Không giới hạn được thì ghi ở Report 3 §8.1 (đã có dòng hạn chế).
  - Bật ghi thẻ microSD của camera để có bản đối chiếu khi mạng rớt (plan §19.7).
- **Kiểm tra trước khi chốt** (bắt buộc, plan §19.5 cổng 3b):
  1. Kéo hình liên tục 24 giờ: PC tự nối lại khi mất mạng; ghi số lần rớt và tổng thời gian mất hình.
  2. Đếm cùng một clip theo hai cách: chạy trực tiếp từ file, và phát lại clip đó qua đường Internet. Mục đích là chắc rằng mất khung không làm đếm sót chim ở miệng lỗ, nơi mỗi con chỉ hiện 1–2 khung.
  3. Lệch nhiều thì quay về phương án đặt PC tại nhà yến, cắm dây LAN cùng modem (Report 4 D5 có ghi phương án này).
- **Phần mềm:** Python 3.11–3.12 và `ai-pipeline`.
  - `stream.py` chạy như một service: Ubuntu dùng `systemd` với `Restart=always`; Windows dùng NSSM hoặc Task Scheduler "At startup".
  - Model ONNX tải về máy, không commit vào repo.
- **Kết nối lên VPS:**
  - MQTT TLS tới `mqtt.<tên miền>:8883` (số đếm, số đếm 5 phút, heartbeat). Nhận vòng đếm qua `{house}/config/update`.
  - Đẩy video có khung bằng RTSPS tới `<tên miền>:8322`, xác thực bằng `STREAM_PUBLISH_SECRET`.
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

- **Broker:** nhập `mqtt.<tên miền>` vào trang AP-mode, hoặc đặt trong `Secrets.h`. mDNS chỉ dùng trong LAN dev.
- **Phải có TLS:** firmware hiện **chỉ nối cổng 1883, không TLS** (`MQTTManager.cpp`, `Config.h`). Muốn nối staging qua 8883 thì phải làm theo plan §15.7:
  - thêm môi trường build `cloud` và nạp CA Let's Encrypt (ISRG Root X1, X2);
  - chờ NTP đồng bộ trước lần kết nối đầu.

  Việc này đã nằm trong `docs/reports/README.md` (gap #39) và Report 4 §12.

## 3. Triển khai, rollback, sao lưu

Còn thiếu trong repo, cần làm trước khi dựng (gap #40):

- `deploy/docker-compose.staging.yml`, gồm Caddy, tls-proxy, backend, MongoDB, EMQX, MinIO, MediaMTX; **không có** Redis vì chưa module nào dùng.
- `backend/Dockerfile`, `frontend/Dockerfile` hoặc bản build tĩnh.
- `deploy/Caddyfile`, `deploy/nginx-stream.conf`.
- `deploy/.env.staging.example`, trong đó mọi mật khẩu là placeholder.
- Script seed demo.

Bản mẫu của các file này nằm ở plan §15.3–15.5.

```bash
# Trên VPS, triển khai một tag
git fetch --tags && git checkout review-2
docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging exec -T mongodb \
  mongodump -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > ~/backup/pre-deploy-$(date +%F).gz
docker compose -f deploy/docker-compose.staging.yml --env-file deploy/.env.staging up -d --build
docker compose -f deploy/docker-compose.staging.yml exec backend npm run migrate:retention   # và các migrate:* còn chờ
docker compose -f deploy/docker-compose.staging.yml exec backend npm run seed                # chỉ khi DB trống
```

| Việc | Cách làm |
| --- | --- |
| Kiểm tra sau triển khai | Chạy 10 bước ở plan §15.9 (HTTPS, cookie refresh, Socket.io, cổng nội bộ không lộ, `/internal` bị chặn, MQTT từ AI node, đẩy video, chặn xem không token, xem video, thử từ Wi-Fi của trường) |
| Rollback | Checkout tag trước, chạy lại `up -d --build`; nếu dữ liệu đã đổi thì `mongorestore` bản `pre-deploy` |
| Sao lưu | Cron 03:00 mỗi ngày, giữ 7 bản (plan §15.9), cộng một bản trước mỗi lần triển khai; chép ra ngoài VPS `[TEAM: nơi lưu]` |
| Bí mật | `deploy/.env.staging` chỉ nằm trên VPS, không commit; đổi mật khẩu các tài khoản seed trước khi đưa link cho người ngoài |
| Sau bảo vệ | Hạ cỡ hoặc tắt VPS để không phát sinh phí |

## 4. Phương án lùi

| Sự cố | Phương án |
| --- | --- |
| Firmware TLS chưa xong | Mở tạm 1883 trên VPS, bắt buộc mật khẩu và ACL theo `deviceId` trên EMQX. Dữ liệu ESP32 đi dạng rõ; ghi vào Report 3 §8.1 và Known Gaps của Design Brief |
| PC cũ không đạt 25 fps | Demo đếm trên clip quay sẵn bằng `tools/track_clip.py` (cùng `FramePipeline`); báo cáo fps đo được, không sửa ngưỡng âm thầm |
| Mất mạng hoặc mất điện ở nhà yến hay ở nhà đặt PC lúc demo | Camera demo phát lặp clip (plan §15.8); ESP32 dự phòng đặt tại chỗ demo, nối vào cùng staging |
| Wi-Fi trường chặn UDP 8189 | MediaMTX có WebRTC qua TCP 8189; dự phòng điện thoại phát 4G |

## 5. Dữ liệu demo

`npm run seed` hiện tạo 1 Farm Owner, 1 Technician, 1 Domain Expert, 1 Farm/House/Zone/SensorNode. Như vậy **chưa đủ** cho mọi kịch bản ở Phụ lục A2 của Design Brief. Cần một script seed demo (gap #40) tạo thêm:

- tài khoản Administrator;
- một farm **không** có chuyên gia (BR-22);
- thiết bị trong kho có nhãn (MF-10);
- cảnh báo suy luận đang chờ kết luận (MF-08);
- số đếm 5 phút và bản ghi phiên của ≥ 7 ngày (MF-06);
- telemetry ≥ 1 ngày cho dự báo và đánh giá sức khỏe (MF-05, MF-11);
- một bơm đã quá giới hạn giờ chạy (cảnh báo `MAINTENANCE_DUE`).
