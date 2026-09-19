# SwiftletCare — BẢNG TASK CHI TIẾT (Micro-task Checklist) v3

**Bám theo:** SRS v1.12.0 + Components Guide v3.3 + Sensor Config Guide + Camera Guide Nhà Yến | **Phạm vi:** Giai đoạn 1 (MVP)

> **[v2 cập nhật]** theo linh kiện thực tế đã mua: ESP32 NodeMCU 38 chân + đế mở rộng, **2 mạch Buck** (tách nguồn PAM8403), Domino TB1504, relay kích H/L (đặt mức High), DFPlayer + PAM8403 6W có volume, camera IR 940nm.
>
> **[v3 cập nhật — theo SRS v1.12.0]** Đổi mô hình onboarding thiết bị: **Technician thao tác qua Web Console** (không phải Farm Owner tự quét QR qua Mobile App như bản checklist cũ) — xem Flow 1/1b. Thêm hẳn 9 Flow mới (Flow 11→19: đăng ký/đăng nhập/quên mật khẩu, mời thành viên, điều khiển relay thủ công + auto-revert, offline-detection, OTA, mời Sales Staff, duyệt sản phẩm, cảnh báo tồn kho, quản lý tài khoản Admin) → mục A/C/D/E dưới đây đã bổ sung task tương ứng. Ticket thêm loại `INSTALLATION` (Flow 9b) đi kèm cơ chế tự động định tuyến giống ticket báo lỗi.
>
> **[Cập nhật]** Các mục `[x]` dưới đây đã được build và **verify trực tiếp** (build/test/demo E2E thật — ESP32 vật lý, backend chạy thật, MongoDB/MQTT thật) trong phiên làm việc gần nhất. Một số mục ghi chú thêm (*) là code đã hoàn chỉnh nhưng chưa demo E2E đầy đủ với phần cứng thật (ví dụ 4/5 cảm biến RS485 chưa đấu dây) — team vẫn nên tự code review theo đúng quy tắc DoD trước khi tin tưởng hoàn toàn.

**Cách dùng:** Mỗi dòng `[ ]` là 1 đầu việc nhỏ, cụ thể, làm được ngay. Tick `[x]` khi xong. Mã `[FR-ID]` để tra ngược SRS. Các việc **liên-role** (cần 2 người phối hợp) có ký hiệu 🤝.

**5 role:** M1 (IoT/Firmware) · M2 (AI/Vision) · M3 (Backend) · M4 (Frontend) · M5 (QA/DevOps)

---

## MỤC LỤC

- [A. M1 — IoT / Hardware / Firmware](#a-m1--iot--hardware--firmware)
- [B. M2 — AI / Computer Vision](#b-m2--ai--computer-vision)
- [C. M3 — Backend](#c-m3--backend)
- [D. M4 — Frontend / PWA](#d-m4--frontend--pwa)
- [E. M5 — QA / DevOps / Thesis](#e-m5--qa--devops--thesis)
- [F. Các mốc phối hợp liên-role (Integration)](#f-các-mốc-phối-hợp-liên-role-integration)

---

# A. M1 — IoT / Hardware / Firmware

## A1. Chuẩn bị & Cấu hình cảm biến (Sprint 1)

- [ ] Đọc kỹ Components Guide v3.3 (mục 1-9) + Sensor Config Guide `[Guide]`
- [ ] Chuẩn bị đồ nghề: VOM, mỏ hàn (nếu cần), dây jumper, thẻ microSD, cáp USB
- [ ] Cài Arduino IDE + thư viện `ModbusMaster`, `DFRobotDFPlayerMini`
- [x] Đấu thử ESP32 + module UART-RS485 V2 (GPIO17→TXD, GPIO16→RXD, VCC 5V, GND) `[Guide 5]`
- [x] Nạp sketch quét Modbus, đấu **từng cảm biến 1** để xác nhận Slave ID `[Config Guide Cách 1A]`
- [x] Xác nhận ES-NOISE-01 = ID 1 `[Guide 8]`
- [ ] Xác nhận ES-CO2-01 = ID 2 `[Guide 8]`
- [ ] Xác nhận ES-NH3-01 = ID 3 `[Guide 8]`
- [ ] Xác nhận ES-ALS-02 = ID 4 `[Guide 8]`
- [ ] Đặt ES35-SW = ID 5 bằng DIP switch (Pin1=ON, Pin3=ON) `[Config Guide Cách 3]`
- [ ] Đổi baudrate ES35-SW 9600→4800 bằng sketch ghi thanh ghi 101 `[Config Guide Cách 1A]` ⚠️ ưu tiên cao
- [ ] Cấp lại nguồn ES35-SW, xác nhận đọc được ở 4800bps
- [ ] Xác nhận cả 5 cảm biến cùng chạy 4800bps, 8-N-1

## A2. Đấu nối phần cứng hoàn chỉnh (Sprint 1-2)

- [ ] Cắm ESP32 NodeMCU 38 chân vào **đế mở rộng 38 chân**, bắt vít cố định vào hộp `[Guide 7]`
- [ ] Đấu jack DC từ AC Adapter 12V/2A vào **Domino TB1504** (+/-) `[Guide 6]`
- [ ] Đấu Domino → **Buck #1**, vặn biến trở + đo VOM chỉnh đúng **5V** (⚠️ trước khi cắm ESP32) `[Guide 6]` — ⚠️ phát hiện lỗi: Buck gây nhiễu/sụt áp làm hỏng RS485 khi có tải thật, cần đo lại dưới tải bằng VOM (chưa có dụng cụ lúc test)
- [ ] Đấu Domino → **Buck #2** (riêng), chỉnh đúng 5V cho PAM8403+DFPlayer+relay `[Guide 6]`
- [ ] Đấu Buck #1 5V → ESP32 (qua domino đế) + module RS485
- [ ] Đấu bus RS485: 2 vít A/B module → 5 cảm biến daisy-chain
- [ ] Đấu 4 cảm biến EPCB theo màu: Nâu=VCC, Đen=GND, Vàng=A, Xanh dương=B `[Guide 4.1]`
- [ ] Đấu ES35-SW theo màu KHÁC: Đỏ=VCC, Đen=GND, Vàng=A, **Xanh lá=B** `[Guide 4.2]` ⚠️
- [ ] Đặt ES35-SW cuối bus, bật DIP Pin 5 = ON (trở 120Ω tích hợp) `[Guide 7]`
- [ ] Đấu rail nguồn 12V cho cả 5 cảm biến (VCC/GND)

## A3. Firmware đọc cảm biến (Sprint 1-2)

- [x] Setup PlatformIO/Arduino project cho ESP32, cấu hình UART2 (4800, 8-N-1, GPIO16/17) `[7.2]`
- [x] Task đọc ES-NOISE-01 (reg 0x0000), quy đổi **÷10 = dB** `[ENV-FR-003, Guide 9.1]` — verify thật: 53-57dB
- [x] Task đọc ES-CO2-01 (reg 0x0000), giá trị **trực tiếp = ppm** `[Guide 9.2]` (*)
- [x] Task đọc ES-NH3-01 (reg 0x0000), giá trị **trực tiếp = ppm** (bản 500ppm) `[Guide 9.3]` (*)
- [x] Task đọc ES-ALS-02 (reg 0x0002, 2 reg 32-bit), **×100 = Lux** (bản 200k) `[Guide 9.4]` (*)
- [x] Task đọc ES35-SW (reg 0+1, 2 reg), **÷10 = °C và %RH** `[Guide 9.5]` (*)
- [x] Gộp 5 giá trị thành 1 JSON telemetry, chu kỳ 10s (cấu hình 5-60s) `[ENV-FR-002]`
- [x] In ra Serial Monitor để verify giá trị đúng đơn vị & hợp lý

## A4. Firmware MQTT & Onboarding (Sprint 2)

> **[v3]** Onboarding đổi hẳn model: firmware KHÔNG còn decode QR (QR/secretKey được Technician quét trên Web Console, không phải trên thiết bị) — việc của firmware là **tự phát AP-mode khi chưa có cấu hình**, nhận {wifiSsid, wifiPassword, farmId, houseId, zoneId, mqttCredentials} qua 1 endpoint HTTP cục bộ, lưu NVS rồi mới kết nối WiFi thật (FARM-FR-003b, Flow 1 bước 5-8).

- [x] Kết nối Wi-Fi (từ Router 4G) `[Guide 1]`
- [x] Kết nối MQTT Broker over TLS (port 8883), QoS 1 `[7.2, SEC-NFR-001]` — ⚠️ lưu ý: PubSubClient chỉ publish được QoS 0, cần đổi lib nếu bắt buộc QoS 1 khi publish
- [x] Publish telemetry topic `swiftletcare/{farmId}/{houseId}/{zoneId}/telemetry` `[ENV-FR-001, 9.2]`
- [x] Publish heartbeat topic + relay status topic `[9.2]`
- [x] Gửi heartbeat đầu tiên → backend cập nhật ONLINE `[FARM-FR-005]`
- [x] Nhận lệnh config/update từ cloud qua MQTT `[9.2]` (*)

### A4a. Tự đổi WiFi không cần USB/nạp lại — `wifi/WiFiProvisioner.h/.cpp` (đã code + verify phần cứng thật)

> Khác phạm vi FARM-FR-003b bên dưới (Web Console của Technician cho thiết bị **mới**): đây là tự phục vụ cho thiết bị **đã lắp xong**, chỉ đổi WiFi khi farm đổi router/đổi vị trí — không đụng farmId/houseId/zoneId/mqttCredentials, không cần Technician/Web Console. Xuất phát từ câu hỏi thực tế "đổi WiFi phải sửa Secrets.h + nạp lại rất phiền".

- [x] Boot-time thử WiFi đã lưu trong NVS (`StorageManager::loadWifiCredentials`), rơi về mặc định Secrets.h nếu chưa từng cấu hình qua portal
- [x] Kết nối thất bại (~10s) → tự phát SoftAP `SwiftletCare-Setup-<deviceId>` (mở, không mật khẩu)
- [x] Captive portal (DNSServer + ESPAsyncWebServer dùng chung instance với OTA): form nhập SSID/mật khẩu, tự popup trên điện thoại qua `onNotFound` redirect
- [x] Lưu WiFi mới vào NVS (`StorageManager::saveWifiCredentials`) → `ESP.restart()` → tự kết nối lại bằng WiFi mới
- [x] Sensor/Relay/PID/MQTT vẫn khởi động bình thường dù đang ở AP-mode (không phá REL-NFR-001 — điều khiển cục bộ vẫn chạy khi mất mạng)
- [x] Bad case: nhập sai WiFi mới → sau restart kết nối lại thất bại → tự quay lại AP-mode (qua chu trình reboot ~10s, không phải timer 60s cùng phiên) để nhập lại
- [x] 🤝 Test E2E bằng phần cứng + điện thoại thật: cố ý sai mật khẩu → AP hiện trên điện thoại → portal tự popup → nhập WiFi thật → lưu NVS → tự reboot → kết nối lại → lên EMQX (`SC-node_001`) — **đã verify từng bước qua log Serial thật, không chỉ đọc code**
- [x] Sửa 1 lỗi thật phát hiện lúc test: gọi `softAPConfig()` trước `softAP()` khiến DHCP của AP không lên đúng (điện thoại thấy SSID nhưng không kết nối được) — đổi lại đúng thứ tự

### A4b. Onboarding thiết bị MỚI qua Web Console (Technician) — CHƯA code

- [ ] Boot-time check NVS: có farmId/houseId/zoneId/mqttCredentials chưa → có thì chạy bình thường, chưa thì vào AP-mode chờ Web Console `[FARM-FR-003b, Flow 1 bước 5]`
- [ ] Serve trang cấu hình cục bộ tại `192.168.4.1` nhận thêm `{farmId, houseId, zoneId, mqttUsername, mqttPassword}` từ Web Console (không chỉ wifiSsid/wifiPassword như A4a) `[Flow 1 bước 6]`
- [ ] 🤝 Test AP-mode E2E với Web Console thật của M3/M4 khi Web Console được code (Flow 1 bước 5-9)

## A5. Firmware Relay điều khiển (Sprint 3)

- [ ] Đấu module Relay 4 kênh: VCC 5V (Buck #2), GND, IN1=GPIO25, IN2=GPIO26, IN3=GPIO27, IN4=GPIO14 `[Guide 9.1]`
- [ ] **Đặt Jumper mỗi relay ở kích mức CAO (High)** → firmware `digitalWrite(pin, HIGH)`=bật `[Guide 8]`
- [ ] Đấu tải: IN1→phun sương, IN3→quạt qua NO-COM `[Guide 12.2]`
- [x] Logic phun sương: bật IN1 khi độ ẩm < humidity_min `[ENV-FR-010]` (*)
- [x] Logic quạt: bật IN3 khi nhiệt độ > temp_max HOẶC CO2 > co2_max HOẶC NH3 > nh3_max `[ENV-FR-011]` (*)
- [x] Logic sưởi (dự phòng): bật IN4 khi nhiệt độ < temp_min `[ENV-FR-012]` (*)
- [x] Publish relay state lên MQTT mỗi khi thay đổi `[ENV-FR-015]`
- [x] Nhận lệnh Manual Override từ cloud, tạm dừng auto cho relay đó `[ENV-FR-016, 017]` (*)

## A6. Firmware Hệ thống Loa ru (Sprint 3)

- [ ] Chép file âm thanh (0001.mp3...) vào thẻ SD FAT32, cắm vào DFPlayer `[Guide 15]`
- [ ] Đấu DFPlayer: VCC 5V (Buck #2), GND, RX←GPIO33 (qua trở 1kΩ), TX→GPIO32 `[Guide 10]`
- [ ] Đấu DFPlayer DAC → amply **PAM8403 6W** (5V Buck #2, chỉnh núm volume) → loa ru `[Guide 11]`
- [ ] Đấu Relay IN2 (GPIO26) đóng/ngắt nguồn amply `[Guide 12.2]`
- [x] Setup thư viện DFRobotDFPlayerMini, UART riêng (không đụng UART2) `[7.2]`
- [x] Hàm điều khiển: play(track), stop, volume(0-30), loop `[ENV-FR-013b, Guide 16.3]`
- [x] Logic lịch loa ru: đến 5-7h/17-19h → bật IN2 + DFPlayer play; hết giờ → stop + ngắt IN2 `[ENV-FR-013b]` (*)
- [ ] 🤝 Nhận lệnh chọn bài/volume/lịch từ cloud (phối hợp M3)

## A7. Firmware Threat & Resilience (Sprint 3-4)

- [x] Logic SENSOR_FAULT: 1 Slave ID timeout/lỗi CRC → giữ giá trị cũ + cờ stale + alert MEDIUM `[THREAT-FR-013]` (*)
- [x] Logic RS485_BUS_FAILURE: ≥3/5 ID timeout liên tiếp 3 chu kỳ → alert CRITICAL `[THREAT-FR-013]` (*)
- [x] Logic SPEAKER_FAILURE: relay loa ON + DFPlayer play nhưng dB không tăng → alert `[THREAT-FR-006]` (*)
- [x] Logic PUMP_DRY: relay phun sương ON nhưng ẩm không tăng sau 5p → alert `[THREAT-FR-011]` (*)
- [x] Logic POWER_OUTAGE: watchdog phát hiện reset bất ngờ → alert khi khởi động lại `[THREAT-FR-012]` (*)
- [x] Offline Resilience: tiếp tục điều khiển cục bộ khi mất Internet `[ENV-FR-014, REL-NFR-001]` (*)
- [x] Buffer telemetry vào SPIFFS khi mất MQTT, upload khi có mạng `[REL-NFR-003]` (*)
- [x] Hardware Watchdog Timer timeout 30s `[REL-NFR-002]`

## A8. Firmware OTA & Hardware Test (Sprint 5)

- [ ] OTA Update Task: nhận lệnh, tải & flash firmware mới qua MQTT `[7.2, TICKET-FR-008]` — đã có OTA nhưng qua HTTP (ElegantOTA `/update`), chưa phải qua MQTT như yêu cầu
- [ ] Xác thực checksum file `.bin` trước khi flash, từ chối + rollback nếu sai `[Flow 15 case 4b]`
- [ ] Test rollback tự động: cố tình flash firmware lỗi (boot loop) → xác nhận ESP32 tự quay lại firmware cũ ở lần reset kế tiếp, không bị "gạch" máy `[Flow 15 case 5a]`
- [ ] Test tải OTA thất bại giữa chừng (rút mạng khi đang tải) → xác nhận vẫn chạy firmware cũ bình thường `[Flow 15 case 4a]`
- [ ] Test Offline Resilience: ngắt mạng >24h, PID vẫn chạy `[13.4]`
- [ ] Test Power Recovery: ngắt/cắm nguồn, reconnect ≤30s `[13.4, PERF-NFR-007]`
- [ ] Test độ bền relay: bật/tắt 10.000 lần `[13.4]`
- [ ] 🤝 Hỗ trợ M2 lắp Camera Node (nguồn, RTSP) `[Flow 1b]`

## A9. Lắp đặt thật & Tài liệu (Sprint 6-8)

- [ ] Lắp đặt tại farm thử nghiệm/mock-up, thu dữ liệu thật ≥3 ngày `[RISK-02]`
- [x] Viết README module `firmware-esp32/` `[17.2]`
- [ ] Regression test toàn bộ phần cứng lần cuối `[13.4]`
- [ ] Tag firmware version ổn định (v-final)
- [ ] Viết phần Hardware/Firmware cho báo cáo KLTN
- [ ] **(stretch)** Mức 2 loa ru: ESP32 tải file từ cloud ghi SD `[Guide 15]`

---

# B. M2 — AI / Computer Vision

## B1. Dataset (Sprint 1-3)

- [ ] Setup Roboflow project, định nghĩa 4 class: swiftlet, rat, snake, owl `[11.1]`
- [ ] Thu thập video/ảnh nguồn từ camera hoặc dataset public `[RISK-01]`
- [ ] Annotate batch 1 (~20% mục tiêu 5.000 ảnh) `[11.1]`
- [ ] Annotate batch 2 (~50%), ưu tiên class hiếm owl/snake `[RISK-01]`
- [ ] Annotate hoàn thành 100% (≥5.000 ảnh sau augmentation) `[11.1]`
- [ ] Setup augmentation: flip H/V, brightness ±30%, blur, noise, crop `[11.1]`
- [ ] Split train 70% / val 15% / test 15% `[11.1]`

## B2. Training Model (Sprint 2-3)

- [ ] Setup pipeline train trên Google Colab/Kaggle GPU `[11.4]`
- [ ] Train YOLOv8n baseline v0, đánh giá sơ bộ `[11.2]`
- [ ] Train model v1, mục tiêu mAP@0.5 ≥75% `[11.2]`
- [ ] Export ONNX `[11.2]`
- [ ] Quantize INT8, kiểm tra model ≤20MB `[11.2]`
- [ ] Benchmark FPS trên RPi thật (mục tiêu ≥25) `[PERF-NFR-004, RISK-03]`
- [ ] Nếu FPS<25: thử NCNN hoặc giảm resolution xuống 480×480 `[11.4]`

## B3. Tracking & Counting (Sprint 2-4)

- [ ] Test ByteTrack trên video mẫu (máy tính) `[VISION-FR-004]`
- [ ] Thiết kế logic line-crossing (virtual line) tính hướng ENTRY/EXIT `[VISION-FR-005]`
- [ ] Tích hợp full pipeline: RTSP→YOLO→ByteTrack→counting (chạy máy tính/RPi để bàn) `[VISION-FR-001~006]`
- [ ] Publish kết quả đếm qua MQTT `{entry, exit, timestamp, confidence}` `[VISION-FR-006]`
- [ ] Test đếm với video 5p, so với đếm tay (error ≤5%) `[13.5]`
- [ ] Setup PM2/Supervisor auto-restart process AI `[REL-NFR-004]`

## B4. Predator Detection (Sprint 5)

- [ ] Logic capture frame khi detect rat/snake/owl confidence ≥0.7 `[THREAT-FR-001]`
- [ ] Non-Maximum Suppression + Temporal Filtering (≥2 frame) `[THREAT-FR-003]`
- [ ] 🤝 Upload snapshot lên S3 + nhận presigned URL (phối hợp M3) `[THREAT-FR-002]`
- [ ] Phân severity: CRITICAL (snake/owl), HIGH (rat) `[THREAT-FR-004]`
- [ ] Test Flow 4 E2E: giả lập predator → alert kèm ảnh <5s `[Flow 4]`
- [ ] Night Vision (IR) test đếm ánh sáng yếu `[VISION-FR-007]`
- [ ] Cảnh báo EDGE_AI_DEGRADED khi FPS<10 `[THREAT-FR-010]`

## B5. Lắp Camera Node thật (Sprint 5)

- [ ] Lắp Camera IP PoE 4MP + Raspberry Pi `[Flow 1b]`
- [ ] Cấu hình RTSP URL vào RPi `[Flow 1b]`
- [ ] 🤝 Onboarding Camera Node (Flow 1b) — phối hợp M3/M4 `[FARM-FR-004]`
- [ ] Self-test: đọc 10 frame RTSP, xác nhận FPS≥25 trước khi báo ONLINE `[Flow 1b]`

## B6. Đánh giá & Báo cáo (Sprint 6-8)

- [ ] Model Evaluation: mAP, Precision, Recall, Confusion Matrix `[13.5]`
- [ ] Counting Accuracy test 100 con (error ≤5%) `[13.5]`
- [ ] False Positive Rate predator ≤5% `[13.5]`
- [ ] Fine-tune với dữ liệu thật từ farm nếu cần `[11.4]`
- [ ] Viết phần AI/CV cho báo cáo KLTN

---

# C. M3 — Backend

## C1. Auth & Phân quyền 5 role (Sprint 1)

- [x] Khởi tạo repo Express + TypeScript `[7.4]`
- [ ] Schema `users` với enum role: ADMIN/FARM_OWNER/TECHNICIAN/SALES_STAFF `[AUTH-FR-004, 8.2]` ⚠️ 5 role, bỏ OPERATOR — ⚠️ hiện vẫn giữ `OPERATOR` trong enum để tương thích ngược (chưa xóa hẳn theo yêu cầu SRS v1.7.0) — **ưu tiên dọn trước khi thêm role mới**, kiểm tra không còn user nào role này trong DB rồi xoá khỏi enum + `devices.ts` route
- [x] API `POST /auth/register` + OTP (email/phone) `[AUTH-FR-001]` — OTP hiện chỉ log console, chưa nối SMTP/Zalo thật
- [x] API `POST /auth/login` (email/password) `[AUTH-FR-002]` — verify thật qua API
- [ ] Tích hợp OAuth2 Google `[AUTH-FR-002]`
- [x] JWT Access (15p) + Refresh (30 ngày), API refresh/logout `[AUTH-FR-003]`
- [x] Middleware RBAC theo 5 role `[AUTH-FR-004, 12.1]`
- [x] API mời thành viên Farm Owner khác (Primary Owner) `[AUTH-FR-005]`
- [x] API Admin tạo Technician (kèm `assigned_regions`) / tạo Sales Staff trực tiếp `[AUTH-FR-005c]` — merge qua PR #16. Riêng luồng Farm Owner **đề xuất** Sales Staff → Admin duyệt `[AUTH-FR-005b đổi v1.16.0, 005d]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [ ] Guest checkout (không cần tài khoản) `[AUTH-FR-008]`
- [ ] Audit log đăng nhập/thay đổi cấu hình — schema `audit_logs` + middleware ghi log `[AUTH-FR-007, 8.2]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [x] Envelope response chuẩn + pagination + mã lỗi HTTP `[9.0]`

### C1b. Quên mật khẩu, Lời mời, Khoá/Xoá tài khoản `[mới v1.12.0, Flow 11/12/19]`

- [ ] Schema `invitations` (farm_id, invited_email, invited_role, token, status, expires_at) `[AUTH-FR-010, 8.2]`
- [ ] API `POST /auth/forgot-password` — sinh OTP/token TTL 15p, gửi email/SMS `[AUTH-FR-009]`
- [ ] API `POST /auth/reset-password` — xác thực OTP, đổi mật khẩu, thu hồi mọi Refresh Token cũ `[AUTH-FR-009]`
- [ ] API `POST /farms/:id/members` sinh `Invitation` (TTL 7 ngày) thay vì thêm thẳng vào `farms.members` `[AUTH-FR-010]`
- [ ] API `GET/POST /invitations/:token`, `/accept`, `/decline` — bao gồm case email chưa có tài khoản dẫn thẳng vào đăng ký `[Flow 12]`
- [ ] Job/cron chuyển `Invitation` quá 7 ngày → status EXPIRED `[AUTH-FR-010]`
- [ ] API `DELETE /farms/:id/members/:userId` — chặn Primary Owner tự gỡ chính mình `[Flow 12 case 5a]`
- [ ] Thêm field `deactivated_at/reason`, `password_reset_token_hash/expires_at` vào schema `users` `[8.2]`
- [x] API `GET /admin/users`, `PUT /admin/users/:id/status` (khoá/mở khoá kèm lý do bắt buộc) `[AUTH-FR-011]` — merge qua PR #16
- [x] Middleware JWT kiểm tra `is_active` mỗi request (không chỉ lúc login) — chặn ngay cả khi Access Token còn hạn `[AUTH-FR-011]` — merge qua PR #16
- [x] API `POST /auth/delete-request`, `GET/PUT /admin/delete-requests/:id/complete` `[AUTH-FR-012]` — merge qua PR #16
- [x] Logic cascade khi xoá Primary Owner: còn thành viên khác → chuyển `owner_id`; hết thành viên → xoá mềm Farm `[AUTH-FR-012, Flow 19 bước 7a/7b]` — merge qua PR #16

### C1c. Module SYSTEM & duyệt Sales Staff `[mới SRS v1.16.0, §5.11, Flow 16]`

- [ ] API `GET /system/audit-logs` lọc theo actor/action/target/thời gian `[SYSTEM-FR-001]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [ ] Collection `system_settings` + API `GET/PUT /system/settings/default-thresholds`; reset ngưỡng Zone đọc từ đây `[SYSTEM-FR-002, ENV-FR-007/020]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [ ] API `GET /system/health-overview` (farm/zone/thiết bị/ticket/tài khoản) `[SYSTEM-FR-003]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [ ] Farm Owner đề xuất Sales Staff → Admin duyệt/từ chối (`sales_assignment_requests`) `[AUTH-FR-005b, 005d]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick
- [ ] UI Admin: audit log, ngưỡng mặc định, tổng quan hệ thống, duyệt đề xuất Sales Staff `[SYSTEM-FR-001..003, AUTH-FR-005d]`
- [ ] Chat theo ticket (Farm Owner ↔ Technician, Admin tham gia được) + tin nhắn hệ thống khi Admin reassign `[TICKET-FR-014..017]`

## C2. Farm & Device (Sprint 2)

- [x] Schema `farms` (owner_id + members với is_primary), `houses`, `zones` `[8.2]`
- [x] API CRUD Farm/House/Zone `[FARM-FR-001, 002]` — verify thật qua API
- [ ] Giới hạn `POST /devices/sensor-nodes/register` chỉ role TECHNICIAN gọi được (hiện Farm Owner nào cũng gọi được, sai theo model mới) `[FARM-FR-003, RACI mục 4.4]`
- [ ] Cấp sẵn cặp `{device_id, secretKey}` trước khi Technician nạp firmware (kho thiết bị nội bộ, đơn giản hoá cho KLTN có thể chỉ cần Admin nhập tay 1 danh sách) `[Flow 1 bước 3]`
- [ ] Kiểm tra `secretKey` khớp trước khi tạo `SensorNode`, trả lỗi rõ ràng nếu sai/đã đăng ký Farm khác `[Flow 1 case 3a]`
- [ ] Thêm status `PENDING` vào enum `sensor_nodes.status` (giữa lúc Technician tạo record và lúc thiết bị gửi heartbeat đầu tiên) `[8.2]`
- [ ] Logic sinh mqttCredentials riêng cho từng thiết bị khi đăng ký `[Flow 1 bước 4]`
- [ ] Endpoint HTTP cục bộ trên Web Console hiển thị hướng dẫn kết nối AP-mode + gửi JSON cấu hình xuống ESP32 qua `192.168.4.1` `[FARM-FR-003b, Flow 1 bước 5-6]`
- [ ] Job/cảnh báo "Kích hoạt quá hạn" nếu quá 15 phút vẫn `PENDING` chưa nhận heartbeat `[Flow 1 case 8a]`
- [ ] Setup EMQX broker + TLS + Device Certificate `[SEC-NFR-001/005]` — EMQX + TLS đã chạy (dev), chưa có Device Certificate (mTLS) riêng từng thiết bị
- [x] MQTT subscriber heartbeat → status ONLINE/OFFLINE `[FARM-FR-005]` — heartbeat→ONLINE verify thật; node-cron 10s (`jobs/deviceOfflineJob.ts`) tự chuyển OFFLINE khi last_heartbeat > 30s, phát DEVICE_STATUS_CHANGE — **đã verify khớp đúng Flow 14 trong SRS**
- [x] API xem chi tiết device (firmware, uptime, RSSI) `[FARM-FR-006]`
- [ ] API `DELETE`/thay thế SensorNode giữ lại lịch sử telemetry cũ `[FARM-FR-008]`

## C3. Telemetry & Realtime (Sprint 2)

- [x] Schema `telemetry` (temp/humidity/light/nh3/co2/sound, **bỏ h2s/tvoc**) `[8.2]` ⚠️
- [x] Telemetry Aggregator: subscribe topic, validate, lưu MongoDB `[ENV-FR-004]` — verify thật: ESP32→EMQX→backend→MongoDB
- [ ] Đánh dấu is_anomaly cho dữ liệu ngoài ngưỡng `[ENV-FR-004]` — field có sẵn nhưng luôn `false`, chưa so sánh với Zone.thresholds
- [x] Setup socket.io, event TELEMETRY_UPDATE `[ENV-FR-005, 9.3]` — verify thật qua socket.io-client

## C4. Điều khiển Relay & Loa ru (Sprint 3)

- [ ] Schema `sensor_nodes` với relay_states (misting/speaker/ventilation/heating) + relay_type='GPIO' `[8.2]` — relay_states đã đúng, còn thiếu field `relay_type`
- [x] Schema thêm speaker_schedule + audio (track/volume/playing/loop) `[8.2]`
- [x] API cấu hình ngưỡng Zone (bỏ h2s_max/tvoc_max) `[ENV-FR-006]`
- [x] API điều khiển relay → publish MQTT command `[ENV-FR-016]` — verify thật: API→MQTT publish đúng topic
- [ ] API điều khiển loa ru (chọn bài/volume/lịch play/stop) `[ENV-FR-013b]`
- [ ] Logic Manual Override auto-expire 30p (scheduler) `[ENV-FR-018]` — field `override_expiry` được set, nhưng chưa có job backend tự trả về AUTO khi hết hạn (mới có phía firmware) — **cần làm giống mẫu `deviceOfflineJob.ts` (node-cron) đã có, xem Flow 13 bước 6**
- [ ] Idempotent: bấm lại nút cùng trạng thái để gia hạn `override_expiry` thêm 30p thay vì lỗi `[Flow 13 case 4a]`
- [ ] Hiển thị trạng thái "Đang chờ xác nhận từ thiết bị" tách biệt "đã xác nhận" khi ESP32 chưa phản hồi `relay/status` `[Flow 13 case 2a/2b]`
- [ ] Xếp hàng lệnh trả về AUTO nếu ESP32 đang mất kết nối lúc hết hạn override, áp dụng ngay khi kết nối lại `[Flow 13 case 6a]`
- [ ] Lưu lịch sử override + thay đổi cấu hình `[ENV-FR-019, 009]` — lịch sử đổi ngưỡng (threshold_history) đã có; lịch sử override riêng biệt CHƯA có
- [x] Event RELAY_UPDATE qua socket.io `[9.3]`

## C5. Alert Engine (Sprint 3-4)

- [ ] Schema `alerts` (enum type đủ SENSOR_FAULT/RS485_BUS_FAILURE/SPEAKER_FAILURE...) `[8.2]` — model + enum đã đủ, chưa có Alert Engine tạo bản ghi thật
- [ ] Alert Engine phân 4 mức CRITICAL/HIGH/MEDIUM/LOW `[ALERT-FR-001]`
- [ ] Deduplication window 5p/loại/zone `[ALERT-FR-008]`
- [ ] Setup Firebase FCM push `[ALERT-FR-002]`
- [ ] Setup Zalo ZNS cho CRITICAL/HIGH `[ALERT-FR-003]`
- [ ] API cấu hình kênh nhận + giờ im lặng `[ALERT-FR-005, 006]`
- [ ] API alerts list + acknowledge + ghi chú `[ALERT-FR-007, 009]` — hỗ trợ ghi chú "Báo động giả" (false positive) tách biệt "Đã xử lý" `[Flow 4 case 9a]`
- [ ] Event ALERT_NEW qua socket.io `[9.3]`

## C6. Vision Backend & Analytics (Sprint 4-6)

- [ ] Schema `bird_count_records` `[8.2]`
- [ ] MQTT subscriber vision/bird-count `[VISION-FR-006]`
- [ ] Logic Return Rate = evening_entry/morning_exit ×100% `[VISION-FR-009]`
- [ ] Alert LOW_RETURN_RATE (giảm >20% so 7 ngày) `[VISION-FR-011]`
- [ ] Setup S3/MinIO + presigned URL TTL 15p `[SEC-NFR-006]`
- [ ] API analytics: history, bird-count trends, correlation, multi-zone `[ANALYTICS-FR-001~005]`

## C7. Ticket & SLA (Sprint 5)

- [ ] Schema `tickets` (type/priority/status/sla/sat_checklist) `[8.2]` — model đã có, chưa có logic
- [ ] Thêm type `INSTALLATION` vào enum + field `scheduled_visit_at` (Farm Owner chọn thẳng lúc tạo, không qua bước liên hệ) `[TICKET-FR-001, 8.2, Flow 9b bước 1]`
- [ ] API tạo ticket thủ công (báo lỗi + INSTALLATION) `[TICKET-FR-001]`
- [ ] Logic tự tạo ticket từ Alert CRITICAL/HIGH chưa ack 15p `[TICKET-FR-002]`
- [ ] Logic gán priority P1/P2/P3 tự động (INSTALLATION/MAINTENANCE mặc định P3) `[TICKET-FR-003]`
- [ ] Ticket Router gán Technician theo assigned_regions — áp dụng cho **mọi loại ticket kể cả INSTALLATION**, không cần Admin chọn tay `[TICKET-FR-004, 005, Flow 9b bước 3]`
- [ ] Technician tự sửa `scheduled_visit_at`/yêu cầu gán lại nếu không sắp xếp được đúng giờ `[TICKET-FR-004b, Flow 9 case 4a, Flow 9b case 4a]`
- [ ] Tính sla_response/resolve_due, job escalate khi vượt SLA `[TICKET-FR-006, 009, SLA-NFR-002]`
- [ ] API cập nhật status, notes, sat-checklist, rating, KPI `[TICKET-FR-007~012]` — đủ 4 trạng thái `MỚI→ĐANG XỬ LÝ→CHỜ XÁC NHẬN HIỆN TRƯỜNG→ĐÃ ĐÓNG` cho cả 2 loại ticket
- [ ] Chặn đóng ticket INSTALLATION nếu SAT checklist chưa đạt, giữ status ĐANG XỬ LÝ + đặt lại `scheduled_visit_at` `[TICKET-FR-010, Flow 9b case 6a]`
- [x] **API Admin toàn quyền can thiệp ticket bất kỳ** (đổi Technician/priority/ngày hẹn, đóng/huỷ) không giới hạn ở SLA breach `[TICKET-FR-005b]` — merge qua PR #16
- [ ] API Farm Owner tự huỷ ticket giữa chừng `[Flow 9 case 6c, Flow 9b case 4a]`
- [ ] API Technician "Yêu cầu gán lại" ticket bị gán nhầm khu vực `[Flow 9 case 4a]`

## C8. Marketplace (Sprint 6)

- [ ] Schema `harvest_batches`, `nest_listings`, `contact_inquiries` `[8.2]` — model đã có, chưa có logic
- [ ] API tạo Harvest Batch + auto-attach env_snapshot (5 cảm biến, 7 ngày) `[MARKET-FR-001, 002]`
- [ ] Bad case: Zone chưa đủ 7 ngày dữ liệu → đánh dấu `insufficient_data: true` thay vì hiện số liệu sai/rỗng `[Flow 7 case 3a]`
- [ ] Auto-attach flock_snapshot (bird_count 30 ngày) `[MARKET-FR-003]`
- [ ] Sinh trace_code UUID + QR `[MARKET-FR-004]`
- [ ] Chặn sửa/xoá Harvest Batch sau khi đã đăng bán (status khác DRAFT), chỉ cho đổi status Listing `[MARKET-FR-005, Flow 7 case 5a]`
- [ ] API Listing CRUD + public list/detail/trace/inquiry/profile `[MARKET-FR-006~013]`
- [ ] Bad case: `GET /marketplace/trace/:traceCode` với mã không tồn tại → thông báo rõ ràng, không lộ lỗi hệ thống; thêm rate limit riêng cho endpoint public này `[Flow 7 case 11a, SEC-NFR-004]`

## C9. Security & Privacy (Sprint 6)

- [x] Rate limiting ≤100 req/phút `[SEC-NFR-004]`
- [x] Input validation toàn bộ endpoint `[12.4]` — express-validator trên các route đã code logic thật
- [x] bcrypt cost≥12, JWT HS256 `[SEC-NFR-003, 12.1]`
- [ ] Logic consent khi đăng ký + API xóa tài khoản `[PRIV-NFR-001, 003]` — API xoá tài khoản chi tiết xem C1b (AUTH-FR-012, Flow 19)

## C10. Hardening & Báo cáo (Sprint 7-8)

- [ ] Bug fixing theo báo cáo test M5
- [ ] Test coverage ≥80% `[13.1]`
- [ ] Viết phần Backend Architecture cho báo cáo
- [ ] **(stretch)** Module SALES: products/inventory/orders (COD-only) `[SALES-FR-001~010]` — route/model/controller đã scaffold (501), chưa có logic thật
- [ ] **(stretch)** API `PUT /products/:id/review` (duyệt/từ chối) + cho gửi lại `submit-review` sau REJECTED `[SALES-FR-002, Flow 17]`
- [ ] **(stretch)** Admin chuyển APPROVED → REJECTED bất kỳ lúc nào nếu phát hiện vi phạm sau duyệt `[Flow 17 case 4d]`
- [ ] **(stretch)** Thông báo Sales Staff khi tồn kho dưới ngưỡng tối thiểu; tự tắt khi nhập thêm Harvest Batch `[SALES-FR-004, Flow 18]`
- [ ] **(stretch)** Soft-reserve atomic ở tầng DB, tránh race condition 2 Buyer cùng mua sản phẩm sắp hết `[SALES-NFR-001, Flow 10 case 4a]`
- [ ] **(stretch)** Không tạo Order/soft-reserve nếu thanh toán online thất bại giữa chừng `[Flow 10 case 3b]`
- [ ] **(stretch)** API mời Sales Staff dùng chung `Invitation` với Farm Owner (khác `invited_role`) `[Flow 16]`

---

# D. M4 — Frontend / PWA

## D1. Setup & Auth (Sprint 1)

- [ ] Setup Vite + React18 + Router v6 + TailwindCSS `[7.5]`
- [ ] Setup PWA plugin + Service Worker `[UX-NFR-002, 003]`
- [ ] Màn Đăng ký (email/phone + OTP) `[AUTH-FR-001]`
- [ ] Màn Đăng nhập (email/password + Google) `[AUTH-FR-002]`
- [ ] Bad case UI: email trùng gợi ý "Quên mật khẩu", OTP sai/hết hạn, sai mật khẩu quá 5 lần khoá tạm 15p `[Flow 11 case 1a/2a/3a]`
- [ ] Màn "Quên mật khẩu" (nhập email/SĐT → OTP → mật khẩu mới) `[AUTH-FR-009, Flow 11 bước 6-7]`
- [ ] Axios + interceptor auto refresh token `[AUTH-FR-003]`
- [ ] Xử lý Refresh Token hết hạn/bị thu hồi → buộc đăng xuất về màn login `[Flow 11 case 4a]`
- [ ] Màn chấp nhận/từ chối lời mời (`/invitations/:token`) — có pre-fill email nếu dẫn sang đăng ký `[AUTH-FR-010, Flow 12]`
- [ ] Layout Dashboard responsive `[UX-NFR-001]`
- [ ] Setup i18n Việt/Anh `[UX-NFR-004]`

## D2. Farm & Device UI (Sprint 2)

- [x] Màn danh sách Farm + tạo Farm `[FARM-FR-001]`
- [x] Màn House/Zone management `[FARM-FR-002]`
- [ ] Màn "Web Console Onboarding" cho Technician (chỉ role TECHNICIAN thấy, không phải Farm Owner) — bước 1: chọn Farm → House → Zone đích `[FARM-FR-003, Flow 1 bước 2]`
- [ ] Bước 2: quét/nhập Device ID + secretKey, hiển thị lỗi rõ ràng nếu sai/đã thuộc Farm khác `[Flow 1 bước 3, case 3a]`
- [ ] Bước 3: hướng dẫn kết nối vào AP tạm của ESP32 + nút "Thử lại" nếu không thấy mạng `[FARM-FR-003b, Flow 1 bước 5, case 5a]`
- [ ] Bước 4: form nhập WiFi thật của farm, gửi kèm mqttCredentials xuống thiết bị `[Flow 1 bước 6]`
- [ ] Bước 5: polling/socket chờ status PENDING → ONLINE, hiển thị "Kích hoạt quá hạn" nếu >15 phút `[Flow 1 bước 8, case 8a]`
- [x] Màn danh sách Device + trạng thái ONLINE/OFFLINE realtime `[FARM-FR-005, 006]` — StatusDot theo `SensorNode.status`, tự cập nhật qua DEVICE_STATUS_CHANGE (kể cả chiều OFFLINE từ deviceOfflineJob)
- [x] Socket.io-client subscribe JOIN_ZONE `[9.3]`
- [x] Badge "Live"/"Mất kết nối" tự chuyển sau 20s không nhận telemetry mới (độc lập với backend 30s) `[Flow 14 bước 6]` — đã code trong `useTelemetry.ts`, verify thật
- [ ] Dashboard 5 chart realtime: nhiệt/ẩm/lux/NH3/CO2/dB `[ENV-FR-005]` ⚠️ hiện là SensorCard số liệu tức thời, chưa có biểu đồ theo thời gian; 5 cảm biến thật chưa đấu dây đủ
- [ ] UI mời thành viên Farm Owner / Sales Staff — dùng chung màn Invitation (D1), chỉ khác `invited_role` `[AUTH-FR-005, 005b, Flow 12]`
- [ ] Màn danh sách thành viên Farm + nút gỡ thành viên (Primary Owner) `[Flow 12 bước 5]`

## D3. Điều khiển Relay & Loa ru UI (Sprint 3)

- [ ] Màn cấu hình ngưỡng Zone (temp/humidity/light/nh3/co2) `[ENV-FR-006]` ⚠️ bỏ h2s/tvoc
- [ ] UI bật/tắt relay phun sương/quạt thủ công + badge AUTO/MANUAL `[ENV-FR-016, 017]`
- [ ] UI đếm ngược Manual Override 30p + bấm lại để gia hạn thêm 30p `[ENV-FR-018, Flow 13 case 4a]`
- [ ] Trạng thái "Đang chờ xác nhận từ thiết bị" khác màu với "đã xác nhận" khi chưa nhận `relay/status` `[Flow 13 case 2a/2b]`
- [ ] UI điều khiển loa ru: chọn bài, volume slider, play/stop, cấu hình lịch `[ENV-FR-013b]`
- [ ] Màn lịch sử override `[ENV-FR-019]`
- [ ] Xử lý event RELAY_UPDATE realtime `[9.3]`

## D4. Alert & Analytics UI (Sprint 4)

- [ ] Notification Center (list alert, đã đọc/chưa đọc) `[ALERT-FR-007]`
- [ ] UI acknowledge alert + ghi chú `[ALERT-FR-009]`
- [ ] Cài đặt kênh nhận (Push/Zalo/SMS) + giờ im lặng `[ALERT-FR-005, 006]`
- [ ] Setup Firebase Web Push (Service Worker) `[ALERT-FR-002]`
- [ ] Xử lý event ALERT_NEW realtime `[9.3]`
- [ ] Trang Analytics: chart lịch sử + multi-zone comparison + correlation `[ANALYTICS-FR-001/003/005]`

## D5. Vision UI (Sprint 5)

- [ ] Dashboard đếm chim live giờ cao điểm `[VISION-FR-012]`
- [ ] Biểu đồ xu hướng return rate `[VISION-FR-010, ANALYTICS-FR-002]`
- [ ] Trang live stream camera (HLS/WebRTC) `[VISION-FR-013]`
- [ ] Xử lý event BIRD_COUNT_UPDATE realtime `[9.3]`
- [ ] Trang xem video recording sự kiện `[VISION-FR-015]`

## D6. Ticket UI (Sprint 5)

- [ ] Màn Farm Owner tạo ticket báo lỗi (chọn loại lỗi) `[TICKET-FR-001]`
- [ ] Màn Farm Owner "Yêu cầu lắp đặt" — chọn ngày giờ hẹn cụ thể ngay lúc tạo (`scheduled_visit_at`), không có bước liên hệ `[TICKET-FR-001, Flow 9b bước 1]`
- [ ] Màn danh sách + chi tiết ticket + timeline ghi chú `[TICKET-FR-007]`
- [ ] UI Technician cập nhật status + checklist SAT `[TICKET-FR-007, 010]` — chặn nút "Đóng ticket" nếu checklist chưa đạt `[Flow 9b case 6a]`
- [ ] Nút Technician "Yêu cầu gán lại" (kèm lý do) `[Flow 9 case 4a]`
- [ ] Nút Farm Owner "Huỷ yêu cầu" trước ngày hẹn `[Flow 9b case 4a]`
- [ ] UI Admin can thiệp toàn quyền: đổi Technician/ngày hẹn/priority, đóng-huỷ bất kỳ ticket nào `[TICKET-FR-005b]`
- [ ] UI đánh giá 1-5 sao + Dashboard KPI (Admin) `[TICKET-FR-011, 012]`

## D7. Marketplace UI (Sprint 6)

- [ ] Form tạo Harvest Batch + hiển thị snapshot tự động `[MARKET-FR-001~003]`
- [ ] Hiển thị Trace Code + QR `[MARKET-FR-004]`
- [ ] Form đăng bán Nest Listing `[MARKET-FR-006]`
- [ ] Trang Marketplace công khai + filter `[MARKET-FR-008]`
- [ ] Traceability Card (biểu đồ nhiệt/ẩm 7 ngày, return rate) `[MARKET-FR-009]`
- [ ] Form liên hệ Buyer + trang tra cứu Trace Code/QR `[MARKET-FR-010, 011]`
- [ ] Consent screen đăng ký + chức năng xóa tài khoản `[PRIV-NFR-001, 003]`
- [ ] **(stretch)** UI Admin duyệt/từ chối Product (kèm lý do) + Sales Staff sửa & gửi lại sau REJECTED `[SALES-FR-002, Flow 17]`
- [ ] **(stretch)** Badge cảnh báo tồn kho thấp trên trang Product (Sales Staff + Farm Owner đều thấy) `[SALES-FR-004, Flow 18]`

## D8. Quản trị Tài khoản (Admin) & OTA (Technician) `[mới v1.12.0]`

- [ ] Trang Admin: danh sách tài khoản, filter theo role/trạng thái `[AUTH-FR-011]`
- [ ] UI khoá/mở khoá tài khoản kèm ô nhập lý do bắt buộc `[AUTH-FR-011, Flow 19 bước 2]`
- [ ] Thông báo "Tài khoản đã bị khoá" kèm lý do khi user cố đăng nhập `[Flow 19 bước 4]`
- [ ] Trang Admin: danh sách yêu cầu xoá tài khoản + nút xác nhận hoàn tất `[AUTH-FR-012, Flow 19 bước 6-8]`
- [ ] UI Technician "Đẩy OTA" — chọn thiết bị + phiên bản firmware, xem trạng thái tải/flash `[TICKET-FR-008, Flow 15]`

## D9. Polish & Báo cáo (Sprint 7-8)

- [ ] Lighthouse tuning: Perf≥80, PWA≥90 `[UX-NFR-007]`
- [ ] Test responsive desktop/tablet/mobile `[UX-NFR-001]`
- [ ] Fix bug UI theo test M5
- [ ] Viết phần Frontend/UX cho báo cáo
- [ ] **(stretch)** UI giỏ hàng/checkout + quản lý Sales `[SALES-FR-*]`

---

# E. M5 — QA / DevOps / Thesis

## E1. Hạ tầng DevOps (Sprint 1)

- [x] Docker Compose local (Mongo+Redis+EMQX) `[17.1]`
- [ ] GitHub Actions CI (lint + unit test mỗi PR) `[13.1]`
- [x] File `.env.example` đầy đủ biến `[17.2]`
- [x] Cấu trúc repo theo module + README từng repo `[17.2]`
- [ ] Import toàn bộ FR ID vào Jira/Trello
- [x] 🤝 Endpoint `/health` cùng M3 `[OPS-NFR-003]`

## E2. Deploy & Logging (Sprint 2)

- [ ] Deploy staging (VPS/Render/Railway) `[17.1]`
- [ ] Setup logging JSON structured (winston/morgan) `[OPS-NFR-001]`
- [ ] Dashboard admin xem trạng thái node toàn hệ thống `[OPS-NFR-004]` — ✅ backend đã code + test E2E trên nhánh `feat/admin-system-and-sales-approval`, chờ review PR mới tick

## E3. Integration Testing (Sprint 2-6)

- [x] 🤝 Test MQTT E2E (ESP32→Broker→Backend→DB) `[13.2]` — verify thật với ESP32 vật lý
- [x] Test đổi WiFi tự phục vụ qua AP-mode/captive portal (A4a) trên phần cứng + điện thoại thật: sai mật khẩu → AP hiện → portal tự popup → nhập WiFi thật → lưu NVS → tự reboot → kết nối lại → lên EMQX `[FARM-FR-003b tự phục vụ]` — phát hiện + sửa luôn lỗi thứ tự `softAPConfig()`/`softAP()` trong lúc test
- [ ] 🤝 Test onboarding thiết bị MỚI qua Web Console (Technician) khi Web Console được code (A4b) `[Flow 1]`
- [ ] Test bad case Flow 1: secretKey sai, SAT checklist không đạt (phần Web Console, A4b) `[Flow 1 case 3a/case checklist]`
- [x] Test offline-detection: rút nguồn ESP32 → StatusDot đỏ trong ≤30s, badge Live → "Mất kết nối" trong ≤20s, cắm lại → tự Online `[Flow 14]` — verify thật đã thực hiện trong buổi làm việc
- [ ] 🤝 Test Manual Override + loa ru theo lịch `[13.2]`
- [ ] Test override auto-expire 30p thật (không chỉ trên giấy) + gia hạn override `[Flow 13]`
- [ ] Test đăng ký/đăng nhập/quên mật khẩu/refresh token đầy đủ bad case `[Flow 11]`
- [ ] 🤝 Test mời thành viên Farm/Sales Staff — chấp nhận/từ chối/hết hạn `[Flow 12]`
- [ ] 🤝 Test ticket INSTALLATION: tạo → tự động gán Technician → Web Console onboarding → SAT → đóng `[Flow 9b]`
- [ ] Test Admin khoá/mở khoá tài khoản + JWT bị chặn ngay dù token còn hạn `[Flow 19]`
- [ ] Test OTA + rollback khi firmware lỗi `[Flow 15]`
- [ ] 🤝 Test Bird Count E2E `[13.2]`
- [ ] 🤝 Test Alert Pipeline đa kênh `[13.2]`
- [ ] 🤝 Test Flow 7 (Harvest→Listing→Trace) + bad case Trace Code không tồn tại `[13.2, Flow 7]`

## E4. Performance Testing (Sprint 4, 7)

- [ ] API throughput: 100 req/s @ P95≤500ms (k6/Artillery) `[13.3]`
- [ ] WebSocket: 100 connections, latency≤2s `[13.3]`
- [ ] MQTT message rate: 1000 msg/s `[13.3]`

## E5. Security & Backup Review (Sprint 6)

- [ ] Security review: JWT/bcrypt/rate limit/S3 presigned `[12.1~12.4]`
- [ ] Review consent/privacy screens `[17.4]`
- [ ] Test backup telemetry hàng ngày + restore `[REL-NFR-007]`

## E6. FCM/Zalo & Demo Setup (Sprint 5)

- [ ] Setup Firebase FCM + Zalo ZNS thật, test push `[13.2]`
- [ ] Viết kịch bản demo đóng vai Technician `[RISK-09]`

## E7. Audit & Thesis (Sprint 7-8)

- [ ] Audit DoD toàn bộ FR Giai đoạn 1 `[18]`
- [ ] Go/No-go stretch (SALES, upload loa ru) `[RISK-10]`
- [ ] Performance test cuối + regression toàn diện `[13.3]`
- [ ] Tổng hợp KPI dự án (coverage, FR done/tổng, uptime)
- [ ] Điều phối viết báo cáo KLTN + dry-run demo ≥2 lần

---

# F. Các mốc phối hợp liên-role (Integration)

> Các mốc 🤝 cần ≥2 người ngồi cùng nhau, không ai làm riêng được.

- [x] **M1+M3** — Firmware publish MQTT ↔ Backend nhận & lưu (Sprint 2) `[13.2]` — verify thật: ESP32 → EMQX → backend → MongoDB
- [ ] **M1+M3+M4** — Onboarding thiết bị end-to-end qua Web Console: Technician chọn Zone → nhập secretKey → AP-mode WiFi → ESP32 kết nối → dashboard (Sprint 2) `[Flow 1]` — **đổi khỏi model "Farm Owner quét QR" cũ, xem SRS v1.12.0 §4.1**
- [x] **M1+M3+M4** — Offline-detection: rút nguồn ESP32 → StatusDot + badge Live tự chuyển Offline không cần F5 (Sprint 2-3) `[Flow 14]` — verify thật, đã hoàn thành trong buổi làm việc
- [ ] **M1+M3+M4** — Điều khiển relay/loa ru: bấm UI → API → MQTT → ESP32 phản hồi (Sprint 3) `[Flow 2, 13]` — mới có API→MQTT (chưa có UI, chưa demo ESP32 phản hồi thật do Secrets.h ESP32 hiện chưa trỏ đúng farmId/houseId/zoneId thật)
- [ ] **M2+M3** — RPi publish bird-count ↔ Backend tính return rate (Sprint 4) `[Flow 3]`
- [ ] **M2+M3** — Predator detection: RPi → S3 upload → Alert đa kênh (Sprint 5) `[Flow 4]`
- [ ] **M1+M2** — Lắp Camera Node thật + onboarding qua Web Console (Sprint 5) `[Flow 1b]`
- [ ] **M3+M4** — Ticket lifecycle báo lỗi: tạo → gán tự động → xử lý → đóng (Sprint 5) `[Flow 9]`
- [ ] **M3+M4** — Ticket INSTALLATION: Farm Owner yêu cầu → Ticket Router tự gán Technician → onboarding Flow 1 → SAT → đóng (Sprint 5) `[Flow 9b]`
- [ ] **M3+M4** — Đăng ký/đăng nhập/quên mật khẩu/mời thành viên end-to-end (Sprint 1-2) `[Flow 11, 12]`
- [ ] **M3+M4** — Admin khoá/mở khoá + xử lý yêu cầu xoá tài khoản end-to-end (Sprint 6) `[Flow 19]`
- [ ] **M3+M4** — Harvest → Listing → Buyer tra cứu Trace (Sprint 6) `[Flow 7]`
- [ ] **Cả nhóm** — Master Flow demo tổng: onboarding + giám sát + điều khiển + loa ru + cảnh báo + ticket (báo lỗi & lắp đặt) + quản lý tài khoản (Sprint 8)

---

## Quy tắc chung khi tick

1. Chỉ tick `[x]` khi thỏa **cả 4 tiêu chí DoD** (SRS mục 18): code review + test pass + demo E2E + tài liệu.
2. Mỗi người bắt buộc tham gia Integration Testing (mục F) của ít nhất 1 module không phải của mình `[14.1]`.
3. Task 🤝 phải hẹn lịch chung, ghi vào standup.
4. Cuối mỗi sprint: đếm số `[x]/tổng` mỗi người, cập nhật bảng tiến độ WORKPLAN v2.

---

_Bảng task chi tiết v3 đi kèm WORKPLAN v2 + SRS v1.12.0 + Components Guide v3.3. Dùng file này để làm việc hàng ngày; dùng WORKPLAN v2 để nhìn tổng thể theo sprint._
