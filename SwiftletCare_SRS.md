# Software Requirements Specification (SRS)

## SwiftletCare: An Automated Environmental Control and Multi-Modal Health Monitoring System for Swiftlet Farming

---

| Trường thông tin        | Nội dung                            |
| ----------------------- | ----------------------------------- |
| **Tên dự án**           | SwiftletCare                        |
| **Phiên bản SRS**       | 1.12.0                              |
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
15. [Quản lý Rủi ro (Risk Register)](#15-quản-lý-rủi-ro-risk-register)
16. [Giả định, Ràng buộc & Phạm vi Loại trừ](#16-giả-định-ràng-buộc--phạm-vi-loại-trừ)
17. [Vận hành, Triển khai & Tuân thủ Dữ liệu](#17-vận-hành-triển-khai--tuân-thủ-dữ-liệu)
18. [Tiêu chí Nghiệm thu (Definition of Done)](#18-tiêu-chí-nghiệm-thu-definition-of-done)
19. [Bảng Thuật ngữ](#19-bảng-thuật-ngữ)

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

> **[Cập nhật v1.7.0]** Sau rà soát lại cùng BA Review, hệ thống thống nhất vận hành với **5 vai trò người dùng** (Farm Owner, Technician, Sales Staff, Buyer, Administrator) — **gộp Operator vào Farm Owner** thành 1 vai trò duy nhất phía Farm (bản v1.6.0 trước đó tách thành 6 vai trò, không cần thiết cho phạm vi KLTN và không khớp với tài liệu BA gốc vốn đã mô tả đúng 5 actor — xem mục 1.3). Hệ thống vẫn được triển khai theo **3 giai đoạn** — phạm vi nghiệm thu KLTN (FA26) chỉ bao gồm **Giai đoạn 1 (MVP)**, xem chi tiết mục 2.4 và mục 16.3.

### 1.3. Tài liệu Tham chiếu

- `FA26_SE_Capstone_Project_Register_SwiftletCare.docx` – Phiếu đăng ký đề tài KLTN
- `KLTN_2026_SwiftletCare_FA26.docx` – Đặc tả kỹ thuật phần cứng và Edge AI Vision
- YOLOv8/YOLOv10 Documentation – Ultralytics
- ByteTrack: Multi-Object Tracking by Associating Every Detection Box
- EMQX/Mosquitto MQTT Broker Documentation
- Express.js Framework Documentation
- `BA_Review_ActivityFlow_SwiftletCare.md` – Đánh giá BA & thiết kế luồng nghiệp vụ **5 actor (Farmer, Buyer, Technician, Sales Staff, Admin)** — nội dung đã được hợp nhất vào SRS này; mô hình 5 actor được khôi phục đúng theo tài liệu gốc này kể từ bản v1.7.0

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

> **[Cập nhật v1.7.0 — gộp Operator vào Farm Owner]** Bản v1.6.0 từng tách "Farm Owner" và "Operator" thành 2 vai trò riêng để phân quyền theo Zone. Sau rà soát, nhóm quyết định **gộp lại thành 1 vai trò Farm Owner duy nhất** cho toàn bộ phía Farm: trong phạm vi KLTN (1 farm thử nghiệm, quy mô nhỏ), việc phân quyền chi tiết theo Zone giữa "chủ farm" và "nhân viên vận hành" tạo thêm độ phức tạp không cần thiết và không phản ánh đúng cách vận hành thực tế của các farm quy mô vừa/nhỏ. Một Farm có thể có **nhiều tài khoản Farm Owner** (1 Primary Owner tự đăng ký + các thành viên được mời), tất cả đều có quyền vận hành ngang nhau (xem AUTH-FR-005, `farms.members`, mục 8.2).

| Vai trò           | Thuộc về                                          | Mô tả                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Farm Owner**    | Phía khách hàng (Farm)                            | Chủ nhà yến và nhân viên vận hành trực tiếp tại farm — gộp chung 1 vai trò; 1 Farm có 1 tài khoản Primary Owner tự đăng ký, có thể mời thêm thành viên Farm Owner khác (quyền vận hành ngang nhau) và mời Sales Staff |
| **Technician**    | Phía công ty SwiftletCare                         | Nhân viên hỗ trợ kỹ thuật: lắp đặt phần cứng, xử lý ticket sự cố theo SLA, bảo trì định kỳ                                                                                                                            |
| **Sales Staff**   | Phía Farm (hoặc kiêm bởi Farm Owner nếu farm nhỏ) | Vận hành thương mại: sản phẩm, tồn kho, đơn hàng, vận chuyển, đổi trả cấp Farm                                                                                                                                        |
| **Buyer**         | Bên ngoài                                         | Khách mua tổ yến; có thể guest checkout hoặc đăng ký tài khoản                                                                                                                                                        |
| **Administrator** | Phía công ty SwiftletCare                         | Quản trị nền tảng: tài khoản, duyệt sản phẩm, phân xử tranh chấp, cấu hình hệ thống toàn cục                                                                                                                          |

### 2.4. Lộ trình Phát triển 3 Giai đoạn & Phạm vi KLTN

> Bổ sung theo BA Review để làm rõ ranh giới giữa "toàn bộ tầm nhìn sản phẩm" và "phạm vi thực sự triển khai/nghiệm thu trong 6 tháng đồ án".

| Giai đoạn                                             | Mục tiêu                                                      | Phạm vi chính                                                                                                                                                                           |                                                      Thuộc phạm vi KLTN?                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------: |
| 🟢 **Giai đoạn 1 — MVP (Core Monitoring & Control)**  | Chứng minh giá trị cốt lõi IoT: "nuôi yến từ xa, an toàn hơn" | Farm Owner giám sát/điều khiển 1 farm, cảnh báo, ticket báo lỗi cơ bản; Technician lắp đặt & xử lý ticket; Admin quản lý tài khoản; Marketplace chỉ là landing page tĩnh + form liên hệ |                                          ✅ **Có — đây là phạm vi nghiệm thu chính**                                          |
| 🟡 **Giai đoạn 2 — Vận hành & Thương mại hóa cơ bản** | Mở use case bán hàng thật + nâng cấp vận hành kỹ thuật        | Kích hoạt Sales Staff, giỏ hàng/thanh toán online thật, SLA ticket, OTA firmware, Traceability đầy đủ trên Marketplace                                                                  | ⚠️ **Thiết kế sẵn data model & luồng (mục 5.9, 5.10, 8, 10) nhưng chỉ cài đặt nếu còn thời gian — không bắt buộc nghiệm thu** |
| 🔵 **Giai đoạn 3 — Mở rộng & Thông minh hóa**         | Nền tảng dữ liệu ngành yến, tối ưu bằng AI                    | Dự báo AI, automation rule builder, predictive maintenance, multi-tenant SaaS, đa kênh bán hàng                                                                                         |                                        ❌ **Ngoài phạm vi KLTN — chỉ nêu định hướng**                                         |

**Ý nghĩa với nhóm phát triển:** Task 3 (Backend) và Task 4 (Frontend) nên ưu tiên code chắc chắn toàn bộ Giai đoạn 1 trước, sau đó mới mở rộng sang schema/API của Giai đoạn 2 (đã thiết kế sẵn ở mục 8.2 và 9.1) — tránh dàn trải làm dở cả 3 giai đoạn mà không giai đoạn nào chạy hoàn chỉnh để demo.

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

> **[Cập nhật v1.7.0]** Hệ thống thống nhất **5 actor**: **Farm Owner** (đã gộp Operator), **Technician**, **Sales Staff**, **Buyer**, **Administrator**. Việc gộp Operator vào Farm Owner giúp đơn giản hóa mô hình phân quyền — một Farm không còn phân biệt "chủ" và "nhân viên vận hành" ở cấp hệ thống, mà chỉ phân biệt Primary Owner (người tạo Farm, có thêm quyền quản trị Farm như xóa Farm/mời-gỡ thành viên) và các thành viên Farm Owner khác (quyền vận hành đầy đủ: xem dashboard, điều khiển thiết bị, xử lý ticket, quản lý thu hoạch).

### 4.1. Actor Bên Ngoài

| Actor             | Mô tả                                                                                                                                 | Quyền hạn                                                                                                                                                                                                            | Tài khoản được tạo bởi                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Farm Owner**    | Chủ nhà yến và nhân viên vận hành farm (1 vai trò gộp chung); mỗi Farm có 1 Primary Owner + có thể có thêm thành viên Farm Owner khác | Quản lý thông tin farm/house/zone (tạo, đổi tên, xóa mềm), **xem** dashboard thời gian thực của thiết bị đã được Technician lắp đặt & kích hoạt, **chỉnh thông số vận hành** (ngưỡng cảnh báo môi trường — ENV-FR-006, điều khiển relay thủ công — ENV-FR-016..018), tạo/xử lý ticket báo lỗi, mời thêm Farm Owner khác hoặc Sales Staff, đăng bán yến. Primary Owner có thêm quyền: xóa farm, gỡ thành viên. **Không tự đăng ký/gỡ bỏ/thay thế thiết bị vật lý** — việc này thuộc về Technician (mô hình giống thợ lắp mạng/camera: khách hàng chỉ dùng, không tự đấu nối) | **Primary Owner: tự đăng ký** (AUTH-FR-001); **thành viên khác: được Primary Owner mời** (AUTH-FR-005) |
| **Technician**    | Nhân viên hỗ trợ kỹ thuật **phía công ty SwiftletCare** (không thuộc farm)                                                            | Lắp đặt phần cứng tại farm; **đăng ký/kích hoạt/gỡ bỏ/thay thế thiết bị vào đúng Farm→House→Zone qua Web Console Onboarding chuyên dụng** (bao gồm cấu hình WiFi thật cho thiết bị qua AP-mode ngay tại chỗ, không cần cắm USB nạp lại firmware mỗi lần lắp — FARM-FR-003/003b); tiếp nhận & xử lý ticket theo SLA, bảo trì định kỳ, đẩy OTA firmware                                                                                                    | Administrator tạo, gán khu vực phụ trách                                                               |
| **Sales Staff**   | Nhân viên vận hành thương mại, quản lý 1 hoặc nhiều Farm                                                                              | Quản lý sản phẩm (chờ Admin duyệt), nhập sản lượng thu hoạch, quản lý tồn kho, xử lý đơn hàng & vận chuyển, xử lý đổi trả cấp Farm, xem báo cáo doanh số                                                             | Farm Owner mời **hoặc** Administrator tạo (farm liên kết/HTX)                                          |
| **Buyer**         | Người mua yến, khách hàng tiềm năng/đối tác                                                                                           | Xem Marketplace công khai (không cần đăng nhập), xem truy xuất nguồn gốc, đặt hàng (guest hoặc có tài khoản), theo dõi đơn hàng, liên hệ Farm Owner                                                                  | Tự đăng ký hoặc **guest checkout** (không bắt buộc TK)                                                 |
| **Administrator** | Quản trị nền tảng SwiftletCare                                                                                                        | Quản lý tài khoản toàn hệ thống, duyệt sản phẩm, cấu hình SLA/ngưỡng mặc định/hoa hồng, phân xử tranh chấp cấp cao, audit log                                                                                        | Tài khoản gốc hệ thống (seed/super-admin tạo)                                                          |

> **Ghi chú quan trọng (giải quyết mâu thuẫn của các bản trước):** Chốt lại: **Farm Owner (Primary) luôn tự đăng ký phần mềm** (AUTH-FR-001/002); các thành viên Farm Owner khác được Primary Owner mời và có quyền vận hành ngang nhau (không phân quyền theo Zone trong phạm vi KLTN). **[Cập nhật — mô hình "công ty vận hành, khách hàng chỉ dùng", giống lắp mạng/camera an ninh]** Việc **đăng ký/kích hoạt thiết bị là một luồng nghiệp vụ chính thức trên Web, chỉ do Technician thực hiện** (không còn đường tự phục vụ song song cho Farm Owner như bản trước) — Farm Owner không tự quét QR/tự cấu hình thiết bị, chỉ nhận bàn giao thiết bị đã hoạt động và thao tác trên dữ liệu/thông số sau đó. Lý do: (1) khớp đúng mô hình kinh doanh — công ty SwiftletCare bán sản phẩm + vận hành nền tảng, không bàn giao đứt quyền kiểm soát kỹ thuật cho khách hàng; (2) việc lắp đặt vật lý (đấu dây RS485) vốn dĩ đã cần Technician có mặt tại farm, nên để họ hoàn tất luôn bước kích hoạt phần mềm trong cùng 1 lượt ghé thăm là hợp lý và giảm rủi ro cấu hình sai. Xem Flow 1/1b (mục 10) đã viết lại theo luồng Technician Web Console.

### 4.2. Actor Hệ thống (Background Services)

| Actor                         | Mô tả                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **ESP32 Controller Node**     | Thu thập cảm biến, thực thi PID, publish MQTT                                                                      |
| **Raspberry Pi Edge AI Node** | Chạy YOLO + ByteTrack, publish kết quả đếm chim                                                                    |
| **MQTT Broker (EMQX)**        | Trung gian message routing giữa edge và cloud                                                                      |
| **Alert Engine**              | Dịch vụ background phân tích sự kiện và gửi thông báo                                                              |
| **Telemetry Aggregator**      | Thu thập, validate, lưu time-series IoT data                                                                       |
| **Ticket Router**             | Dịch vụ nền tự động gán ticket cho Technician theo khu vực, theo dõi SLA và tự động escalate khi quá hạn (mục 5.9) |

### 4.3. Sơ đồ Ngữ cảnh Hệ thống (System Context Diagram)

> SwiftletCare là 1 hộp trung tâm, giao tiếp với **5 actor người dùng** và các hệ thống bên thứ 3.

```mermaid
flowchart TB
    Farmer(["👤 Farm Owner"])
    Buyer(["👤 Buyer"])
    Tech(["👤 Technician"])
    Sales(["👤 Sales Staff"])
    Admin(["👤 Administrator"])

    ESP32["🔌 ESP32-S3 Controller Node<br/>+ Bus RS485 (6 cảm biến/relay)<br/>tại mỗi Zone"]
    RPi["📷 Raspberry Pi 5 Edge AI Node<br/>+ Camera IP PoE 4MP"]
    FCM["🔔 Firebase FCM"]
    Zalo["🔔 Zalo ZNS"]
    SMS["🔔 SMS Gateway (Twilio/ESMS)"]
    Pay["💳 Cổng thanh toán<br/>VNPay/Momo/ZaloPay (Giai đoạn 2)"]
    Ship["🚚 Đơn vị vận chuyển<br/>GHN/GHTK/J&T (Giai đoạn 2+)"]
    S3["☁️ S3/MinIO<br/>Snapshot & video storage"]

    subgraph SYS["HỆ THỐNG SWIFTLETCARE<br/>Web/Mobile PWA + Backend Express + MQTT Broker EMQX + MongoDB"]
        direction TB
        Core["Core Platform:<br/>AUTH · FARM · ENV · VISION · THREAT<br/>ALERT · ANALYTICS · MARKET · TICKET · SALES"]
    end

    Farmer -- "Đăng ký/đăng nhập, giám sát, điều khiển,<br/>báo lỗi, mời thành viên/Sales Staff" --> SYS
    Tech -- "Xử lý ticket, lắp đặt/kích hoạt thiết bị, bảo trì" --> SYS
    Sales -- "Quản lý sản phẩm, tồn kho, xử lý đơn hàng" --> SYS
    Admin -- "Quản lý tài khoản, duyệt sản phẩm, cấu hình hệ thống" --> SYS
    Buyer -- "Xem Marketplace, đặt hàng, tra cứu truy xuất nguồn gốc" --> SYS

    ESP32 -- "Telemetry (RS485→MQTT, JSON, 10s/lần)<br/>Heartbeat, Relay status" --> SYS
    SYS -- "Lệnh điều khiển Relay,<br/>cập nhật ngưỡng cấu hình" --> ESP32
    RPi -- "Bird count, Threat alert (MQTT)<br/>RTSP live stream" --> SYS
    SYS -- "Cấu hình vùng detect, lệnh recording" --> RPi

    SYS -- "Push notification" --> FCM
    SYS -- "ZNS message" --> Zalo
    SYS -- "SMS dự phòng" --> SMS
    SYS -- "Upload snapshot/video" --> S3
    SYS -. "Yêu cầu thanh toán (Giai đoạn 2)" .-> Pay
    Pay -. "Kết quả giao dịch" .-> SYS
    SYS -. "Tạo vận đơn (Giai đoạn 2+)" .-> Ship
    Ship -. "Cập nhật trạng thái giao hàng" .-> SYS
```

_(Đường nét đứt = tích hợp thuộc Giai đoạn 2 trở đi, chưa bắt buộc trong phạm vi KLTN — xem mục 2.4)_

### 4.4. Ma trận Phân quyền Tổng hợp (RACI rút gọn)

> Bổ sung theo BA Review để mọi thành viên team tra cứu nhanh "ai làm gì" khi thiết kế phân quyền API (middleware RBAC, mục 12.1). _R = Thực hiện, A = Phê duyệt/chịu trách nhiệm cuối, I = Được thông báo, "-" = không liên quan._

| Chức năng                                        |                    Farm Owner                    |        Buyer         |      Technician      |         Sales Staff          |        Admin        |
| ------------------------------------------------ | :----------------------------------------------: | :------------------: | :------------------: | :--------------------------: | :-----------------: |
| Đăng ký/đăng nhập                                | R (Primary tự đăng ký; thành viên khác được mời) | R (tự đăng ký/guest) |    - (Admin tạo)     | - (Farm Owner mời/Admin tạo) |  - (tài khoản gốc)  |
| Xem dữ liệu cảm biến nhà yến mình                |                        R                         |          -           | R (khi xử lý ticket) |              -               |     A (toàn bộ)     |
| Điều khiển thiết bị (relay)                      |                        R                         |          -           | R (khắc phục sự cố)  |              -               |          -          |
| Tạo/xử lý ticket lỗi ³                           |                     R (tạo)                      |          -           |      R (xử lý)       |              -               | A (escalate/can thiệp) |
| Gán/kích hoạt thiết bị vào Farm ¹                |                        -                         |          -           |          R           |              -               |      I (audit)      |
| Yêu cầu lắp đặt nhà yến mới ²                     |                     R (tạo)                      |          -           |   R (nhận tự động & thực hiện)      |              -               | I (audit/can thiệp) |
| Tạo/sửa sản phẩm                                 |                        I                         |          -           |          -           |              R               |      A (duyệt)      |
| Nhập sản lượng thu hoạch & tồn kho               |                        I                         |          -           |          -           |              R               |          I          |
| Mua hàng, thanh toán                             |                        -                         |          R           |          -           |              -               |          -          |
| Xác nhận đơn & cập nhật trạng thái vận chuyển    |                        I                         |     I (theo dõi)     |          -           |              R               |          -          |
| Duyệt tài khoản/khóa-mở khóa tài khoản (Flow 19) |                        I                         |          I           |          I           |              I               |         R/A         |
| Yêu cầu xoá tài khoản (right to erasure, Flow 19)|                     R (yêu cầu)                  |      R (yêu cầu)     |      R (yêu cầu)     |           R (yêu cầu)        | A (xử lý ≤30 ngày)  |
| Quên mật khẩu / quản lý phiên đăng nhập (Flow 11)|                        R                         |          R           |          R           |              R               |          -          |
| Đẩy OTA firmware (Flow 15)                       |                        I                         |          -           |          R           |              -               |          I          |
| Xử lý khiếu nại đơn hàng                         |                        I                         |   R (tạo yêu cầu)    |          -           | R (xác minh, xử lý cấp Farm) | A (phân xử cấp cao) |
| Cấu hình ngưỡng cảnh báo mặc định, SLA, hoa hồng |                        I                         |          -           |          I           |              I               |         R/A         |

> ¹ **Gán/kích hoạt thiết bị vào Farm** là việc của **Technician** (nhân viên công ty), không phải Farm Owner tự làm — giống mô hình lắp mạng/camera an ninh: kỹ thuật viên của nhà cung cấp dịch vụ tới lắp đặt phần cứng **và** kích hoạt kết nối luôn trong cùng 1 lượt, khách hàng (Farm Owner) chỉ xem và chỉnh thông số vận hành sau khi thiết bị đã hoạt động. Technician chỉ kích hoạt được thiết bị cho Farm nằm trong `assigned_regions` của mình (xem `users.assigned_regions`, AUTH-FR-005c, mục 8.2) — không phải toàn quyền trên mọi Farm. Admin không cần duyệt từng lần kích hoạt (tránh làm chậm lắp đặt hiện trường) nhưng được thông báo để audit. **[Sửa BA Review — lần 2]** Bản trước (do phiên trước hiểu nhầm là mô hình "bàn giao phần mềm cho Farm Owner tự vận hành") ghi Farm Owner = R tự đăng ký qua QR — không đúng với mô hình SaaS mà công ty SwiftletCare vẫn vận hành nền tảng và kiểm soát qua Technician/Admin (xem mô tả actor Technician/Admin, mục 4.1: cả hai đều "phía công ty SwiftletCare").

> ² **Yêu cầu lắp đặt nhà yến mới** đi qua ticket loại `INSTALLATION` (TICKET-FR-001/004/004b, Flow 9b) — dùng chung cơ chế Ticket Router tự động như ticket báo lỗi: Technician phụ trách khu vực (`assigned_regions`) nhận ticket ngay, không cần Admin chọn tay cho từng ticket. Admin chỉ **I (audit)** trong vận hành bình thường vì việc "điều phối" thật sự đã xảy ra từ trước — lúc Admin gán khu vực phụ trách cho Technician (AUTH-FR-005c) — chứ không phải điều phối lặp lại mỗi khi có ticket mới. Xem thêm ghi chú ³ về quyền can thiệp khi cần.

> ³ **Cả 2 dòng ticket ở trên (báo lỗi và lắp đặt)**: dù vận hành bình thường là tự động (Ticket Router) và Farm Owner/Technician tự xử lý, **Administrator luôn có toàn quyền can thiệp bất kỳ ticket nào, bất kỳ lúc nào** — xem, sửa, đổi Technician phụ trách, đổi ngày giờ hẹn, đổi priority, đóng/huỷ (TICKET-FR-005b). Đây không phải quyền có điều kiện (chỉ khi vượt SLA hay thiếu Technician) mà là quyền quản trị nền tảng luôn sẵn có, dùng khi có khiếu nại hoặc sai sót phát sinh.

---

## 5. Yêu cầu Chức năng

### 5.1. Module AUTH – Xác thực & Phân quyền

| ID           | Yêu cầu                                                                                                                                                                                                                                                                                                                                                    | Mức độ   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| AUTH-FR-001  | Hệ thống cho phép đăng ký tài khoản bằng email/số điện thoại, xác thực OTP — luồng đầy đủ kể cả bad case xem Flow 11                                                                                                                                                                                                                                                                                | Bắt buộc |
| AUTH-FR-002  | Hỗ trợ đăng nhập bằng email/mật khẩu và OAuth2 (Google) — xem Flow 11                                                                                                                                                                                                                                                                                    | Bắt buộc |
| AUTH-FR-003  | Quản lý phiên đăng nhập bằng JWT Access Token (15 phút) + Refresh Token (30 ngày) — xem Flow 11                                                                                                                                                                                                                                                                          | Bắt buộc |
| AUTH-FR-004  | Phân quyền theo Role: `ADMIN`, `FARM_OWNER`, `TECHNICIAN`, `SALES_STAFF` (enum thống nhất với schema `users.role`, xem mục 8.2; `BUYER` không có trong enum RBAC vì hỗ trợ guest checkout — xem SALES-FR-013). **[v1.7.0]** Bỏ role `OPERATOR` — đã gộp vào `FARM_OWNER`. **[Làm rõ v1.12.0]** Buyer đăng ký tài khoản qua OTP vẫn là 1 document trong `users` (để `orders.buyer_id` ref tới, phục vụ tra cứu lịch sử đơn hàng) nhưng có `role: null` — không tham gia RBAC vì không có endpoint nào dành riêng cho Buyer bị chặn bởi role middleware (Marketplace/checkout đều public hoặc theo `orders.buyer_id`, không theo role) | Bắt buộc |
| AUTH-FR-005  | Farm Owner (Primary — người tạo Farm) có thể mời thêm thành viên khác vào Farm với **cùng vai trò Farm Owner**; mọi thành viên Farm Owner của 1 Farm có quyền vận hành ngang nhau (xem `farms.members`, mục 8.2). **[v1.7.0]** Không còn phân quyền theo Zone riêng cho thành viên được mời — nếu cần trong tương lai, đây là điểm mở rộng ở Giai đoạn 2/3. Luồng mời/chấp nhận/từ chối đầy đủ xem Flow 12 | Bắt buộc |
| AUTH-FR-005b | Farm Owner có thể mời Sales Staff vào Farm của mình (many-to-many); nếu Farm không có Sales Staff, Farm Owner tự động có toàn bộ quyền của Sales Staff trên Farm đó (permission-based, không ép buộc tạo tài khoản riêng) — xem Flow 16                                                                                                                                  | Bắt buộc |
| AUTH-FR-005c | Administrator có thể tạo tài khoản Technician và gán khu vực địa lý phụ trách (`assigned_regions`); Administrator cũng có thể tạo tài khoản Sales Staff và gán vào 1+ Farm cho trường hợp farm liên kết/hợp tác xã — xem Flow 16                                                                                                                                         | Bắt buộc |
| AUTH-FR-006  | Hỗ trợ xác thực 2 yếu tố (2FA) bằng TOTP (Google Authenticator)                                                                                                                                                                                                                                                                                            | Tùy chọn |
| AUTH-FR-007  | Ghi audit log mọi hành động đăng nhập, thay đổi cấu hình                                                                                                                                                                                                                                                                                                   | Bắt buộc |
| AUTH-FR-008  | Buyer có thể đặt hàng dạng **guest checkout** (chỉ nhập tên, SĐT/email, địa chỉ giao hàng) mà không cần tạo tài khoản; nếu muốn theo dõi đơn hàng nhiều lần thì đăng ký bằng OTP số điện thoại                                                                                                                                                             | Bắt buộc |
| AUTH-FR-009 **[mới v1.12.0]**  | Quên mật khẩu: user nhập email/SĐT → hệ thống gửi OTP hoặc link đặt lại (TTL 15 phút, dùng 1 lần) → xác thực → đặt mật khẩu mới. Sau khi đổi thành công, mọi Refresh Token cũ của user bị thu hồi (buộc đăng nhập lại trên các thiết bị khác) — xem Flow 11 | Bắt buộc |
| AUTH-FR-010 **[mới v1.12.0]**  | Lời mời thành viên (Farm Owner mời Farm Owner khác — AUTH-FR-005, hoặc mời Sales Staff — AUTH-FR-005b) có TTL 7 ngày và trạng thái `PENDING → ACCEPTED / DECLINED / EXPIRED`; người được mời nhận thông báo (email/push) kèm link chấp nhận; nếu email chưa có tài khoản, chấp nhận lời mời dẫn thẳng vào luồng đăng ký (Flow 11) — xem Flow 12 | Bắt buộc |
| AUTH-FR-011 **[mới v1.12.0]**  | Administrator có thể khoá (`is_active=false`) hoặc mở khoá tài khoản bất kỳ, kèm lý do bắt buộc (ghi vào audit log — AUTH-FR-007); tài khoản bị khoá vẫn còn dữ liệu nhưng mọi request JWT của user đó bị từ chối (401) kể cả token còn hạn — không chỉ chặn lúc login — xem Flow 19 | Bắt buộc |
| AUTH-FR-012 **[mới v1.12.0]**  | User có thể yêu cầu xoá tài khoản và dữ liệu cá nhân (PRIV-NFR-003 — quyền được xoá theo Nghị định 13/2023/NĐ-CP); Administrator xử lý yêu cầu trong ≤ 30 ngày. Quy tắc cascade: nếu là Primary Owner của Farm còn thành viên khác → chuyển `owner_id` cho thành viên `joined_at` sớm nhất trước khi xoá; nếu Farm không còn thành viên nào khác → xóa mềm luôn Farm đó (không xoá dữ liệu telemetry lịch sử, chỉ ẩn khỏi giao diện, phục vụ nghĩa vụ lưu trữ hồ sơ) — xem Flow 19 | Bắt buộc |

### 5.2. Module FARM – Quản lý Trang trại & Thiết bị

| ID          | Yêu cầu                                                                                    | Mức độ   |
| ----------- | ------------------------------------------------------------------------------------------ | -------- |
| FARM-FR-001 | Tạo, cập nhật, xóa mềm thông tin trang trại (Farm): tên, địa chỉ, tọa độ GPS, mô tả        | Bắt buộc |
| FARM-FR-002 | Mỗi Farm có thể chứa nhiều House (tòa nhà yến), mỗi House nhiều Zone (tầng/khu vực)        | Bắt buộc |
| FARM-FR-003 | **Technician** đăng ký thiết bị IoT Node (ESP32 Controller) bằng Device ID + QR Code, qua **Web Console Onboarding chuyên dụng** (không phải Farm Owner tự làm — xem actor Technician, mục 4.1) | Bắt buộc |
| FARM-FR-003b | Web Console Onboarding cho phép Technician cấu hình WiFi thật của farm cho thiết bị **tại chỗ qua AP-mode** (ESP32 tự phát mạng WiFi tạm khi chưa có cấu hình, Technician kết nối vào và điền form) — không cần cắm cáp USB nạp lại firmware mỗi lần lắp đặt một thiết bị mới | Bắt buộc |
| FARM-FR-004 | **Technician** đăng ký AI Camera Node (Raspberry Pi) bằng Node ID + QR Code qua cùng Web Console Onboarding                    | Bắt buộc |
| FARM-FR-005 | Xem trạng thái online/offline của từng thiết bị theo thời gian thực (Last Heartbeat ≤ 30s) — chi tiết cơ chế tự động phát hiện mất kết nối/mất nguồn xem Flow 14 | Bắt buộc |
| FARM-FR-006 | Xem thông tin chi tiết thiết bị: firmware version, uptime, cường độ tín hiệu Wi-Fi (RSSI)  | Bắt buộc |
| FARM-FR-007 | **Technician** gán thiết bị vào Zone cụ thể khi onboarding; một Zone có thể có nhiều node cảm biến và nhiều camera. Farm Owner chỉ xem, không tự gán/đổi Zone của thiết bị | Bắt buộc |
| FARM-FR-008 | **Technician** gỡ bỏ và thay thế thiết bị mà không mất lịch sử dữ liệu cũ (qua Web Console, không phải Farm Owner)                                 | Bắt buộc |

### 5.3. Module ENV – Giám sát & Điều khiển Môi trường

#### 5.3.1. Thu thập Dữ liệu Cảm biến

| ID         | Yêu cầu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| ENV-FR-001 | **[Cập nhật v1.8.0 — theo linh kiện thực tế]** ESP32 thu thập dữ liệu từ **5 cảm biến RS485 vật lý** trên bus (mỗi cảm biến 1 Slave ID): ES35-SW nhiệt-ẩm (ID5), ES-ALS-02 ánh sáng (ID4), ES-NH3-01 khí NH3 (ID3), ES-CO2-01 khí CO2 (ID2), ES-NOISE-01 tiếng ồn (ID1) — xem BOM v3.1 mục 7.1. ESP32 đọc lần lượt bằng Modbus Function 0x03, quy đổi giá trị theo công thức từng cảm biến, rồi publish qua MQTT topic: `swiftletcare/{farmId}/{houseId}/{zoneId}/telemetry` (xem cấu trúc topic thống nhất tại mục 9.2) | Bắt buộc |
| ENV-FR-002 | Tần suất đọc cảm biến và publish: mỗi 10 giây (có thể cấu hình từ 5–60 giây)                                                                                                                                                                                                                                                                                                                                                                                                                                             | Bắt buộc |
| ENV-FR-003 | **[Cập nhật v1.8.0]** Dữ liệu cảm biến bao gồm: Nhiệt độ (°C), Độ ẩm (%), Cường độ ánh sáng (lux), Nồng độ khí NH3 (ppm), CO2 (ppm), Biên độ âm thanh (dB). **Đã loại bỏ H2S (ppm) và TVOC (ppb)** vì không mua cảm biến rời cho 2 khí này; nếu sau này bổ sung cảm biến H2S/TVOC thì mở rộng lại schema `telemetry` (mục 8.2) và ngưỡng tương ứng                                                                                                                                                                       | Bắt buộc |
| ENV-FR-004 | Backend validate và lưu telemetry vào time-series collection MongoDB; dữ liệu ngoài ngưỡng hợp lệ bị đánh dấu anomaly                                                                                                                                                                                                                                                                                                                                                                                                    | Bắt buộc |
| ENV-FR-005 | Dashboard hiển thị giá trị cảm biến thời gian thực qua WebSocket; độ trễ cập nhật ≤ 2 giây                                                                                                                                                                                                                                                                                                                                                                                                                               | Bắt buộc |

#### 5.3.2. Cấu hình Ngưỡng Điều khiển

| ID         | Yêu cầu                                                                                                                                                                                                                                                       | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ENV-FR-006 | **[Cập nhật v1.8.0]** Farm Owner cấu hình ngưỡng tự động cho từng Zone: `temp_min` (°C), `temp_max` (°C), `humidity_min` (%), `humidity_max` (%), `light_max` (lux), `nh3_max` (ppm), `co2_max` (ppm). (Đã bỏ `h2s_max`, `tvoc_max` theo bộ cảm biến thực tế) | Bắt buộc |
| ENV-FR-007 | Giá trị khuyến nghị mặc định: Nhiệt độ 26–31°C, Độ ẩm 75–95%, Ánh sáng < 0.2 lux                                                                                                                                                                              | Bắt buộc |
| ENV-FR-008 | Hệ thống hỗ trợ đặt ngưỡng cảnh báo (Warning) riêng với ngưỡng kích hoạt actuator (Action)                                                                                                                                                                    | Bắt buộc |
| ENV-FR-009 | Lịch sử thay đổi cấu hình được ghi lại với timestamp và user thực hiện                                                                                                                                                                                        | Bắt buộc |

#### 5.3.3. Điều khiển Tự động (Closed-loop PID)

| ID          | Yêu cầu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Mức độ   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ENV-FR-010  | **[Cập nhật v1.9.0]** ESP32 thực thi thuật toán PID/on-off cục bộ để kích Relay phun sương (kênh IN1, GPIO25) khi độ ẩm < humidity_min. Dùng **module Relay thường 4 kênh kích GPIO** (không phải relay Modbus — xem phụ lục Relay Addon)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Bắt buộc |
| ENV-FR-011  | **[Cập nhật v1.9.0]** ESP32 kích Relay quạt thông gió (kênh IN3, GPIO27) khi nhiệt độ > temp_max hoặc NH3 > nh3_max hoặc CO2 > co2_max. (Bỏ điều kiện H2S/TVOC). Nhóm ENV-FR-010→019 (điều khiển tự động) đã **mở khoá** sau khi bổ sung module Relay thường 4 kênh GPIO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Bắt buộc |
| ENV-FR-012  | ESP32 kích Relay sưởi nhiệt (kênh dự phòng IN4, GPIO14) khi nhiệt độ < temp_min — tuỳ chọn, chỉ khi có gắn thiết bị sưởi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Bắt buộc |
| ENV-FR-013  | ESP32 tắt ánh sáng (nếu có) khi ánh sáng môi trường > light_max                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Bắt buộc |
| ENV-FR-013b | **[Cập nhật v1.10.0]** ESP32 điều khiển hệ thống loa ru dẫn dụ: (a) Relay kênh IN2 (GPIO26) đóng/ngắt NGUỒN cấp cho amply/loa; (b) Module phát nhạc **DFPlayer Mini** (giao tiếp UART qua GPIO32/33) đọc file âm thanh (MP3/WAV) từ thẻ microSD, ESP32 gửi lệnh `play/stop/volume/loop` qua UART; (c) tín hiệu audio qua amply **PAM8403** (nếu loa >3W) rồi ra loa. Điều khiển theo **lịch cố định** (mặc định 5:00-7:00 và 17:00-19:00) hoặc thủ công. File âm thanh nạp sẵn vào thẻ SD (Mức 1); upload file từ xa qua cloud → ESP32 ghi SD là **Mức 2 (stretch, không bắt buộc MVP)**. Liên kết THREAT-FR-006: khi relay loa ON + DFPlayer đang play mà cảm biến dB (ES-NOISE-01) không tăng → cảnh báo SPEAKER_FAILURE. Chi tiết: xem phụ lục `SwiftletCare_Relay_Audio_Guide.md` | Bắt buộc |
| ENV-FR-014  | Hệ thống tiếp tục thực thi Closed-loop Control cục bộ khi mất kết nối Internet (Offline Resilience)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Bắt buộc |
| ENV-FR-015  | Trạng thái relay (ON/OFF) được publish lên MQTT và đồng bộ lên Cloud mỗi khi thay đổi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Bắt buộc |

#### 5.3.4. Điều khiển Thủ công (Manual Override)

| ID         | Yêu cầu                                                                                          | Mức độ   |
| ---------- | ------------------------------------------------------------------------------------------------ | -------- |
| ENV-FR-016 | Farm Owner có thể bật/tắt thủ công từng relay qua Web/Mobile UI                                  | Bắt buộc |
| ENV-FR-017 | Khi ở chế độ Manual Override, PID Control bị tạm dừng cho relay đó; hiển thị cảnh báo rõ ràng    | Bắt buộc |
| ENV-FR-018 | Manual Override tự động hết hạn sau thời gian cấu hình (mặc định 30 phút), trả về chế độ tự động — luồng đầy đủ kể cả bad case xem Flow 13 | Bắt buộc |
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

| ID            | Yêu cầu                                                                                                                                                                                                                                                                                                                                                                                                                                   | Mức độ   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| THREAT-FR-009 | Phát hiện mất kết nối ESP32 (timeout heartbeat > 60 giây) → cảnh báo NODE_OFFLINE                                                                                                                                                                                                                                                                                                                                                         | Bắt buộc |
| THREAT-FR-010 | Phát hiện Raspberry Pi offline hoặc model inference tốc độ giảm < 10 FPS → cảnh báo EDGE_AI_DEGRADED                                                                                                                                                                                                                                                                                                                                      | Bắt buộc |
| THREAT-FR-011 | Phát hiện bơm nước cạn (pump running dry): relay ON nhưng humidity không tăng sau 5 phút → cảnh báo PUMP_DRY                                                                                                                                                                                                                                                                                                                              | Bắt buộc |
| THREAT-FR-012 | Phát hiện mất điện: Watchdog cứng phát hiện reset không mong muốn → ESP32 publish POWER_OUTAGE alert khi khởi động lại                                                                                                                                                                                                                                                                                                                    | Bắt buộc |
| THREAT-FR-013 | **[Cập nhật v1.8.0]** Trong mỗi chu kỳ đọc Modbus (ENV-FR-002), nếu 1 Slave ID cảm biến timeout/lỗi CRC → giữ giá trị cũ, gắn cờ `stale`, cảnh báo `SENSOR_FAULT` (MEDIUM); nếu ≥ 3/5 Slave ID timeout liên tiếp trong 3 chu kỳ → nghi ngờ lỗi vật lý toàn bus (đứt dây/mất nguồn/nhiễu) → cảnh báo `RS485_BUS_FAILURE` (CRITICAL) thay vì báo từng cảm biến riêng lẻ. (Ngưỡng tính trên 5 thiết bị thực tế: Noise/CO2/NH3/Light/ES35-SW) | Bắt buộc |

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

### 5.9. Module TICKET – Hỗ trợ Kỹ thuật & SLA

> Module này còn thiếu hoàn toàn ở bản gốc: SRS v1.4.0 chỉ nhắc "Alert" (hệ thống tự phát hiện sự cố) nhưng chưa mô tả quy trình con người xử lý sự cố đó. Thuộc phạm vi KLTN (Giai đoạn 1).

#### 5.9.1. Tạo & Định tuyến Ticket

| ID            | Yêu cầu                                                                                                                                                                                                             | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| TICKET-FR-001 | Farm Owner tạo ticket thủ công, chọn loại: nhóm **báo lỗi** (`SENSOR_FAULT`, `RS485_BUS_FAILURE`, `ACTUATOR_FAILURE`, `NODE_OFFLINE`, `EDGE_AI_DEGRADED`, `POWER_OUTAGE`, `SPEAKER_FAILURE`, `PREDATOR_DETECTED`, `OTHER`) hoặc nhóm **yêu cầu dịch vụ** (`INSTALLATION` — yêu cầu lắp đặt House/Zone/thiết bị mới, xem Flow 9b). Với ticket `INSTALLATION`, Farm Owner chọn luôn **ngày giờ hẹn mong muốn** (`scheduled_visit_at`) ngay lúc tạo — không cần thêm bước liên hệ qua lại để chốt lịch | Bắt buộc |
| TICKET-FR-002 | Hệ thống tự động tạo ticket và liên kết với Alert tương ứng khi Alert Engine phát sinh cảnh báo CRITICAL/HIGH chưa được acknowledge trong 15 phút                                                                   | Bắt buộc |
| TICKET-FR-003 | Mỗi ticket có mức ưu tiên P1/P2/P3, gán tự động theo loại (VD: `RS485_BUS_FAILURE`, `PREDATOR_DETECTED` → P1 mặc định; `INSTALLATION`/`MAINTENANCE` → P3 mặc định vì không khẩn cấp) nhưng Technician/Admin có thể điều chỉnh thủ công kèm lý do                                    | Bắt buộc |
| TICKET-FR-004 | Ticket Router (actor hệ thống, mục 4.2) tự động gán **mọi loại ticket** (kể cả `INSTALLATION`) cho Technician phụ trách khu vực địa lý của Farm, dựa theo `assigned_regions` mà **Administrator đã điều phối từ trước** (AUTH-FR-005c) — không cần Admin can thiệp thủ công theo từng ticket phát sinh | Bắt buộc |
| TICKET-FR-004b | Với ticket loại `INSTALLATION`: `scheduled_visit_at` do **Farm Owner chọn sẵn lúc tạo ticket** (TICKET-FR-001), không phải Technician/Admin đặt sau. Sau khi Ticket Router tự động gán, Technician chỉ cần xác nhận tiếp nhận đúng ngày giờ đó (không có bước liên hệ qua lại để chốt lịch). Nếu Technician không sắp xếp được đúng giờ đã chọn, Technician tự sửa `scheduled_visit_at` kèm ghi chú lý do, hoặc báo Administrator can thiệp gán lại (xem TICKET-FR-005b). SLA phản hồi của `INSTALLATION` tính theo thời điểm Technician xác nhận tiếp nhận (VD ≤ 24h kể từ lúc tạo ticket), khác với SLA khắc phục sự cố của ticket báo lỗi (TICKET-FR-006) | Bắt buộc |
| TICKET-FR-005 | Nếu không có Technician nào phù hợp khu vực hoặc Technician phụ trách đang quá tải (> N ticket mở), Ticket Router gán cho Technician dự phòng hoặc đưa vào hàng đợi chung | Bắt buộc |
| TICKET-FR-005b | **Administrator có toàn quyền quản lý mọi ticket** (mọi loại, mọi trạng thái, bất kể do Ticket Router tự động gán hay ai tạo): xem chi tiết, sửa thông tin, đổi priority/`scheduled_visit_at`, gán lại (reassign) sang Technician khác, hoặc đóng/huỷ ticket. Đây là quyền can thiệp **luôn sẵn có** để xử lý ngoại lệ, khiếu nại, hoặc sai sót phát sinh — không giới hạn ở trường hợp vượt SLA (TICKET-FR-009) hay không tìm được Technician phù hợp (TICKET-FR-005) | Bắt buộc |

#### 5.9.2. Xử lý & SLA

| ID            | Yêu cầu                                                                                                                                                                                                                        | Mức độ   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| TICKET-FR-006 | SLA cấu hình được bởi Administrator theo mức ưu tiên; mặc định đề xuất: **P1** phản hồi ≤ 30 phút / xử lý ≤ 4 giờ, **P2** phản hồi ≤ 4 giờ / xử lý ≤ 24 giờ, **P3** phản hồi ≤ 24 giờ / xử lý ≤ 72 giờ                         | Bắt buộc |
| TICKET-FR-007 | Technician cập nhật trạng thái ticket theo đúng luồng đầy đủ cho **mọi loại ticket** (kể cả `INSTALLATION` — xem Flow 9b): `MỚI` (chờ tiếp nhận) → `ĐANG XỬ LÝ` (đã tiếp nhận, đang xử lý/chuẩn bị lắp đặt) → `CHỜ XÁC NHẬN HIỆN TRƯỜNG` (đã làm xong tại farm, chờ checklist/xác nhận) → `ĐÃ ĐÓNG`; mỗi lần đổi trạng thái ghi log kèm ghi chú | Bắt buộc |
| TICKET-FR-008 | Technician có thể xử lý từ xa (restart thiết bị, đẩy OTA, cập nhật cấu hình qua MQTT command) trước khi quyết định cần đến hiện trường — luồng OTA đầy đủ kể cả rollback khi lỗi xem Flow 15 | Bắt buộc |
| TICKET-FR-009 | Nếu ticket vượt SLA xử lý mà chưa đóng, hệ thống tự động **escalate**: gửi thông báo cho Administrator và Technician dự phòng                                                                                                  | Bắt buộc |
| TICKET-FR-010 | Với ticket "Lắp đặt mới", Technician bắt buộc hoàn thành **checklist nghiệm thu (Site Acceptance Test)** trước khi đóng ticket: kiểm tra 5 địa chỉ Modbus phản hồi đúng, camera RTSP ổn định, kết nối 4G, relay đóng/ngắt đúng | Bắt buộc |
| TICKET-FR-011 | Farm Owner đánh giá mức độ hài lòng (1–5 sao) sau khi ticket đóng                                                                                                                                                              | Tùy chọn |
| TICKET-FR-012 | Administrator xem dashboard KPI: số ticket mở/đóng theo Technician, thời gian xử lý trung bình, tỉ lệ đúng SLA                                                                                                                 | Bắt buộc |
| TICKET-FR-013 | Hệ thống hỗ trợ bảo trì định kỳ: Administrator/Technician lên lịch bảo trì theo Farm, tự tạo ticket loại `MAINTENANCE` khi đến hạn                                                                                             | Tùy chọn |

---

### 5.10. Module SALES – Bán hàng, Tồn kho & Vận chuyển

> **[Thuộc Giai đoạn 2]** Mở rộng module MARKET (5.8) vốn chỉ dừng ở "đăng tin + truy xuất nguồn gốc" thành luồng thương mại đầy đủ: sản phẩm liên kết tồn kho thật, đơn hàng, thanh toán, vận chuyển, đổi trả — do actor **Sales Staff** vận hành. Data model và API được thiết kế sẵn nhưng **việc cài đặt/nghiệm thu KLTN không bắt buộc** (xem mục 2.4); nếu nhóm còn thời gian ở Phase 5–6 có thể triển khai làm điểm cộng.

#### 5.10.1. Quản lý Sản phẩm & Tồn kho

| ID           | Yêu cầu                                                                                                                                                      | Mức độ   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| SALES-FR-001 | Sales Staff tạo **Product** từ 1 Harvest Batch (MARKET-FR-001): tên, mô tả, giá, hình ảnh, liên kết `env_snapshot`/`flock_snapshot` để hiển thị Traceability | Bắt buộc |
| SALES-FR-002 | Product gửi Administrator duyệt trước khi hiển thị công khai trên Marketplace (trạng thái: `PENDING_REVIEW → APPROVED / REJECTED`) — luồng đầy đủ kể cả từ chối/gửi lại xem Flow 17                           | Bắt buộc |
| SALES-FR-003 | Mỗi lần Sales Staff nhập đợt thu hoạch mới (liên kết Harvest Batch), số lượng tự động **cộng vào Inventory** theo loại sản phẩm                              | Bắt buộc |
| SALES-FR-004 | Sales Staff xem tồn kho hiện tại theo từng sản phẩm; hệ thống tự cảnh báo khi tồn kho dưới ngưỡng tối thiểu cấu hình được — xem Flow 18                                    | Bắt buộc |
| SALES-FR-005 | Khi tồn kho về 0, sản phẩm tự động chuyển trạng thái `OUT_OF_STOCK`, ẩn khỏi trang đặt hàng (vẫn hiển thị để xem thông tin) — xem Flow 18                                  | Bắt buộc |

#### 5.10.2. Đơn hàng & Vận chuyển

| ID           | Yêu cầu                                                                                                                                                                                                                                                                                               | Mức độ   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SALES-FR-006 | Khi Buyer đặt hàng, hệ thống **tạm giữ (soft-reserve)** số lượng tương ứng trong Inventory ngay lập tức, tránh 2 Buyer cùng mua sản phẩm sắp hết                                                                                                                                                      | Bắt buộc |
| SALES-FR-007 | Trạng thái đơn hàng dùng **1 bộ enum thống nhất** cho cả Buyer/Sales Staff/Admin: `PENDING_CONFIRMATION → CONFIRMED → PACKED → SHIPPING → DELIVERED / DELIVERY_FAILED / CANCELLED`                                                                                                                    | Bắt buộc |
| SALES-FR-008 | Sales Staff xác nhận đơn (kiểm tra đủ tồn kho), đóng gói, nhập mã vận đơn, cập nhật trạng thái theo từng bước                                                                                                                                                                                         | Bắt buộc |
| SALES-FR-009 | Khi đơn chuyển `DELIVERED`, hệ thống **trừ tồn kho chính thức**; khi đơn bị `CANCELLED` trước khi giao, **hoàn lại tồn kho tạm giữ** ở SALES-FR-006                                                                                                                                                   | Bắt buộc |
| SALES-FR-010 | Buyer theo dõi trạng thái đơn hàng real-time qua WebSocket/thông báo push                                                                                                                                                                                                                             | Bắt buộc |
| SALES-FR-011 | Sales Staff xử lý đổi trả cấp Farm: kiểm tra tình trạng hàng hoàn, xác nhận đổi hàng mới hoặc đề xuất hoàn tiền lên Admin                                                                                                                                                                             | Bắt buộc |
| SALES-FR-012 | Administrator tiếp nhận khiếu nại/tranh chấp, chuyển Sales Staff xác minh tình trạng hàng thực tế trước khi ra quyết định cuối (hoàn tiền qua cổng thanh toán hoặc yêu cầu đổi hàng)                                                                                                                  | Bắt buộc |
| SALES-FR-013 | Buyer có thể đặt hàng qua **guest checkout** (tên, SĐT/email, địa chỉ) mà không cần tài khoản; đơn hàng vẫn tra cứu được qua link/mã đơn gửi kèm SMS/email                                                                                                                                            | Bắt buộc |
| SALES-FR-014 | Thanh toán hỗ trợ COD và thanh toán online (VNPay/Momo/ZaloPay); **mô hình thu tiền (nền tảng giữ hộ theo kiểu escrow hay Farm/Sales Staff thu trực tiếp và trả hoa hồng định kỳ) là quyết định nghiệp vụ cần chốt với stakeholder trước khi thiết kế module thanh toán** (xem mục 15 RISK và mục 16) | Bắt buộc |
| SALES-FR-015 | Sales Staff xem báo cáo doanh số theo ngày/tháng/sản phẩm cho (các) Farm được gán                                                                                                                                                                                                                     | Tùy chọn |
| SALES-FR-016 | Hệ thống cảnh báo chéo cho Sales Staff khi Farm nguồn đang có ticket kỹ thuật mức P1/CRITICAL còn mở (VD: `PREDATOR_DETECTED`, `RS485_BUS_FAILURE`), gợi ý cân nhắc tạm dừng nhận đơn mới cho sản phẩm từ Farm đó                                                                                     | Tùy chọn |

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
| REL-NFR-006 | Backend deploy với ít nhất 2 instance (Load Balancer) để đảm bảo HA                               |
| REL-NFR-007 | Dữ liệu telemetry được backup tự động hàng ngày                                                   |

### 6.3. Khả năng mở rộng (Scalability)

| ID            | Yêu cầu                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| SCALE-NFR-001 | Kiến trúc backend hỗ trợ horizontal scaling (stateless services + Redis cache)    |
| SCALE-NFR-002 | MQTT Broker (EMQX) hỗ trợ ≥ 10,000 concurrent connections (production deployment) |
| SCALE-NFR-003 | Một Farm có thể quản lý tối đa 10 Houses và 50 Zones                              |
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
| COST-NFR-001 | Tổng chi phí phần cứng prototype ≤ 10.105.000 VNĐ (theo BOM v1.3 – linh kiện cập nhật 2026, xem mục 7.1)              |
| COST-NFR-002 | Edge AI ưu tiên xử lý cục bộ trên RPi; chỉ upload snapshots + metadata lên cloud (không stream video liên tục qua 4G) |
| COST-NFR-003 | Dữ liệu telemetry gửi lên cloud ở dạng JSON compact; tần suất tối đa 1 message/10 giây                                |

### 6.7. Hỗ trợ Kỹ thuật & Vận hành Thương mại

| ID            | Yêu cầu                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLA-NFR-001   | SLA phản hồi/xử lý ticket theo mức ưu tiên phải cấu hình được qua Admin Portal, không hard-code (đối chiếu TICKET-FR-006)                                       |
| SLA-NFR-002   | Hệ thống tự động escalate ticket quá SLA trong vòng ≤ 5 phút sau khi vượt hạn                                                                                   |
| SALES-NFR-001 | Thao tác trừ/hoàn tồn kho (soft-reserve) phải là **atomic operation** ở tầng DB để tránh race condition khi nhiều Buyer đặt hàng cùng lúc 1 sản phẩm sắp hết    |
| SALES-NFR-002 | Toàn bộ giao dịch thanh toán (nếu triển khai Giai đoạn 2) phải qua cổng thanh toán đạt chuẩn PCI-DSS; hệ thống **không lưu trữ trực tiếp số thẻ/OTP ngân hàng** |

---

## 7. Đặc tả Phần cứng & BOM

### 7.1. Hardware Bill of Materials (BOM v3.1 — Linh kiện Thực tế)

> **[Cập nhật v1.8.0]** BOM được viết lại theo **linh kiện thật đã mua** (nhà cung cấp EPCB IoT Services). Chi tiết đầy đủ (register map, màu dây từng cảm biến, hướng dẫn đấu nối) xem file phụ lục `SwiftletCare_Components_Guide_v3.1.md` và sơ đồ tương tác `SwiftletCare_Wiring_Detailed_v3.html`.

**Cụm IoT Controller hiện tại (5 cảm biến giám sát, chưa có Relay):**

| STT | Thiết bị                                             | Model thực tế                                                                                    | Slave ID | Nguồn | Vai trò                                          |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | :------: | ----- | ------------------------------------------------ |
| 1   | Vi điều khiển                                        | **ESP32 NodeMCU 38 chân Type-C (CP2102, ESP32-WROOM-32)**                                        |    —     | 5V    | Modbus Master, MQTT, Wi-Fi                       |
| 2   | **Đế mở rộng ESP32 38 chân**                         | Domino 3.81mm, FR4, có lỗ bắt vít                                                                |    —     | —     | Đấu dây không cần hàn, cố định chắc              |
| 3   | Module chuyển đổi RS485                              | UART TTL to RS485 V2 (auto-direction)                                                            |    —     | 5V    | Cầu nối ESP32 ↔ bus RS485                        |
| 4   | Cảm biến tiếng ồn                                    | ES-NOISE-01 (30-130dB)                                                                           |    1     | 12V   | Đo dB                                            |
| 5   | Cảm biến CO2                                         | ES-CO2-01 (0-5000ppm)                                                                            |    2     | 12V   | Đo CO2                                           |
| 6   | Cảm biến khí NH3                                     | ES-NH3-01 (0-500ppm, điện hóa)                                                                   |    3     | 12V   | Đo NH3                                           |
| 7   | Cảm biến ánh sáng                                    | ES-ALS-02 (0-200.000 Lux)                                                                        |    4     | 12V   | Đo Lux                                           |
| 8   | Cảm biến nhiệt-ẩm                                    | ES35-SW (chip SHT35)                                                                             |    5     | 12V   | Đo nhiệt độ + độ ẩm, node cuối bus               |
| 9   | Nguồn                                                | AC Adapter 12V/2A (jack DC)                                                                      |    —     | —     | Cấp nguồn toàn hệ thống                          |
| 10  | **Mạch hạ áp #1**                                    | **Buck LM2596 3A** (in 3-30V, out 1.5-30V, 92%)                                                  |    —     | —     | 12V→5V cho ESP32 + module RS485                  |
| 11  | **Mạch hạ áp #2**                                    | **Buck LM2596 3A** (thứ 2)                                                                       |    —     | —     | 12V→5V cho PAM8403 + DFPlayer + relay (tải nặng) |
| 12  | **Domino phân phối**                                 | **TB1504 (4 mối, 15A/600V)**                                                                     |    —     | —     | Chia nguồn 12V                                   |
| 13  | Dây điện nhiều lõi (mỏng)                            | —                                                                                                |    —     | —     | Đấu nối                                          |
| 14  | Router 4G LTE                                        | (giữ nguyên)                                                                                     |    —     | —     | Phát Wi-Fi/Internet cho ESP32                    |
| 15  | **Module 4 Relay 5V opto cách ly kích H/L (Jumper)** | 250VAC-10A/30VDC-10A, ~200mA/relay, chọn mức kích High/Low                                       |    —     | 5V    | Điều khiển 3 actuator + 1 dự phòng               |
| 16  | Máy phun sương                                       | Bơm/vỉ phun (12V DC hoặc 220VAC)                                                                 |    —     | tải   | Tăng ẩm — kênh Relay IN1 (GPIO25)                |
| 17  | Loa ru (dẫn dụ chim yến)                             | Loa + amply (thường 220VAC)                                                                      |    —     | tải   | Dẫn dụ chim — kênh Relay IN2 (GPIO26), theo lịch |
| 18  | Quạt thông gió                                       | Quạt (12V DC hoặc 220VAC)                                                                        |    —     | tải   | Giảm nhiệt/xả khí — kênh Relay IN3 (GPIO27)      |
| 19  | **Module phát MP3 DFPlayer Mini**                    | MP3/WAV/WMA, microSD FAT16/32 ≤32GB, ampli tích hợp, UART/IO, thư mục ≤100×255 bài, 6 mức volume |    —     | 5V    | Nguồn phát âm thanh loa ru                       |
| 20  | **Amply PAM8403 6W Hifi 2.0 (có volume)**            | Class-D 2×3W, nguồn 5V-**1.2A**, loa 4Ω/8Ω, núm volume + lọc nhiễu                               |    —     | 5V    | Khuếch đại DFPlayer đẩy loa ru                   |
| 21  | **Thẻ microSD**                                      | ≤32GB FAT32                                                                                      |    —     | —     | Chứa file âm thanh loa ru                        |
| 22  | Điện trở 1kΩ                                         | —                                                                                                |    —     | —     | Bảo vệ chân RX DFPlayer                          |

> **Ghi chú BOM v3.3 (linh kiện thực tế):**
>
> - **4 cảm biến EPCB (Noise/CO2/NH3/Light)** dùng chung màu dây: **Nâu=VCC, Đen=GND, Vàng=A, Xanh dương=B**, mặc định **4800bps**.
> - **ES35-SW** dùng màu dây KHÁC: **Đỏ=VCC, Đen=GND, Vàng=A+, Xanh lá=B-**, mặc định **9600bps** → **phải đổi về 4800bps** (dùng ESP32 chạy sketch cấu hình, không cần USB-RS485 — xem Sensor Config Guide).
> - **Điện trở đầu cuối:** dùng trở 120Ω tích hợp trong ES35-SW (bật DIP Pin 5 = ON, đặt ở cuối bus) → không cần trở rời.
> - **ESP32 dùng đế mở rộng 38 chân** (domino 3.81mm): mọi GPIO ra domino vít → **đấu dây không cần hàn**, cố định vào hộp bằng vít. Chỉ tương thích ESP32 38 chân.
> - **DÙNG 2 MẠCH BUCK LM2596 3A** (⚠️ thay đổi quan trọng): Buck #1 cấp ESP32 + module RS485 (~0.5A); Buck #2 cấp riêng cho PAM8403 (1.2A) + DFPlayer + relay (~2.1A) — tách riêng vì PAM8403 6W ngốn nhiều dòng, dùng chung 1 Buck dễ sụt áp treo ESP32. **Chỉnh mỗi Buck ra đúng 5V bằng biến trở + đo VOM trước khi cắm** (⚠️ ngõ ra mặc định có thể cao gây cháy). Cẩn thận cấp ngược chân +/- IN.
> - **Domino TB1504 (4 mối, 15A/600V)** phân phối nguồn 12V — dư sức tải.
> - **Module RS485 V2 là loại tự động**, đấu THẲNG TX/RX (không đấu chéo).
> - **Relay: module 4 kênh 5V opto cách ly kích H/L chọn bằng Jumper** — **đặt Jumper ở kích mức CAO (High)**: `digitalWrite(pin, HIGH)` = bật (logic trực quan). Tiếp điểm 250VAC-10A đóng được tải 220V. 3 kênh: phun sương (IN1/GPIO25)/loa ru (IN2/GPIO26)/quạt (IN3/GPIO27), 1 dự phòng (IN4/GPIO14).
> - **Loa ru:** **DFPlayer Mini** (đọc MP3/WAV/WMA từ microSD ≤32GB, hỗ trợ thư mục ≤100×255 bài) → **PAM8403 6W có núm volume** khuếch đại → loa. Relay IN2 đóng/ngắt nguồn amply. Điều khiển play/stop/volume theo lịch (5-7h, 17-19h). Chi tiết: xem phụ lục `SwiftletCare_Components_Guide_v3.3.md`.
> - **Camera (nhánh Vision):** camera nhà yến IP 2MP **IR 940nm không phát sáng** (không làm chim sợ), ống kính 2.8mm góc rộng, IP66+, RTSP — xem `SwiftletCare_Camera_Guide_NhaYen_Full.md`. Chạy AI trên laptop (không cần RPi/PoE ngay).
> - **Đã bỏ so với thiết kế cũ:** cảm biến H2S + TVOC + nhiệt-ẩm ngoài trời, cầu chì rời, điện trở terminator rời, nguồn tổ ong, relay Modbus RS485, Camera PoE 4MP Starlight, Switch PoE.
> - **⚠️ Ngân sách nguồn:** nhánh Buck #2 có thể chạm 2.1A khi loa phát hết công suất + 3 relay đóng. **Nếu loa ru công suất lớn → cấp nguồn 220VAC riêng cho amply/loa** (relay IN2 đóng/ngắt 220V), hoặc nâng adapter lên 12V/3A-5A.
> - **Cần bổ sung:** đầu jack DC cái để đấu adapter vào domino.
>
> **Sơ đồ đấu nối (linh kiện thật):**
>
> ```
> AC Adapter 12V/2A → Domino TB1504 ─┬─ Buck#1 (5V) → ESP32 (đế 38 chân) + Module RS485 → BUS: Noise-CO2-NH3-Light-ES35SW
>                                    ├─ Buck#2 (5V) → PAM8403 + DFPlayer + Relay 4 kênh
>                                    └─ 12V → 5 cảm biến + tải relay 12V
> ```

### 7.2. Yêu cầu ESP32 Firmware

- Framework: Arduino (PlatformIO) hoặc ESP-IDF v5.x với FreeRTOS
- Các task chạy song song: **Modbus Polling Task**, MQTT Publish Task, OTA Update Task (PID Control Task **tạm hoãn** — chờ mua Relay)
- **Giao tiếp cảm biến:** RS485 Modbus RTU Master qua UART2 (GPIO16 RX, GPIO17 TX) + Module UART TTL to RS485 V2 (auto-direction, đấu thẳng không chéo)
- **Modbus Library:** `ModbusMaster` (Arduino) hoặc `eModbus` (ESP32-native, non-blocking)
- **Sensor polling:** Đọc lần lượt 5 Slave ID qua Modbus Function Code 0x03 (Read Holding Registers), chu kỳ 10 giây (cấu hình được 5–60s)
- **Bus config:** **Baud rate 4800 bps** (đã đồng bộ tất cả cảm biến về 4800), 8-N-1, Slave ID 1–5
- **Công thức quy đổi từng cảm biến (QUAN TRỌNG khi code):**
  - ES-NOISE-01 (ID1, reg 0x0000): giá trị ÷ 10 = dB
  - ES-CO2-01 (ID2, reg 0x0000): giá trị trực tiếp = ppm
  - ES-NH3-01 (ID3, reg 0x0000): bản 500ppm → giá trị trực tiếp = ppm
  - ES-ALS-02 (ID4, reg 0x0002, đọc 2 reg 32-bit): bản 200k Lux → giá trị × 100 = Lux
  - ES35-SW (ID5, reg 0 + 1, đọc 2 reg): giá trị ÷ 10 = °C và %RH
- **Điều khiển Relay (cập nhật v1.11.0):** dùng **module 4 relay 5V opto cách ly kích H/L (chọn Jumper)** — `digitalWrite()` trực tiếp, không qua Modbus. Chân: IN1=GPIO25 (phun sương), IN2=GPIO26 (loa ru), IN3=GPIO27 (quạt), IN4=GPIO14 (dự phòng/sưởi). **Đặt Jumper mỗi relay ở kích mức CAO (High)** → `digitalWrite(pin, HIGH)` = bật, `LOW` = tắt (logic trực quan, ghi rõ trong code).
- **Relay Task:** thêm task điều khiển relay theo (a) ngưỡng cảm biến cho misting/ventilation/heating, (b) lịch cố định cho loa ru (5-7h, 17-19h), (c) lệnh Manual Override từ cloud.
- **Audio Task (loa ru, mới v1.10.0):** dùng thư viện `DFRobotDFPlayerMini`, giao tiếp DFPlayer qua UART1 hoặc SoftwareSerial (GPIO33=TX→DFPlayer RX qua trở 1kΩ, GPIO32=RX←DFPlayer TX). Lệnh: `volume(0-30)`, `play(track)`, `loop(track)`, `stop()`. Trình tự phát: bật Relay IN2 → play; hết giờ: stop → ngắt Relay IN2. File âm thanh đặt tên `0001.mp3, 0002.mp3...` trên thẻ SD (FAT32).
- Protocol: MQTT over TLS (port 8883), QoS Level 1
- Local storage: NVS (Non-Volatile Storage) cho config; SPIFFS cho buffer telemetry offline
- Hardware Watchdog Timer: timeout 30 giây
- **Lưu ý cấu hình cảm biến trước khi lắp:** dùng app **Insight Sensor** (EPCB tặng kèm) hoặc Modbus Poll + USB-RS485 để (1) đổi baudrate ES35-SW 9600→4800, (2) xác nhận Slave ID 1-5 đúng.

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
User (1) ──< FarmMembership >── (N) Farm           # mọi thành viên đều role: FARM_OWNER; phân biệt bằng cờ is_primary (người tạo Farm)
User (1) ──< SalesAssignment >── (N) Farm           # role: SALES_STAFF, many-to-many
User (1) ──< TechnicianRegion >── (N) Region        # Technician phụ trách khu vực
Farm (1) ──< (N) House
House (1) ──< (N) Zone
Zone (1) ──< (N) SensorNode (ESP32)
Zone (1) ──< (N) CameraNode (RPi)
SensorNode (1) ──< (N) TelemetryRecord
CameraNode (1) ──< (N) BirdCountRecord
Zone (1) ──< (N) Alert
Alert (1) ──< (0..1) Ticket                          # Alert có thể sinh ra Ticket
Farm (1) ──< (N) Ticket
User/Technician (1) ──< (N) Ticket (assigned_to)
Farm (1) ──< (N) HarvestBatch
HarvestBatch (1) ──< (0..1) Product                  # thay cho liên kết trực tiếp NestListing
Product (1) ──< (1) Inventory
Product (1) ──< (N) OrderItem
Order (1) ──< (N) OrderItem
Order (1) ──< (0..1) Shipment
Order (1) ──< (0..N) ReturnRequest
HarvestBatch (1) ──< (1) NestListing
NestListing (1) ──< (N) ContactInquiry (from Buyer)
Farm (1) ──< (N) Invitation                          # lời mời Farm Owner/Sales Staff, mới v1.12.0
User (1) ──< (N) AuditLog (actor_id)                 # mới v1.12.0, AUTH-FR-007
```

> `NestListing`/`ContactInquiry` (Giai đoạn 1, mục 5.8) vẫn giữ nguyên cho luồng "đăng tin + liên hệ" đơn giản. Các entity mới `Product/Inventory/Order/OrderItem/Shipment/ReturnRequest/Ticket` (Giai đoạn 2, mục 5.9/5.10) là **lớp mở rộng phía trên** — `Product` tham chiếu `harvest_batch_id` giống `NestListing` để tái sử dụng dữ liệu Traceability đã có, tránh trùng lặp mô hình.

### 8.2. Schema Chi tiết (MongoDB Collections)

#### `users`

```json
{
  "_id": "ObjectId",
  "email": "string (unique, indexed)",
  "phone": "string",
  "password_hash": "string (bcrypt, null nếu chỉ đăng nhập OTP)",
  "full_name": "string",
  "role": "enum: ADMIN | FARM_OWNER | TECHNICIAN | SALES_STAFF | null (null = Buyer đã đăng ký qua OTP theo SALES-FR-013 — vẫn là 1 document trong `users` để orders.buyer_id ref tới, nhưng không mang role RBAC nào vì Buyer không truy cập bất kỳ endpoint nào bị chặn bởi role middleware, mục 12.1)",
  "assigned_regions": [
    "string (chỉ dùng khi role=TECHNICIAN, VD: ['HCMC', 'Long An'])"
  ],
  "avatar_url": "string",
  "notification_preferences": {
    "push": true,
    "zalo": true,
    "sms": false,
    "quiet_hours": { "start": "22:00", "end": "06:00" }
  },
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "is_active": "boolean",
  "deactivated_at": "ISODate (nullable — set khi Admin khoá tài khoản, AUTH-FR-011)",
  "deactivated_reason": "string (nullable, bắt buộc nhập khi khoá)",
  "password_reset_token_hash": "string (nullable, hash của OTP/token đặt lại mật khẩu, AUTH-FR-009)",
  "password_reset_expires_at": "ISODate (nullable)"
}
```

#### `invitations` — [mới v1.12.0, AUTH-FR-010]

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "invited_email": "string",
  "invited_role": "enum: FARM_OWNER | SALES_STAFF",
  "invited_by": "ObjectId (ref: users)",
  "token": "string (unique, dùng trong link mời)",
  "status": "enum: PENDING | ACCEPTED | DECLINED | EXPIRED",
  "expires_at": "ISODate (created_at + 7 ngày)",
  "created_at": "ISODate",
  "responded_at": "ISODate (nullable)"
}
```

#### `audit_logs` — [mới v1.12.0, AUTH-FR-007]

```json
{
  "_id": "ObjectId",
  "actor_id": "ObjectId (ref: users, nullable nếu hệ thống tự thực hiện)",
  "action": "string (VD: LOGIN, LOGIN_FAILED, PASSWORD_RESET, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, THRESHOLD_UPDATED, RELAY_OVERRIDE, TICKET_REASSIGNED, PRODUCT_APPROVED)",
  "target_type": "string (VD: user, farm, sensor_node, ticket, product)",
  "target_id": "ObjectId (nullable)",
  "metadata": "object (chi tiết thay đổi, before/after nếu có)",
  "ip_address": "string (nullable)",
  "created_at": "ISODate"
}
```

#### `farms`

```json
{
  "_id": "ObjectId",
  "name": "string",
  "address": "string",
  "coordinates": { "lat": "number", "lng": "number" },
  "owner_id": "ObjectId (ref: users — Primary Owner, người tạo Farm)",
  "members": [
    {
      "user_id": "ObjectId (ref: users, role=FARM_OWNER)",
      "is_primary": false,
      "joined_at": "ISODate"
    }
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
  "status": "enum: PENDING | ONLINE | OFFLINE | ERROR (PENDING = Technician đã tạo record qua Web Console Onboarding nhưng thiết bị chưa gửi heartbeat đầu tiên — xem Flow 1, mục 10)",
  "rssi": "number (dBm)",
  "relay_states": {
    "misting": "boolean (kênh IN1, GPIO25 — phun sương)",
    "speaker": "boolean (kênh IN2, GPIO26 — loa ru, mới v1.9.0)",
    "ventilation": "boolean (kênh IN3, GPIO27 — quạt thông gió)",
    "heating": "boolean (kênh IN4/dự phòng, GPIO14 — sưởi, tuỳ chọn)"
  },
  "relay_type": "string ('GPIO' — module relay thường 4 kênh kích GPIO, không phải Modbus)",
  "speaker_schedule": {
    "enabled": "boolean",
    "windows": [
      { "start": "05:00", "end": "07:00" },
      { "start": "17:00", "end": "19:00" }
    ]
  },
  "audio": {
    "current_track": "number (số file trên SD, VD: 1 = 0001.mp3)",
    "volume": "number (0-30)",
    "playing": "boolean",
    "loop": "boolean (loa ru thường phát lặp)"
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
  "temperature": "number (từ ES35-SW, giá trị Modbus ÷10)",
  "humidity": "number (từ ES35-SW, giá trị Modbus ÷10)",
  "light_lux": "number (từ ES-ALS-02, bản 200k Lux → giá trị ×100)",
  "nh3_ppm": "number (từ ES-NH3-01, bản 500ppm → giá trị trực tiếp)",
  "co2_ppm": "number (từ ES-CO2-01, giá trị trực tiếp)",
  "sound_db": "number (từ ES-NOISE-01, giá trị Modbus ÷10)",
  "is_anomaly": "boolean"
  // [v1.8.0] Đã bỏ h2s_ppm, tvoc_ppb theo bộ cảm biến thực tế. Thêm lại nếu mua cảm biến H2S/TVOC.
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
  "type": "enum: THRESHOLD_BREACH | PREDATOR_DETECTED | NODE_OFFLINE | EDGE_AI_DEGRADED | SPEAKER_FAILURE | PUMP_DRY | BIRD_PANIC | POWER_OUTAGE | LOW_RETURN_RATE | SENSOR_FAULT | RS485_BUS_FAILURE",
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

#### `tickets` — [Module TICKET]

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "zone_id": "ObjectId (nullable)",
  "alert_id": "ObjectId (nullable, ref: alerts — nếu ticket sinh tự động từ Alert)",
  "created_by": "ObjectId (ref: users, nullable nếu hệ thống tự tạo)",
  "type": "enum: SENSOR_FAULT | RS485_BUS_FAILURE | ACTUATOR_FAILURE | NODE_OFFLINE | EDGE_AI_DEGRADED | POWER_OUTAGE | SPEAKER_FAILURE | PREDATOR_DETECTED | INSTALLATION | MAINTENANCE | OTHER",
  "priority": "enum: P1 | P2 | P3",
  "status": "enum: NEW | IN_PROGRESS | AWAITING_FIELD_CONFIRMATION | CLOSED",
  "assigned_to": "ObjectId (ref: users, role=TECHNICIAN)",
  "scheduled_visit_at": "ISODate (nullable — chỉ dùng cho type=INSTALLATION/MAINTENANCE; Farm Owner chọn ngay lúc tạo ticket (TICKET-FR-001), Technician chỉ xác nhận; Admin có thể sửa lại nếu cần điều phối lại, TICKET-FR-005b)",
  "sla_response_due_at": "ISODate",
  "sla_resolve_due_at": "ISODate",
  "is_sla_breached": "boolean",
  "sat_checklist": {
    "modbus_addresses_ok": "boolean",
    "camera_rtsp_ok": "boolean",
    "lte_connection_ok": "boolean",
    "relay_test_ok": "boolean"
  },
  "notes": [
    { "author_id": "ObjectId", "content": "string", "created_at": "ISODate" }
  ],
  "satisfaction_rating": "number (1-5, nullable)",
  "created_at": "ISODate",
  "closed_at": "ISODate (nullable)"
}
```

#### `products` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "harvest_batch_id": "ObjectId (ref: harvest_batches)",
  "created_by": "ObjectId (ref: users, role=SALES_STAFF hoặc FARM_OWNER)",
  "name": "string",
  "description": "string",
  "price_vnd": "number",
  "price_unit": "string",
  "images": ["string (S3 URLs)"],
  "review_status": "enum: PENDING_REVIEW | APPROVED | REJECTED",
  "rejection_reason": "string (nullable)",
  "listing_status": "enum: ACTIVE | OUT_OF_STOCK | HIDDEN",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

#### `inventory` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "product_id": "ObjectId (ref: products, unique)",
  "quantity_available": "number",
  "quantity_reserved": "number (soft-reserve khi có đơn PENDING_CONFIRMATION/CONFIRMED)",
  "low_stock_threshold": "number",
  "updated_at": "ISODate"
}
```

#### `orders` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "order_code": "string (unique, để guest tra cứu)",
  "buyer_id": "ObjectId (nullable, ref: users — null nếu guest checkout)",
  "buyer_name": "string",
  "buyer_phone": "string",
  "buyer_email": "string (nullable)",
  "shipping_address": "string",
  "status": "enum: PENDING_CONFIRMATION | CONFIRMED | PACKED | SHIPPING | DELIVERED | DELIVERY_FAILED | CANCELLED",
  "payment_method": "enum: COD | VNPAY | MOMO | ZALOPAY",
  "payment_status": "enum: UNPAID | PAID | REFUNDED",
  "total_amount_vnd": "number",
  "handled_by": "ObjectId (nullable, ref: users, role=SALES_STAFF)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

#### `order_items` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "order_id": "ObjectId (ref: orders)",
  "product_id": "ObjectId (ref: products)",
  "farm_id": "ObjectId (ref: farms, denormalized để tra cứu nhanh)",
  "quantity": "number",
  "unit_price_vnd": "number (snapshot giá tại thời điểm đặt hàng)"
}
```

#### `shipments` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "order_id": "ObjectId (ref: orders, unique)",
  "carrier": "string (VD: GHN, GHTK, J&T — tùy chọn Giai đoạn 2+)",
  "tracking_code": "string (nullable)",
  "shipped_at": "ISODate (nullable)",
  "delivered_at": "ISODate (nullable)",
  "delivery_note": "string (nullable, lý do thất bại nếu có)"
}
```

#### `return_requests` — [Module SALES — Giai đoạn 2]

```json
{
  "_id": "ObjectId",
  "order_id": "ObjectId (ref: orders)",
  "reason": "string",
  "evidence_images": ["string (S3 URLs)"],
  "status": "enum: SUBMITTED | UNDER_VERIFICATION | APPROVED_REFUND | APPROVED_EXCHANGE | REJECTED",
  "verified_by": "ObjectId (nullable, ref: users, role=SALES_STAFF)",
  "resolved_by": "ObjectId (nullable, ref: users, role=ADMIN)",
  "resolution_note": "string (nullable)",
  "created_at": "ISODate",
  "resolved_at": "ISODate (nullable)"
}
```

#### `sales_assignments` — [ánh xạ nhiều-nhiều Farm ↔ Sales Staff]

```json
{
  "_id": "ObjectId",
  "farm_id": "ObjectId (ref: farms)",
  "sales_staff_id": "ObjectId (ref: users, role=SALES_STAFF)",
  "invited_by": "ObjectId (ref: users, role=FARM_OWNER hoặc ADMIN)",
  "assigned_at": "ISODate"
}
```

---

## 9. Đặc tả Giao diện & API

### 9.0. Quy ước chung của API

| Quy ước                | Mô tả                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Base path**          | Tất cả endpoint dưới đây có prefix `/api/v1` (ví dụ: `POST /api/v1/auth/login`). Version tăng khi có breaking change.        |
| **Định dạng response** | JSON, bọc trong envelope thống nhất: `{ "success": boolean, "data": ..., "error": { "code", "message" } }`                   |
| **Phân trang**         | Query params `page` (mặc định 1), `limit` (mặc định 20, tối đa 100); response kèm `meta: { total, page, limit }`             |
| **Mã lỗi HTTP**        | 400 (validation), 401 (chưa auth), 403 (không đủ quyền), 404 (không tồn tại), 409 (conflict), 429 (rate limit), 500 (server) |
| **Rate limiting**      | Header `X-RateLimit-Limit` / `X-RateLimit-Remaining` trả về trên mọi response đã auth (đối chiếu SEC-NFR-004)                |
| **WebSocket Auth**     | Client gửi JWT Access Token qua `auth: { token }` khi khởi tạo Socket.io connection; server reject nếu invalid/expired       |

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
| POST   | `/auth/forgot-password` | Gửi OTP/link đặt lại mật khẩu (AUTH-FR-009) | Public        |
| POST   | `/auth/reset-password`  | Đặt mật khẩu mới bằng OTP/token nhận được   | Public        |
| POST   | `/auth/delete-request`  | User tự yêu cầu xoá tài khoản (AUTH-FR-012) | JWT           |

#### Farms

| Method | Endpoint                    | Mô tả                                            | Auth                |
| ------ | ---------------------------- | ------------------------------------------------ | ------------------- |
| GET    | `/farms`                     | Danh sách farm của user                          | JWT                 |
| POST   | `/farms`                     | Tạo farm mới (người tạo trở thành Primary Owner) | JWT (OWNER)         |
| GET    | `/farms/:id`                 | Chi tiết farm                                    | JWT                 |
| PUT    | `/farms/:id`                 | Cập nhật farm                                    | JWT (OWNER)         |
| DELETE | `/farms/:id`                 | Xóa mềm farm                                     | JWT (Primary OWNER) |
| POST   | `/farms/:id/members`         | Mời thành viên Farm Owner khác (tạo invitation, AUTH-FR-010) | JWT (OWNER)         |
| DELETE | `/farms/:id/members/:userId` | Gỡ thành viên khỏi Farm                          | JWT (Primary OWNER) |
| GET    | `/invitations/:token`        | Xem chi tiết lời mời trước khi chấp nhận         | Public              |
| POST   | `/invitations/:token/accept` | Chấp nhận lời mời (Farm Owner hoặc Sales Staff)  | Public/JWT          |
| POST   | `/invitations/:token/decline`| Từ chối lời mời                                  | Public              |

#### Quản lý Tài khoản — [Admin, mới v1.12.0]

| Method | Endpoint                | Mô tả                                                        | Auth         |
| ------ | ------------------------ | ------------------------------------------------------------- | ------------ |
| GET    | `/admin/users`           | Danh sách toàn bộ tài khoản (filter theo role/trạng thái)     | JWT (ADMIN)  |
| PUT    | `/admin/users/:id/status`| Khoá/mở khoá tài khoản kèm lý do (AUTH-FR-011)                | JWT (ADMIN)  |
| GET    | `/admin/delete-requests` | Danh sách yêu cầu xoá tài khoản đang chờ xử lý                | JWT (ADMIN)  |
| PUT    | `/admin/delete-requests/:id/complete` | Xác nhận đã xoá xong dữ liệu theo AUTH-FR-012    | JWT (ADMIN)  |

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

#### Tickets & SLA — [Module TICKET]

| Method | Endpoint                     | Mô tả                                                          | Auth                   |
| ------ | ---------------------------- | -------------------------------------------------------------- | ---------------------- |
| POST   | `/tickets`                   | Farm Owner tạo ticket báo lỗi thủ công                         | JWT (OWNER)            |
| GET    | `/tickets`                   | Danh sách ticket (filter theo farm/status/priority/assignee)   | JWT                    |
| GET    | `/tickets/:id`               | Chi tiết ticket + lịch sử ghi chú                              | JWT                    |
| PUT    | `/tickets/:id/status`        | Technician cập nhật trạng thái ticket                          | JWT (TECHNICIAN)       |
| POST   | `/tickets/:id/notes`         | Thêm ghi chú xử lý                                             | JWT                    |
| PUT    | `/tickets/:id/sat-checklist` | Cập nhật checklist nghiệm thu lắp đặt                          | JWT (TECHNICIAN)       |
| POST   | `/tickets/:id/escalate`      | Escalate thủ công lên Admin (ngoài cơ chế tự động SLA-NFR-002) | JWT (TECHNICIAN/ADMIN) |
| POST   | `/tickets/:id/rating`        | Farm Owner đánh giá mức hài lòng sau khi đóng ticket           | JWT (OWNER)            |
| GET    | `/tickets/kpi`               | Dashboard KPI xử lý ticket theo Technician                     | JWT (ADMIN)            |

#### Sales, Inventory & Orders — [Module SALES — Giai đoạn 2]

| Method | Endpoint                       | Mô tả                                                                 | Auth                          |
| ------ | ------------------------------ | --------------------------------------------------------------------- | ----------------------------- |
| POST   | `/farms/:id/sales-staff`       | Farm Owner mời Sales Staff vào Farm                                   | JWT (OWNER)                   |
| GET    | `/farms/:id/sales-staff`       | Danh sách Sales Staff của Farm                                        | JWT (OWNER)                   |
| POST   | `/products`                    | Sales Staff tạo Product từ Harvest Batch                              | JWT (SALES_STAFF/OWNER)       |
| PUT    | `/products/:id`                | Chỉnh sửa Product (chỉ khi chưa APPROVED hoặc theo quy tắc duyệt lại) | JWT (SALES_STAFF/OWNER)       |
| POST   | `/products/:id/submit-review`  | Gửi Product cho Admin duyệt                                           | JWT (SALES_STAFF/OWNER)       |
| PUT    | `/products/:id/review`         | Admin duyệt/từ chối Product                                           | JWT (ADMIN)                   |
| GET    | `/products`                    | Danh sách Product công khai (filter, phân trang)                      | **Public**                    |
| GET    | `/inventory/:productId`        | Xem tồn kho hiện tại của 1 Product                                    | JWT (SALES_STAFF/OWNER)       |
| POST   | `/orders`                      | Buyer tạo đơn hàng (hỗ trợ guest checkout, tự soft-reserve tồn kho)   | **Public**                    |
| GET    | `/orders/:orderCode`           | Tra cứu đơn hàng theo mã (guest) hoặc theo JWT (Buyer có tài khoản)   | Public/JWT                    |
| GET    | `/orders`                      | Danh sách đơn hàng (Sales Staff xem theo Farm được gán)               | JWT (SALES_STAFF/ADMIN)       |
| PUT    | `/orders/:id/confirm`          | Sales Staff xác nhận đơn (kiểm tra tồn kho)                           | JWT (SALES_STAFF)             |
| PUT    | `/orders/:id/status`           | Cập nhật trạng thái đơn theo từng bước (PACKED/SHIPPING/DELIVERED)    | JWT (SALES_STAFF)             |
| POST   | `/orders/:id/return-requests`  | Buyer/Sales Staff tạo yêu cầu đổi trả                                 | Public/JWT                    |
| PUT    | `/return-requests/:id/verify`  | Sales Staff xác minh tình trạng hàng hoàn                             | JWT (SALES_STAFF)             |
| PUT    | `/return-requests/:id/resolve` | Admin ra quyết định cuối (hoàn tiền/đổi hàng/từ chối)                 | JWT (ADMIN)                   |
| GET    | `/sales-reports`               | Báo cáo doanh số theo Farm/khoảng thời gian                           | JWT (SALES_STAFF/OWNER/ADMIN) |

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
TELEMETRY_UPDATE: { zoneId, temperature, humidity, light, nh3, co2, sound, timestamp }
RELAY_UPDATE: { zoneId, relayName, state, mode }
BIRD_COUNT_UPDATE: { zoneId, entryCount, exitCount, sessionType, timestamp }
ALERT_NEW: { alertId, severity, type, title, message, snapshotUrl }
DEVICE_STATUS_CHANGE: { nodeId, status, timestamp }
```

> **[Sửa v1.12.0]** `TELEMETRY_UPDATE` trước đây còn sót `h2s`, `tvoc` — 2 trường này đã bị loại bỏ khỏi `ENV-FR-003`/schema `telemetry` từ v1.8.0 (không mua cảm biến rời) nhưng quên cập nhật ở đây, gây lệch giữa event payload và dữ liệu thật.

---

## 10. Luồng Xử lý Nghiệp vụ (Flows)

### Flow 1: Onboarding Thiết bị (Technician Web Console — FARM-FR-003/003b)

> **[Cập nhật — mô hình "công ty vận hành, khách hàng chỉ dùng"]** Khác bản trước (Farm Owner tự quét QR qua Mobile App): đăng ký/kích hoạt thiết bị giờ là 1 luồng nghiệp vụ chính thức trên **Web, chỉ Technician thao tác** — giống kỹ thuật viên nhà mạng/lắp camera tới lắp đặt và kích hoạt kết nối trong cùng 1 lượt. Farm Owner không tham gia luồng này, chỉ thấy kết quả cuối (thiết bị xuất hiện trong Zone, có dữ liệu).

```
0. (Tiền đề) Farm Owner đã tạo Farm→House→Zone từ trước trên Web (FARM-FR-001/002);
   nếu chưa có, Technician có thể tạo hộ khi tới lắp đặt (cùng quyền truy cập Farm
   qua assigned_regions).
1. Technician lắp đặt phần cứng tại farm: đấu dây RS485 (5 cảm biến), đấu relay 4 kênh,
   cấp nguồn ESP32.
2. Technician đăng nhập Web Dashboard (tài khoản Technician) → mở "Web Console
   Onboarding" → chọn Farm → House → Zone đích.
3. Quét/nhập Device ID + secretKey in trên vỏ ESP32 (được công ty cấp sẵn lúc chuẩn bị
   thiết bị, không phải Farm Owner tự sinh ra) → Technician bấm "Bắt đầu kích hoạt".
4. Backend xác thực {deviceId, secretKey}, tạo SensorNode record (trạng thái PENDING,
   gán sẵn zone_id đã chọn ở bước 2), sinh mqttCredentials riêng cho thiết bị này.
5. Vì ESP32 mới chưa có WiFi, Technician dùng điện thoại/laptop kết nối vào mạng AP
   tạm do ESP32 tự phát ("SwiftletCare-Setup-<deviceId>") — Web Console hiển thị
   hướng dẫn bước này.
6. Technician mở trang cấu hình cục bộ tại 192.168.4.1 (do ESP32 tự phục vụ) → điền
   WiFi thật của farm; Web Console (đang mở song song trên mạng chính) đẩy kèm
   {farmId, houseId, zoneId, mqttCredentials} xuống thiết bị qua cùng kết nối AP.
7. ESP32 lưu cấu hình vào NVS, khởi động lại, tự kết nối WiFi thật + MQTT Broker
   bằng mqttCredentials nhận được.
8. ESP32 gửi heartbeat đầu tiên → Backend cập nhật SensorNode status: PENDING → ONLINE.
9. Web Console hiển thị "Thiết bị đã kết nối thành công" → Technician xác nhận bàn giao.
10. Farm Owner đăng nhập Web Dashboard, thấy thiết bị mới đã có dữ liệu trong đúng Zone —
    không cần thao tác gì thêm.

--- Trường hợp lỗi/ngoại lệ ---
3a. secretKey sai hoặc deviceId đã được đăng ký cho Farm khác trước đó → Web Console
    báo lỗi rõ ràng ("Mã kích hoạt không đúng" / "Thiết bị đã thuộc về Farm khác"),
    không tạo SensorNode record, Technician kiểm tra lại nhãn dán trên vỏ máy
5a. Technician không kết nối được vào AP tạm của ESP32 (tín hiệu yếu, ESP32 lỗi khi
    boot vào chế độ AP) → SensorNode vẫn ở status PENDING → Web Console cho phép
    "Thử lại" (ESP32 tự quay lại AP-mode nếu sau 5 phút không nhận được cấu hình
    mới, không cần rút nguồn cắm lại thủ công)
6a. Technician điền sai WiFi thật của farm (sai mật khẩu) → bước 7 thất bại, ESP32
    không kết nối được WiFi thật → tự động quay lại AP-mode sau 60 giây để nhập lại,
    KHÔNG mất cấu hình farmId/houseId/zoneId/mqttCredentials đã nhận trước đó
7a. WiFi thật đúng nhưng MQTT Broker không kết nối được (broker down, sai
    mqttCredentials do lỗi backend) → ESP32 vẫn giữ kết nối WiFi, tự retry MQTT mỗi
    10s; nếu quá 5 phút chưa kết nối được, Web Console hiển thị cảnh báo cho
    Technician biết cần kiểm tra phía backend/broker (không phải lỗi tại thiết bị)
8a. Quá 15 phút kể từ bước 4 mà chưa nhận heartbeat đầu tiên (SensorNode vẫn PENDING)
    → hệ thống tự đánh dấu ticket/record là "Kích hoạt quá hạn", Technician xem lại
    toàn bộ các bước 5-7 tại hiện trường trước khi báo hỏng thiết bị
```

### Flow 1b: Onboarding AI Camera Node (Raspberry Pi) — Technician thực hiện

```
1. Technician lắp đặt Camera IP PoE + Raspberry Pi tại Zone, đấu nối PoE Switch.
2. Technician mở Web Console Onboarding → chọn Farm → House → Zone → loại thiết bị
   "AI Camera Node" → quét/nhập Node ID + secretKey (dán sẵn trên vỏ RPi).
3. Web Console gửi POST /devices/camera-nodes/register {nodeId, secretKey, zoneId, rtspUrl}
4. Backend tạo camera_node record, trả về {mqttCredentials, streamConfig}
5. Technician cấu hình RTSP URL của Camera IP PoE vào RPi (qua màn hình HDMI tạm thời
   hoặc SSH) và nhập WiFi/LAN nếu cần
6. RPi khởi động service AI (PM2) → kết nối MQTT Broker → publish heartbeat đầu tiên
7. RPi chạy self-test: đọc thử 10 frame từ RTSP, xác nhận FPS ≥ 25 trước khi báo ONLINE
8. Backend cập nhật status ONLINE → Web Console hiển thị "Camera đã kết nối thành công"
   kèm ảnh preview 1 frame → Technician xác nhận bàn giao
9. Nếu self-test thất bại (FPS thấp hoặc RTSP timeout) → Web Console hiển thị lỗi cụ thể
   và gợi ý khắc phục (kiểm tra dây LAN, nguồn PoE) ngay tại hiện trường

--- Trường hợp lỗi/ngoại lệ ---
3a. secretKey sai hoặc nodeId đã đăng ký cho Farm khác → giống Flow 1 bước 3a, không
    tạo camera_node record
9a. Self-test thất bại lặp lại > 3 lần liên tiếp (đã kiểm tra dây/nguồn) → Technician
    tạo Ticket loại `SENSOR_FAULT` ngay tại chỗ (không cần rời farm rồi Farm Owner
    phải tạo lại) để theo dõi lịch sử xử lý, nghi ngờ lỗi phần cứng Camera/RPi cần
    đổi máy
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
0. (Bối cảnh) 5:30–7:00 sáng cùng ngày, RPi đã chạy "Morning Session" (session_type: MORNING_EXIT) tương tự các bước 1–7 bên dưới nhưng đếm theo chiều ra → kết thúc lưu exit_count = 1823 vào `bird_count_records`
1. 17:30 - RPi bắt đầu "Evening Session" mode (tăng độ nhạy detection)
2. Camera stream RTSP → RPi decode frame @ 30FPS
3. YOLOv8 detect: [{class: "swiftlet", bbox: [x,y,w,h], conf: 0.92}]
4. ByteTrack assign Track ID: track_id=15
5. Frame t+1: track_id=15 vượt qua crossing line → direction: INWARD
6. Increment entry_count: 1547
7. Mỗi 30 giây publish MQTT: {sessionType: "EVENING_ENTRY", entryCount: 1547, exitCount: 0}
8. 19:00 - RPi kết thúc session → Backend truy vấn exit_count = 1823 của MORNING_EXIT session cùng ngày, cùng zone → compute return_rate = 1547/1823 = 84.8% (theo công thức VISION-FR-009)
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

--- Trường hợp lỗi/ngoại lệ ---
9a. Farm Owner xem ảnh snapshot và xác định đây là **false positive** (VD: bóng đổ
    giống hình rắn) → acknowledge với ghi chú "Báo động giả" thay vì "Đã xử lý" —
    dữ liệu này được giữ lại làm feedback cải thiện model AI ở Phase 3 (không có
    vòng lặp tự động retrain trong phạm vi KLTN, chỉ lưu để nhóm xem xét thủ công)
9b. Farm Owner không mở app trong 15 phút (CRITICAL chưa acknowledge) → hệ thống tự
    tạo Ticket theo TICKET-FR-002, chuyển sang Flow 9 để Technician cũng được báo
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

--- Trường hợp lỗi/ngoại lệ ---
3a. Zone chưa đủ 7 ngày dữ liệu telemetry (farm mới, mới lắp thiết bị) → hệ thống
    vẫn tạo Harvest Batch nhưng `env_snapshot` đánh dấu `insufficient_data: true`,
    hiển thị rõ trên Traceability Card ("Chưa đủ dữ liệu môi trường lịch sử") thay
    vì hiện số liệu sai lệch hoặc rỗng gây hiểu nhầm
5a. Owner sửa/xoá Harvest Batch sau khi đã "Đăng bán" (status khác DRAFT) → hệ thống
    từ chối theo MARKET-FR-005, chỉ cho cập nhật trạng thái Listing (AVAILABLE/
    SOLD/HIDDEN), không cho sửa lại env_snapshot/flock_snapshot đã gắn — đảm bảo
    tính toàn vẹn dữ liệu truy xuất đã công bố
11a. Buyer nhập/quét Trace Code không tồn tại hoặc sai định dạng → trả về thông báo
    rõ ràng "Không tìm thấy lô yến với mã này, vui lòng kiểm tra lại" (không lộ chi
    tiết lỗi hệ thống), tránh dùng để dò brute-force trace_code (thêm rate limit
    theo SEC-NFR-004 cho riêng endpoint public này)
```

### Flow 8: Xử lý Sự cố Cảm biến RS485 & Cảnh báo Đa kênh (Sensor-to-Alert)

```
1. Mỗi 10 giây, ESP32-S3 gửi Modbus request (0x03/0x04) lần lượt qua Addr 1 → 5
2a. Nếu 1 địa chỉ timeout/lỗi CRC → giữ giá trị cũ, gắn cờ stale
2b. Nếu ≥ 3/5 địa chỉ timeout liên tiếp trong 3 chu kỳ → nghi ngờ lỗi vật lý toàn bus
3a. Trường hợp 2a → publish Alert: SENSOR_FAULT (MEDIUM)
3b. Trường hợp 2b → publish Alert: RS485_BUS_FAILURE (CRITICAL) (theo THREAT-FR-013)
4. Backend nhận, lưu Alert, Alert Engine phân loại mức độ, dedup 5 phút/Zone
5. Gửi đa kênh: FCM Push, Zalo ZNS (nếu CRITICAL/HIGH), SMS dự phòng
6. Farm Owner nhận cảnh báo → thử điều khiển thủ công (nếu là lỗi actuator) hoặc xem chi tiết (nếu là lỗi cảm biến/bus)
7. Nếu Farm Owner không tự xử lý được → tạo Ticket liên kết Alert (TICKET-FR-002) → chuyển sang Flow 9
8. Nếu trong ngưỡng an toàn → chỉ cập nhật Dashboard qua WebSocket, không cảnh báo
```

### Flow 9: Vòng đời Ticket & SLA (Farm Owner ↔ Technician ↔ Admin)

```
1. Ticket được tạo (thủ công bởi Farm Owner, hoặc tự động từ Alert CRITICAL/HIGH chưa ack sau 15 phút)
2. Hệ thống gán priority P1/P2/P3 theo loại lỗi (VD: RS485_BUS_FAILURE, PREDATOR_DETECTED → P1 mặc định)
3. Ticket Router gán Technician theo assigned_regions của Farm; tính sla_response_due_at, sla_resolve_due_at
4. Technician nhận thông báo → xác nhận tiếp nhận → status: IN_PROGRESS
5. Technician chẩn đoán từ xa (xem log telemetry, gửi lệnh restart/OTA qua MQTT command)
6a. Xử lý được từ xa → status: CLOSED, ghi chú nguyên nhân
6b. Cần đến hiện trường → lên lịch hẹn với Farm Owner → sửa chữa/thay thế → chạy lại checklist SAT → status: CLOSED
7. Trong suốt quá trình, nếu vượt sla_resolve_due_at mà chưa CLOSED → hệ thống tự động escalate (SLA-NFR-002):
   thông báo Administrator + gán thêm Technician dự phòng
7b. Ngoài escalate tự động ở bước 7, Administrator có thể chủ động xem và can thiệp
    sửa ticket này (đổi Technician, đổi priority, đóng/huỷ) bất kỳ lúc nào nếu phát
    sinh vấn đề/khiếu nại, không cần đợi vượt SLA (TICKET-FR-005b)
8. Farm Owner đánh giá mức độ hài lòng (1-5 sao) sau khi ticket đóng
9. Administrator xem dashboard KPI: tỉ lệ đúng SLA theo từng Technician (TICKET-FR-012)

--- Trường hợp lỗi/ngoại lệ ---
4a. Technician bị gán nhầm (ticket ngoài `assigned_regions` do dữ liệu farm sai địa
    chỉ, hoặc Technician đang nghỉ) → Technician bấm "Yêu cầu gán lại" kèm lý do →
    ticket quay về hàng đợi, Ticket Router thử gán Technician dự phòng khác
    (TICKET-FR-005); nếu vẫn không có ai phù hợp → escalate cho Admin
5a. Sự cố tự hết trước khi Technician kịp xử lý (VD: mất điện tạm thời rồi có điện
    lại, alert tự chuyển RESOLVED) → Technician xác nhận không cần can thiệp thêm →
    status: CLOSED, ghi chú "Tự phục hồi, không cần sửa chữa"
6c. Farm Owner tự huỷ ticket giữa chừng (đã tự khắc phục được, hoặc báo nhầm) →
    status: CLOSED kèm ghi chú "Farm Owner tự đóng" — Technician đang xử lý (nếu đã
    IN_PROGRESS) nhận thông báo dừng, không cần tới hiện trường nữa
```

### Flow 9b: Yêu cầu Lắp đặt Nhà Yến Mới (Farm Owner → Ticket Router → Technician)

> Khác Flow 9 chỉ ở **loại ticket và SLA** (lên lịch hẹn thay vì khắc phục sự cố) — cơ chế định tuyến giống hệt nhau: Ticket Router tự động gán theo `assigned_regions`, không cần Admin can thiệp từng ticket, vì Admin **đã điều phối trước** ở bước gán khu vực phụ trách cho Technician (AUTH-FR-005c) — không phải điều phối lại mỗi khi có ticket mới. Đây là luồng trả lời câu hỏi "farm owner có nhà yến mới thì sao" — Farm Owner không tự lắp/kích hoạt được (xem actor Farm Owner, mục 4.1), phải qua ticket này.

```
1. Farm Owner có nhà yến mới → mở Web Dashboard → "Yêu cầu lắp đặt" → tạo ticket
   type=INSTALLATION: mô tả (VD: "Nhà yến mới, 1 tầng, cần 1 bộ ESP32 + 5 cảm biến"),
   địa chỉ, số lượng House/Zone dự kiến, và chọn thẳng NGÀY GIỜ HẸN cụ thể
   (`scheduled_visit_at`, TICKET-FR-001/004b) — không có bước liên hệ qua lại để
   chốt lịch. (Nếu House/Zone thật trong hệ thống chưa có — có thể tạo cùng lúc
   Technician xuống khảo sát, hoặc Farm Owner tự tạo House rỗng trước theo
   FARM-FR-002, tuỳ chọn.)
2. Ticket vào trạng thái `MỚI`, priority mặc định P3 (TICKET-FR-003)
3. Ticket Router tự động gán ticket cho Technician phụ trách khu vực của Farm, theo
   `assigned_regions` mà Admin đã thiết lập từ trước (TICKET-FR-004) — giống hệt cơ
   chế Flow 9, không có bước Admin duyệt/chọn tay ở đây
4. **Tiếp nhận:** Technician nhận thông báo được gán, thấy sẵn ngày giờ hẹn Farm
   Owner đã chọn → bấm xác nhận tiếp nhận → status: `MỚI` → `ĐANG XỬ LÝ`. Nếu không
   sắp xếp được đúng giờ đó, Technician tự sửa `scheduled_visit_at` kèm ghi chú, hoặc
   báo Administrator can thiệp gán lại/đổi lịch (TICKET-FR-005b)
5. **Đang xử lý:** đúng ngày giờ hẹn, Technician xuống farm, khảo sát/tạo House-Zone
   còn thiếu (FARM-FR-001/002 — nếu Farm Owner chưa tạo trước), lắp đặt phần cứng,
   rồi thực hiện Flow 1 (Onboarding Thiết bị qua Web Console) để kích hoạt thiết bị
   vào đúng Zone — ticket vẫn ở status `ĐANG XỬ LÝ` trong suốt quá trình này
6. **Chờ xác nhận hiện trường:** Technician hoàn thành checklist nghiệm thu SAT
   (TICKET-FR-010: 5 địa chỉ Modbus, camera RTSP, kết nối 4G, relay đóng/ngắt) →
   cập nhật ticket status: `ĐANG XỬ LÝ` → `CHỜ XÁC NHẬN HIỆN TRƯỜNG`
7. **Đóng ticket:** sau khi checklist đạt, Technician đóng ticket → status:
   `CHỜ XÁC NHẬN HIỆN TRƯỜNG` → `ĐÃ ĐÓNG` (mỗi bước đổi trạng thái đều ghi log kèm
   ghi chú, TICKET-FR-007)
8. Farm Owner nhận thông báo "Nhà yến mới đã sẵn sàng" → đăng nhập, thấy House/Zone
   mới đã có dữ liệu thời gian thực, không cần thao tác kỹ thuật gì thêm
9. Farm Owner đánh giá mức độ hài lòng (1-5 sao, TICKET-FR-011, tuỳ chọn)
10. **Xuyên suốt các bước 2-9:** Administrator có thể xem và can thiệp sửa ticket này
    bất kỳ lúc nào (đổi Technician, đổi ngày giờ, đổi priority, đóng/huỷ) nếu phát
    sinh vấn đề — không phải chỉ giới hạn ở trường hợp ngoại lệ (TICKET-FR-005b).
    Bình thường Admin không cần thao tác gì, chỉ xem KPI tổng hợp (TICKET-FR-012)

--- Trường hợp lỗi/ngoại lệ ---
4a. Farm Owner huỷ yêu cầu trước ngày hẹn (đổi ý, hoặc dời vô thời hạn) — có thể xảy
    ra ở bất kỳ thời điểm nào từ bước 1 đến trước bước 5 → Farm Owner tự đổi status
    ticket → `ĐÃ ĐÓNG` (huỷ), ghi chú lý do — Technician được gán nhận thông báo để
    không xuống farm theo lịch cũ
4b. Đến ngày hẹn nhưng Technician không tới được (ốm, sự cố cá nhân) và không kịp tự
    đổi lịch → sau `sla_response_due_at` mà ticket vẫn `MỚI`/chưa xác nhận tiếp nhận
    đúng hạn → tự động escalate cho Administrator (giống TICKET-FR-009) để gán
    Technician dự phòng
6a. SAT checklist KHÔNG đạt (VD: 1/5 địa chỉ Modbus không phản hồi, camera RTSP
    chập chờn) → Technician KHÔNG được đóng ticket (TICKET-FR-010 chặn cứng) →
    ghi chú lý do → status giữ `ĐANG XỬ LÝ`, đặt lại `scheduled_visit_at` cho lần
    quay lại gần nhất (VD: chờ hàng thay thế) → Farm Owner nhận thông báo "Cần
    thêm 1 buổi lắp đặt" kèm lý do
```

### Flow 10: Đặt hàng, Xử lý Đơn & Đổi trả (Buyer ↔ Sales Staff ↔ Admin) — [Giai đoạn 2]

```
1. Buyer xem Product (đã qua Admin duyệt) → xem Traceability Card → thêm giỏ hàng
2. Buyer checkout: chọn guest checkout hoặc đăng nhập → nhập địa chỉ giao hàng → chọn COD/thanh toán online
3. Nếu thanh toán online: chuyển cổng thanh toán → xác nhận kết quả
   3a. Thanh toán thành công → tạo Order (status: PENDING_CONFIRMATION)
   3b. Thanh toán thất bại/huỷ giữa chừng (hết phiên, sai OTP ngân hàng...) → KHÔNG
       tạo Order, KHÔNG soft-reserve tồn kho, Buyer quay lại giỏ hàng thử lại
   Nếu COD: tạo Order ngay (status: PENDING_CONFIRMATION)
4. Hệ thống soft-reserve số lượng tương ứng trong Inventory (SALES-FR-006)
4a. Sản phẩm vừa hết hàng đúng lúc Buyer checkout (race condition 2 Buyer cùng mua
    sản phẩm sắp hết) → thao tác soft-reserve atomic ở tầng DB (SALES-NFR-001) đảm
    bảo chỉ 1 Buyer giữ được hàng; Buyer còn lại nhận lỗi rõ ràng "Sản phẩm vừa hết
    hàng" ngay khi checkout, không tạo Order treo
5. Order được gửi đến Sales Staff phụ trách Farm nguồn của sản phẩm
6. Sales Staff kiểm tra tồn kho thật → xác nhận đơn (status: CONFIRMED)
   Nếu Farm đang có ticket P1/CRITICAL mở → hệ thống cảnh báo chéo, Sales Staff cân nhắc liên hệ Buyer trước khi xác nhận (SALES-FR-016)
7. Sales Staff đóng gói (status: PACKED) → nhập mã vận đơn, bàn giao vận chuyển (status: SHIPPING)
8. Buyer theo dõi trạng thái real-time qua WebSocket/thông báo
9a. Giao thành công → status: DELIVERED → trừ tồn kho chính thức (SALES-FR-009) → Buyer đánh giá sản phẩm
9b. Giao thất bại → status: DELIVERY_FAILED → Sales Staff liên hệ Buyer xử lý giao lại/hủy → nếu hủy, hoàn tồn kho tạm giữ
10. Nếu Buyer không hài lòng → tạo Return Request → Admin tiếp nhận → chuyển Sales Staff xác minh tình trạng hàng
11. Sales Staff xác nhận đủ/không đủ điều kiện đổi-trả → Admin ra quyết định cuối: hoàn tiền qua cổng thanh toán hoặc điều phối đổi hàng
```

### Flow 11: Đăng ký, Đăng nhập & Quản lý Phiên (Farm Owner/Buyer) — [mới v1.12.0]

```
1. User mở Web → "Đăng ký" → nhập email/SĐT → hệ thống gửi OTP (AUTH-FR-001)
2. User nhập OTP đúng trong thời hạn → tạo tài khoản (`role: FARM_OWNER` nếu đăng ký
   từ Web Dashboard, hoặc `role: null` nếu là Buyer đăng ký từ Marketplace — AUTH-FR-004,
   SALES-FR-013) → Farm Owner tự động trở thành Primary Owner nếu đây là Farm đầu
   tiên họ tạo
3. Đăng nhập bằng email/mật khẩu hoặc OAuth2 Google (AUTH-FR-002) → nhận Access
   Token (15 phút) + Refresh Token (30 ngày, lưu ở httpOnly cookie)
4. Access Token hết hạn giữa phiên làm việc → Frontend tự gọi POST /auth/refresh
   bằng Refresh Token → nhận Access Token mới, User không cảm nhận được gián đoạn
5. User bấm "Đăng xuất" → Refresh Token hiện tại bị thu hồi (POST /auth/logout)

--- Trường hợp lỗi/ngoại lệ ---
1a. Email/SĐT đã tồn tại → hệ thống báo lỗi, gợi ý "Quên mật khẩu" (Flow 11 bước
    dưới) thay vì tạo trùng tài khoản
2a. OTP sai quá 5 lần hoặc hết hạn (TTL mặc định 5 phút) → yêu cầu gửi lại OTP mới,
    khoá tạm gửi OTP 60 giây/lần để chống spam SMS/email
3a. Sai mật khẩu quá 5 lần liên tiếp trong 15 phút → khoá đăng nhập tạm thời 15 phút
    cho tài khoản đó (không phải khoá vĩnh viễn như AUTH-FR-011 do Admin) — chống
    brute-force, không cần code CAPTCHA riêng cho phạm vi KLTN
3b. Tài khoản bị Admin khoá (`is_active=false`) → đăng nhập thành công về mặt mật
    khẩu nhưng bị chặn ngay sau đó, hiển thị "Tài khoản đã bị khoá, liên hệ hỗ trợ"
    kèm lý do nếu Admin đã ghi (AUTH-FR-011)
4a. Refresh Token hết hạn (>30 ngày không dùng) hoặc đã bị thu hồi (do đổi mật khẩu
    ở nơi khác — AUTH-FR-009, hoặc bị Admin khoá) → Frontend buộc đăng xuất, chuyển
    về màn hình đăng nhập, không tự đăng nhập lại được

--- Quên mật khẩu (AUTH-FR-009) ---
6. User bấm "Quên mật khẩu" → nhập email/SĐT → POST /auth/forgot-password → nhận
   OTP/link đặt lại (TTL 15 phút, dùng 1 lần)
7. User nhập OTP + mật khẩu mới → POST /auth/reset-password → mật khẩu đổi thành
   công → mọi Refresh Token cũ bị thu hồi → yêu cầu đăng nhập lại
7a. OTP/link hết hạn hoặc đã dùng → hệ thống từ chối, yêu cầu bắt đầu lại từ bước 6
```

### Flow 12: Mời & Quản lý Thành viên Farm (Farm Owner) — [mới v1.12.0]

```
1. Primary Owner mở Farm → "Mời thành viên" → nhập email + chọn vai trò
   (FARM_OWNER khác — AUTH-FR-005, hoặc Sales Staff — AUTH-FR-005b)
2. Hệ thống tạo `Invitation` (status: PENDING, TTL 7 ngày) → gửi email/thông báo
   kèm link `/invitations/:token`
3a. Email đã có tài khoản → người được mời đăng nhập → bấm "Chấp nhận" →
    POST /invitations/:token/accept → thêm vào `farms.members` (Farm Owner) hoặc
    tạo `SalesAssignment` (Sales Staff) → status: ACCEPTED
3b. Email chưa có tài khoản → bấm link mời → dẫn thẳng vào Flow 11 bước 1 (đăng ký)
    với email pre-fill → đăng ký xong tự động accept invitation luôn, không cần
    thao tác thêm lần 2
4. Người mời (Primary Owner) thấy thành viên mới xuất hiện trong danh sách Farm,
   có quyền vận hành ngang nhau ngay lập tức (AUTH-FR-005)
5. Primary Owner có thể gỡ thành viên bất kỳ lúc nào (DELETE /farms/:id/members/:userId)
   → thành viên bị gỡ mất quyền truy cập Farm ngay (JWT vẫn hợp lệ nhưng middleware
   kiểm tra lại `farms.members` mỗi request, không cache quyền trong token)

--- Trường hợp lỗi/ngoại lệ ---
3c. Người được mời bấm "Từ chối" → status: DECLINED, Primary Owner nhận thông báo
3d. Quá 7 ngày không phản hồi → status tự chuyển EXPIRED, link không còn dùng được
    → Primary Owner phải gửi lời mời mới nếu vẫn cần
5a. Primary Owner cố gỡ chính mình → hệ thống từ chối (Farm luôn phải có ít nhất 1
    Primary Owner) — muốn rời Farm, Primary Owner phải chuyển quyền cho thành viên
    khác trước (thao tác thủ công qua Admin nếu cần, ngoài phạm vi UI tự phục vụ
    Phase 1)
```

### Flow 13: Điều khiển Relay Thủ công & Tự động Hết hạn Override (Farm Owner) — [mới v1.12.0, ENV-FR-016..019]

```
1. Farm Owner mở Dashboard Zone → bấm bật/tắt 1 relay (VD: Misting) thủ công
2. Frontend gọi POST /devices/sensor-nodes/:id/relay {relayName, state: true} →
   Backend cập nhật `control_mode: MANUAL`, đặt `override_expiry = now + 30 phút`
   (mặc định, cấu hình được — ENV-FR-018), publish MQTT command tới ESP32
3. ESP32 nhận lệnh → đóng relay → publish `relay/status` xác nhận → Backend cập
   nhật `relay_states` thật, emit RELAY_UPDATE qua WebSocket
4. Dashboard hiển thị relay đang ở chế độ MANUAL kèm đồng hồ đếm ngược tới
   `override_expiry` (ENV-FR-017 — cảnh báo rõ ràng khi đang override)
5. PID Control tạm dừng cho riêng relay đó trong lúc MANUAL (relay khác vẫn tự động
   bình thường)
6. Hết 30 phút → hệ thống tự trả relay đó về `control_mode: AUTO`, publish lệnh tắt
   override xuống ESP32 → PID tiếp quản lại theo ngưỡng đã cấu hình (ENV-FR-018)
7. Mọi lần bật/tắt override được ghi lại: user, thời gian, relay, trạng thái
   (ENV-FR-019)

--- Trường hợp lỗi/ngoại lệ ---
2a. ESP32 đang mất kết nối MQTT lúc Farm Owner bấm nút → Backend vẫn cập nhật DB
    lạc quan (optimistic) nhưng Dashboard hiển thị rõ trạng thái "Đang chờ xác
    nhận từ thiết bị" (khác màu với trạng thái đã xác nhận) cho tới khi nhận được
    `relay/status` thật — tránh Farm Owner tưởng lầm lệnh đã chạy trong khi ESP32
    chưa hề nhận được
2b. Quá 30 giây không nhận được xác nhận từ ESP32 → Dashboard báo "Không thể xác
    nhận trạng thái relay, kiểm tra kết nối thiết bị" (liên kết chéo với Flow 14 —
    có thể thiết bị đã mất kết nối)
4a. Farm Owner muốn gia hạn thêm trước khi hết 30 phút → bấm lại nút bật (idempotent,
    cùng trạng thái) → `override_expiry` được làm mới thêm 30 phút từ thời điểm đó
6a. Ngay lúc hệ thống tự trả về AUTO (bước 6) mà ESP32 đang mất kết nối → lệnh trả
    về AUTO được xếp hàng, ESP32 tự áp dụng ngay khi kết nối lại (không bị mất lệnh)
```

### Flow 14: Thiết bị Mất kết nối/Mất nguồn → Dashboard Tự động chuyển Offline (Farm Owner) — [mới v1.12.0, FARM-FR-005]

> Trả lời trực tiếp câu hỏi thực tế đã phát sinh trong quá trình phát triển: "nếu rút thiết bị ra hoặc mất nguồn thì Dashboard có tự hiểu là Offline không". Đã cài đặt thật (không chỉ là đặc tả trên giấy).

```
1. ESP32 gửi heartbeat mỗi 30 giây (MQTT_HEARTBEAT_MS, mục 7.2) trong điều kiện
   hoạt động bình thường → Backend cập nhật `last_heartbeat`, `status: ONLINE`
2. Farm Owner rút nguồn/dây mạng của ESP32 → thiết bị ngừng gửi heartbeat và
   telemetry ngay lập tức, không có tín hiệu "tôi sắp tắt" nào được gửi trước
   (mất điện đột ngột, không phải graceful shutdown)
3. Một job nền chạy mỗi 10 giây quét toàn bộ SensorNode đang `ONLINE` nhưng
   `last_heartbeat` đã quá 30 giây (FARM-FR-005) → tự động chuyển `status: OFFLINE`
4. Backend phát sự kiện `DEVICE_STATUS_CHANGE` qua WebSocket tới mọi client đang
   mở Zone đó
5. Trang "Thiết bị" (Devices) cập nhật chấm trạng thái (StatusDot) từ xanh → đỏ
   ngay lập tức, không cần Farm Owner bấm F5
6. Song song, badge "Live" trên Dashboard cũng tự chuyển "Mất kết nối" sau tối đa
   20 giây không nhận thêm dữ liệu telemetry mới — cơ chế độc lập ở phía client,
   phản ứng nhanh hơn 30 giây từ phía backend, phòng trường hợp socket bị nghẽn
7. Farm Owner cắm nguồn/dây mạng lại → ESP32 khởi động, kết nối WiFi + MQTT →
   gửi heartbeat đầu tiên → Backend chuyển lại `status: ONLINE` → DEVICE_STATUS_CHANGE
   phát lại → Dashboard tự chuyển xanh trở lại, không cần thao tác gì thêm

--- Trường hợp lỗi/ngoại lệ ---
2a. Mất mạng/nhiễu tín hiệu RẤT NGẮN (dưới 30 giây) rồi tự phục hồi → job nền ở
    bước 3 KHÔNG kịp đánh dấu OFFLINE (do kiểm tra mỗi 10s và ngưỡng 30s) → tránh
    "nhấp nháy" trạng thái gây khó chịu cho Farm Owner vì những đợt rớt mạng bình
    thường không đáng báo động
3a. Nếu thiết bị OFFLINE kéo dài, THREAT-FR-009 song song phát alert NODE_OFFLINE
    (ngưỡng riêng 60 giây, mức cảnh báo chính thức) — khác với việc đổi StatusDot
    ở bước 3-5 vốn chỉ là trạng thái hiển thị tức thời, không phải alert cần
    acknowledge
```

### Flow 15: Cập nhật Firmware qua OTA (Technician) — [mới v1.12.0, TICKET-FR-008]

```
1. Technician xác định cần cập nhật firmware (bugfix, tính năng mới) cho 1 hoặc
   nhiều SensorNode qua Web Console
2. Technician chọn thiết bị → "Đẩy OTA" → chọn phiên bản firmware đã build sẵn
   (`.bin` upload lên S3/MinIO trước đó ở bước build/release nội bộ team)
3. Backend publish lệnh OTA qua MQTT `config/update` (hoặc gọi trực tiếp
   ElegantOTA endpoint `http://<ip-esp32>/update` nếu cùng LAN) kèm URL firmware
4. ESP32 tải file `.bin`, xác thực (checksum), ghi vào partition OTA dự phòng
5. Ghi thành công → ESP32 tự khởi động lại vào firmware mới → gửi heartbeat với
   `firmware_version` mới → Backend cập nhật, Technician xác nhận thành công

--- Trường hợp lỗi/ngoại lệ ---
4a. Tải file thất bại giữa chừng (mất mạng) → ESP32 tiếp tục chạy firmware CŨ
    (partition OTA mới không được đánh dấu hợp lệ) → không có gián đoạn vận hành,
    Technician thử đẩy lại OTA sau
4b. Checksum sai (file hỏng khi tải) → ESP32 từ chối flash, tự rollback, giữ
    nguyên firmware cũ, log lỗi qua Serial/MQTT để Technician biết cần build lại
5a. Firmware mới bị lỗi (boot loop, watchdog reset liên tục) → ESP32 tự động
    rollback về firmware cũ ở lần khởi động lại kế tiếp nếu không thấy heartbeat
    thành công trong X giây (cơ chế OTA rollback tiêu chuẩn của ESP-IDF/Arduino-OTA)
    — tránh biến thiết bị thành "gạch" (bricked) từ xa, không ai gỡ về sửa tay được
```

### Flow 16: Mời & Onboarding Sales Staff (Farm Owner/Admin) — [mới v1.12.0, Giai đoạn 2]

```
1a. Farm Owner mời Sales Staff qua Flow 12 (dùng chung cơ chế Invitation, khác
    Farm Owner chỉ ở `invited_role: SALES_STAFF`)
1b. HOẶC Administrator tự tạo tài khoản Sales Staff cho trường hợp farm liên kết/
    hợp tác xã (AUTH-FR-005c) → gán trực tiếp vào 1+ Farm qua `SalesAssignment`,
    không cần qua bước mời/chấp nhận
2. Sales Staff đăng nhập → thấy danh sách Farm mình được gán → chọn Farm để quản
   lý sản phẩm/tồn kho/đơn hàng (Flow 17, Flow 10)

--- Trường hợp lỗi/ngoại lệ ---
1c. Sales Staff được mời bởi nhiều Farm khác nhau → 1 tài khoản Sales Staff có thể
    có nhiều `SalesAssignment` (many-to-many, đúng theo ER diagram mục 8.1) — không
    cần tạo tài khoản riêng cho mỗi Farm
1d. Farm Owner gỡ Sales Staff khỏi Farm (tương tự Flow 12 bước 5) → Sales Staff mất
    quyền truy cập Farm đó ngay, các Order/Product đã tạo trước đó vẫn giữ nguyên
    lịch sử (không xoá), chỉ chặn thao tác mới
```

### Flow 17: Duyệt/Từ chối Sản phẩm (Administrator ↔ Sales Staff) — [mới v1.12.0, SALES-FR-002, Giai đoạn 2]

```
1. Sales Staff tạo Product từ 1 Harvest Batch → POST /products (status: DRAFT)
2. Sales Staff hoàn thiện thông tin (giá, mô tả, ảnh) → POST /products/:id/submit-review
   → status: PENDING_REVIEW
3. Administrator xem danh sách Product chờ duyệt → kiểm tra thông tin, đối chiếu
   Traceability (env_snapshot/flock_snapshot có hợp lý không)
4a. Đạt yêu cầu → PUT /products/:id/review {decision: APPROVED} → status: APPROVED
    → Product hiển thị công khai trên Marketplace, cộng vào Inventory (SALES-FR-003)
4b. Không đạt → PUT /products/:id/review {decision: REJECTED, reason} → status:
    REJECTED, Sales Staff nhận thông báo kèm lý do cụ thể

--- Trường hợp lỗi/ngoại lệ ---
4c. Sau khi REJECTED, Sales Staff sửa lại thông tin theo góp ý → gọi lại
    POST /products/:id/submit-review → quay về PENDING_REVIEW, lặp lại từ bước 3
    (không giới hạn số lần gửi lại trong phạm vi KLTN)
4d. Product đã APPROVED nhưng sau đó phát hiện vi phạm (thông tin sai sự thật) →
    Administrator có quyền chuyển thẳng về REJECTED/ẩn khỏi Marketplace bất kỳ lúc
    nào (không chỉ giới hạn ở bước duyệt lần đầu), tương tự tinh thần TICKET-FR-005b
```

### Flow 18: Cảnh báo Tồn kho Thấp (Sales Staff) — [mới v1.12.0, SALES-FR-004/005, Giai đoạn 2]

```
1. Mỗi khi Order chuyển DELIVERED, tồn kho Product bị trừ chính thức (SALES-FR-009)
2. Nếu tồn kho sau khi trừ xuống dưới ngưỡng tối thiểu (cấu hình được theo từng
   Product) → hệ thống gửi thông báo cho Sales Staff phụ trách
3. Sales Staff nhập thêm Harvest Batch mới liên kết Product đó → tồn kho tự cộng
   lại (SALES-FR-003), thông báo cảnh báo tự tắt khi vượt lại ngưỡng

--- Trường hợp lỗi/ngoại lệ ---
1a. Tồn kho về đúng 0 → Product tự chuyển `OUT_OF_STOCK`, ẩn khỏi trang đặt hàng
    (Buyer không checkout được) nhưng vẫn xem được thông tin/Traceability
    (SALES-FR-005) — tránh Buyer đặt hàng vào sản phẩm không còn hàng
1b. Sales Staff không xử lý cảnh báo trong thời gian dài (không có SLA cứng như
    Ticket vì đây không phải sự cố kỹ thuật) → Farm Owner (đồng sở hữu Farm) cũng
    nhìn thấy cảnh báo tồn kho thấp trên Dashboard chung, có thể tự nhắc Sales
    Staff ngoài hệ thống
```

### Flow 19: Quản lý Tài khoản bởi Administrator (khoá/mở khoá, xoá theo yêu cầu) — [mới v1.12.0, AUTH-FR-011/012, PRIV-NFR-003]

```
--- Khoá/Mở khoá tài khoản ---
1. Administrator phát hiện/nhận báo cáo tài khoản vi phạm (spam, gian lận đơn
   hàng, lạm dụng hệ thống) → mở trang Quản lý Tài khoản → tìm user
2. PUT /admin/users/:id/status {is_active: false, reason} → tài khoản bị khoá,
   lý do bắt buộc nhập, ghi vào `audit_logs`
3. Mọi request JWT tiếp theo của user đó bị middleware từ chối (401) ngay cả khi
   Access Token còn hạn — không cần đợi token hết hạn tự nhiên (AUTH-FR-011)
4. User cố đăng nhập lại → thấy thông báo "Tài khoản đã bị khoá" kèm lý do
5. Administrator xem lại, quyết định mở khoá khi hợp lý → PUT .../status
   {is_active: true} → user đăng nhập lại bình thường

--- Xoá tài khoản theo yêu cầu (Right to Erasure) ---
6. User (bất kỳ role nào) vào Cài đặt tài khoản → "Yêu cầu xoá tài khoản" →
   POST /auth/delete-request → tạo yêu cầu, Administrator nhận thông báo
7. Administrator xem yêu cầu, xác minh danh tính (đối chiếu email đã xác thực),
   xử lý trong ≤ 30 ngày theo AUTH-FR-012:
   7a. Nếu là Primary Owner của Farm còn thành viên khác → chuyển `owner_id` sang
       thành viên `joined_at` sớm nhất, thông báo cho thành viên đó
   7b. Nếu Primary Owner mà Farm không còn thành viên nào khác → xoá mềm luôn Farm
       (giữ lại dữ liệu telemetry lịch sử phục vụ nghĩa vụ lưu trữ, chỉ ẩn khỏi UI)
8. Administrator xác nhận hoàn tất → PUT /admin/delete-requests/:id/complete →
   tài khoản bị xoá/ẩn PII (email/SĐT/tên thay bằng placeholder), user nhận email
   xác nhận cuối cùng trước khi mất quyền truy cập

--- Trường hợp lỗi/ngoại lệ ---
2a. Administrator cố khoá chính tài khoản Admin khác duy nhất còn lại → hệ thống
    có thể cho phép (không giới hạn cứng như Primary Owner ở Flow 12, vì có thể có
    tài khoản gốc/super-admin dự phòng ngoài UI) nhưng cảnh báo rõ trước khi xác nhận
7c. User gửi yêu cầu xoá nhưng đang có Order/Ticket dở dang → Administrator có thể
    tạm hoãn xử lý và ghi chú lý do (VD: chờ hoàn tất giao dịch) thay vì xoá ngay,
    miễn vẫn phản hồi trong hạn 30 ngày cho user biết tình trạng
```

### Sơ đồ Luồng Chính Toàn Hệ thống (Master Flow)

> Gộp toàn bộ các luồng actor + hệ thống nền thành 1 bức tranh swimlane, thể hiện 2 trục nghiệp vụ song song (Vận hành Kỹ thuật và Thương mại) cùng chia sẻ 1 nguồn dữ liệu gốc là Farm/Zone. **[Cập nhật v1.12.0]** Đã thêm nhánh Technician lắp đặt/kích hoạt thiết bị (Flow 1/1b), yêu cầu lắp đặt nhà yến mới đi thẳng vào Ticket Router (Flow 9b), phát hiện mất kết nối tự động (Flow 14), và quản lý tài khoản của Admin (Flow 19). Sơ đồ này chỉ minh hoạ luồng dữ liệu chính ở tầm cao — 8 Flow còn lại thiên về nghiệp vụ tài khoản/phiên đăng nhập (Flow 11-13, 15-18) không vẽ riêng ở đây vì không thêm actor/node mới, xem chi tiết từng Flow tương ứng.

```mermaid
flowchart LR
    subgraph L1["Tầng Thiết bị"]
        Sensor["Bus RS485<br/>5 Cảm biến + Camera AI"]
    end

    subgraph L2["Tầng Xử lý Cloud"]
        MQTT["MQTT Broker<br/>+ Backend"]
        AlertEngine["Alert Engine<br/>CRITICAL/HIGH/MEDIUM/LOW"]
    end

    subgraph L3["Trục Vận hành Kỹ thuật"]
        FarmerOps["Farm Owner<br/>giám sát, chỉnh thông số, yêu cầu lắp đặt"]
        TicketQ["Ticket Router<br/>(báo lỗi + INSTALLATION)"]
        TechOps["Technician<br/>xử lý sự cố theo SLA<br/>+ lắp đặt/kích hoạt qua Web Console"]
    end

    subgraph L4["Trục Thương mại (Giai đoạn 2)"]
        Harvest["Farm Owner/Sales Staff<br/>nhập Harvest Batch"]
        Listing["Sales Staff<br/>tạo Product"]
        Market["Marketplace công khai"]
        BuyerOps["Buyer<br/>mua hàng"]
        Fulfill["Sales Staff<br/>xử lý đơn & vận chuyển"]
    end

    subgraph L5["Quản trị"]
        AdminOps["Administrator<br/>duyệt, phân xử, cấu hình"]
    end

    Sensor -- "Telemetry + Bird count" --> MQTT
    MQTT -- "Dữ liệu real-time" --> FarmerOps
    MQTT -- "Snapshot môi trường/đàn chim theo chu kỳ" --> Harvest
    MQTT --> AlertEngine
    AlertEngine -- "Cảnh báo ngưỡng/sự cố" --> FarmerOps
    AlertEngine -- "Tạo Ticket tự động hoặc do Farm Owner báo (Flow 8/9)" --> TicketQ
    FarmerOps -- "Yêu cầu lắp đặt nhà yến mới (Flow 9b)" --> TicketQ
    TicketQ --> TechOps
    TechOps -- "Đóng ticket/escalate" --> AdminOps
    TechOps -- "Lắp đặt + kích hoạt thiết bị qua Web Console (Flow 1/1b)" --> Sensor
    FarmerOps -- "Điều khiển thủ công qua Relay (Flow 13)" --> Sensor
    MQTT -.->|"Mất heartbeat >30s → tự chuyển Offline (Flow 14)"| FarmerOps

    Harvest --> Listing
    Listing -- "Chờ duyệt" --> AdminOps
    AdminOps -- "Duyệt sản phẩm" --> Market
    Market --> BuyerOps
    BuyerOps -- "Đặt hàng, thanh toán" --> Fulfill
    Fulfill -- "Cập nhật trạng thái vận chuyển" --> BuyerOps
    BuyerOps -- "Khiếu nại (nếu có)" --> AdminOps
    AdminOps -- "Chuyển xác minh" --> Fulfill

    AdminOps -.-> TicketQ
    AdminOps -.->|"Cảnh báo chéo: Farm đang gặp sự cố<br/>→ tạm dừng nhận đơn mới"| Fulfill
    AdminOps -.->|"Quản lý tài khoản: khoá/mở khoá/xoá theo yêu cầu (Flow 19)<br/>— áp dụng cho mọi actor, chỉ vẽ đại diện 1 nhánh"| FarmerOps
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

> ⚠️ **Cần hoàn tất trước khi bắt đầu Phase 1:** cột "Thành viên phụ trách" hiện để `TBD` — nhóm phải điền tên thật và commit trong buổi kick-off, vì Phase 1 (tháng 7/2026) đã yêu cầu môi trường dev sẵn sàng cho cả 5 nhánh song song. Đề xuất quy mô nhóm tối thiểu **4–5 thành viên**, mỗi người phụ trách chính 1 task và hỗ trợ Task 5.

| Task                          | Nội dung                                                                         | Kỹ năng cần thiết                                       | Thành viên phụ trách  |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------- |
| **Task 1 – Hardware**         | Thiết kế sơ đồ mạch, lắp ráp prototype, firmware ESP32 (sensor, PID, MQTT, OTA)  | C/C++ nhúng, RS485/Modbus, điện tử cơ bản               | TBD                   |
| **Task 2 – AI Pipeline**      | Thu thập dataset, annotation, train YOLOv8, tích hợp ByteTrack, optimize cho RPi | Python, Ultralytics/PyTorch, OpenCV                     | TBD                   |
| **Task 3 – Backend**          | REST API (Express), MQTT Broker setup, MongoDB schema, WebSocket, Alert Engine   | Node.js/Express, MongoDB, MQTT                          | TBD                   |
| **Task 4 – Frontend/Mobile**  | React.js Dashboard, PWA (mobile web), chart components, live stream              | React, TailwindCSS, Socket.io-client                    | TBD                   |
| **Task 5 – Testing & Thesis** | Thực nghiệm thực tế, đánh giá model, đo latency, viết báo cáo KLTN               | Trách nhiệm chung, điều phối bởi 1 thành viên phụ trách | TBD (lead luân phiên) |

**Ma trận trách nhiệm chéo:** mỗi thành viên phụ trách chính 1 task nhưng bắt buộc tham gia Integration Testing (mục 13.2) của ít nhất 1 task khác để đảm bảo cả nhóm hiểu toàn hệ thống trước khi bảo vệ đồ án.

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

## 15. Quản lý Rủi ro (Risk Register)

| ID      | Rủi ro                                                                                                                  | Xác suất   | Tác động   | Chiến lược Giảm thiểu                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| RISK-01 | Dataset AI không đủ 5.000 ảnh chất lượng (đặc biệt class `owl`, `snake` hiếm gặp)                                       | Cao        | Cao        | Bắt đầu thu thập dữ liệu từ Phase 1 song song; dùng synthetic augmentation và public dataset bổ sung; hạ mục tiêu mAP nếu cần và ghi rõ trong báo cáo |
| RISK-02 | Camera/RPi không lắp được tại nhà yến thật (chủ nhà yến từ chối cho lắp thiết bị thử nghiệm)                            | Trung bình | Cao        | Chuẩn bị phương án demo tại mô hình nhà yến mini (indoor mock-up) làm backup                                                                          |
| RISK-03 | RPi 4 không đạt 25 FPS với YOLOv8 sau khi thêm ByteTrack                                                                | Trung bình | Trung bình | Quantize INT8, giảm input resolution xuống 480×480, cân nhắc RPi 5 (đã có trong BOM v1.3)                                                             |
| RISK-04 | RS485 bus nhiễu tín hiệu khi kéo dây dài trong nhà yến (nhiều tầng)                                                     | Trung bình | Trung bình | Dùng điện trở terminator 120Ω hai đầu bus, cáp shielded, giới hạn chiều dài bus theo khuyến nghị Modbus RTU                                           |
| RISK-05 | Thành viên nhóm thiếu kinh nghiệm về 1 trong 3 mảng (hardware/AI/web) làm chậm tiến độ                                  | Cao        | Cao        | Phân công theo thế mạnh (mục 14.1), review chéo hàng tuần, timebox học kỹ thuật mới tối đa 1 tuần/task                                                |
| RISK-06 | Chi phí phần cứng vượt ngân sách khi mua thực tế (giá linh kiện biến động)                                              | Trung bình | Thấp       | Chốt nhà cung cấp sớm, dự phòng buffer 10% trên tổng BOM (≈ 1.010.000₫ thêm)                                                                          |
| RISK-07 | Zalo ZNS / Firebase FCM có giới hạn quota miễn phí                                                                      | Thấp       | Trung bình | Kiểm tra hạn mức free-tier trước Phase 4; fallback về Web Push nếu vượt quota                                                                         |
| RISK-08 | Mô hình thu tiền (escrow vs Farm/Sales Staff thu trực tiếp) chưa chốt với stakeholder → chặn thiết kế module thanh toán | Cao        | Cao        | Đưa quyết định này vào buổi họp chốt yêu cầu sớm nhất (trước Phase 4); nếu chưa chốt kịp, triển khai trước bằng COD-only để không block demo          |
| RISK-09 | Team không đủ người đóng vai Technician thật để test luồng SLA/ticket trong lúc demo                                    | Trung bình | Trung bình | Dùng chính thành viên nhóm đóng vai Technician khi demo; viết kịch bản test rõ ràng cho hội đồng                                                      |
| RISK-10 | Module SALES (Giai đoạn 2) bị dồn vào cuối lịch trình do ưu tiên Giai đoạn 1 → không kịp demo trọn vẹn                  | Trung bình | Thấp       | Đã gắn rõ "không bắt buộc nghiệm thu" ở mục 2.4 — chỉ code nếu còn dư thời gian sau khi Giai đoạn 1 ổn định                                           |

---

## 16. Giả định, Ràng buộc & Phạm vi Loại trừ

### 16.1. Giả định (Assumptions)

- Trang trại thử nghiệm có sẵn nguồn điện 220V ổn định và kết nối 4G khả dụng tại vị trí lắp đặt.
- Chủ nhà yến hợp tác đồng ý cho lắp thiết bị thử nghiệm ít nhất 1 tháng để thu thập dữ liệu thực tế.
- Nhóm có quyền truy cập GPU (Google Colab/Kaggle) đủ để train YOLOv8 trong thời gian Phase 3.
- Các thư viện/framework mã nguồn mở (YOLOv8, ByteTrack, EMQX, v.v.) giữ nguyên license miễn phí trong suốt thời gian dự án.

### 16.2. Ràng buộc (Constraints)

- Ngân sách phần cứng prototype giới hạn ở mức đã duyệt trong mục 7.1 (10.105.000 VNĐ), không tính chi phí cloud hosting/domain.
- Thời gian thực hiện cố định trong khung FA26 (7/2026–12/2026), không thể gia hạn.
- Đồ án chỉ triển khai **1 farm thử nghiệm** (không phải multi-tenant production thật) — các con số về scalability (mục 6.3) là mục tiêu kiến trúc, không phải benchmark bắt buộc verify với tải thật.

### 16.3. Ngoài Phạm vi (Out of Scope)

Các hạng mục sau **không** thuộc phạm vi nghiệm thu bắt buộc của đồ án KLTN này (Giai đoạn 1), cần nêu rõ với hội đồng để tránh hiểu nhầm:

- Module SALES đầy đủ (giỏ hàng, thanh toán online, tồn kho, vận chuyển, đổi trả — mục 5.10) thuộc **Giai đoạn 2**: đã có đặc tả FR/data model/API đầy đủ để mở rộng sau, nhưng **không bắt buộc cài đặt/nghiệm thu** trong KLTN; nếu chưa triển khai, Marketplace chỉ dừng ở mức đăng tin + truy xuất nguồn gốc + form liên hệ (module MARKET gốc, mục 5.8).
- Phân quyền chi tiết theo Zone giữa các thành viên Farm Owner trong cùng 1 Farm — đã gộp thành 1 vai trò với quyền vận hành ngang nhau trong Giai đoạn 1 (xem mục 2.2); đây là điểm mở rộng tiềm năng cho Giai đoạn 2/3 nếu có nhu cầu thực tế.
- Mô hình thu tiền cụ thể (escrow hay Farm/Sales Staff thu trực tiếp) là quyết định nghiệp vụ **chưa chốt** — xem RISK-08 (mục 15); nếu triển khai Module SALES thì mặc định dùng COD trước để không phụ thuộc quyết định này.
- Ứng dụng mobile native (iOS/Android qua App Store/Play Store) — chỉ có PWA.
- Đa ngôn ngữ đầy đủ ngoài Việt/Anh (UX-NFR-004 chỉ yêu cầu 2 ngôn ngữ).
- Tích hợp với hệ thống ERP/kế toán của trang trại.
- Tích hợp API thật với đối tác vận chuyển (GHN/GHTK/J&T) — Giai đoạn 2 chỉ cần nhập mã vận đơn thủ công (SALES-FR-008); tự động đồng bộ trạng thái là Giai đoạn 3.
- Chứng nhận pháp lý an toàn thực phẩm (VSATTP) cho sản phẩm yến — hệ thống chỉ hỗ trợ _truy xuất dữ liệu môi trường_, không thay thế quy trình kiểm định chất lượng chính thức.
- Vận hành production thật với SLA thương mại (uptime 99.9%, on-call 24/7) — các mục tiêu NFR/SLA (mục 6.7) là target kỹ thuật cho demo/thesis, không phải cam kết SLA pháp lý thật.

---

## 17. Vận hành, Triển khai & Tuân thủ Dữ liệu

> Phần này bổ sung các khía cạnh vận hành thường bị bỏ sót trong SRS đồ án nhưng cần thiết để nhóm không bị lúng túng khi deploy.

### 17.1. Môi trường Triển khai

| Môi trường     | Mục đích                                    | Ghi chú                                                             |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `local`        | Phát triển trên máy cá nhân                 | Docker Compose: MongoDB + Redis + EMQX local                        |
| `staging/demo` | Môi trường demo cho GVHD và hội đồng        | Deploy trên VPS giá rẻ hoặc free-tier (Render/Railway/Oracle Cloud) |
| `production`   | Nếu triển khai tại farm thật để thu dữ liệu | Có thể dùng chung với staging do quy mô nhỏ (1 farm)                |

### 17.2. Quản lý Cấu hình & Secrets

- Biến môi trường (API keys, JWT secret, MongoDB URI, MQTT broker credentials, Firebase/Zalo keys) lưu trong file `.env` **không commit vào Git** (`.gitignore`).
- Cung cấp file `.env.example` liệt kê đầy đủ tên biến (không kèm giá trị thật) để thành viên mới setup nhanh.
- Repo tách biệt theo module: `firmware-esp32/`, `edge-ai-rpi/`, `backend/`, `frontend/` — mỗi thư mục có README riêng hướng dẫn chạy local.

### 17.3. Logging & Giám sát (Observability)

| ID          | Yêu cầu                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| OPS-NFR-001 | Backend log theo format JSON có structured fields (timestamp, level, requestId) qua `morgan`/`winston`             |
| OPS-NFR-002 | ESP32 và RPi in log qua Serial/stdout với mức độ: INFO, WARN, ERROR; RPi log thêm ra file xoay vòng (log rotation) |
| OPS-NFR-003 | Có endpoint `/health` ở Backend trả về trạng thái kết nối DB, Redis, MQTT Broker để kiểm tra nhanh khi demo        |
| OPS-NFR-004 | Dashboard admin (Administrator) có màn hình xem nhanh trạng thái tất cả node (online/offline) toàn hệ thống        |

### 17.4. Tuân thủ Dữ liệu Cá nhân (Data Privacy)

Hệ thống thu thập dữ liệu cá nhân (email, số điện thoại, tên) của Farm Owner/Buyer và hình ảnh từ camera giám sát. Nhóm cần tuân thủ tinh thần **Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân**:

| ID           | Yêu cầu                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| PRIV-NFR-001 | Có màn hình/thông báo xin sự đồng ý (consent) khi người dùng đăng ký tài khoản, nêu rõ dữ liệu nào được thu thập       |
| PRIV-NFR-002 | Buyer gửi form liên hệ (MARKET-FR-010) chỉ lưu tối thiểu thông tin cần thiết (tên, 1 kênh liên hệ, nội dung)           |
| PRIV-NFR-003 | Cung cấp chức năng cho user yêu cầu xóa tài khoản và dữ liệu cá nhân liên quan (right to erasure)                      |
| PRIV-NFR-004 | Camera chỉ ghi hình khu vực nhà yến (không hướng ra khu dân cư xung quanh) để tránh xâm phạm quyền riêng tư bên thứ ba |

---

## 18. Tiêu chí Nghiệm thu (Definition of Done)

> Mỗi yêu cầu chức năng (FR) ở mục 5 chỉ được xem là "hoàn thành" khi thỏa **cả 4 điều kiện** sau, để tránh tình trạng "code xong nhưng chưa demo được":

1. **Code hoàn chỉnh & review:** Merge vào nhánh `develop` qua Pull Request, có ít nhất 1 thành viên khác review.
2. **Test pass:** Unit test liên quan (mục 13.1) chạy pass trong CI; với FR có Integration Test tương ứng (mục 13.2), test đó cũng phải pass.
3. **Demo được end-to-end:** Có thể trình diễn trực tiếp luồng nghiệp vụ tương ứng (đối chiếu Flow ở mục 10), không chỉ chạy được ở môi trường local của 1 người.
4. **Tài liệu cập nhật:** README/API doc cập nhật nếu có thay đổi endpoint hoặc schema; SRS này được cập nhật version nếu yêu cầu thay đổi so với đặc tả gốc.

**Ví dụ áp dụng cho VISION-FR-005 (logic đếm chim qua line ảo):** chỉ Done khi (1) code ByteTrack + line-crossing đã review, (2) có unit test cho hàm tính hướng di chuyển, (3) demo được RPi đếm đúng số chim đi qua trong 1 đoạn video test 5 phút, (4) README mô-đun AI ghi rõ cách cấu hình vị trí line ảo.

---

## 19. Bảng Thuật ngữ

| Thuật ngữ                      | Định nghĩa                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge AI**                    | Xử lý AI trực tiếp trên thiết bị biên (RPi) thay vì trên cloud                                                                               |
| **MQTT**                       | Message Queuing Telemetry Transport – protocol nhẹ cho IoT                                                                                   |
| **PID Control**                | Proportional-Integral-Derivative – thuật toán điều khiển vòng kín                                                                            |
| **YOLO**                       | You Only Look Once – kiến trúc object detection thời gian thực                                                                               |
| **ByteTrack**                  | Thuật toán Multi-Object Tracking không cần re-ID feature                                                                                     |
| **RTSP**                       | Real Time Streaming Protocol – giao thức truyền video từ camera IP                                                                           |
| **PoE**                        | Power over Ethernet – cấp nguồn cho thiết bị qua cáp mạng                                                                                    |
| **BOM**                        | Bill of Materials – danh sách vật tư và linh kiện                                                                                            |
| **Return Rate**                | Tỉ lệ chim về trong ngày: (số chim về buổi tối) / (số chim ra buổi sáng) × 100%                                                              |
| **Closed-loop**                | Hệ thống điều khiển có phản hồi; output được đo và dùng để điều chỉnh input                                                                  |
| **Quantization**               | Kỹ thuật nén model AI từ FP32 xuống INT8 để tăng tốc inference                                                                               |
| **FCM**                        | Firebase Cloud Messaging – dịch vụ push notification của Google                                                                              |
| **Zalo ZNS**                   | Zalo Notification Service – kênh thông báo qua Zalo                                                                                          |
| **QoS**                        | Quality of Service – mức độ đảm bảo delivery trong MQTT                                                                                      |
| **TTL**                        | Time To Live – thời gian hết hạn của dữ liệu/token                                                                                           |
| **Presigned URL**              | URL có chữ ký thời hạn để truy cập file private trên S3                                                                                      |
| **MOT**                        | Multi-Object Tracking – theo dõi nhiều đối tượng cùng lúc qua video                                                                          |
| **Harvest Batch**              | Đợt thu hoạch tổ yến, gắn liền với dữ liệu môi trường và thông tin đàn chim                                                                  |
| **Trace Code**                 | Mã truy xuất nguồn gốc duy nhất (UUID) gắn với mỗi lô yến thu hoạch                                                                          |
| **Traceability Card**          | Giao diện hiển thị thông tin nguồn gốc: farm, môi trường, đàn chim, ảnh SP                                                                   |
| **Nest Listing**               | Tin đăng bán yến trên Marketplace, liên kết với Harvest Batch                                                                                |
| **SLA**                        | Service Level Agreement – cam kết thời gian phản hồi/xử lý ticket theo mức ưu tiên (mục 5.9, 6.7)                                            |
| **Ticket**                     | Bản ghi 1 sự cố/yêu cầu hỗ trợ kỹ thuật cần Technician xử lý, có vòng đời trạng thái riêng (mục 5.9)                                         |
| **P1/P2/P3**                   | Mức ưu tiên ticket (P1 khẩn cấp nhất → P3 thấp nhất), quyết định thời hạn SLA                                                                |
| **Escalate**                   | Cơ chế tự động chuyển/thông báo cấp cao hơn khi ticket/cảnh báo vượt SLA chưa xử lý                                                          |
| **RACI**                       | Responsible/Accountable/Consulted/Informed – ma trận phân quyền theo vai trò (mục 4.4)                                                       |
| **Primary Owner**              | Thành viên Farm Owner đầu tiên (người tạo Farm); có thêm quyền quản trị Farm như mời/gỡ thành viên, xóa Farm (mục 4.1, 8.2)                  |
| **Soft-reserve**               | Tạm giữ số lượng tồn kho ngay khi Buyer đặt hàng, trước khi trừ chính thức lúc giao hàng thành công (SALES-FR-006)                           |
| **Escrow**                     | Mô hình nền tảng giữ hộ tiền thanh toán rồi chuyển cho Farm sau khi giao hàng thành công (quyết định nghiệp vụ chưa chốt — xem mục 15, 16.3) |
| **Guest Checkout**             | Buyer đặt hàng không cần tạo tài khoản, chỉ cần thông tin liên hệ tối thiểu (SALES-FR-013)                                                   |
| **RS485 Bus Failure**          | Sự cố mất tín hiệu đồng loạt nhiều cảm biến/relay do dùng chung 1 bus RS485 daisy-chain (THREAT-FR-013)                                      |
| **SAT (Site Acceptance Test)** | Checklist nghiệm thu kỹ thuật tại hiện trường trước khi Technician bàn giao thiết bị cho Farm Owner (TICKET-FR-010)                          |
| **OTA (Over-The-Air Update)** | Cập nhật firmware ESP32 từ xa qua WiFi (ElegantOTA), không cần cắm USB nạp lại — có cơ chế tự rollback nếu firmware mới lỗi (Flow 15)          |
| **Right to Erasure**           | Quyền yêu cầu xoá tài khoản/dữ liệu cá nhân của người dùng, theo tinh thần Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân (PRIV-NFR-003, AUTH-FR-012, Flow 19) |

---

_Tài liệu SRS này được tạo ngày 07/09/2026. Mọi thay đổi yêu cầu phải được cập nhật kèm phiên bản và ngày sửa đổi._

**Lịch sử phiên bản:**

| Phiên bản | Ngày       | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4.0     | 11/09/2026 | Cập nhật toàn bộ linh kiện/phần mềm lên phiên bản 2026 (ESP32-S3, RPi 5, SHT40, YOLO11, Node 22 LTS, React 19, Vite 6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1.5.0     | 12/09/2026 | Rà soát toàn diện: sửa lỗi cộng tổng BOM, thống nhất role, sửa nhầm lẫn stack, làm rõ MQTT topic, bổ sung Flow 1b, làm rõ nguồn dữ liệu exit_count, thêm quy ước API chung, thêm Risk Register/Out-of-Scope/Vận hành/Definition of Done, bổ sung RACI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.6.0     | 12/09/2026 | Hợp nhất BA Review: mở rộng từ 4 lên **6 vai trò** (thêm Technician, Sales Staff); thêm 2 module TICKET (5.9) và SALES (5.10, Giai đoạn 2); thêm 8 collection MongoDB mới; thêm Flow 8/9/10 và Master Flow; thêm NFR mục 6.7; thêm RISK-08→10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.7.0     | 12/09/2026 | **Gộp actor Farm Owner + Operator → 1 vai trò "Farm Owner" duy nhất**, đưa hệ thống về đúng **5 actor** (Farm Owner, Technician, Sales Staff, Buyer, Administrator) theo tài liệu BA gốc (mục 1.3): (1) cập nhật mục 1.2/2.2 mô tả 5 vai trò, giải thích lý do gộp; (2) cập nhật mục 4.1 (bỏ hàng Operator, thêm khái niệm Primary Owner vs thành viên được mời), 4.3 (bỏ node Operator khỏi System Context Diagram); (3) cập nhật AUTH-FR-004 (bỏ role `OPERATOR` khỏi enum), AUTH-FR-005 (Farm Owner mời thành viên Farm Owner khác thay vì Operator giới hạn Zone); (4) cập nhật ENV-FR-016, TICKET-FR-001 (bỏ "Operator"); (5) cập nhật ERD và schema `users.role`, `farms.members` (mục 8.1, 8.2) theo mô hình mới (`is_primary` thay cho `role: OPERATOR`); (6) cập nhật API `/tickets` (bỏ quyền OPERATOR); (7) cập nhật Flow 8/9 và Master Flow (bỏ nhắc "Operator"); (8) thêm thuật ngữ **Primary Owner** vào Bảng Thuật ngữ; (9) cập nhật mục 16.3 Out-of-Scope để nêu rõ việc gộp vai trò là quyết định phạm vi Giai đoạn 1                                                                                                                                       |
| 1.8.0     | 12/09/2026 | **Cập nhật phần cứng theo linh kiện THỰC TẾ đã mua (EPCB IoT Services):** (1) BOM mục 7.1 viết lại thành **BOM v3.1** — 5 cảm biến RS485 thật: ES-NOISE-01 (ID1), ES-CO2-01 (ID2), ES-NH3-01 (ID3), ES-ALS-02 (ID4), ES35-SW (ID5); (2) **bỏ H2S + TVOC** (không mua cảm biến rời) khỏi ENV-FR-003, ENV-FR-006, ENV-FR-011, schema `telemetry`; (3) chỉ dùng **1 cảm biến nhiệt-ẩm ES35-SW** (bỏ bản ngoài trời); (4) đổi **nguồn tổ ong 12V/10A → AC Adapter 12V/2A**; (5) đổi **MAX485 generic → Module UART TTL to RS485 V2** (auto-direction, đấu thẳng không chéo); (6) **bỏ cầu chì + điện trở terminator rời** — dùng trở 120Ω tích hợp trong ES35-SW (DIP Pin 5); (7) firmware mục 7.2: baud **9600→4800** đồng bộ, thêm công thức quy đổi từng cảm biến, lưu ý dùng app Insight Sensor đổi baud ES35-SW; (8) **PID Control (ENV-FR-010→019) đánh dấu BLOCKED** — chờ mua Relay 4 kênh; (9) THREAT-FR-013 ngưỡng lỗi bus theo 5 thiết bị; (10) tách phần Camera/Raspberry Pi (Vision) ra khỏi cụm phần cứng hiện tại — triển khai sau. Chi tiết đầy đủ: xem phụ lục `SwiftletCare_Components_Guide_v3.1.md` + sơ đồ tương tác `SwiftletCare_Wiring_Detailed_v3.html` |
| 1.9.0     | 12/09/2026 | **Bổ sung Relay điều khiển (Relay thường/GPIO) + 3 actuator:** (1) chọn **module Relay thường 4 kênh 5V có opto cách ly, kích GPIO** thay cho relay Modbus RS485 (đơn giản, rẻ, tách riêng khỏi bus RS485); (2) **mở khoá nhóm ENV-FR-010→019** (bỏ trạng thái BLOCKED) — cập nhật ENV-FR-010/011/012 dùng relay GPIO với mã chân cụ thể (IN1=GPIO25 phun sương, IN3=GPIO27 quạt, IN4=GPIO14 sưởi dự phòng); (3) **thêm ENV-FR-013b** — điều khiển **loa ru dẫn dụ** (IN2=GPIO26) theo lịch cố định (5-7h, 17-19h), liên kết THREAT-FR-006 phát hiện loa hỏng; (4) cập nhật schema `sensor_nodes.relay_states` thêm `speaker`, `relay_type='GPIO'`, `speaker_schedule`; (5) BOM v3.1 thêm 4 dòng: module relay 4 kênh + máy phun sương + loa ru + quạt thông gió; (6) firmware 7.2 thêm Relay Task + mã chân GPIO + lưu ý kích mức thấp. Chi tiết: xem phụ lục `SwiftletCare_Relay_Addon.md`                                                                                                                                                                                                                                                                                 |
| 1.10.0    | 12/09/2026 | **Bổ sung hệ thống âm thanh loa ru (nạp & phát file):** (1) thêm **DFPlayer Mini** (đọc MP3/WAV từ thẻ microSD, giao tiếp UART GPIO32/33) + **amply PAM8403** + thẻ microSD vào BOM — làm rõ amply KHÔNG tự phát file, bắt buộc cần DFPlayer làm nguồn phát; (2) mở rộng **ENV-FR-013b** với chuỗi hoạt động đầy đủ: Relay IN2 đóng nguồn amply → DFPlayer play file từ SD → PAM8403 khuếch đại → loa; điều khiển play/stop/volume/loop qua UART theo lịch; (3) thêm field `audio` (current_track, volume, playing, loop) vào schema `sensor_nodes`; (4) firmware 7.2 thêm **Audio Task** với thư viện DFRobotDFPlayerMini; (5) phân 2 mức: Mức 1 nạp sẵn SD + điều khiển từ xa (MVP), Mức 2 upload file từ cloud → ESP32 ghi SD (stretch goal). Chi tiết: xem phụ lục `SwiftletCare_Relay_Audio_Guide.md` (gộp chung Relay + Âm thanh, thay `SwiftletCare_Relay_Addon.md`)                                                                                                                                                                                                                                                                                                  |
| 1.11.0    | 12/09/2026 | **Chốt BOM theo LINH KIỆN THỰC TẾ đã mua (IC Đây Rồi + EPCB):** (1) ESP32 = **NodeMCU 38 chân Type-C CP2102** + **đế mở rộng 38 chân** (đấu dây không cần hàn); (2) **DÙNG 2 MẠCH BUCK LM2596 3A** — Buck#1 cho ESP32+RS485, Buck#2 riêng cho PAM8403+DFPlayer+relay (vì PAM8403 6W ngốn 1.2A, tách nguồn tránh sụt áp treo ESP32); (3) Domino = **TB1504 (4 mối 15A/600V)**; (4) Relay = **module 4 kênh opto cách ly kích H/L chọn Jumper** — đặt kích mức CAO (High=bật), firmware `digitalWrite(HIGH)`=bật; (5) **DFPlayer Mini** (hỗ trợ MP3/WAV/WMA, thư mục ≤100×255 bài, SD ≤32GB) + **PAM8403 6W Hifi có núm volume** (5V-1.2A, lọc nhiễu); (6) cập nhật firmware 7.2: relay kích High thay vì Low; (7) ⚠️ cảnh báo ngân sách nguồn nhánh Buck#2 ~2.1A — nếu loa lớn thì cấp 220V riêng cho amply/loa; (8) Camera nhánh Vision = **camera nhà yến IR 940nm không phát sáng** (không làm chim sợ), 2.8mm góc rộng, IP66+, RTSP — theo 6 tiêu chí chuẩn ngành, chạy AI trên laptop. Chi tiết: `SwiftletCare_Components_Guide_v3.3.md` + `SwiftletCare_Camera_Guide_NhaYen_Full.md`                                                                                    |
| 1.12.0    | 16/09/2026 | **Rà soát toàn diện luồng nghiệp vụ + đổi mô hình vận hành thiết bị (dựa trên code thực tế đã chạy):** (1) Đổi mô hình onboarding thiết bị từ "Farm Owner tự quét QR" sang **"Technician thao tác qua Web Console" (giống kỹ thuật viên lắp mạng/camera)** — cập nhật actor Farm Owner/Technician (mục 4.1), RACI (mục 4.4), FARM-FR-003/003b/004/007/008, viết lại Flow 1/1b; (2) Thêm **TICKET loại `INSTALLATION`** cho luồng "Farm Owner có nhà yến mới → Ticket Router tự động gán Technician (không qua Admin điều phối tay)" — TICKET-FR-001/003/004/004b/005b, Flow 9b (mới), field `scheduled_visit_at` do Farm Owner chọn thẳng lúc tạo ticket; (3) Thêm **quyền can thiệp toàn diện của Admin trên mọi ticket** (TICKET-FR-005b) và làm rõ TICKET-FR-007 áp dụng đủ 4 trạng thái cho mọi loại ticket; (4) **Bổ sung 9 Flow hoàn toàn mới** (Flow 11→19) để mỗi actor có luồng nghiệp vụ đầy đủ cả happy path lẫn bad case: đăng ký/đăng nhập/quên mật khẩu/refresh token (Flow 11), mời-chấp nhận-từ chối thành viên Farm (Flow 12), điều khiển relay thủ công + auto-revert override (Flow 13), **thiết bị mất kết nối/mất nguồn → Dashboard tự Offline** khớp đúng cơ chế đã code thật — `deviceOfflineJob` cron 10s + ngưỡng 30s heartbeat + client-side staleness 20s (Flow 14), OTA firmware + rollback khi lỗi (Flow 15), mời/onboarding Sales Staff (Flow 16), duyệt/từ chối sản phẩm (Flow 17), cảnh báo tồn kho thấp (Flow 18), quản lý tài khoản Admin — khoá/mở khoá + xoá theo yêu cầu PRIV-NFR-003 (Flow 19); (5) Thêm **bad case cho các Flow đã có**: Flow 1/1b (secretKey sai, AP-mode/WiFi lỗi, SAT thất bại), Flow 4 (false positive), Flow 7 (Trace Code không tồn tại, race condition sửa Harvest Batch sau khi đăng bán), Flow 9/9b (Technician xin gán lại, Farm Owner huỷ ticket, SAT thất bại tại hiện trường), Flow 10 (thanh toán thất bại, hết hàng do race condition); (6) Thêm **AUTH-FR-009→012** (quên mật khẩu, lời mời thành viên có TTL, khoá/mở khoá tài khoản, xoá tài khoản theo PRIV-NFR-003) và các API endpoint tương ứng (mục 9.1); (7) Thêm collection `invitations`, `audit_logs` và field `deactivated_at/reason`, `password_reset_token_hash` vào `users` (mục 8.1, 8.2); (8) Sửa lỗi lệch dữ liệu: `TELEMETRY_UPDATE` WebSocket event (mục 9.3) còn sót `h2s`/`tvoc` dù đã bỏ 2 cảm biến này từ v1.8.0; (9) **Rà soát cuối:** sửa 3 lỗi đánh số bad-case sai bước phân nhánh (Flow 9b) và 2 dòng RACI thiếu vai trò (xoá tài khoản phải áp dụng mọi role, không chỉ Farm Owner/Sales Staff); thêm thuật ngữ OTA + Right to Erasure vào Bảng Thuật ngữ; (10) **Hoàn thiện:** cập nhật sơ đồ Master Flow (mục 10) thêm nhánh Technician Web Console onboarding, ticket INSTALLATION, offline-detection, quản lý tài khoản Admin; làm rõ `users.role = null` cho Buyer đã đăng ký (không phải bỏ sót, mà Buyer không tham gia RBAC) |

_Phiên bản hiện tại: 1.12.0 | Ngày cập nhật: 16/09/2026 | Trạng thái: DRAFT — chờ điền tên thành viên phụ trách (mục 14.1) và chốt mô hình thu tiền (RISK-08). Toàn bộ linh kiện phần cứng đã mua & chốt BOM thực tế (5 cảm biến + 2 Buck + đế ESP32 + relay H/L + DFPlayer/PAM8403 + camera IR 940nm); backend AUTH/FARM/DEVICE/TELEMETRY + offline-detection đã code và chạy thật; luồng nghiệp vụ đã rà soát đầy đủ 19 Flow cho cả 5 actor, sẵn sàng làm cơ sở code tiếp Technician Web Console + các Flow mới_
