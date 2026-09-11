# Software Requirements Specification (SRS)

## SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming

---

| Trường thông tin        | Nội dung                            |
| ----------------------- | ----------------------------------- |
| **Tên dự án**           | SwiftletCare                        |
| **Phiên bản SRS**       | 1.4.0                               |
| **Ngày tạo**            | 07/09/2026                          |
| **Thời gian thực hiện** | Tháng 7/2026 – Tháng 12/2026 (FA26) |
| **Chuyên ngành**        | Software Engineering (SE)           |
| **Loại đồ án**          | Capstone Project – KLTN             |

---

## MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Mô tả Tổng quan Hệ thống](#2-mô-tả-tổng-quan-hệ-thống)
3. [Kiến trúc Hệ thống](#3-kiến-trúc-hệ-thống)
4. [Các Tác nhân (Actors)](#4-các-tác-nhân-actors)
5. [Yêu cầu Chức năng](#5-yêu-cầu-chức-năng)
6. [Yêu cầu Phi chức năng](#6-yêu-cầu-phi-chức-năng)
7. [Đặc tả Phần cứng & BOM](#7-đặc-tả-phần-cứng--bom)
8. [Mô hình Dữ liệu](#8-mô-hình-dữ-liệu)
9. [Đặc tả Giao diện & API](#9-đặc-tả-giao-diện--api)
10. [Luồng Xử lý Nghiệp vụ (Flows)](#10-luồng-xử-lý-nghiệp-vụ-flows)
11. [Yêu cầu AI / Computer Vision](#11-yêu-cầu-ai--computer-vision)
12. [Yêu cầu Bảo mật](#12-yêu-cầu-bảo-mật)
13. [Kế hoạch Kiểm thử](#13-kế-hoạch-kiểm-thử)
14. [Phân công & Lịch trình](#14-phân-công--lịch-trình)
15. [Bảng Thuật ngữ](#15-bảng-thuật-ngữ)

---

## 1. Giới thiệu

### 1.1. Mục đích Tài liệu

Tài liệu này là Đặc tả Yêu cầu Phần mềm (Software Requirements Specification – SRS) cho hệ thống **SwiftletCare**. Tài liệu mô tả đầy đủ và chính xác tất cả các yêu cầu chức năng, phi chức năng, ràng buộc kỹ thuật, kiến trúc hệ thống và tiêu chí chấp nhận của đồ án tốt nghiệp. SRS này được sử dụng làm căn cứ để:

- Đội phát triển thiết kế, xây dựng và kiểm thử hệ thống.
- Giảng viên hướng dẫn và hội đồng đánh giá xem xét phạm vi đồ án.
- Các bên liên quan hiểu rõ giá trị và giới hạn của sản phẩm.

### 1.2. Phạm vi Hệ thống

**SwiftletCare** là một hệ sinh thái IoT toàn diện kết hợp phần cứng nhúng, thị giác máy tính biên (Edge AI), và nền tảng web/mobile, nhằm giải quyết 4 bài toán chính trong nghề nuôi yến thương mại:

| #   | Bài toán                                                 | Giải pháp                                                         |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Điều khiển vi khí hậu thủ công, phụ thuộc người vận hành | Closed-loop PID Control tự động 24/7 qua ESP32                    |
| 2   | Không thể theo dõi số lượng đàn chim chính xác           | AI Camera đếm chim ra/vào theo thời gian thực                     |
| 3   | Phát hiện thiên địch và sự cố trễ, thiệt hại lớn         | Multi-modal Threat Detection (Vision + Audio)                     |
| 4   | Người mua không có cơ sở xác minh chất lượng tổ yến      | Nest Marketplace với truy xuất nguồn gốc (Farm Traceability Data) |

### 1.3. Tài liệu Tham chiếu

- `FA26_SE_Capstone_Project_Register_SwiftletCare.docx` – Phiếu đăng ký đề tài KLTN
- `KLTN_2026_SwiftletCare_FA26.docx` – Đặc tả kỹ thuật phần cứng và Edge AI Vision
- YOLOv8/YOLOv10 Documentation – Ultralytics
- ByteTrack: Multi-Object Tracking by Associating Every Detection Box
- EMQX/Mosquitto MQTT Broker Documentation
- NestJS Framework Documentation

### 1.4. Tổng quan Tài liệu

SRS được tổ chức theo chuẩn IEEE 830-1998 với các phần mở rộng cho hệ thống IoT/Edge AI. Mỗi yêu cầu chức năng được định danh duy nhất theo format `[MODULE]-FR-XXX` để dễ truy vết.

---

## 2. Mô tả Tổng quan Hệ thống

### 2.1. Bối cảnh Vấn đề

Nghề nuôi yến thương mại tại Việt Nam là ngành có giá trị kinh tế cao (tổ yến đạt 20–60 triệu đồng/kg), nhưng cực kỳ nhạy cảm với môi trường. Các vấn đề hiện tại:

- **Về môi trường:** Độ ẩm < 75% hoặc nhiệt độ > 31°C gây thoái hóa tổ, chim bỏ tổ, hoặc tỉ lệ tử vong non cao. Hầu hết nông dân dùng cảm biến rời lẻ, phải kiểm tra thủ công nhiều lần/ngày.
- **Về quản lý đàn:** Không có cơ chế đánh giá tự động số lượng chim ra/vào hàng ngày — chỉ số then chốt nhất để đánh giá sức khỏe đàn và dự báo năng suất thu hoạch.
- **Về an ninh:** Thiên địch (chuột, rắn, cú mèo) và sự cố thiết bị (hỏng loa dẫn dụ, mất điện) hiện chỉ được phát hiện khi chủ nhà kiểm tra trực tiếp, thường quá muộn để can thiệp kịp thời.

### 2.2. Đối tượng Người dùng Mục tiêu

- Chủ nhà yến thương mại quy mô vừa và nhỏ (1–5 tòa nhà).
- Kỹ thuật viên/nhân viên vận hành trang trại yến.
- Quản trị hệ thống (Administrator IT).
- Người mua yến (Buyer) – khách hàng mua tổ yến, cần xác minh chất lượng và nguồn gốc.

### 2.3. Tóm tắt Sản phẩm

SwiftletCare bao gồm **5 sản phẩm đầu ra cụ thể**:

| #   | Sản phẩm                          | Mô tả                                                                |
| --- | --------------------------------- | -------------------------------------------------------------------- |
| P1  | **Hardware Controller Prototype** | Bo mạch IoT ESP32 tích hợp cảm biến + relay, đóng gói trong hộp IP65 |
| P2  | **AI Camera Node**                | Raspberry Pi 4 + IP Camera PoE 4MP + YOLOv8/ByteTrack pipeline       |
| P3  | **Trained AI Model**              | Mô hình đếm chim và phát hiện thiên địch (ONNX/NCNN quantized)       |
| P4  | **Web & Mobile Application**      | Web Dashboard + Mobile Web App (ReactJS / PWA)                       |
| P5  | **Cloud Backend**                 | Node.js + Express API + MQTT Broker + Time-series DB + Alert Service |

---

## 3. Kiến trúc Hệ thống

### 3.1. Mô hình Phân tầng (Tiered Edge AI & IoT Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 3: CLOUD LAYER                      │
│  Express API ──── MongoDB ──── Redis ──── S3/MinIO          │
│  EMQX MQTT Broker ─── Alert Service (Push/Zalo/SMS)        │
└────────────────────────┬───────────────────────────────────┘
                         │ 4G LTE (JSON/MQTT + Snapshots)
┌────────────────────────▼───────────────────────────────────┐
│              TIER 2: EDGE GATEWAY (Router 4G)              │
│  Router 4G LTE Cat4 ─── Local LAN/Wi-Fi ─── PoE Switch    │
└────────┬───────────────────────────────────────┬───────────┘
         │ Wi-Fi (MQTT)                          │ LAN (RTSP)
┌────────▼───────────────────┐    ┌─────────────▼───────────┐
│  TIER 1A: ESP32 NODE       │    │  TIER 1B: EDGE AI NODE  │
│  Modbus RTU Master (MAX485)│    │  Raspberry Pi 4 (4GB)   │
│  RS485 Bus → 5 Sensors     │    │  YOLOv8 + ByteTrack     │
│  RS485 Bus → 4-ch Relay    │    │  IP Camera PoE 4MP      │
│  PID Closed-loop           │    │  30FPS, Starlight IR    │
│  IP65–IP67 Industrial Grade│    │  FullHD Resolution      │
└────────────────────────────┘    └─────────────────────────┘
```

### 3.2. Stack Công nghệ

| Tầng                  | Công nghệ                                                                                                 | Lý do Chọn                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Firmware/Embedded** | ESP32-WROOM-32D, FreeRTOS, Arduino Framework, RS485 Modbus RTU (ModbusMaster/eModbus), MAX485 Transceiver | Dual-core 240MHz, Wi-Fi tích hợp, MQTT native, RS485 bus cho cảm biến công nghiệp IP65+ |
| **Edge AI**           | Raspberry Pi 4 (4GB), Python, OpenCV                                                                      | Đủ sức chạy YOLO quantized @ 25–30 FPS                                                  |
| **AI Model**          | YOLOv8/YOLOv10, ByteTrack/DeepSORT                                                                        | SOTA lightweight object detection + MOT                                                 |
| **AI Training**       | Roboflow/CVAT, Google Colab GPU, ONNX, NCNN                                                               | Pipeline annotation → quantize → deploy                                                 |
| **MQTT Broker**       | EMQX / Mosquitto                                                                                          | Pub/Sub IoT protocol, low latency                                                       |
| **Backend**           | Node.js + Express, JavaScript/TypeScript                                                                  | Nhẹ, linh hoạt, hệ sinh thái npm lớn, WebSocket (socket.io)                             |
| **Database**          | MongoDB (telemetry), Redis (cache/session)                                                                | Phù hợp time-series IoT, schema linh hoạt                                               |
| **File Storage**      | S3 / MinIO                                                                                                | Lưu trữ snapshot cảnh báo, video clips                                                  |
| **Web Dashboard**     | React.js, TailwindCSS, Chart.js                                                                           | SPA dashboard, real-time chart components                                               |
| **Mobile Web (PWA)**  | ReactJS, TailwindCSS, Vite                                                                                | Progressive Web App cài được trên iOS/Android, không cần app store                      |
| **Notification**      | Firebase FCM (Push Web), Zalo ZNS, SMS (Twilio/ESMS)                                                      | Đa kênh; FCM hỗ trợ push cho PWA qua Service Worker                                     |

---

## 4. Các Tác nhân (Actors)

### 4.1. Actor Bên Ngoài

| Actor             | Mô tả                                       | Quyền hạn                                                                    |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| **Farm Owner**    | Chủ nhà yến, người dùng chính               | Full access: quản lý, xem dashboard, cấu hình, đăng bán yến                  |
| **Operator**      | Nhân viên kỹ thuật vận hành                 | Xem dashboard, điều khiển manual, xem cảnh báo                               |
| **Administrator** | Quản trị IT hệ thống                        | Quản lý tài khoản, cấu hình hệ thống, audit log                              |
| **Buyer**         | Người mua yến, khách hàng tiềm năng/đối tác | Xem danh sách yến đăng bán, xem truy xuất nguồn gốc farm, liên hệ Farm Owner |

### 4.2. Actor Hệ thống (Background Services)

| Actor                         | Mô tả                                                 |
| ----------------------------- | ----------------------------------------------------- |
| **ESP32 Controller Node**     | Thu thập cảm biến, thực thi PID, publish MQTT         |
| **Raspberry Pi Edge AI Node** | Chạy YOLO + ByteTrack, publish kết quả đếm chim       |
| **MQTT Broker (EMQX)**        | Trung gian message routing giữa edge và cloud         |
| **Alert Engine**              | Dịch vụ background phân tích sự kiện và gửi thông báo |
| **Telemetry Aggregator**      | Thu thập, validate, lưu time-series IoT data          |

---

## 5. Yêu cầu Chức năng

### 5.1. Module AUTH – Xác thực & Phân quyền

| ID          | Yêu cầu                                                                           | Mức độ   |
| ----------- | --------------------------------------------------------------------------------- | -------- |
| AUTH-FR-001 | Hệ thống cho phép đăng ký tài khoản bằng email/số điện thoại, xác thực OTP        | Bắt buộc |
| AUTH-FR-002 | Hỗ trợ đăng nhập bằng email/mật khẩu và OAuth2 (Google)                           | Bắt buộc |
| AUTH-FR-003 | Quản lý phiên đăng nhập bằng JWT Access Token (15 phút) + Refresh Token (30 ngày) | Bắt buộc |
| AUTH-FR-004 | Phân quyền theo Role: FARM_OWNER, OPERATOR, ADMINISTRATOR                         | Bắt buộc |
| AUTH-FR-005 | Farm Owner có thể mời Operator và phân quyền theo từng nhà yến cụ thể             | Bắt buộc |
| AUTH-FR-006 | Hỗ trợ xác thực 2 yếu tố (2FA) bằng TOTP (Google Authenticator)                   | Tùy chọn |
| AUTH-FR-007 | Ghi audit log mọi hành động đăng nhập, thay đổi cấu hình                          | Bắt buộc |

### 5.2. Module FARM – Quản lý Trang trại & Thiết bị

| ID          | Yêu cầu                                                                                    | Mức độ   |
| ----------- | ------------------------------------------------------------------------------------------ | -------- |
| FARM-FR-001 | Tạo, cập nhật, xóa mềm thông tin trang trại (Farm): tên, địa chỉ, tọa độ GPS, mô tả        | Bắt buộc |
| FARM-FR-002 | Mỗi Farm có thể chứa nhiều House (tòa nhà yến), mỗi House nhiều Zone (tầng/khu vực)        | Bắt buộc |
| FARM-FR-003 | Đăng ký thiết bị IoT Node (ESP32 Controller) bằng Device ID + QR Code Onboarding           | Bắt buộc |
| FARM-FR-004 | Đăng ký AI Camera Node (Raspberry Pi) bằng Node ID + QR Code Onboarding                    | Bắt buộc |
| FARM-FR-005 | Xem trạng thái online/offline của từng thiết bị theo thời gian thực (Last Heartbeat ≤ 30s) | Bắt buộc |
| FARM-FR-006 | Xem thông tin chi tiết thiết bị: firmware version, uptime, cường độ tín hiệu Wi-Fi (RSSI)  | Bắt buộc |
| FARM-FR-007 | Gán thiết bị vào Zone cụ thể; một Zone có thể có nhiều node cảm biến và nhiều camera       | Bắt buộc |
| FARM-FR-008 | Gỡ bỏ và thay thế thiết bị mà không mất lịch sử dữ liệu cũ                                 | Bắt buộc |

### 5.3. Module ENV – Giám sát & Điều khiển Môi trường

#### 5.3.1. Thu thập Dữ liệu Cảm biến

| ID         | Yêu cầu                                                                                                                                                     | Mức độ   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ENV-FR-001 | ESP32 thu thập và publish dữ liệu 5 cảm biến qua MQTT topic có cấu trúc: `swiftletcare/farm/{farmId}/house/{houseId}/zone/{zoneId}/sensors`                 | Bắt buộc |
| ENV-FR-002 | Tần suất đọc cảm biến và publish: mỗi 10 giây (có thể cấu hình từ 5–60 giây)                                                                                | Bắt buộc |
| ENV-FR-003 | Dữ liệu cảm biến bao gồm: Nhiệt độ (°C), Độ ẩm (%), Cường độ ánh sáng (lux), Nồng độ khí NH3 (ppm), H2S (ppm), CO2 (ppm), TVOC (ppb), Biên độ âm thanh (dB) | Bắt buộc |
| ENV-FR-004 | Backend validate và lưu telemetry vào time-series collection MongoDB; dữ liệu ngoài ngưỡng hợp lệ bị đánh dấu anomaly                                       | Bắt buộc |
| ENV-FR-005 | Dashboard hiển thị giá trị cảm biến thời gian thực qua WebSocket; độ trễ cập nhật ≤ 2 giây                                                                  | Bắt buộc |

#### 5.3.2. Cấu hình Ngưỡng Điều khiển

| ID         | Yêu cầu                                                                                                                                                                                                            | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| ENV-FR-006 | Farm Owner cấu hình ngưỡng tự động cho từng Zone: `temp_min` (°C), `temp_max` (°C), `humidity_min` (%), `humidity_max` (%), `light_max` (lux), `nh3_max` (ppm), `h2s_max` (ppm), `co2_max` (ppm), `tvoc_max` (ppb) | Bắt buộc |
| ENV-FR-007 | Giá trị khuyến nghị mặc định: Nhiệt độ 26–31°C, Độ ẩm 75–95%, Ánh sáng < 0.2 lux                                                                                                                                   | Bắt buộc |
| ENV-FR-008 | Hệ thống hỗ trợ đặt ngưỡng cảnh báo (Warning) riêng với ngưỡng kích hoạt actuator (Action)                                                                                                                         | Bắt buộc |
| ENV-FR-009 | Lịch sử thay đổi cấu hình được ghi lại với timestamp và user thực hiện                                                                                                                                             | Bắt buộc |

#### 5.3.3. Điều khiển Tự động (Closed-loop PID)

| ID         | Yêu cầu                                                                                                                                    | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| ENV-FR-010 | ESP32 thực thi thuật toán PID cục bộ để điều khiển Relay phun sương khi độ ẩm < humidity_min                                               | Bắt buộc |
| ENV-FR-011 | ESP32 kích hoạt Relay quạt thông gió khi nhiệt độ > temp_max hoặc NH3 > nh3_max hoặc H2S > h2s_max hoặc CO2 > co2_max hoặc TVOC > tvoc_max | Bắt buộc |
| ENV-FR-012 | ESP32 kích hoạt Relay sưởi nhiệt khi nhiệt độ < temp_min                                                                                   | Bắt buộc |
| ENV-FR-013 | ESP32 tắt ánh sáng (nếu có) khi ánh sáng môi trường > light_max                                                                            | Bắt buộc |
| ENV-FR-014 | Hệ thống tiếp tục thực thi Closed-loop Control cục bộ khi mất kết nối Internet (Offline Resilience)                                        | Bắt buộc |
| ENV-FR-015 | Trạng thái relay (ON/OFF) được publish lên MQTT và đồng bộ lên Cloud mỗi khi thay đổi                                                      | Bắt buộc |

#### 5.3.4. Điều khiển Thủ công (Manual Override)

| ID         | Yêu cầu                                                                                          | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------ | -------- |
| ENV-FR-016 | Farm Owner/Operator có thể bật/tắt thủ công từng relay qua Web/Mobile UI                         | Bắt buộc |
| ENV-FR-017 | Khi ở chế độ Manual Override, PID Control bị tạm dừng cho relay đó; hiển thị cảnh báo rõ ràng    | Bắt buộc |
| ENV-FR-018 | Manual Override tự động hết hạn sau thời gian cấu hình (mặc định 30 phút), trả về chế độ tự động | Bắt buộc |
| ENV-FR-019 | Lịch sử mọi lần override được ghi lại (user, thời gian, relay, trạng thái)                       | Bắt buộc |

### 5.4. Module VISION – AI Camera & Đếm Chim

#### 5.4.1. Luồng Video & Xử lý AI

| ID            | Yêu cầu                                                                                                       | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| VISION-FR-001 | Raspberry Pi nhận luồng RTSP từ Camera IP PoE 4MP (2K @ 30 FPS) qua LAN nội bộ                                | Bắt buộc |
| VISION-FR-002 | Mô hình YOLOv8/YOLOv10 (ONNX/NCNN quantized) chạy inference @ 25–30 FPS trên RPi 4                            | Bắt buộc |
| VISION-FR-003 | Hệ thống detect và classify các class: `swiftlet`, `rat`, `snake`, `owl`                                      | Bắt buộc |
| VISION-FR-004 | Thuật toán ByteTrack theo dõi ID object qua các frame để tránh đếm trùng                                      | Bắt buộc |
| VISION-FR-005 | Logic đếm dựa trên vector di chuyển: chim vượt qua line ảo theo hướng ra → counted as EXIT; ngược lại → ENTRY | Bắt buộc |
| VISION-FR-006 | RPi publish kết quả đếm realtime qua MQTT: `{entry_count, exit_count, timestamp, confidence}`                 | Bắt buộc |
| VISION-FR-007 | Hỗ trợ camera Night Vision (IR) để đếm chim trong điều kiện ánh sáng yếu lúc bình minh/hoàng hôn              | Bắt buộc |

#### 5.4.2. Theo dõi & Thống kê Đàn Chim

| ID            | Yêu cầu                                                                                               | Mức độ   |
| ------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| VISION-FR-008 | Backend tổng hợp entry/exit count theo phiên (session): Phiên Sáng (ra), Phiên Tối (về)               | Bắt buộc |
| VISION-FR-009 | Tính toán Return Rate hàng ngày: `return_rate = (evening_entry / morning_exit) × 100%`                | Bắt buộc |
| VISION-FR-010 | Lưu lịch sử đếm chim theo ngày, tuần, tháng; hiển thị biểu đồ xu hướng                                | Bắt buộc |
| VISION-FR-011 | Cảnh báo khi return_rate giảm > 20% so với trung bình 7 ngày trước                                    | Bắt buộc |
| VISION-FR-012 | Dashboard hiển thị live count thời gian thực trong giờ cao điểm (5:30–7:00 sáng và 17:30–19:00 chiều) | Bắt buộc |

#### 5.4.3. Live Stream Camera

| ID            | Yêu cầu                                                                             | Mức độ   |
| ------------- | ----------------------------------------------------------------------------------- | -------- |
| VISION-FR-013 | Farm Owner xem live stream camera qua Web/PWA App (HLS qua Video.js hoặc WebRTC)    | Bắt buộc |
| VISION-FR-014 | Live stream hiển thị bounding box overlay và ID tracking theo thời gian thực        | Tùy chọn |
| VISION-FR-015 | Xem video recording của các sự kiện đã qua (lưu trữ 7 ngày mặc định, cấu hình được) | Bắt buộc |

### 5.5. Module THREAT – Phát hiện Mối đe dọa

#### 5.5.1. Phát hiện Thiên địch qua Camera

| ID            | Yêu cầu                                                                                                                             | Mức độ   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| THREAT-FR-001 | Khi phát hiện đối tượng class `rat`, `snake`, hoặc `owl` với confidence ≥ 0.7, hệ thống lập tức capture frame và kích hoạt cảnh báo | Bắt buộc |
| THREAT-FR-002 | Snapshot frame (với bounding box) được upload lên S3/MinIO và gửi kèm URL trong notification                                        | Bắt buộc |
| THREAT-FR-003 | Áp dụng Non-Maximum Suppression và Temporal Filtering (≥ 2 frame liên tiếp) trước khi kích hoạt alert, tránh false positive         | Bắt buộc |
| THREAT-FR-004 | Mức độ cảnh báo thiên địch: CRITICAL (snake, owl) và HIGH (rat)                                                                     | Bắt buộc |

#### 5.5.2. Phát hiện Sự cố Âm thanh

| ID            | Yêu cầu                                                                                                            | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| THREAT-FR-005 | Module MAX9814 thu âm liên tục; ESP32 phân tích biên độ và tần số cơ bản                                           | Bắt buộc |
| THREAT-FR-006 | Phát hiện sự cố loa dẫn dụ: Khi amplitude âm thanh giảm đột ngột > 70% so với baseline → cảnh báo SPEAKER_FAILURE  | Bắt buộc |
| THREAT-FR-007 | Phát hiện tiếng chim hoảng loạn: Pattern tần số bất thường (spike noise, continuous high dB) → cảnh báo BIRD_PANIC | Bắt buộc |
| THREAT-FR-008 | Lưu audio snippet 10 giây trước và sau sự kiện âm thanh bất thường                                                 | Tùy chọn |

#### 5.5.3. Phát hiện Sự cố Thiết bị & Hạ tầng

| ID            | Yêu cầu                                                                                                                | Mức độ   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| THREAT-FR-009 | Phát hiện mất kết nối ESP32 (timeout heartbeat > 60 giây) → cảnh báo NODE_OFFLINE                                      | Bắt buộc |
| THREAT-FR-010 | Phát hiện Raspberry Pi offline hoặc model inference tốc độ giảm < 10 FPS → cảnh báo EDGE_AI_DEGRADED                   | Bắt buộc |
| THREAT-FR-011 | Phát hiện bơm nước cạn (pump running dry): relay ON nhưng humidity không tăng sau 5 phút → cảnh báo PUMP_DRY           | Bắt buộc |
| THREAT-FR-012 | Phát hiện mất điện: Watchdog cứng phát hiện reset không mong muốn → ESP32 publish POWER_OUTAGE alert khi khởi động lại | Bắt buộc |

### 5.6. Module ALERT – Hệ thống Cảnh báo & Thông báo

| ID           | Yêu cầu                                                                                        | Mức độ   |
| ------------ | ---------------------------------------------------------------------------------------------- | -------- |
| ALERT-FR-001 | Alert Engine phân loại cảnh báo theo 4 mức: CRITICAL, HIGH, MEDIUM, LOW                        | Bắt buộc |
| ALERT-FR-002 | Gửi Push Notification qua Firebase FCM đến Mobile App (< 3 giây)                               | Bắt buộc |
| ALERT-FR-003 | Gửi Zalo ZNS (Zalo Notification Service) cho cảnh báo CRITICAL và HIGH                         | Bắt buộc |
| ALERT-FR-004 | Gửi SMS (Twilio/ESMS.vn) làm kênh dự phòng khi mạng kém                                        | Tùy chọn |
| ALERT-FR-005 | Farm Owner cấu hình kênh nhận thông báo (Push/Zalo/SMS) theo từng loại sự kiện                 | Bắt buộc |
| ALERT-FR-006 | Hỗ trợ "giờ im lặng" (Do Not Disturb): không gửi thông báo ngoại trừ CRITICAL                  | Bắt buộc |
| ALERT-FR-007 | Dashboard hiển thị Notification Center với lịch sử tất cả cảnh báo, trạng thái đã đọc/chưa đọc | Bắt buộc |
| ALERT-FR-008 | Cơ chế chống spam: Deduplication trong window 5 phút cho cùng loại sự kiện trên cùng zone      | Bắt buộc |
| ALERT-FR-009 | Farm Owner xác nhận (acknowledge) cảnh báo và ghi chú hành động đã xử lý                       | Bắt buộc |

### 5.7. Module ANALYTICS – Phân tích & Báo cáo

| ID               | Yêu cầu                                                                                                  | Mức độ   |
| ---------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| ANALYTICS-FR-001 | Dashboard hiển thị biểu đồ lịch sử telemetry môi trường theo khoảng thời gian: 1h, 6h, 24h, 7d, 30d      | Bắt buộc |
| ANALYTICS-FR-002 | Biểu đồ xu hướng đàn chim: entry/exit count theo ngày, return rate theo tuần                             | Bắt buộc |
| ANALYTICS-FR-003 | Báo cáo tương quan (Correlation Report) giữa điều kiện môi trường và return rate                         | Bắt buộc |
| ANALYTICS-FR-004 | Thống kê nest growth logging: chủ trang trại nhập liệu số lượng tổ thu hoạch, hệ thống hiển thị xu hướng | Bắt buộc |
| ANALYTICS-FR-005 | So sánh đa Zone trên cùng một màn hình (Multi-Zone Comparison)                                           | Bắt buộc |
| ANALYTICS-FR-006 | Export báo cáo dưới định dạng PDF và CSV                                                                 | Tùy chọn |
| ANALYTICS-FR-007 | Heatmap nhiệt độ/độ ẩm theo thời gian trong ngày (để phát hiện pattern)                                  | Tùy chọn |

### 5.8. Module MARKET – Đăng bán Yến & Truy xuất Nguồn gốc

#### 5.8.1. Quản lý Thu hoạch (Harvest Batch)

| ID            | Yêu cầu                                                                                                                                                            | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| MARKET-FR-001 | Farm Owner tạo **Harvest Batch** (đợt thu hoạch) ghi nhận: ngày thu hoạch, zone thu hoạch, số lượng tổ, trọng lượng (gram), loại yến (thô/tinh), ảnh chụp sản phẩm | Bắt buộc |
| MARKET-FR-002 | Hệ thống **tự động gắn kèm dữ liệu môi trường** (snapshot) tại thời điểm thu hoạch: nhiệt độ, độ ẩm, ánh sáng, NH3 trung bình 7 ngày trước thu hoạch               | Bắt buộc |
| MARKET-FR-003 | Hệ thống tự động gắn kèm **thông tin đàn chim**: return rate trung bình 30 ngày, tổng số chim ước tính tại zone thu hoạch                                          | Bắt buộc |
| MARKET-FR-004 | Mỗi Harvest Batch có mã truy xuất duy nhất (**Trace Code**) dạng UUID hoặc mã QR để người mua tra cứu                                                              | Bắt buộc |
| MARKET-FR-005 | Farm Owner có thể chỉnh sửa hoặc xóa mềm Harvest Batch trước khi đăng bán; sau khi đăng bán thì chỉ được cập nhật trạng thái                                       | Bắt buộc |

#### 5.8.2. Đăng bán & Marketplace

| ID            | Yêu cầu                                                                                                                                           | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| MARKET-FR-006 | Farm Owner tạo **Nest Listing** (tin đăng bán) từ một Harvest Batch: tiêu đề, mô tả, giá tham khảo, trạng thái (AVAILABLE / SOLD / HIDDEN)        | Bắt buộc |
| MARKET-FR-007 | Nest Listing hiển thị **thông tin truy xuất nguồn gốc công khai**: tên farm, zone, ngày thu hoạch, dữ liệu môi trường, ảnh sản phẩm               | Bắt buộc |
| MARKET-FR-008 | Buyer (không cần đăng nhập) có thể **xem danh sách Nest Listing công khai**, lọc theo loại yến, khu vực, khoảng giá                               | Bắt buộc |
| MARKET-FR-009 | Buyer xem chi tiết Listing → hiển thị **Traceability Card**: biểu đồ nhiệt độ/độ ẩm 7 ngày trước thu hoạch, return rate, thông tin farm           | Bắt buộc |
| MARKET-FR-010 | Buyer có thể **liên hệ Farm Owner** qua form liên hệ (gửi email/Zalo) hoặc số điện thoại (nếu Owner cho phép hiển thị)                            | Bắt buộc |
| MARKET-FR-011 | Buyer có thể **quét QR Code / nhập Trace Code** trên bao bì sản phẩm để tra cứu nguồn gốc lô yến đã mua                                           | Bắt buộc |
| MARKET-FR-012 | Farm Owner xem **thống kê lượt xem, lượt liên hệ** cho từng Listing                                                                               | Tùy chọn |
| MARKET-FR-013 | Hệ thống hiển thị **Farm Profile công khai**: tên farm, địa chỉ (cấp tỉnh/thành), số năm hoạt động, số lượng đàn chim, điểm môi trường trung bình | Tùy chọn |

---

## 6. Yêu cầu Phi chức năng

### 6.1. Hiệu năng (Performance)

| ID           | Yêu cầu                                                            | Mục tiêu                               |
| ------------ | ------------------------------------------------------------------ | -------------------------------------- |
| PERF-NFR-001 | Thời gian cập nhật telemetry lên dashboard                         | ≤ 2 giây (qua WebSocket)               |
| PERF-NFR-002 | Thời gian gửi Push Notification đến mobile sau khi event kích hoạt | ≤ 3–5 giây                             |
| PERF-NFR-003 | Thời gian phản hồi API REST (P95)                                  | ≤ 500ms                                |
| PERF-NFR-004 | Tốc độ inference AI model trên Raspberry Pi 4                      | ≥ 25 FPS                               |
| PERF-NFR-005 | ESP32 thực thi PID loop và publish MQTT                            | ≤ 100ms latency                        |
| PERF-NFR-006 | Backend chịu tải đồng thời                                         | ≥ 100 concurrent WebSocket connections |
| PERF-NFR-007 | Thời gian khởi động lại ESP32 sau mất điện và reconnect MQTT       | ≤ 30 giây                              |

### 6.2. Độ tin cậy & Khả năng phục hồi (Reliability & Resilience)

| ID          | Yêu cầu                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| REL-NFR-001 | ESP32 tiếp tục thực thi Closed-loop Control ngay cả khi mất Internet hoàn toàn                    |
| REL-NFR-002 | ESP32 có hardware watchdog timer; tự reset và reconnect khi firmware bị treo                      |
| REL-NFR-003 | ESP32 lưu buffer dữ liệu cảm biến cục bộ (SPIFFS/Flash) khi mất MQTT; upload khi kết nối phục hồi |
| REL-NFR-004 | Raspberry Pi tự khởi động lại process AI nếu crash (Supervisor/PM2 process manager)               |
| REL-NFR-005 | Hardware bypass switches cơ học cho phép điều khiển thủ công pump/quạt khi firmware lỗi hoàn toàn |
| REL-NFR-006 | Backend Backend deploy với ít nhất 2 instance (Load Balancer) để đảm bảo HA                       |
| REL-NFR-007 | Dữ liệu telemetry được backup tự động hàng ngày                                                   |

### 6.3. Khả năng mở rộng (Scalability)

| ID            | Yêu cầu                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| SCALE-NFR-001 | Kiến trúc backend hỗ trợ horizontal scaling (stateless services + Redis cache)    |
| SCALE-NFR-002 | MQTT Broker (EMQX) hỗ trợ ≥ 10,000 concurrent connections (production deployment) |
| SCALE-NFR-003 | Một Farm Owner có thể quản lý tối đa 10 Houses và 50 Zones                        |
| SCALE-NFR-004 | Hệ thống hỗ trợ thêm loại cảm biến mới mà không cần thay đổi kiến trúc core       |

### 6.4. Bảo mật (Security)

| ID          | Yêu cầu                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| SEC-NFR-001 | Giao tiếp MQTT giữa Edge và Cloud sử dụng TLS 1.2+ và MQTT Authentication                    |
| SEC-NFR-002 | API REST sử dụng HTTPS (TLS 1.3); mọi endpoint được bảo vệ bởi JWT                           |
| SEC-NFR-003 | Mật khẩu lưu trữ bằng bcrypt (cost factor ≥ 12)                                              |
| SEC-NFR-004 | Rate limiting: ≤ 100 request/phút cho authenticated endpoints                                |
| SEC-NFR-005 | Device Authentication: ESP32 và RPi xác thực bằng Device Certificate khi connect MQTT Broker |
| SEC-NFR-006 | S3 bucket không public; snapshot images chỉ truy cập qua Presigned URL (TTL 15 phút)         |

### 6.5. Khả dụng (Usability)

| ID         | Yêu cầu                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| UX-NFR-001 | Web App hỗ trợ responsive design trên desktop (1920×1080), tablet (768px+) và mobile (≥ 375px) |
| UX-NFR-002 | Mobile PWA cài được trên iOS 16.4+ (Safari Add to Home Screen) và Android 9+ (Chrome)          |
| UX-NFR-003 | PWA hoạt động offline với Service Worker cache cho các màn hình dashboard chính                |
| UX-NFR-004 | Giao diện hỗ trợ tiếng Việt là ngôn ngữ mặc định; tùy chọn tiếng Anh                           |
| UX-NFR-005 | Onboarding thiết bị mới qua QR Code hoàn thành trong < 3 phút                                  |
| UX-NFR-006 | Dashboard load time (LCP) ≤ 3 giây trên 4G                                                     |
| UX-NFR-007 | PWA Lighthouse score: Performance ≥ 80, PWA ≥ 90                                               |

### 6.6. Chi phí & Hiệu quả

| ID           | Yêu cầu                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| COST-NFR-001 | Tổng chi phí phần cứng prototype ≤ 10.450.000 VNĐ (theo BOM v1.3 – linh kiện cập nhật 2026)                           |
| COST-NFR-002 | Edge AI ưu tiên xử lý cục bộ trên RPi; chỉ upload snapshots + metadata lên cloud (không stream video liên tục qua 4G) |
| COST-NFR-003 | Dữ liệu telemetry gửi lên cloud ở dạng JSON compact; tần suất tối đa 1 message/10 giây                                |

---

## 7. Đặc tả Phần cứng & BOM

### 7.1. Hardware Bill of Materials (BOM)

> **BOM v1.1** – Nâng cấp toàn bộ cảm biến và relay sang chuẩn **RS485 Modbus RTU** (IP65–IP67) để lắp đặt trực tiếp trong nhà yến. Tất cả sensor và relay kết nối qua một bus RS485 chung (daisy-chain), chỉ cần 2 dây tín hiệu A/B.

| STT | Thiết bị                                                  | Thông số Kỹ thuật                                                                             | SL   | Đơn giá (VNĐ) | Thành tiền (VNĐ) | Vai trò                                          |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- | ------------- | ---------------- | ------------------------------------------------ |
| 1   | Router 4G LTE                                             | Cat 4, 150Mbps, 2 Anten 5dBi, 3 LAN + Wi-Fi                                                   | 1    | 650.000       | 650.000          | Internet gateway, Local LAN/Wi-Fi                |
| 2   | Camera IP PoE 4MP Starlight                               | Hikvision/Dahua 4MP 2K, Smart IR 30m, RTSP                                                    | 1    | 1.350.000     | 1.350.000        | AI Vision source, High-FPS bird capture          |
| 3   | Raspberry Pi 4 (4GB)                                      | Quad-core 1.5GHz, 4GB RAM, Gigabit LAN                                                        | 1    | 1.850.000     | 1.850.000        | Edge AI Hub, YOLOv8 inference                    |
| 4   | MicroSD 64GB                                              | SanDisk Extreme U3 A2, 160MB/s                                                                | 1    | 220.000       | 220.000          | OS Linux, local dataset storage                  |
| 5   | Switch PoE 4 Cổng                                         | 4× PoE 48V + 2× Uplink 100Mbps                                                                | 1    | 380.000       | 380.000          | Power + data cho IP Camera                       |
| 6   | ESP32-WROOM-32D                                           | Dual-Core 240MHz, 38 pins, Wi-Fi+BT                                                           | 1    | 85.000        | 85.000           | MCU: Modbus Master, PID, MQTT                    |
| 7   | **Cảm biến Nhiệt Ẩm RS485 (chip SHT30)**                  | **IP67, RS485 Modbus RTU, 5–36VDC, PTFE filter, ±0.3°C / ±2%RH**                              | 1    | 350.000       | 350.000          | Nhiệt độ + độ ẩm chính xác cao, chống ẩm nhà yến |
| 8   | **Cảm biến Ánh sáng RS485**                               | **IP65/IP68, RS485 Modbus RTU, 0–200.000 Lux, 5–32VDC** (DFRobot SEN0644 hoặc t.đương)        | 1    | 380.000       | 380.000          | Giám sát ánh sáng buồng yến, chống nước          |
| 9   | **Cảm biến Đa khí RS485 4-in-1 (Electrochemical + NDIR)** | **IP65, RS485 Modbus RTU, 10–30VDC, đo đồng thời 4 loại khí:**                                | 1    | 2.000.000     | 2.000.000        | Phân loại đầy đủ 4 loại khí trong nhà yến        |
|     |                                                           | **• NH3 0–500ppm (Electrochemical, ±3%)**                                                     |      |               |                  | NH3: phân chim, vi sinh vật                      |
|     |                                                           | **• H2S 0–100ppm (Electrochemical, ±3%)**                                                     |      |               |                  | H2S: phân hủy chất hữu cơ                        |
|     |                                                           | **• CO2 0–5000ppm (NDIR, ±50ppm)**                                                            |      |               |                  | CO2: hô hấp chim, thông khí                      |
|     |                                                           | **• TVOC 0–60.000ppb (MOS, ±15%)**                                                            |      |               |                  | TVOC: chất lượng không khí tổng hợp              |
| 10  | **Cảm biến Tiếng ồn RS485 (Noise dB Sensor)**             | **IP65, RS485 Modbus RTU, 30–130dB, A-weighting, 10–30VDC**                                   | 1    | 650.000       | 650.000          | Đo dB phát hiện sự cố loa/chim hoảng loạn        |
| 11  | **Cảm biến Nhiệt Ẩm Ngoài trời RS485**                    | **IP67, RS485 Modbus RTU, -40~80°C, 0~100%RH, 5–36VDC**                                       | 1    | 350.000       | 350.000          | Đối chứng nhiệt ẩm ngoài trời                    |
| 12  | **Waveshare Industrial Modbus RTU 4-ch Relay**            | **RS485 Modbus RTU, 7–36VDC, 30A/250VAC, cách ly ADI + optocoupler, TVS chống sét, DIN Rail** | 1    | 1.200.000     | 1.200.000        | Đóng ngắt bơm, quạt, sưởi – cách ly công nghiệp  |
| 13  | **Module MAX485 Auto Direction (TTL↔RS485)**              | **Auto DE/RE, 5V, tốc độ lên đến 2.5Mbps**                                                    | 1    | 50.000        | 50.000           | Chuyển đổi UART ESP32 ↔ Bus RS485                |
| 14  | Hệ thống Phun sương                                       | Bơm mini 12V DC / Vỉ siêu âm                                                                  | 1    | 95.000        | 95.000           | Actuator tăng ẩm                                 |
| 15  | Quạt Thông gió 12V 120mm                                  | DC 12V, lưu lượng lớn                                                                         | 1    | 45.000        | 45.000           | Actuator giảm nhiệt, xả khí                      |
| 16  | Hệ thống Sưởi nhiệt 12V                                   | 25W–50W, 12V                                                                                  | 1    | 35.000        | 35.000           | Actuator sưởi ấm                                 |
| 17  | Nguồn 12V 10A (120W)                                      | AC-DC 220V → 12V ổn định                                                                      | 1    | 165.000       | 165.000          | Nguồn tổng cho toàn hệ thống                     |
| 18  | Mạch Buck LM2596                                          | 12V → 5V 3A (2 mạch)                                                                          | 2    | 25.000        | 50.000           | Hạ áp cho RPi, ESP32                             |
| 19  | Hộp IP65 + Phụ kiện                                       | ABS 25×18cm, domino, bypass switch, DIN Rail                                                  | 1 bộ | 200.000       | 200.000          | Vỏ bảo vệ chống ẩm + thanh ray lắp relay         |
|     | **TỔNG**                                                  | **19 hạng mục**                                                                               |      |               | **10.450.000**   |                                                  |

> **Ghi chú BOM v1.3:**
>
> - Tất cả cảm biến (STT 7–11) và relay (STT 12) sử dụng chuẩn **RS485 Modbus RTU**, kết nối daisy-chain trên 1 bus chung qua module MAX485 (STT 13)
> - Cảm biến đều có vỏ bảo vệ **IP65–IP67**, phù hợp lắp đặt trực tiếp trong nhà yến ẩm ướt
> - Cảm biến nhiệt ẩm dùng **Sensirion SHT40** (4th Gen, ±0.2°C) thay SHT30 (3rd Gen) → chính xác hơn, tiết kiệm năng lượng hơn
> - Cảm biến đa khí 4-in-1 (STT 9) kết hợp **Electrochemical** (NH3, H2S) + **NDIR** (CO2) + **MOS** (TVOC) → đo đồng thời 4 loại khí, mỗi loại dùng công nghệ phù hợp nhất
> - MCU nâng cấp lên **ESP32-S3** (AI vector instructions, USB OTG, BLE 5) thay ESP32 WROOM-32D
> - Edge AI nâng cấp lên **Raspberry Pi 5** (Cortex-A76, PCIe, 2–3x nhanh hơn RPi 4)
> - Relay công nghiệp Waveshare có **bảo vệ cách ly, TVS chống sét**, an toàn cho môi trường nhà yến
> - So với BOM v1.0 (5.410.000₫), chi phí tăng thêm 5.040.000₫ nhưng chất lượng, hiệu năng, và độ bao phủ dữ liệu tăng đáng kể
>
> **Sơ đồ đấu nối RS485 Bus:**
>
> ```
> [ESP32-S3] --UART2--> [MAX485] --A/B--> [SHT40 Addr1] -- [Lux Addr2] -- [MultiGas Addr3] -- [dB Addr4] -- [SHT40-Out Addr5] -- [Relay Addr6] -- [120Ω Term]
> ```

### 7.2. Yêu cầu ESP32 Firmware

- Framework: Arduino (PlatformIO) hoặc ESP-IDF v5.x với FreeRTOS
- Các task chạy song song: **Modbus Polling Task**, PID Control Task, MQTT Publish Task, OTA Update Task
- **Giao tiếp cảm biến:** RS485 Modbus RTU Master qua UART2 (GPIO16 RX, GPIO17 TX) + Module MAX485 Auto Direction
- **Modbus Library:** `ModbusMaster` (Arduino) hoặc `eModbus` (ESP32-native, non-blocking)
- **Sensor polling:** Đọc lần lượt các cảm biến qua Modbus Function Code 0x03 (Read Holding Registers) / 0x04 (Read Input Registers), chu kỳ 10 giây (cấu hình được 5–60s)
- **Relay control:** Ghi lệnh relay qua Modbus Function Code 0x05 (Write Single Coil) / 0x06 (Write Single Register)
- **Bus config:** Baud rate 9600 bps, 8N1, Sensor addresses 1–5, Relay address 6
- **Sensor Addr 3 (Multi-gas):** Đọc 4 register liên tiếp: NH3 (ppm), H2S (ppm), CO2 (ppm), TVOC (ppb)
- Protocol: MQTT over TLS (port 8883), QoS Level 1
- Local storage: NVS (Non-Volatile Storage) cho config; SPIFFS cho buffer telemetry offline
- Hardware Watchdog Timer: timeout 30 giây

### 7.3. Yêu cầu Raspberry Pi Edge Node

- OS: Raspberry Pi OS Lite 64-bit (Bullseye/Bookworm)
- Runtime: Python 3.10+, OpenCV 4.8+
- AI Framework: ONNX Runtime / NCNN
- Process Manager: PM2 hoặc Supervisor để auto-restart
- Camera Input: RTSP stream từ IP Camera PoE qua Gigabit LAN

### 7.4. Yêu cầu Backend (Node.js + Express)

- Runtime: Node.js 20 LTS (LTS), JavaScript/TypeScript
- Framework: Express.js 4.x
- Middleware: `express-validator` (input validation), `helmet` (security headers), `cors`, `morgan` (logging)
- WebSocket: `socket.io` (realtime dashboard updates)
- MQTT Client: `mqttjs/mqtt.js` (subscribe telemetry từ Broker)
- ORM/ODM: Mongoose (MongoDB)
- Auth: `jsonwebtoken` + `bcryptjs`
- Process Manager: PM2 (cluster mode)
- Testing: Jest + Supertest

### 7.5. Yêu cầu Frontend (ReactJS + PWA)

- Build tool: Vite 5+
- Framework: React 18+, React Router v6
- Styling: TailwindCSS 3+
- State Management: Zustand hoặc React Query (server state)
- Charts: Chart.js + react-chartjs-2
- Realtime: socket.io-client
- PWA: Vite PWA plugin (`vite-plugin-pwa`), Service Worker, Web Push API
- UI Components: shadcn/ui hoặc Headless UI
- HTTP Client: Axios
- Build output: Static files deploy lên Nginx / Vercel / Cloudflare Pages

---

## 8. Mô hình Dữ liệu

### 8.1. Entity Relationship (Tổng quan)

```
User (1) ──< FarmMembership >── (N) Farm
Farm (1) ──< (N) House
House (1) ──< (N) Zone
Zone (1) ──< (N) SensorNode (ESP32)
Zone (1) ──< (N) CameraNode (RPi)
SensorNode (1) ──< (N) TelemetryRecord
CameraNode (1) ──< (N) BirdCountRecord
Zone (1) ──< (N) Alert
Alert (1) ──< (N) AlertAcknowledgement
Farm (1) ──< (N) HarvestBatch
HarvestBatch (1) ──< (1) NestListing
NestListing (1) ──< (N) ContactInquiry (from Buyer)
```

### 8.2. Schema Chi tiết (MongoDB Collections)

#### `users`

```json
{
  "_id": "ObjectId",
  "email": "string (unique, indexed)",
  "phone": "string",
  "password_hash": "string (bcrypt)",
  "full_name": "string",
  "role": "enum: ADMIN | FARM_OWNER | OPERATOR",
  "avatar_url": "string",
  "notification_preferences": {
    "push": true,
    "zalo": true,
    "sms": false,
    "quiet_hours": { "start": "22:00", "end": "06:00" }
  },
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "is_active": "boolean"
}
```

#### `farms`

```json
{
  "_id": "ObjectId",
  "name": "string",
  "address": "string",
  "coordinates": { "lat": "number", "lng": "number" },
  "owner_id": "ObjectId (ref: users)",
  "members": [
    { "user_id": "ObjectId", "role": "OPERATOR", "joined_at": "ISODate" }
  ],
  "created_at": "ISODate",
  "is_deleted": "boolean"
}
```

#### `houses`

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "name": "string",
  "floors": "number",
  "description": "string",
  "created_at": "ISODate"
}
```

#### `zones`

```json
{
  "_id": "ObjectId",
  "house_id": "ObjectId (ref: houses)",
  "name": "string",
  "floor": "number",
  "thresholds": {
    "temp_min": 26.0,
    "temp_max": 31.0,
    "humidity_min": 75.0,
    "humidity_max": 95.0,
    "light_max": 0.2,
    "co2_max": 1500
  },
  "created_at": "ISODate"
}
```

#### `sensor_nodes`

```json
{
  "_id": "ObjectId",
  "device_id": "string (unique, hardware MAC-based)",
  "zone_id": "ObjectId (ref: zones)",
  "firmware_version": "string",
  "last_heartbeat": "ISODate",
  "status": "enum: ONLINE | OFFLINE | ERROR",
  "rssi": "number (dBm)",
  "relay_states": {
    "misting": "boolean",
    "ventilation": "boolean",
    "heating": "boolean",
    "light": "boolean"
  },
  "control_mode": "enum: AUTO | MANUAL",
  "registered_at": "ISODate"
}
```

#### `telemetry` (Time-series, heavy write)

```json
{
  "_id": "ObjectId",
  "node_id": "ObjectId (ref: sensor_nodes)",
  "zone_id": "ObjectId",
  "timestamp": "ISODate (indexed, TTL: 1 year)",
  "temperature": "number",
  "humidity": "number",
  "light_lux": "number",
  "nh3_ppm": "number",
  "h2s_ppm": "number",
  "co2_ppm": "number",
  "tvoc_ppb": "number",
  "sound_db": "number",
  "is_anomaly": "boolean"
}
```

#### `bird_count_records`

```json
{
  "_id": "ObjectId",
  "camera_node_id": "ObjectId (ref: camera_nodes)",
  "zone_id": "ObjectId",
  "timestamp": "ISODate",
  "session_type": "enum: MORNING_EXIT | EVENING_ENTRY",
  "entry_count": "number",
  "exit_count": "number",
  "return_rate": "number (percentage)",
  "confidence_avg": "number"
}
```

#### `alerts`

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId",
  "zone_id": "ObjectId (nullable)",
  "node_id": "ObjectId (nullable)",
  "type": "enum: THRESHOLD_BREACH | PREDATOR_DETECTED | NODE_OFFLINE | SPEAKER_FAILURE | PUMP_DRY | BIRD_PANIC | POWER_OUTAGE | LOW_RETURN_RATE",
  "severity": "enum: CRITICAL | HIGH | MEDIUM | LOW",
  "title": "string",
  "message": "string",
  "snapshot_url": "string (nullable, S3 presigned)",
  "metadata": "object",
  "status": "enum: ACTIVE | ACKNOWLEDGED | RESOLVED",
  "created_at": "ISODate",
  "acknowledged_at": "ISODate",
  "acknowledged_by": "ObjectId (ref: users)",
  "acknowledgement_note": "string"
}
```

#### `harvest_batches`

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "zone_id": "ObjectId (ref: zones)",
  "created_by": "ObjectId (ref: users)",
  "trace_code": "string (unique, UUID v4 – mã truy xuất nguồn gốc)",
  "harvest_date": "ISODate",
  "nest_count": "number",
  "weight_grams": "number",
  "nest_type": "enum: RAW | CLEANED | PREMIUM",
  "product_images": ["string (S3 URLs)"],
  "env_snapshot": {
    "avg_temperature": "number (7d avg before harvest)",
    "avg_humidity": "number (7d avg)",
    "avg_light_lux": "number (7d avg)",
    "avg_nh3_ppm": "number (7d avg)",
    "avg_h2s_ppm": "number (7d avg)",
    "avg_co2_ppm": "number (7d avg)",
    "avg_tvoc_ppb": "number (7d avg)",
    "telemetry_range": { "from": "ISODate", "to": "ISODate" }
  },
  "flock_snapshot": {
    "avg_return_rate_30d": "number (percentage)",
    "estimated_population": "number"
  },
  "status": "enum: DRAFT | LISTED | ARCHIVED",
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "is_deleted": "boolean"
}
```

#### `nest_listings`

```json
{
  "_id": "ObjectId",
  "harvest_batch_id": "ObjectId (ref: harvest_batches)",
  "farm_id": "ObjectId (ref: farms)",
  "title": "string",
  "description": "string",
  "price_vnd": "number (nullable – giá tham khảo)",
  "price_unit": "string (e.g., 'gram', 'tổ', 'kg')",
  "listing_status": "enum: AVAILABLE | SOLD | HIDDEN",
  "contact_info": {
    "show_phone": "boolean",
    "show_email": "boolean",
    "show_zalo": "boolean"
  },
  "view_count": "number",
  "inquiry_count": "number",
  "published_at": "ISODate",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

#### `contact_inquiries`

```json
{
  "_id": "ObjectId",
  "listing_id": "ObjectId (ref: nest_listings)",
  "buyer_name": "string",
  "buyer_phone": "string (nullable)",
  "buyer_email": "string (nullable)",
  "message": "string",
  "created_at": "ISODate",
  "is_read": "boolean"
}
```

---

## 9. Đặc tả Giao diện & API

### 9.1. REST API Endpoints (Node.js + Express)

#### Authentication

| Method | Endpoint           | Mô tả                        | Auth          |
| ------ | ------------------ | ---------------------------- | ------------- |
| POST   | `/auth/register`   | Đăng ký tài khoản            | Public        |
| POST   | `/auth/login`      | Đăng nhập, trả JWT           | Public        |
| POST   | `/auth/refresh`    | Làm mới Access Token         | Refresh Token |
| POST   | `/auth/logout`     | Thu hồi Refresh Token        | JWT           |
| POST   | `/auth/otp/send`   | Gửi OTP xác thực email/phone | Public        |
| POST   | `/auth/otp/verify` | Xác thực OTP                 | Public        |

#### Farms

| Method | Endpoint             | Mô tả                   | Auth        |
| ------ | -------------------- | ----------------------- | ----------- |
| GET    | `/farms`             | Danh sách farm của user | JWT         |
| POST   | `/farms`             | Tạo farm mới            | JWT (OWNER) |
| GET    | `/farms/:id`         | Chi tiết farm           | JWT         |
| PUT    | `/farms/:id`         | Cập nhật farm           | JWT (OWNER) |
| DELETE | `/farms/:id`         | Xóa mềm farm            | JWT (OWNER) |
| POST   | `/farms/:id/members` | Mời thành viên          | JWT (OWNER) |

#### Devices

| Method | Endpoint                               | Mô tả                  | Auth |
| ------ | -------------------------------------- | ---------------------- | ---- |
| POST   | `/devices/sensor-nodes/register`       | Đăng ký ESP32 node     | JWT  |
| GET    | `/devices/sensor-nodes`                | Danh sách ESP32 nodes  | JWT  |
| PUT    | `/devices/sensor-nodes/:id/thresholds` | Cập nhật ngưỡng        | JWT  |
| POST   | `/devices/sensor-nodes/:id/relay`      | Điều khiển relay       | JWT  |
| GET    | `/devices/camera-nodes`                | Danh sách Camera nodes | JWT  |

#### Telemetry & Analytics

| Method | Endpoint                       | Mô tả                                | Auth |
| ------ | ------------------------------ | ------------------------------------ | ---- |
| GET    | `/telemetry/zones/:id/latest`  | Giá trị cảm biến mới nhất            | JWT  |
| GET    | `/telemetry/zones/:id/history` | Lịch sử (query: from, to, interval)  | JWT  |
| GET    | `/analytics/bird-count/daily`  | Thống kê đếm chim hàng ngày          | JWT  |
| GET    | `/analytics/bird-count/trends` | Xu hướng đàn chim                    | JWT  |
| GET    | `/analytics/correlation`       | Tương quan môi trường vs return rate | JWT  |

#### Alerts

| Method | Endpoint                  | Mô tả                                      | Auth |
| ------ | ------------------------- | ------------------------------------------ | ---- |
| GET    | `/alerts`                 | Danh sách cảnh báo (có phân trang, filter) | JWT  |
| GET    | `/alerts/:id`             | Chi tiết cảnh báo                          | JWT  |
| PUT    | `/alerts/:id/acknowledge` | Xác nhận cảnh báo                          | JWT  |

#### Harvest & Marketplace

| Method | Endpoint                              | Mô tả                                                    | Auth        |
| ------ | ------------------------------------- | -------------------------------------------------------- | ----------- |
| POST   | `/harvests`                           | Tạo Harvest Batch mới (auto-attach env + flock snapshot) | JWT (OWNER) |
| GET    | `/harvests`                           | Danh sách Harvest Batch của farm                         | JWT (OWNER) |
| GET    | `/harvests/:id`                       | Chi tiết Harvest Batch                                   | JWT (OWNER) |
| PUT    | `/harvests/:id`                       | Cập nhật Harvest Batch (chỉ khi DRAFT)                   | JWT (OWNER) |
| DELETE | `/harvests/:id`                       | Xóa mềm Harvest Batch                                    | JWT (OWNER) |
| POST   | `/marketplace/listings`               | Tạo Nest Listing từ Harvest Batch                        | JWT (OWNER) |
| GET    | `/marketplace/listings`               | Danh sách Listing công khai (có filter, phân trang)      | **Public**  |
| GET    | `/marketplace/listings/:id`           | Chi tiết Listing + Traceability Card                     | **Public**  |
| PUT    | `/marketplace/listings/:id`           | Cập nhật Listing (trạng thái, giá, mô tả)                | JWT (OWNER) |
| GET    | `/marketplace/trace/:traceCode`       | Tra cứu nguồn gốc lô yến qua Trace Code / QR             | **Public**  |
| POST   | `/marketplace/listings/:id/inquiries` | Buyer gửi form liên hệ                                   | **Public**  |
| GET    | `/marketplace/listings/:id/inquiries` | Owner xem danh sách liên hệ                              | JWT (OWNER) |
| GET    | `/marketplace/listings/:id/stats`     | Thống kê lượt xem, lượt liên hệ                          | JWT (OWNER) |
| GET    | `/marketplace/farms/:id/profile`      | Farm Profile công khai                                   | **Public**  |

### 9.2. MQTT Topic Schema

```
# Telemetry từ ESP32 lên Cloud
swiftletcare/{farmId}/{houseId}/{zoneId}/telemetry
swiftletcare/{farmId}/{houseId}/{zoneId}/relay/status
swiftletcare/{farmId}/{houseId}/{zoneId}/heartbeat

# Lệnh từ Cloud xuống ESP32
swiftletcare/{farmId}/{houseId}/{zoneId}/relay/command
swiftletcare/{farmId}/{houseId}/{zoneId}/config/update

# Từ Raspberry Pi Edge AI
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/bird-count
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/alert
swiftletcare/{farmId}/{houseId}/{zoneId}/vision/heartbeat

# QoS Level:
# - Telemetry: QoS 0 (best effort, high frequency)
# - Commands/Config: QoS 1 (at-least-once)
# - Alerts/Heartbeat: QoS 1
```

### 9.3. WebSocket Events (Socket.io)

```
# Client subscribe
JOIN_ZONE: { zoneId }

# Server emit
TELEMETRY_UPDATE: { zoneId, temperature, humidity, light, nh3, h2s, co2, tvoc, sound, timestamp }
RELAY_UPDATE: { zoneId, relayName, state, mode }
BIRD_COUNT_UPDATE: { zoneId, entryCount, exitCount, sessionType, timestamp }
ALERT_NEW: { alertId, severity, type, title, message, snapshotUrl }
DEVICE_STATUS_CHANGE: { nodeId, status, timestamp }
```

---

## 10. Luồng Xử lý Nghiệp vụ (Flows)

### Flow 1: Onboarding Thiết bị (QR Code Provisioning)

```
1. Farm Owner mở Mobile App → chọn "Thêm thiết bị"
2. App hiển thị màn hình quét QR
3. Quét QR Code trên vỏ ESP32 → App decode: {deviceId, deviceType, secretKey}
4. App gửi POST /devices/register với {deviceId, secretKey, zoneId}
5. Backend tạo device record, trả về {mqttCredentials: {username, password, broker}}
6. App hiển thị WiFi credential → Owner nhập vào ESP32 qua BLE hoặc AP mode
7. ESP32 kết nối WiFi → kết nối MQTT Broker với credentials nhận được
8. ESP32 gửi heartbeat đầu tiên → Backend cập nhật status ONLINE
9. App hiển thị "Thiết bị đã kết nối thành công" ✓
```

### Flow 2: Closed-loop Environmental Control

```
1. ESP32 đọc SHT31 mỗi 10 giây: temp=32.5°C, humidity=71%
2. Humidity (71%) < threshold_min (75%) → PID tính output
3. ESP32 bật Relay Misting (Relay #1 ON)
4. Publish MQTT: {relay: "misting", state: ON, trigger: "AUTO_PID", timestamp}
5. Backend nhận → cập nhật relay_states trong DB
6. WebSocket emit → Dashboard hiển thị icon bơm đang chạy
7. Sau 3 phút: humidity=76% > threshold_min → PID giảm output → Relay OFF
8. Nếu sau 5 phút humidity không tăng → Alert: PUMP_DRY (MEDIUM)
```

### Flow 3: Swiftlet Counting Session (Evening Return)

```
1. 17:30 - RPi bắt đầu "Evening Session" mode (tăng độ nhạy detection)
2. Camera stream RTSP → RPi decode frame @ 30FPS
3. YOLOv8 detect: [{class: "swiftlet", bbox: [x,y,w,h], conf: 0.92}]
4. ByteTrack assign Track ID: track_id=15
5. Frame t+1: track_id=15 vượt qua crossing line → direction: INWARD
6. Increment entry_count: 1547
7. Mỗi 30 giây publish MQTT: {sessionType: "EVENING_ENTRY", entryCount: 1547, exitCount: 0}
8. 19:00 - RPi kết thúc session → compute return_rate = 1547/1823 = 84.8%
9. Publish summary → Backend lưu BirdCountRecord
10. Dashboard cập nhật biểu đồ xu hướng
```

### Flow 4: Predator Intrusion Detection

```
1. RPi frame inference: [{class: "snake", bbox: [...], conf: 0.87}]
2. Temporal filter: snake detected trong 3 frame liên tiếp (frame 101, 102, 103)
3. Confirm detection → Capture frame 102 (bounding box overlay)
4. Upload snapshot JPEG lên S3/MinIO → nhận presigned URL (TTL: 7 ngày)
5. Publish MQTT Alert: {type: PREDATOR_DETECTED, class: "snake", severity: CRITICAL, snapshotUrl}
6. Alert Engine nhận → tạo Alert record trong DB
7. Gửi đa kênh đồng thời:
   - Firebase FCM Push: "🚨 Phát hiện RẮN tại Nhà Yến A - Tầng 2!" + ảnh
   - Zalo ZNS: Template "Cảnh báo khẩn: Thiên địch xâm nhập" + URL ảnh
8. Dashboard alert badge: +1 CRITICAL
9. Farm Owner nhận notification → mở app → xem ảnh → acknowledge + ghi chú "Đã xử lý"
```

### Flow 5: Alert khi Loa dẫn dụ Hỏng

```
1. MAX9814 liên tục đọc biên độ âm thanh: baseline ~65dB (loa đang phát)
2. Giá trị đột ngột: ~12dB (giảm >80%)
3. ESP32 phân tích: amplitude_drop > 70% trong 30 giây liên tục
4. Publish Alert MQTT: {type: SPEAKER_FAILURE, severity: HIGH, soundDb: 12}
5. Alert Engine → Push Notification: "⚠️ Nghi ngờ hỏng loa dẫn dụ - Kiểm tra ngay"
```

### Flow 6: Dashboard Multi-Zone Analytics

```
1. Farm Owner mở Dashboard Web → chọn Tab "Phân tích"
2. GET /analytics/bird-count/trends?farmId=X&range=30d
3. Backend aggregate từ bird_count_records → tính return_rate theo ngày
4. Chart.js hiển thị line chart: return_rate 30 ngày
5. Phát hiện ngày 15/10 return_rate = 62% (giảm mạnh)
6. Owner click vào điểm → Detail panel hiển thị env data ngày đó: temp_max=33.2°C
7. Correlation insight: "Ngày có nhiệt độ > 32°C, return rate giảm trung bình 18%"
```

### Flow 7: Đăng bán Yến với Truy xuất Nguồn gốc

```
1. Farm Owner mở Dashboard → chọn Tab "Thu hoạch" → click "Tạo đợt thu hoạch mới"
2. Nhập thông tin: ngày thu hoạch, zone, số lượng tổ, trọng lượng, loại yến, upload ảnh sản phẩm
3. POST /harvests → Backend tự động:
   a. Query telemetry 7 ngày trước harvest_date tại zone → tính avg temp, humidity, light, NH3
   b. Query bird_count_records 30 ngày → tính avg return_rate, estimated population
   c. Gắn env_snapshot + flock_snapshot vào Harvest Batch
   d. Sinh trace_code (UUID v4) + QR Code image
4. Owner xem lại Harvest Batch (trạng thái: DRAFT) → kiểm tra dữ liệu
5. Owner click "Đăng bán" → nhập tiêu đề, mô tả, giá tham khảo → POST /marketplace/listings
6. Listing xuất hiện trên trang Marketplace công khai (status: AVAILABLE)
7. Buyer truy cập Marketplace → lọc theo loại yến, khu vực → xem danh sách Listing
8. Buyer click vào Listing → hiển thị Traceability Card:
   - Thông tin farm (tên, tỉnh/thành, năm hoạt động)
   - Biểu đồ nhiệt độ/độ ẩm 7 ngày trước thu hoạch
   - Return rate trung bình 30 ngày, số lượng đàn chim
   - Ảnh sản phẩm, ngày thu hoạch, loại yến
9. Buyer gửi liên hệ qua form → Farm Owner nhận notification
10. Sau khi bán xong → Owner cập nhật Listing status: SOLD
11. Buyer nhận sản phẩm → quét QR Code trên bao bì → GET /marketplace/trace/:traceCode
    → Hiển thị đầy đủ thông tin nguồn gốc lô yến đã mua
```

---

## 11. Yêu cầu AI / Computer Vision

### 11.1. Dataset Requirements

| Thông số             | Giá trị                                      |
| -------------------- | -------------------------------------------- |
| Classes              | swiftlet, rat, snake, owl (4 classes)        |
| Tổng số ảnh mục tiêu | ≥ 5.000 images (sau augmentation)            |
| Tỉ lệ split          | Train 70% / Val 15% / Test 15%               |
| Annotation format    | YOLO format (normalized bounding boxes)      |
| Annotation tool      | Roboflow / CVAT                              |
| Augmentation         | Flip H/V, Brightness ±30%, Blur, Noise, Crop |

### 11.2. Model Specifications

| Thông số                     | Giá trị Mục tiêu                       |
| ---------------------------- | -------------------------------------- |
| Base Model                   | YOLOv8n / YOLOv10n (nano, lightweight) |
| Input Resolution             | 640×640                                |
| mAP@0.5 (test set)           | ≥ 75%                                  |
| Precision (swiftlet class)   | ≥ 80%                                  |
| Recall (swiftlet class)      | ≥ 80%                                  |
| Inference speed (RPi 4 ONNX) | ≥ 25 FPS                               |
| Model format deployment      | ONNX hoặc NCNN (quantized INT8)        |
| Model size                   | ≤ 20MB (sau quantization)              |

### 11.3. Tracking Algorithm

| Thông số                 | Giá trị                                   |
| ------------------------ | ----------------------------------------- |
| Tracker                  | ByteTrack (primary) / DeepSORT (fallback) |
| Counting method          | Virtual line crossing (bi-directional)    |
| Max tracks active        | 50 concurrent                             |
| Track confirmation       | ≥ 3 consecutive frames                    |
| False positive reduction | Temporal filtering: 3/5 frames confirm    |

### 11.4. Training Pipeline

```
1. Thu thập video từ IP Camera (RTSP → RPi ghi ra MicroSD)
2. Lọc frame có chuyển động (Motion Detection) → tiết kiệm 80% disk
3. Upload lên Roboflow → annotation bounding box 4 classes
4. Augmentation: random flip, brightness, blur, mosaic
5. Train YOLOv8n trên Kaggle T4 GPU (~2 giờ/100 epochs)
6. Evaluate: mAP, Precision, Recall, Confusion Matrix
7. Export → ONNX → quantize INT8 → test trên RPi
8. Nếu FPS < 25: dùng NCNN hoặc giảm input resolution xuống 480×480
```

---

## 12. Yêu cầu Bảo mật

### 12.1. Authentication & Authorization

- JWT Secret: HS256, key ≥ 256-bit, rotate định kỳ
- Access Token TTL: 15 phút; Refresh Token TTL: 30 ngày
- Role-based access control (RBAC) áp dụng ở middleware level
- API Gateway validate JWT trước khi route đến service

### 12.2. IoT Security

- MQTT: TLS 1.2+, Certificate-based device authentication
- Mỗi device có client certificate riêng (X.509)
- Device certificate bị revoke khi device bị gỡ khỏi hệ thống
- MQTT ACL: device chỉ được publish/subscribe topic của chính nó

### 12.3. Data Security

- Password: bcrypt, cost=12
- PII (email, phone): không log ra stdout; masked trong audit logs
- S3 snapshot: private bucket; truy cập qua Presigned URL TTL 15 phút
- Database: connection string, API keys lưu trong environment variables / secrets manager

### 12.4. Input Validation

- Tất cả REST API inputs được validate bằng class-validator (NestJS)
- MQTT payload được schema-validate trước khi xử lý
- File upload (nếu có): validate MIME type, giới hạn 10MB

---

## 13. Kế hoạch Kiểm thử

### 13.1. Unit Testing

| Module                    | Framework                       | Coverage Target     |
| ------------------------- | ------------------------------- | ------------------- |
| Backend NestJS Services   | Jest                            | ≥ 80% line coverage |
| PID Control Logic (ESP32) | Unity Test Framework            | ≥ 90%               |
| AI Model (evaluation)     | Python pytest + sklearn metrics | mAP ≥ 75%           |

### 13.2. Integration Testing

| Test Case       | Mô tả                                                            |
| --------------- | ---------------------------------------------------------------- |
| MQTT End-to-End | ESP32 publish → MQTT Broker → Backend subscribe → DB write       |
| Alert Pipeline  | Telemetry breach → Alert Engine → Notification gửi (mock FCM)    |
| Bird Count E2E  | Video input → RPi inference → MQTT publish → Backend → Dashboard |
| Manual Override | Web UI click relay → API → MQTT command → ESP32 xác nhận         |

### 13.3. Performance Testing

| Metric               | Tool           | Target                        |
| -------------------- | -------------- | ----------------------------- |
| API throughput       | k6 / Artillery | 100 req/s @ P95 ≤ 500ms       |
| WebSocket concurrent | Artillery      | 100 connections, latency ≤ 2s |
| MQTT message rate    | MQTT Bench     | 1000 msg/s throughput         |
| RPi AI inference     | Custom timer   | ≥ 25 FPS                      |

### 13.4. Hardware Testing

| Test               | Mô tả                                     | Tiêu chí Pass                       |
| ------------------ | ----------------------------------------- | ----------------------------------- |
| Offline Resilience | Ngắt mạng → ESP32 tiếp tục PID            | Control hoạt động trong 24h offline |
| Power Recovery     | Ngắt nguồn → Cắm lại → Kiểm tra reconnect | Reconnect trong ≤ 30 giây           |
| Sensor Accuracy    | So sánh SHT31 với thiết bị chuẩn          | Sai số nhiệt độ ≤ 0.3°C, Độ ẩm ≤ 2% |
| Relay Durability   | Bật/tắt relay 10.000 lần                  | Không lỗi cơ học                    |

### 13.5. AI Model Evaluation

| Metric                              | Target                  |
| ----------------------------------- | ----------------------- |
| mAP@0.5 (overall)                   | ≥ 75%                   |
| Precision (swiftlet)                | ≥ 80%                   |
| Recall (swiftlet)                   | ≥ 80%                   |
| False Positive Rate (predator)      | ≤ 5%                    |
| Counting Accuracy (controlled test) | ≤ 5% error trên 100 con |

---

## 14. Phân công & Lịch trình

### 14.1. Phân công Nhiệm vụ

| Task                          | Nội dung                                                                         | Thành viên phụ trách |
| ----------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| **Task 1 – Hardware**         | Thiết kế sơ đồ mạch, lắp ráp prototype, firmware ESP32 (sensor, PID, MQTT, OTA)  | TBD                  |
| **Task 2 – AI Pipeline**      | Thu thập dataset, annotation, train YOLOv8, tích hợp ByteTrack, optimize cho RPi | TBD                  |
| **Task 3 – Backend**          | NestJS API, MQTT Broker setup, MongoDB schema, WebSocket, Alert Engine           | TBD                  |
| **Task 4 – Frontend/Mobile**  | React.js Dashboard, React Native Mobile App, chart components, live stream       | TBD                  |
| **Task 5 – Testing & Thesis** | Thực nghiệm thực tế, đánh giá model, đo latency, viết báo cáo KLTN               | TBD                  |

### 14.2. Lịch trình Dự kiến

| Giai đoạn                        | Thời gian       | Deliverable                                          |
| -------------------------------- | --------------- | ---------------------------------------------------- |
| Phase 1: Setup & Research        | Tháng 7/2026    | SRS hoàn chỉnh, Hardware BOM mua sắm, môi trường dev |
| Phase 2: Hardware + Backend Core | Tháng 8/2026    | ESP32 firmware + MQTT + DB schema                    |
| Phase 3: AI Pipeline             | Tháng 8–9/2026  | Dataset annotated + Model v1 trained                 |
| Phase 4: Frontend + Integration  | Tháng 9–10/2026 | Web Dashboard + Mobile App                           |
| Phase 5: Testing & Optimization  | Tháng 11/2026   | Test reports, Model v2                               |
| Phase 6: Thesis Writing          | Tháng 12/2026   | Báo cáo KLTN + Demo                                  |

---

## 15. Bảng Thuật ngữ

| Thuật ngữ             | Định nghĩa                                                                      |
| --------------------- | ------------------------------------------------------------------------------- |
| **Edge AI**           | Xử lý AI trực tiếp trên thiết bị biên (RPi) thay vì trên cloud                  |
| **MQTT**              | Message Queuing Telemetry Transport – protocol nhẹ cho IoT                      |
| **PID Control**       | Proportional-Integral-Derivative – thuật toán điều khiển vòng kín               |
| **YOLO**              | You Only Look Once – kiến trúc object detection thời gian thực                  |
| **ByteTrack**         | Thuật toán Multi-Object Tracking không cần re-ID feature                        |
| **RTSP**              | Real Time Streaming Protocol – giao thức truyền video từ camera IP              |
| **PoE**               | Power over Ethernet – cấp nguồn cho thiết bị qua cáp mạng                       |
| **BOM**               | Bill of Materials – danh sách vật tư và linh kiện                               |
| **Return Rate**       | Tỉ lệ chim về trong ngày: (số chim về buổi tối) / (số chim ra buổi sáng) × 100% |
| **Closed-loop**       | Hệ thống điều khiển có phản hồi; output được đo và dùng để điều chỉnh input     |
| **Quantization**      | Kỹ thuật nén model AI từ FP32 xuống INT8 để tăng tốc inference                  |
| **ByteTrack**         | Multi-Object Tracking bằng cách associate mọi detection box                     |
| **FCM**               | Firebase Cloud Messaging – dịch vụ push notification của Google                 |
| **Zalo ZNS**          | Zalo Notification Service – kênh thông báo qua Zalo                             |
| **QoS**               | Quality of Service – mức độ đảm bảo delivery trong MQTT                         |
| **TTL**               | Time To Live – thời gian hết hạn của dữ liệu/token                              |
| **Presigned URL**     | URL có chữ ký thời hạn để truy cập file private trên S3                         |
| **MOT**               | Multi-Object Tracking – theo dõi nhiều đối tượng cùng lúc qua video             |
| **Harvest Batch**     | Đợt thu hoạch tổ yến, gắn liền với dữ liệu môi trường và thông tin đàn chim     |
| **Trace Code**        | Mã truy xuất nguồn gốc duy nhất (UUID) gắn với mỗi lô yến thu hoạch             |
| **Traceability Card** | Giao diện hiển thị thông tin nguồn gốc: farm, môi trường, đàn chim, ảnh SP      |
| **Nest Listing**      | Tin đăng bán yến trên Marketplace, liên kết với Harvest Batch                   |

---

_Tài liệu SRS này được tạo ngày 07/09/2026. Mọi thay đổi yêu cầu phải được cập nhật kèm phiên bản và ngày sửa đổi._

_Phiên bản: 1.4.0 | Ngày cập nhật: 11/09/2026 | Thay đổi: Cập nhật toàn bộ linh kiện/phần mềm lên phiên bản 2026 (ESP32-S3, RPi 5, SHT40, YOLO11, Node 22 LTS, React 19, Vite 6) | Trạng thái: DRAFT_
