# Việc cần làm trước Review 2 — theo Report 3 (SRS) và Report 4 (SDD)

Danh sách gom từ: Report 3 `report3-srs.md`, Report 4 `report4-sdd.md`, bảng "Chỗ lệch" trong `docs/reports/README.md` (số `#` ở cột Nguồn), các ô `[TEAM]`, và hướng dẫn chuẩn bị Review 2 (PDF). Cập nhật ngày 23/10/2026.

**Cách dùng:** đánh `[x]` khi xong, điền người nhận vào cột Người. Việc xong ở code thì sửa luôn dòng tương ứng trong `docs/reports/README.md` ("Chỗ lệch") trong cùng PR. Mức ưu tiên:

- **P0** — thiếu thì không demo được luồng chính hoặc hội đồng chắc chắn hỏi.
- **P1** — yêu cầu bắt buộc (M) của Report 3 nhưng không chặn demo.
- **P2** — sửa cho đúng chuẩn, nợ cũ, tùy chọn.

---

## 1. Hồ sơ Review 2 (không phải code)

| | Việc | Ưu tiên | Người | Ghi chú |
|---|---|:---:|---|---|
| [ ] | Điền các ô `[TEAM]` trong Report 3 (16 chỗ) và Report 4 (15 chỗ) | P0 | | Danh sách dòng: xem mục 2 bên dưới |
| [ ] | Phiếu đăng ký bản chốt + **BM03** (chép 8 dòng ở `docs/reports/README.md`, mục "Bản nháp các dòng BM03") | P0 | | Phiếu phải có trong repo (PDF yêu cầu) |
| [ ] | Report 1 (giới thiệu dự án), Report 2 (kế hoạch quản lý dự án) | P0 | | Chưa có |
| [ ] | **Report 5 – Test plan + test case**: test theo FR, theo chuyển trạng thái (17 lifecycle), theo NFR, end-to-end cho 11 luồng chính | P0 | | Ánh xạ ~700 test backend đang có vào test case |
| [ ] | **BM01 Design Brief** + Phụ lục A (bảng workflow, kịch bản demo chính và ngoại lệ, số test cam kết, tối đa 6 NFR cam kết) | P0 | | Report 4 §4 có 13 quyết định thiết kế, Brief chọn 5 |
| [ ] | Xuất Report 3, 4 ra PDF theo mẫu, tên `SWP490_<Mã>_R2_Report<n>.pdf` | P0 | | Sơ đồ Mermaid render sẵn |
| [ ] | Gắn tag `review-2` trên repo sau khi mọi thứ trên đã merge | P0 | | |
| [ ] | **BM02 Self-review**: chạy prompt mẫu của PDF trên tag `review-2`, không sửa prompt | P0 | | Tắt Memory trước khi chạy |
| [ ] | Mở PR cho nhánh tài liệu `claude/modest-mendel-wz9d7b` và merge vào `develop` | P0 | | |
| [ ] | (Tùy chọn) Chuyển `SwiftletCare_SRS.md` sang `docs/archive/` khi Report 3 chốt | P2 | | Đầu file đã ghi là ghi chú nội bộ |

**Ngưỡng Defense 1.1 cần nhắm tới:** 100 % workflow chạy end-to-end trên staging · ≥ 90 % test case đạt · ≥ 50 % test chạy tự động trong CI.

---

## 2. Ô `[TEAM]` cần điền

### `docs/reports/report3-srs.md`

| | Dòng | Nội dung |
|---|---|---|
| [ ] | 7, 10, 12, 13 | Mã đề tài, GVHD, ngày, phiên bản phiếu |
| [ ] | 94 | REF-9 MS 2273:2012 — có bản đầy đủ hay bỏ |
| [ ] | 95 | REF-10 Nghị định 13/2020 Điều 25 — đọc nguyên văn, giờ được phát loa, quy định tỉnh |
| [ ] | 483 | BR-01 độ ẩm sàn 75 % hay 80 % — hỏi người nuôi yến |
| [ ] | 494 | BR-07 giờ phát loa nằm trong khung pháp luật cho phép |
| [ ] | 601 | NFR-08 tỷ lệ tự động, % trong ngưỡng |
| [ ] | 602 | NFR-09 Precision/Recall/sai số đếm (ban ngày, hồng ngoại) |
| [ ] | 604 | NFR-11 MAE dự báo 60 phút |
| [ ] | 605 | NFR-12 chi phí (theo BOM mới) |
| [ ] | 606 | NFR-13 mốc 10 phút setup thiết bị |
| [ ] | 607 | NFR-14 mức trùng khớp và kappa |
| [ ] | 872 | Cách chạy tay bơm/quạt khi bộ điều khiển hỏng (theo cách đấu của nhà yến đang mượn) |
| [ ] | 887 | Ngày phiên bản 3.0.0 |

### `docs/reports/report4-sdd.md`

| | Dòng | Nội dung |
|---|---|---|
| [ ] | 7, 10, 12 | Mã đề tài, GVHD, ngày |
| [ ] | 144 | Điều khoản sử dụng Open-Meteo |
| [ ] | 158 | Phiên bản mạch nhóm tự vẽ + BOM mạch |
| [ ] | 183 | Staging: VPS, URL, cách triển khai |
| [ ] | 192, 193 | Công cụ AI và model nhóm dùng |
| [ ] | 1317 | Lịch sao lưu MongoDB |
| [ ] | 1347–1352 | Ngày các phiên bản 1.0.0 → 1.0.5 |

---

## 3. Việc thực tế ngoài code

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | Train model 1 lớp `swiftlet` trên clip của nhà (Roboflow → Colab → ONNX); chia train/test **theo ngày**; báo độ chính xác tách ban ngày và hồng ngoại | P0 | | #7, VISION-FR-003, 016, NFR-09 |
| [ ] | Đo FPS của pipeline trên máy chạy thật (NFR-04 cần 25 fps); không đạt thì sửa NFR-04 theo số đo | P0 | | #7, NFR-04 |
| [ ] | Đưa hệ thống vào nhà yến, chạy liên tục **≥ 14 ngày** (đủ cho NFR-08, 11, 14) | P0 | | #38 |
| [ ] | Người nuôi yến đánh giá từng ngày (hỏi đánh giá trước, rồi mới xem trạng thái của hệ thống) trong đợt chạy | P0 | | EXPERT-FR-012, BR-31 |
| [ ] | Biên bản phỏng vấn 2–3 người nuôi yến lâu năm: ngưỡng BR-01, NH3/CO2 BR-02, mức lệch BR-28, luật kết hợp BR-29, mưa BR-30 (mẫu ở `docs/evidence-register.md` mục 7.2) | P0 | | #11 |
| [ ] | `docs/evidence-register.md`: đọc các nguồn ở mục 4.0, chuyển vào bảng 4.1/4.2; điền cột nguồn cho các khẳng định `KD-xx` | P0 | | #11 |
| [ ] | Ghi kết quả thử firmware trên board thật vào `firmware/README.md` (rút cảm biến, bơm khô, đổi tham số, OTA, RESTART, mất mạng 30 phút, mất điện) | P0 | | NFR-05, 06, 07 |
| [ ] | Kiểm tra cách đấu công tắc có sẵn của nhà yến (trước hay song song relay) và viết cách chạy tay | P1 | | Report 3 §8.1 |
| [ ] | Cập nhật `docs/hardware/BOM.md` theo linh kiện thật + hoá đơn | P1 | | #10, NFR-12 |
| [ ] | Vẽ và in mạch điều khiển: ESP32, RS485, relay, ADS1115 + 2 biến dòng kẹp (SCT-013 / ZMCT103C) | P1 | | #37, THREAT-FR-014, D11 |
| [ ] | Dựng staging (VPS, TLS, MediaMTX, EMQX 8883) để demo | P0 | | Report 4 §3.4, §11 |
| [ ] | In nhãn QR cho các board thật và mã QR cho từng tầng của nhà yến thử nghiệm | P1 | | MF-10 |

---

## 4. Code chưa làm theo Report 3 / Report 4

### 4.1. Backend

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | **Quyền theo Report 3 §2.4:** bỏ `TECHNICIAN`, `ADMIN` khỏi sửa/reset ngưỡng Zone, hệ số mờ, ngưỡng theo node; Technician chỉ can thiệp tay và xác nhận cảnh báo khi giữ ticket mở của farm; Admin không làm hai việc đó; báo Farm Owner khi Technician can thiệp tay | P0 | | #2, #15 |
| [ ] | **MF-10:** cho `FARM_OWNER` đăng ký/dời/gỡ/thay thiết bị (farm của mình), bỏ `ADMIN` ở đăng ký; dời thiết bị đang offline (lưu Zone mới, heartbeat tự sửa topic); cho cấp lại key khi thiết bị không còn hoạt động; sửa comment FARM-FR-003c cũ | P0 | | #25, #26, #27 |
| [ ] | **MF-11:** job `healthAssessment` hằng ngày, collection `househealthdays`, mức chỉ số theo House (chuyên gia sửa), luật kết hợp BR-29, mưa BR-30 | P0 | | #32 |
| [ ] | Đánh giá theo ngày của người nuôi (route ghi đánh giá; không cho sửa sau khi đã xem trạng thái) | P0 | | #33 |
| [ ] | Báo cáo theo House ngày/tuần/tháng (đổi từ tuần theo Zone), CSV chỉ số theo ngày | P0 | | #34, #35 |
| [ ] | Job thời tiết Open-Meteo mỗi giờ, collection `weatherobservations` | P1 | | #36 |
| [ ] | `DISMISSED` khi chuyên gia bác bỏ: lưu trạng thái trước, bắt buộc ghi chú khi `REJECTED`, gộp trùng/tự đóng tính cả `DISMISSED` (enum 3 phía cùng PR) | P0 | | #19 |
| [ ] | BR-22: farm chưa có chuyên gia thì Farm Owner kiểm chứng, sửa tham số phát hiện, vòng đếm, lịch đếm; thông báo cảnh báo suy luận chuyển cho Farm Owner | P1 | | #17 |
| [ ] | EXPERT-FR-009: báo Farm Owner mọi quyết định của chuyên gia + endpoint lịch sử hoạt động của chuyên gia | P1 | | #18 |
| [ ] | EXPERT-FR-010/011: mục duyệt thay đổi của chủ farm, đề xuất hệ số (2 collection, route, thông báo) | P1 | | #21 |
| [ ] | ENV-FR-027: version cấu hình theo Zone, so với version thiết bị báo, gửi lại khi lệch, `CONFIG_MISMATCH` | P1 | | #22 |
| [ ] | ALERT-FR-014: endpoint gói bằng chứng của cảnh báo suy luận | P1 | | #23 |
| [ ] | VISION-FR-019/020: lịch đếm theo mùa/tạm thời theo House; backend tính phiên từ số đếm 5 phút; job so tỷ lệ theo giờ kết thúc phiên chiều; đánh dấu phiên không đầy đủ | P1 | | #20, #24 |
| [ ] | ALERT-FR-002: gửi FCM thật; route đăng ký/huỷ device token; xoá token FCM báo không hợp lệ | P0 | | #12 |
| [ ] | `ACTUATOR_FAULT`: nhận từ firmware, mức HIGH, sinh ticket `ACTUATOR_FAILURE` (enum 3 phía) | P1 | | #37 |
| [ ] | ENV-FR-007: bắt buộc ghi nguồn khi Admin đổi ngưỡng mặc định | P1 | | #16 |
| [ ] | MARKET-FR-001: kiểm tra số tổ/khối lượng > 0, ngày không ở tương lai | P2 | | #5 |
| [ ] | (Optional) ENV-FR-026 báo chuyên gia khi ngưỡng mặc định đổi | P2 | | #16 |
| [ ] | Mỗi việc trên: cập nhật `docs/api/api-spec.yaml`, chạy `npm run db:script` khi đổi model, thêm test (unit/integration), thêm hằng số tự chọn vào Report 3 §4.5 | — | | `backend/CLAUDE.md` |

### 4.2. Firmware

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | Gửi version cấu hình đang áp trong heartbeat | P1 | | #22, ENV-FR-027 |
| [ ] | Đo dòng bơm/quạt qua ADS1115, học dòng bình thường, `ACTUATOR_FAULT` (BR-32); test host-side cho logic so sánh | P1 | | #37, THREAT-FR-014 |
| [ ] | Telemetry thêm `pump_current_a`, `fan_current_a` (đổi cùng backend handler) | P1 | | Report 4 §7.2 |
| [ ] | (Optional) Device ID lấy từ MAC khi `Secrets.h` không ghi | P2 | | #29 |
| [ ] | Bump `FIRMWARE_VERSION` khi đổi hành vi | — | | `firmware/CLAUDE.md` |

### 4.3. AI pipeline

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | `stream.py` gửi MQTT: số đếm phiên mỗi 30 s, số đếm 5 phút, heartbeat (TLS 8883, topic theo House) | P0 | | #7, VISION-FR-006, 017 |
| [ ] | Đẩy video đã vẽ khung lên MediaMTX | P0 | | VISION-FR-013, 014 |
| [ ] | Luồng đọc khung mới nhất (không trễ dần), tự kết nối lại camera/broker | P1 | | plan §6.6 |
| [ ] | Bỏ khối MQTT Raspberry Pi trong `config.yaml`; khung giờ phiên chỉ là mặc định | P2 | | `ai-pipeline/CLAUDE.md` Known debt |
| [ ] | Thêm job CI cho `pytest` của pipeline | P2 | | Report 4 §12 |

### 4.4. Web (frontend)

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | Thêm role `DOMAIN_EXPERT`: `DomainExpertLayout`, nhóm role `FARM_SIDE_ROLES`, `EXPERT_ONLY`, `MENU_ACCESS` | P0 | | #9, FE_Design 12.8 |
| [ ] | Màn chuyên gia: kiểm chứng cảnh báo (kèm bằng chứng), báo cáo + kết luận, tham số phát hiện, vòng đếm (vẽ trên khung live), duyệt thay đổi, đề xuất hệ số, lịch đếm | P0 | | #9, #21 |
| [ ] | MF-11: trạng thái sức khỏe theo ngày + lý do, màn đánh giá ngày (hỏi trước rồi mới hiện), báo cáo ngày/tuần/tháng, tải PDF (`jspdf`) và CSV | P0 | | #32–35 |
| [ ] | Live stream có khung + số đếm trực tiếp theo House | P0 | | VISION-FR-012, 013 |
| [ ] | Farm Owner: lịch sử can thiệp tay, thẻ tỷ lệ tự động, lịch sử quyết định của chuyên gia | P1 | | ENV-FR-019, ANALYTICS-FR-011, EXPERT-FR-009 |
| [ ] | MF-10 trên web: in nhãn QR ở kho thiết bị (Admin), in mã QR tầng ở màn Zone, quét QR (`html5-qrcode`), tiến trình setup | P1 | | #28 |
| [ ] | Hiện `DISMISSED` trong danh sách cảnh báo khi backend có | P1 | | FE_Design 2.6.1 |

### 4.5. Mobile

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | Đồng bộ enum với backend (`Role`, `AlertType`…), bỏ Zalo/SMS | P0 | | #31 |
| [ ] | Đăng ký FCM token sau đăng nhập, huỷ khi đăng xuất; nhận push | P0 | | #12, ALERT-FR-002 |
| [ ] | MF-10: quét nhãn + mã tầng (`expo-camera`), hướng dẫn cài Wi-Fi AP-mode, tiến trình setup | P0 | | #28 |
| [ ] | Dashboard, cảnh báo, trạng thái sức khỏe theo ngày + đánh giá ngày | P0 | | MF-11 |
| [ ] | Live stream theo camera của House (đổi route `livestream/[zoneId]`) | P1 | | `mobile/CLAUDE.md` |
| [ ] | Thêm `off*` cho socket trước khi màn đầu tiên đăng ký sự kiện | P1 | | #31 |

---

## 5. Sửa lại cho đúng chuẩn (code đang có)

| | Việc | Module | Ưu tiên | Nguồn |
|---|---|---|:---:|---|
| [ ] | Gỡ `PREDATOR_DETECTED` khỏi `AlertType`, `TicketType` (3 phía cùng PR) | BE/FE/Mobile | P1 | #6 |
| [ ] | Quyết `ERROR`/`DEGRADED` (thiết bị) và `ARCHIVED` (thu hoạch): bỏ khỏi enum hoặc có luồng gán | BE/FE/Mobile | P2 | #3, #4 |
| [ ] | Gỡ `sales-staff/`, các trang Marketplace, relay sưởi ("Quá lạnh"), nhãn `BIRD_PANIC`, kênh Zalo/SMS | Web | P0 | #30, FE_Design 13.14 |
| [ ] | Gỡ chỗ sửa ngưỡng/hệ số khỏi màn Technician (`ThresholdsModal`) | Web | P0 | #15 |
| [ ] | Ẩn nút can thiệp tay/xác nhận cảnh báo với Admin, và với Technician không giữ ticket | Web | P1 | FE_Design 12.0 c |
| [ ] | `HARVEST_ROLES`: bỏ Admin, thêm chuyên gia chỉ xem | Web | P2 | FE_Design 12.0 c dòng 4 |
| [ ] | Đổi chữ "PLC" thành "Bộ điều khiển"; bỏ câu "Raspberry Pi" ở `BirdTab`, `CorrelationCard` | Web | P2 | FE_Design 13.14 |
| [ ] | `/onboarding` → `FarmOwnerDeviceSetupPage` mở cho Farm Owner + Technician | Web | P1 | FE_Design 12.0 c dòng 5b |
| [ ] | Comment cũ "FARM-FR-003c khu nâng cao / secretKey trong NVS" ở `provisionedDevice.service.ts`, `device.service.ts` | BE | P2 | #27 |
| [ ] | Nợ frontend còn lại (ErrorBoundary, gộp i18n, lỗi API theo nhóm, nhãn enum chung…) — trả khi sửa màn | Web | P2 | FE_Design 13.14 |
| [ ] | Hạn can thiệp tay theo thiết bị (BR-20) — giữ như SRS; muốn tính riêng từng relay thì sửa cả backend và firmware | BE/FW | P2 | #13 |

---

## 6. Thứ tự đề xuất trong 2 tuần

1. **Tuần 1:**
   - Dữ liệu và phần cứng: train model, dựng staging, đưa hệ thống vào nhà yến, phỏng vấn người nuôi.
   - Backend P0: quyền theo §2.4, MF-10, `DISMISSED`, FCM, MF-11 (đánh giá theo ngày, đánh giá của người nuôi, báo cáo).
   - Pipeline gửi MQTT và video.
2. **Tuần 2:**
   - Web và mobile P0: role chuyên gia, màn chuyên gia, MF-10, MF-11, live stream.
   - Backend và firmware P1.
   - Report 5 và Design Brief; điền `[TEAM]`; gắn tag `review-2`; chạy BM02.
3. **Song song suốt 2 tuần:** ghi minh chứng (ảnh, log, số đo) vào `docs/evidence-register.md` mục 6.

Việc P1 không kịp thì không xoá khỏi SRS mà ghi vào mục Known Gaps của Design Brief; riêng yêu cầu M của Report 3 phải có kế hoạch làm sau Review 2.
