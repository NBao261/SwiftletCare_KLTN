# Việc cần làm trước Review 2 — theo Report 3 (SRS) và Report 4 (SDD)

Danh sách gom từ: Report 3 `report3-srs.md`, Report 4 `report4-sdd.md`, bảng "Chỗ lệch" trong `docs/reports/README.md` (số `#` ở cột Nguồn), các ô `[TEAM]`, và hướng dẫn chuẩn bị Review 2 (PDF). Cập nhật ngày 23/10/2026 (sau PR #95).

**Cách dùng:** đánh `[x]` khi xong, điền người nhận vào cột Người. Việc xong ở code thì sửa luôn dòng tương ứng trong `docs/reports/README.md` ("Chỗ lệch") trong cùng PR. Mức ưu tiên:

- **P0** — thiếu thì không demo được luồng chính hoặc hội đồng chắc chắn hỏi.
- **P1** — yêu cầu bắt buộc (M) của Report 3 nhưng không chặn demo.
- **P2** — sửa cho đúng chuẩn, nợ cũ, tùy chọn.

---

## 1. Hồ sơ Review 2 (không phải code)

| | Việc | Ưu tiên | Người | Ghi chú |
|---|---|:---:|---|---|
| [x] | Phiếu đăng ký bản đề xuất chốt v3 + **BM03** | P0 | | `registration-v3.md`, `bm03-record-of-changes.md`, docx ở `registration/`. Còn: thêm số điện thoại vào bản docx nộp (repo cố ý không lưu), điền mã đề tài, GVHD, ngày; xuất PDF chung một file `…_R2_Registration.pdf` |
| [x] | Report 1 (Introduction), Report 2 (Project Management Plan) | P0 | | `report1-introduction.md`, `report2-project-management-plan.md`. Còn: ô `[TEAM]` (khảo sát thị trường, số liệu ngành, ngày các mốc, nhóm chat), xác nhận ước lượng công và % hoàn thành |
| [x] | **Report 5** – test plan + 131 test case (22 tính năng × 3, 11 workflow, 48 chuyển trạng thái, 6 NFR) | P0 | | `report5-test.md`, sinh từ `report5/tc.py`. 69 test tự động đang đạt; 42 test tự động còn phải viết; 20 test thủ công chạy trên staging/nhà yến |
| [x] | **Project Tracking** | P0 | | `project-tracking.md` (mốc, PR theo người, trạng thái tính năng, defect) |
| [x] | **BM01 Design Brief** + Phụ lục A | P0 | | `design-brief.md`, docx ở `design-brief/` (mục 0–8 vừa 4 trang). Còn: xác nhận Ownership Map (đề xuất theo lịch sử commit), PR của từng người, ngưỡng NFR-09/14 |
| [x] | **Đưa PR #89 vào `develop`** (pipeline gửi MQTT, đẩy video, job pytest) | P0 | Bảo | Xong 23/10/2026 qua PR #95 (Project Tracking DF-1 đã đóng) |
| [ ] | Điền các ô `[TEAM]` còn lại | P0 | | Danh sách ở mục 2 |
| [ ] | Xuất Report 1–5 và Project Tracking ra PDF theo mẫu, tên `SWP490_<Mã>_R2_Report<n>.pdf` | P0 | | Sơ đồ Mermaid render sẵn |
| [ ] | Gắn tag `review-2` trên repo sau khi mọi thứ trên đã merge | P0 | | |
| [ ] | **BM02 Self-review**: chạy prompt mẫu của PDF trên tag `review-2`, không sửa prompt; điểm High Kept/Planned thêm vào Known Gaps của Design Brief | P0 | | Tắt Memory trước khi chạy |
| [ ] | Mở PR cho nhánh tài liệu `claude/modest-mendel-wz9d7b` và merge vào `develop` | P0 | | |
| [ ] | (Tùy chọn) Chuyển `SwiftletCare_SRS.md` sang `docs/archive/` khi Report 3 chốt | P2 | | Đầu file đã ghi là ghi chú nội bộ |

**Ngưỡng Defense 1.1 cần nhắm tới:** 100 % workflow chạy end-to-end trên staging · ≥ 90 % test case đạt · ≥ 50 % test chạy tự động trong CI · không còn defect Critical/High.

---

## 2. Ô `[TEAM]` cần điền

Mã đề tài, GVHD và ngày nằm ở đầu mọi file (Report 1–5, Design Brief, BM03, phiếu v3) — điền một lần cho tất cả.

### `docs/reports/report3-srs.md`

| | Dòng | Nội dung |
|---|---|---|
| [ ] | 7, 10, 12 | Mã đề tài, GVHD, ngày |
| [ ] | 94 | REF-9 MS 2273:2012 — có bản đầy đủ hay bỏ |
| [ ] | 95 | REF-10 Nghị định 13/2020 Điều 25 — đọc nguyên văn, giờ được phát loa, quy định tỉnh |
| [ ] | 233 | Cấu hình PC cũ làm AI node (CPU, RAM, GPU nếu có) |
| [ ] | 490 | BR-01 độ ẩm sàn 75 % hay 80 % — hỏi người nuôi yến |
| [ ] | 501 | BR-07 giờ phát loa nằm trong khung pháp luật cho phép |
| [ ] | 608 | NFR-08 tỷ lệ tự động, % trong ngưỡng |
| [ ] | 609 | NFR-09 Precision/Recall/sai số đếm (ban ngày, hồng ngoại) |
| [ ] | 611 | NFR-11 MAE dự báo 60 phút |
| [ ] | 612 | NFR-13 mốc 10 phút setup thiết bị |
| [ ] | 613 | NFR-14 mức trùng khớp và kappa |
| [ ] | 887 | Cách chạy tay bơm/quạt khi bộ điều khiển hỏng (theo cách đấu của nhà yến đang mượn) |
| [ ] | 904 | Ngày phiên bản 3.0.0 |

### `docs/reports/report4-sdd.md`

| | Dòng | Nội dung |
|---|---|---|
| [ ] | 7, 10, 12 | Mã đề tài, GVHD, ngày |
| [ ] | 144 | Điều khoản sử dụng Open-Meteo |
| [ ] | 158 | Phiên bản mạch nhóm tự vẽ |
| [ ] | 183 | Nhà cung cấp VPS và tên miền staging (đề xuất ở `docs/deploy/staging.md`) |
| [ ] | 192, 193 | Công cụ AI và model nhóm dùng |
| [ ] | 1333 | Nơi chép bản sao lưu MongoDB ra ngoài VPS |
| [ ] | 1366–1373 | Ngày các phiên bản 1.0.0 → 1.0.7 |

### Các hồ sơ mới

| | File | Nội dung |
|---|---|---|
| [ ] | `report1-introduction.md` dòng 53, 64 | Sản phẩm có trên thị trường (tên, giá, link); số liệu ngành yến có nguồn |
| [ ] | `report2-project-management-plan.md` dòng 22, 74–80, 145 | Xác nhận ước lượng; ngày Review 1, Review 2, các iteration, Defense 1.1, Viva; nhóm chat |
| [ ] | `design-brief.md` dòng 108, 110, 117–119 | Ngưỡng NFR-09, NFR-14; PR tiêu biểu của từng người |
| [ ] | `project-tracking.md` dòng 14–19 | Ngày các mốc |
| [ ] | `report5-test.md` (sửa trong `report5/tc.py`) | Số clip của NFR-09; ngưỡng NFR-09, NFR-14 |

---

## 3. Việc thực tế ngoài code

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [ ] | Train model 1 lớp `swiftlet` trên clip của nhà (Roboflow → Colab → ONNX); chia train/test **theo ngày**; báo độ chính xác tách ban ngày và hồng ngoại | P0 | | #7, VISION-FR-003, 016, NFR-09 |
| [ ] | Đo FPS của pipeline trên **PC cũ đặt tại nhà thành viên** (NFR-04 cần 25 fps); ghi cấu hình máy; không đạt thì thử ảnh vào nhỏ hơn / 1 ô / GPU, rồi ghi số đo thật | P0 | | #7, NFR-04, `docs/deploy/staging.md` §2.3 |
| [ ] | Đưa hệ thống vào nhà yến, chạy liên tục **≥ 14 ngày** (đủ cho NFR-08, 11, 14) | P0 | | #38 |
| [ ] | Người nuôi yến đánh giá từng ngày (hỏi đánh giá trước, rồi mới xem trạng thái của hệ thống) trong đợt chạy | P0 | | EXPERT-FR-012, BR-31 |
| [ ] | Biên bản phỏng vấn 2–3 người nuôi yến lâu năm: ngưỡng BR-01, NH3/CO2 BR-02, mức lệch BR-28, luật kết hợp BR-29, mưa BR-30 (mẫu ở `docs/evidence-register.md` mục 7.2) | P0 | | #11 |
| [ ] | `docs/evidence-register.md`: đọc các nguồn ở mục 4.0, chuyển vào bảng 4.1/4.2; điền cột nguồn cho các khẳng định `KD-xx` | P0 | | #11 |
| [ ] | Ghi kết quả thử firmware trên board thật vào `firmware/README.md` (rút cảm biến, bơm khô, đổi tham số, OTA, RESTART, mất mạng 30 phút, mất điện) | P0 | | NFR-05, 06, 07 |
| [ ] | Kiểm tra cách đấu công tắc có sẵn của nhà yến (trước hay song song relay) và viết cách chạy tay | P1 | | Report 3 §8.1 |
| [ ] | Vẽ và in mạch điều khiển: ESP32, RS485, relay, ADS1115 + 2 biến dòng kẹp (SCT-013 / ZMCT103C) | P1 | | #37, THREAT-FR-014, D11 |
| [ ] | Dựng staging theo `docs/deploy/staging.md`: VPS 2 vCPU/4 GB + tên miền, Caddy TLS, tls-proxy cho MQTT 8883 và RTSPS 8322, MediaMTX; viết `deploy/docker-compose.staging.yml`, Dockerfile backend/web, Caddyfile; script seed demo đủ dữ liệu cho 22 kịch bản | P0 | | #40, Report 4 §3.4, §11 |
| [ ] | Cài PC cũ tại nhà thành viên làm AI node: `.env` có URL RTSP qua IP tĩnh nhà yến (cổng 18554), `stream.py` chạy như service, BIOS tự bật khi có điện; đặt mật khẩu camera mạnh và giới hạn IP nguồn trên modem nếu được | P0 | | Report 4 D5, `docs/deploy/staging.md` §2.3 |
| [ ] | Chạy thử kéo hình camera qua Internet liên tục 24 giờ; đếm cùng một clip đọc trực tiếp và đọc qua Internet, so số đếm | P0 | | Report 4 D5, plan §19.5 cổng 3b |
| [ ] | Firmware MQTT TLS (môi trường build `cloud`, CA Let's Encrypt) để ESP32 nối được broker staging | P0 | | #39, plan §15.7 |
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
| [~] | `stream.py` gửi MQTT (số đếm phiên, số đếm 5 phút, heartbeat) và đẩy video lên MediaMTX đã có trên develop (PR #95); còn chạy thử với EMQX/MediaMTX của staging từ PC cũ tại nhà thành viên | P0 | Bảo | #7, VISION-FR-006, 013, 014, 017 |
| [~] | Khối MQTT Raspberry Pi trong `config.yaml` đã bỏ (PR #95); khung giờ phiên trong `config.yaml` chỉ còn là mặc định cho tới khi backend tính phiên từ số đếm 5 phút | P2 | | `ai-pipeline/CLAUDE.md`, #20 |
| [x] | Job CI cho `pytest` của pipeline | P1 | Bảo | Có từ PR #95 |

### 4.4. Web (frontend)

| | Việc | Ưu tiên | Người | Nguồn |
|---|---|:---:|---|---|
| [~] | Role `DOMAIN_EXPERT` đã có từ PR #91 (`/expert/*`, `EXPERT_ROLES`, `ExpertPageShell`); còn: bỏ dữ liệu giả dự phòng, đổi sang thư mục/tên theo FE_Design §12 (`domain-expert/`, `DomainExpertLayout`, `apis/`) | P1 | Tuấn | #9, FE_Design 12.8 |
| [~] | Màn chuyên gia: kiểm chứng cảnh báo, báo cáo + kết luận, tham số phát hiện đã có (PR #91); còn: bằng chứng theo cảnh báo, `DISMISSED`, vòng đếm vẽ trên khung live, duyệt thay đổi, đề xuất hệ số, lịch đếm | P0 | Tuấn | #9, #21 |
| [ ] | MF-11: trạng thái sức khỏe theo ngày + lý do, màn đánh giá ngày (hỏi trước rồi mới hiện), báo cáo ngày/tuần/tháng, tải PDF (`jspdf`) và CSV | P0 | | #32–35 |
| [~] | Live stream có khung + số đếm trực tiếp theo House: web Farm Owner đã có (trang Vision, WHEP, PR #93); còn chờ nút AI đẩy video (PR #89) và màn mobile | P0 | | VISION-FR-012, 013 |
| [~] | Farm Owner: lịch sử can thiệp tay, thẻ tỷ lệ tự động đã có ở `/analytics` (PR #93); còn lịch sử quyết định của chuyên gia (chờ backend EXPERT-FR-009) | P1 | | ENV-FR-019, ANALYTICS-FR-011, EXPERT-FR-009 |
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
| [~] | Gỡ phần cũ: Marketplace, nhãn `BIRD_PANIC`, relay sưởi trên màn đã xong (PR #93); còn `sales-staff/` + role `SALES_STAFF`, trường `heating` trong `RelayStates`, tùy chọn Zalo/SMS ở `SettingsPage` | Web | P0 | #30, FE_Design 13.14 |
| [ ] | Gỡ chỗ sửa ngưỡng/hệ số khỏi màn Technician (`ThresholdsModal`) | Web | P0 | #15 |
| [ ] | Ẩn nút can thiệp tay/xác nhận cảnh báo với Admin, và với Technician không giữ ticket | Web | P1 | FE_Design 12.0 c |
| [ ] | `HARVEST_ROLES`: bỏ Admin, thêm chuyên gia chỉ xem | Web | P2 | FE_Design 12.0 c dòng 4 |
| [ ] | Đổi chữ "PLC" thành "Bộ điều khiển" (`zone.plc` trong `farmStructure.i18n.ts`, `ScadaModeBanner`); gỡ trang stub `FarmOwnerLiveStreamPage` còn ghi "RPi" (live stream đã ở trang Vision) | Web | P2 | FE_Design 13.14 |
| [ ] | `/onboarding` → `FarmOwnerDeviceSetupPage` mở cho Farm Owner + Technician | Web | P1 | FE_Design 12.0 c dòng 5b |
| [ ] | Comment cũ "FARM-FR-003c khu nâng cao / secretKey trong NVS" ở `provisionedDevice.service.ts`, `device.service.ts` | BE | P2 | #27 |
| [ ] | Nợ frontend còn lại (ErrorBoundary, gộp i18n, lỗi API theo nhóm, nhãn enum chung…) — trả khi sửa màn | Web | P2 | FE_Design 13.14 |
| [ ] | Hạn can thiệp tay theo thiết bị (BR-20) — giữ như SRS; muốn tính riêng từng relay thì sửa cả backend và firmware | BE/FW | P2 | #13 |

---

## 6. Thứ tự đề xuất trong 2 tuần

1. **Tuần 1:**
   - Dữ liệu và phần cứng: train model, dựng staging (VPS + PC cũ tại nhà thành viên), đưa hệ thống vào nhà yến, phỏng vấn người nuôi.
   - Backend P0: quyền theo §2.4, MF-10, `DISMISSED`, FCM, MF-11 (đánh giá theo ngày, đánh giá của người nuôi, báo cáo).
   - Chạy pipeline (gửi MQTT và video) với staging từ PC cũ tại nhà thành viên.
2. **Tuần 2:**
   - Web và mobile P0: role chuyên gia, màn chuyên gia, MF-10, MF-11, live stream.
   - Backend và firmware P1.
   - Điền `[TEAM]` trong các hồ sơ đã soạn; gắn tag `review-2`; chạy BM02.
3. **Song song suốt 2 tuần:** ghi minh chứng (ảnh, log, số đo) vào `docs/evidence-register.md` mục 6.

Việc P1 không kịp thì không xoá khỏi SRS mà ghi vào mục Known Gaps của Design Brief; riêng yêu cầu M của Report 3 phải có kế hoạch làm sau Review 2.
