# Việc cần làm — Review 2 và Iteration 2

Cập nhật 26/10/2026, sau khi đồng bộ hồ sơ: phiếu v3 + BM03 1.1, SRS 3.1.0, SDD 1.1.0, Design Brief 1.1, Report 5 1.1.0 (136 test case).

**Cách dùng:**
- Trạng thái chỉ ghi ở `project-tracking.md`. File này chỉ liệt kê **các bước** làm từng gap (G-xx).
- Đóng một gap thì trong cùng PR: sửa dòng gap ở Project Tracking §6, cập nhật trạng thái tính năng ở §3, và đổi nguồn test trong `report5/tc.py` từ `todo-auto` sang test thật rồi sinh lại Report 5.
- Không sửa SRS/SDD để "khớp code"; code theo SRS/SDD. Hằng số mới thì thêm vào Report 3 §4.5, vị trí trong code thì thêm vào Report 4 §5.5.
- Mức ưu tiên: **P0-Tag** phải xong trước khi gắn tag `review-2` · **P0-Demo** phải xong trước khi demo Defense 1.1 trên staging · **P1** yêu cầu M của Report 3, chưa chặn tag hay demo · **P2** dọn dẹp, tùy chọn.

## Các quyết định đã chốt (26/10/2026)

1. Một installation phục vụ một chủ sở hữu nhà yến; **không có đăng ký công khai**. Admin tạo tài khoản Farm Owner và Technician; co-owner và Domain Expert vào bằng lời mời (BM03 dòng 10).
2. Kênh ngoài app: **cả FCM push và Telegram**.
3. Mobile **giữ đủ phạm vi phiếu** (3.2 b): theo dõi, phân tích số đếm, live stream (HLS), cảnh báo + push, can thiệp tay, setup QR, trạng thái ngày + chấm điểm, báo cáo, thu hoạch, kiểm chứng và tinh chỉnh của chuyên gia.
4. NFR:
   - NFR-04: tốc độ xử lý ≥ tốc độ luồng camera (25 fps).
   - NFR-08: tự động ≥ 95 %; độ ẩm trong ngưỡng ≥ 80 %.
   - NFR-09: P ≥ 0,80, R ≥ 0,80, sai số ≤ 10 %, trên 20 clip 5 phút.
   - NFR-11: MAE60 thấp hơn persistence.
   - NFR-13: ≤ 10 phút.
   - NFR-14: đồng thuận ≥ 70 % kèm khoảng tin cậy 95 %, trên ≥ 14 ngày; kappa có trọng số và Gwet's AC1 chỉ để báo cáo.
5. MQTT **theo thiết bị**: `swiftletcare/dev/{deviceId}/…`, mỗi thiết bị một credential, ACL tĩnh, ESP32 chuyển sang `esp-mqtt` + TLS, bỏ `config/reassign`.
6. Đổi tên cảnh báo `PUMP_DRY` → `MISTING_INEFFECTIVE`, `POWER_OUTAGE` → `UNEXPECTED_RESTART` (+ `reset_reason`), **không giữ alias** ngoài bảng `ALERT_TYPE_ALIAS` cho firmware cũ.
7. Can thiệp tay:
   - Bơm ON tối đa 30 phút.
   - Phải xác nhận (thiếu xác nhận thì 409) khi zone đang có `SENSOR_FAULT`, `RS485_BUS_FAILURE` hoặc `MISTING_INEFFECTIVE`.
   - Mỗi relay có hạn riêng.
   - Lệnh quá 60 giây kể từ lúc phát thì không áp dụng.
8. Trạng thái sức khỏe:
   - `current_status` luôn tính lại theo dữ liệu.
   - `evaluation_snapshot` lưu theo từng lượt chấm, không bao giờ đổi.
   - Môi trường và đàn chim là nguồn bắt buộc; không khí và tiếng ồn là tuỳ chọn.
   - Mưa chỉ hạ `ACTION` → `WATCH` khi nguồn quyết định đúng là đàn chim + tiếng ồn.
   - Cảnh báo tiếng ồn đã `DISMISSED` không tính.
9. `THRESHOLD_BREACH` cho cả 5 chỉ số: nhiệt độ/độ ẩm phải ngoài ngưỡng 10 phút, ánh sáng/NH3/CO2 phải ngoài ngưỡng 5 phút.

---

## 1. Hồ sơ Review 2

| | Việc | Ưu tiên | Ghi chú |
|---|---|:---:|---|
| [x] | Đồng bộ **cấu trúc** phiếu v3, BM03, SRS, SDD, BM01, Tracking, Report 5 theo các quyết định trên (chưa phải baseline cuối: còn G-01, G-02, `[TEAM]`, CI trên tag, BM02) | P0-Tag | 26/10/2026 |
| [x] | Sinh lại Word: `tools/make_registration_v3.py`, `make_bm03.py`, `make_bm01.py`; BM01 mục 0–8 = 4 trang (đo bằng Word 26/10) | P0-Tag | Sinh lại và đo lại sau khi điền `[TEAM]` |
| [ ] | Điền các ô `[TEAM]` (mục 2) | P0-Tag | |
| [ ] | PR code nhỏ **G-01** (enum + dọn phạm vi) và phần **bỏ đăng ký công khai** của G-02 merge trước khi gắn tag | P0-Tag | Mục 4 |
| [ ] | Mở PR nhánh tài liệu này vào `develop` | P0-Tag | |
| [ ] | Chạy CI đủ mọi module trên commit cuối của `develop` (Actions → CI → *Run workflow*); xanh thì gắn tag `review-2` **đúng commit đó** (push tag chạy CI lần nữa, không phải dời tag). Tải 3 artifact của lần chạy trên tag (`backend-jest-results`, `firmware-pio-junit`, `ai-pipeline-pytest-junit`), rồi `python docs/reports/report5/gen_report5.py docs/reports/report5/template.md docs/reports/report5-test.md --jest jest-results.json --pio pio-junit.xml --pytest pytest-junit.xml`; ghi link lần chạy CI vào Report 5 §6 | P0-Tag | CI đã có trigger tag `review-*`, chạy tay và artifact (26/10) |
| [ ] | **BM02**: chạy prompt chuẩn trên tag, không sửa prompt, giữ nguyên kết quả; trả lời Fixed/Kept/Planned; điểm High Kept/Planned thêm vào BM01 §5 | P0-Tag | Tắt Memory trước khi chạy |
| [ ] | Xuất PDF Report 1–5, Tracking, BM01, phiếu + BM03 | P0-Tag | Mermaid render sẵn |
| [ ] | (Tùy chọn) Chuyển `SwiftletCare_SRS.md` sang `docs/archive/` | P2 | |

**Ngưỡng Defense 1.1** (không phải điều kiện nộp Review 2): 100 % workflow chạy end-to-end trên staging · ≥ 90 % test đạt · ≥ 50 % test tự động trong CI · không còn defect Critical/High.

## 2. Ô `[TEAM]` cần điền

- **Mọi hồ sơ:** mã đề tài, GVHD, ngày.
- **Phiếu đăng ký (Word), các ô không có `[TEAM]`:** Class; chọn Specialty (ES/IS/JS); đánh dấu "Kinds of person make registers" (Lecturer/Students); bảng Supervisor (tên, điện thoại, e-mail, chức danh); ngày ký; số điện thoại sinh viên (chỉ điền ở bản nộp, không commit). Sửa trong `tools/make_registration_v3.py` rồi sinh lại.
- **Report 3:**
  - REF-9: có mua bản đầy đủ MS 2273:2012 hay bỏ tham chiếu.
  - REF-10: đọc nguyên văn Nghị định 13/2020 Điều 25 và quy định của tỉnh về giờ phát loa.
  - §2.5: cấu hình PC làm AI node.
  - BR-01: mức sàn độ ẩm 75 % hay 80 % (hỏi người nuôi).
  - BR-07: giờ phát loa được phép.
  - §8.1: cách chạy tay bơm/quạt bằng công tắc của nhà yến.
  - Ngày phiên bản 3.0.0.
- **Report 4:**
  - Điều khoản sử dụng Open-Meteo.
  - Phiên bản mạch tự vẽ.
  - Nhà cung cấp VPS và tên miền.
  - Công cụ AI và model đã dùng.
  - Nơi lưu bản sao lưu.
  - Ngày các phiên bản 1.0.x.
- **Report 1:** sản phẩm trên thị trường (tên, giá, link) và số liệu ngành có nguồn. Không bịa số.
- **Report 2:** ngày các mốc, xác nhận ước lượng công.
- **Design Brief §8:** PR tiêu biểu của từng người.
- **Project Tracking:**
  - §1: ngày các mốc.
  - §2: đếm lại số PR của Bảo sau #107.
  - §3: PR của F-01, 02, 04, 05, 08, 09, 12.

## 3. Việc thực tế ngoài code (G-19)

| | Việc | Ưu tiên |
|---|---|:---:|
| [ ] | Train model 1 lớp `swiftlet` (Roboflow → Colab → ONNX). Chia **train / val / test theo ngày quay trước khi trích frame**; augmentation chỉ cho train; ngày test không dùng để chỉnh tham số; 20 clip NFR-09 lấy từ ngày test, chưa từng dùng cho train hay val | P0-Demo |
| [ ] | Đếm tay 20 clip 5 phút (10 ban ngày, 10 hồng ngoại), mỗi clip 2 người đếm, đối chiếu từng khung chỗ lệch | P0-Demo |
| [ ] | Đo NFR-04 trên PC thật với luồng 25 fps cả một phiên 90 phút. Không kịp thì giảm fps camera và **đo lại NFR-09 ở fps đó** | P0-Demo |
| [ ] | Đưa hệ thống vào nhà yến, chạy ≥ 7 ngày (NFR-08, NFR-11) và ≥ 14 ngày có chấm điểm (NFR-14) | P0-Demo |
| [ ] | Biên bản phỏng vấn 2–3 người nuôi: BR-01, BR-02, mức lệch BR-28, luật BR-29, mưa BR-30 (`docs/evidence-register.md` §7.2) | P0-Demo |
| [ ] | Ghi kết quả thử board thật vào `firmware/README.md`: mất mạng 30 phút, mất điện, watchdog, rút cảm biến, phun không tăng ẩm, RESTART, OTA, SHA sai, rollback | P0-Demo |
| [ ] | Kiểm tra cách đấu công tắc của nhà yến, viết cách chạy tay (Report 3 §8.1) | P1 |
| [ ] | Vẽ, in mạch có ADS1115 + 2 điện trở shunt đo dòng phun sương và quạt (tải demo một chiều, G-13) | P1 |
| [ ] | In nhãn QR cho board thật và mã QR từng tầng | P1 |
| [ ] | Camera (NFR-10 e): xác nhận luật lọc IP nguồn trên modem nhà yến chỉ cho IP tĩnh của nhà thành viên vào cổng 18554 (chuyển cổng thôi là chưa đủ); thử từ 4G và một mạng khác phải thất bại, AI node vẫn kéo được hình; lưu ảnh chụp luật + kết quả vào `docs/evidence-register.md` | P0-Demo |

## 4. Code theo gap

Mỗi gap: tên ở Project Tracking §6, yêu cầu ở SRS, thiết kế ở SDD. Mỗi PR có test cho logic mới (backend [Bắt buộc], firmware [Bắt buộc] cho logic điều khiển/phát hiện).

### G-01 — Enum và dọn phạm vi (P0-Tag)

Một PR cho backend, web, mobile, firmware:

- [ ] `AlertType`:
  - đổi `PUMP_DRY` → `MISTING_INEFFECTIVE`, `POWER_OUTAGE` → `UNEXPECTED_RESTART`;
  - thêm `CONFIG_MISMATCH`, `ACTUATOR_FAULT`;
  - bỏ `PREDATOR_DETECTED`.
- [ ] `AlertStatus`: thêm `DISMISSED`.
- [ ] Ở 3 phía `backend/src/types/domain.types.ts`, `frontend/src/types/`, `mobile/types/`: bỏ `DeviceStatus` `ERROR`/`DEGRADED`, `HarvestStatus` `ARCHIVED`, trường `heating` trong `RelayStates`, Zalo/SMS trong tùy chọn thông báo (backend `user.model.ts`, `auth.service.ts`, `notification.service.ts`; web `SettingsPage.tsx`, `auth.types.ts`, `en.ts`).
- [ ] Backend:
  - `ALERT_TYPE_ALIAS` nhận tên cũ từ firmware cũ (`PUMP_DRY`, `POWER_OUTAGE`, `BIRD_PANIC`);
  - `UNEXPECTED_RESTART` mang `details.reset_reason` lấy từ heartbeat;
  - bỏ các nhánh `DEGRADED` ở `device.service.ts` (lệnh từ xa và dời thiết bị chỉ khi `ONLINE`), sửa test `deviceOnboarding.test.ts` theo.
- [ ] Firmware:
  - gửi tên mới;
  - `UNEXPECTED_RESTART` kèm `reset_reason` (`POWER_ON` | `WATCHDOG` | `BROWNOUT` | `CRASH`);
  - không gửi sau RESTART/OTA chủ động;
  - bump `FIRMWARE_VERSION`.
- [ ] Web/mobile:
  - nhãn i18n mới;
  - gỡ `heating` khỏi `ExpertControlPanel`, `ControlSubsystemPanel`, `dashboardMetrics`, `deviceInventory` và test;
  - gỡ nhãn predator.
- [ ] `migrate:alert-types` (đổi tên trong `alerts`, xoá cảnh báo predator, bỏ `heating`, map `ERROR`/`DEGRADED` → `ONLINE`, bỏ `ARCHIVED`, bỏ Zalo/SMS, bỏ `sla_hours` trong `systemsettings`) kèm test migration.
- [ ] Sau khi sửa: `api-spec.yaml`, `npm run db:script`.

### G-02 — Không đăng ký công khai (bỏ đăng ký: P0-Tag; phần còn lại P1)

- [ ] **Trước tag:** bỏ `/auth/register` và OTP đăng ký ở backend + `api-spec.yaml` (kể cả dòng giới hạn tốc độ nhắc `/auth/register`), bỏ trang đăng ký web và `(auth)/register` mobile; test route đăng ký trả 404.
- [ ] Backend:
  - thêm `POST /admin/farm-owners` (mật khẩu tạm, đổi ở lần đăng nhập đầu, như Technician);
  - lời mời gửi tới email chưa có tài khoản thì người nhận tạo tài khoản từ link (email, role cố định);
  - test: route đăng ký trả 404, tài khoản tạo từ link có đúng role.
- [ ] Web: bỏ trang đăng ký; màn Admin "Tạo Farm Owner"; trang nhận lời mời có ô đặt mật khẩu.
- [ ] Mobile: bỏ `(auth)/register`.
- [ ] Sửa `api-spec.yaml` và `docs/database/` nếu đổi model.

### G-03 — Vòng chuyên gia (P1)

- [ ] `DISMISSED`:
  - lưu `previous_status`;
  - `REJECTED` bắt buộc ghi chú (422);
  - đổi sang `CONFIRMED` thì khôi phục trạng thái cũ và báo lại Farm Owner;
  - gộp trùng và tự đóng tính cả `DISMISSED`;
  - `DISMISSED` không gửi thông báo.
- [ ] BR-22: farm chưa có chuyên gia thì Farm Owner ghi kết luận, sửa tham số phát hiện, vòng đếm, lịch đếm; thông báo cảnh báo suy luận chuyển cho Farm Owner.
- [ ] EXPERT-FR-009:
  - `notifyUser` cho mọi Farm Owner ở mỗi quyết định của chuyên gia;
  - `audit_logs` thêm `farm_id`, `actor_role`;
  - `GET /expert-activity?farmId=` đọc từ audit log.
- [ ] ALERT-FR-014: endpoint gói bằng chứng của cảnh báo suy luận (thiếu dữ liệu thì báo "missing", không phải 0).
- [ ] Web: hiện `DISMISSED`, ai bác bỏ và lý do; màn bằng chứng; lịch sử hoạt động.

### G-04 — Mục duyệt và đề xuất hệ số (P1)

- [ ] Collection `parameterreviews`, `coefficientproposals` theo SDD 6.1; route accept/revert/adjust, submit/approve/reject; thông báo hai chiều; Farm Owner áp gợi ý trực tiếp khi farm có chuyên gia → 403.
- [ ] Web: màn duyệt cho chuyên gia, nút "gửi chuyên gia" cho Farm Owner.

### G-05 — Vượt ngưỡng có thời gian chờ (P1)

- [ ] `telemetry.service.ts`:
  - giữ thời điểm bắt đầu vượt ngưỡng theo `(node, metric, direction)`;
  - chỉ tạo `THRESHOLD_BREACH` khi vượt liên tục `BREACH_DWELL_MS`: 10 phút cho nhiệt độ/độ ẩm, 5 phút cho ánh sáng/NH3/CO2;
  - mẫu stale không tính;
  - `details = {metric, observed, threshold, direction, started_at}`.
- [ ] Test `thresholdBreach.test.ts` (TC-F07-02): 9 phút không có cảnh báo, 10 phút có 1 cảnh báo.
- [ ] Đóng defect DF-6.

### G-06 — Can thiệp tay (P1)

- [ ] Backend:
  - `MAX_PUMP_ON_OVERRIDE_MS` = 30 phút (422);
  - đang có `SENSOR_FAULT`/`RS485_BUS_FAILURE`/`MISTING_INEFFECTIVE` mà thiếu `confirmed: true` thì 409;
  - `relay_override_logs.alert_confirmed`;
  - `sensornodes.relays` có hạn riêng từng relay (`overrideExpiry.job.ts` theo relay);
  - huỷ theo relay hoặc tất cả.
- [ ] Firmware: `overrideExpiryMs` theo từng relay (BR-20); test native.
- [ ] Lệnh có `commandId`, `issuedAt` (làm cùng G-07).
- [ ] Web/mobile: hộp xác nhận liệt kê cảnh báo đang mở trước khi bật bơm.
- [ ] Test TC-F17-02, TC-ST "MANUAL → MANUAL".

### G-07 — MQTT theo thiết bị (P1, PR lớn nhất)

Một PR cho firmware, backend, AI node và deploy. Thử trên bàn với 2 controller + AI node trước khi lên staging.

- [ ] Kho thiết bị: khi thêm thiết bị, sinh broker secret (trả một lần như activation key, lưu hash `broker_secret_hash`); thu hồi thì EMQX từ chối.
- [ ] Backend:
  - `POST /internal/mqtt-auth` cho EMQX HTTP authentication;
  - service account của backend;
  - subscribe `swiftletcare/dev/+/…` với `clean: false`, QoS 1;
  - payload có `deviceId` khác topic thì bỏ;
  - không ingest retained.
- [ ] EMQX: file authz một luật `swiftletcare/dev/${username}/#` + service account; tắt anonymous.
- [ ] Topic:
  - lên (thiết bị → cloud): `telemetry` (0), `telemetry/buffered` (1), `heartbeat` (0), `relay/status` (1, kèm `commandId`), `alert` (1, kèm `eventId`), `vision/bird-count` (1), `vision/alert` (1);
  - xuống (cloud → thiết bị): `config` (retained, có `config_version`), `cmd` (envelope `commandId`, `type`, `issuedAt`).
- [ ] Backend:
  - alert theo `eventId` (unique một phần `node_id + event_id`);
  - telemetry buffered unique `node_id + timestamp`;
  - bỏ `config/reassign` và `recordHeartbeat` sửa topic;
  - dời zone chỉ đổi DB và publish lại `config`.
- [ ] Firmware:
  - thay PubSubClient bằng `esp-mqtt` (`mqtt_client.h`), TLS với CA (ISRG Root X1), cổng 8883, user = device ID, password = secret flash cùng ID (NVS);
  - hàng đợi alert trong NVS, xoá khi có PUBACK;
  - buffer flash xoá khi có PUBACK;
  - nhớ 16 `commandId` gần nhất, RESTART/OTA lưu NVS;
  - bỏ lệnh RELAY/AUDIO/RESTART cũ hơn 60 giây (cần NTP);
  - OTA bỏ `setInsecure()`, dùng CA;
  - test native cho bộ lọc lệnh trùng/cũ.
- [ ] AI node: topic theo thiết bị, credential riêng, heartbeat có `fps` và `model_version`; đọc ring từ `config` retained.
- [ ] Cập nhật quy tắc MQTT ở `CLAUDE.md` gốc, `backend/CLAUDE.md`, `firmware/CLAUDE.md`, `ai-pipeline/CLAUDE.md`; bỏ câu "current code".
- [ ] Đóng DF-4.
- [ ] Test NFR-10 (d): script thử publish sang topic thiết bị khác thì bị từ chối.

### G-08 — Phiên bản cấu hình (P1)

- [ ] `zones.config_version` tăng mỗi lần đổi ngưỡng, hệ số hoặc tham số phát hiện; `config` retained mang version; heartbeat báo `applied_config_version`; job `configSync` publish lại khi còn version cũ, quá 3 heartbeat lúc online thì `CONFIG_MISMATCH`; firmware cũ không báo version thì `UNKNOWN`.
- [ ] API trả trạng thái đồng bộ theo controller (PENDING/APPLIED/MISMATCH/UNKNOWN).
- [ ] Test TC-ST config sync 4 dòng.

### G-09 — Màn MF-10 (P1)

- [ ] Web Admin: in nhãn ngay sau khi thêm thiết bị (`qrcode`), hiện broker secret một lần để flash.
- [ ] Màn Zone: in mã QR tầng.
- [ ] Cấp lại key cho thiết bị đã gỡ (BR-26), sửa `rotateProvisionedKey` và comment cũ "secretKey trong NVS".
- [ ] Mobile: quét nhãn + mã tầng (`expo-camera`), hướng dẫn Wi-Fi AP-mode, màn tiến trình (PENDING → ONLINE → APPLIED).
- [ ] Web: `/onboarding` cho Farm Owner + Technician.

### G-10 — FCM (P0-Demo, cần cho NFR-02)

- [ ] Backend:
  - collection `pushtokens`;
  - `POST`/`DELETE /notifications/push-tokens`;
  - adapter `push` dùng `firebase-admin` (credential qua biến môi trường, không commit);
  - xoá token FCM báo invalid;
  - không log token.
- [ ] Mobile: `expo-notifications` lấy FCM token sau đăng nhập, huỷ khi đăng xuất; mở thông báo thì vào chi tiết cảnh báo.
- [ ] Test TC-F08-03 (mock Firebase Admin).

### G-11 — MF-11 (P0-Demo)

- [ ] `houses.health_levels` (Domain Expert sửa, Farm Owner khi không có chuyên gia).
- [ ] Job `weather` mỗi giờ (Open-Meteo, chỉ gửi tọa độ), `weatherobservations` TTL 90 ngày.
- [ ] Job `healthAssessment` sau `returnRate`:
  - chỉ số và completeness theo từng nguồn (BR-28);
  - luật BR-29 theo thứ tự;
  - mưa BR-30;
  - bỏ `NOISE_ANOMALY` đã `DISMISSED`;
  - lưu `current_status` và `current_reasons`;
  - tính lại khi có dữ liệu trễ hoặc kết luận mới trong 7 ngày.
- [ ] Chấm điểm (BR-31, chặn ở **API**, không chỉ ở màn hình): với Farm Owner/Domain Expert chưa chấm hoặc chưa bỏ qua ngày đó trong 7 ngày, mọi endpoint (ngày, báo cáo ngày/tuần/tháng, CSV) trả ngày **không có** status, reasons, rating của người khác; thông báo "ngày đã sẵn sàng" không kèm status; `POST …/rating` lưu rating + `evaluation_snapshot` trong một lần ghi atomic rồi mới trả status; `POST …/skip` mở status, không tính vào NFR-14; không cho đổi rating sau khi đã xem, chỉ thêm ghi chú; trạng thái chấm theo **từng người** (PENDING → RATED / SKIPPED / EXPIRED, Report 3 §6.18), quá 7 ngày người chưa chấm thành `EXPIRED`; ngày không có trạng thái chấm riêng. Test TC-F22-01..03 thử xem trước qua mọi endpoint.
- [ ] Báo cáo theo House ngày/tuần/tháng (`househealthreports`, unique `house_id + kind + period_start + period_end`), migrate báo cáo tuần theo Zone cũ; CSV chỉ số theo ngày; PDF bằng `jspdf` ở web.
- [ ] `ANALYTICS-FR-014`: đồng thuận + CI 95 %, kappa có trọng số tuyến tính, Gwet's AC1, ma trận nhầm lẫn, ngày `INSUFFICIENT_DATA` tách riêng.
- [ ] Web + mobile: trạng thái ngày, màn chấm điểm, báo cáo.
- [ ] Test TC-F20/21/22 và 5 dòng TC-ST 6.17.

### G-12 — Đếm chim (P1)

- [ ] Backend:
  - lịch đếm theo mùa và khung tạm (VISION-FR-019);
  - phiên tính từ bucket 5 phút theo khung của ngày (`window_start`, `window_end`);
  - phiên không đầy đủ khi `EDGE_AI_DEGRADED` mở trong khung (VISION-FR-020);
  - job tỷ lệ chạy 15 phút sau khung chiều của từng House;
  - heartbeat AI có `fps` < 10 thì `EDGE_AI_DEGRADED`.
- [ ] Web: trình vẽ vòng đếm trên khung hình live (VISION-FR-018).
- [ ] AI pipeline: tách phần vẽ khung + vòng thành hàm có test `tests/test_annotate.py` (TC-F11-01: mọi khung có vòng và hộp kèm track ID).
- [ ] Đánh giá NFR-09 (VISION-FR-016): P/R phát hiện trên ≥ 200 khung có nhãn hộp cho mỗi điều kiện sáng (IoU ≥ 0,5) và sai số đếm trên 20 clip, đều lấy từ ngày quay không dùng cho train, val, chọn model, ngưỡng confidence, vòng đếm hay tham số tracker; nếu đã chia ngẫu nhiên theo frame trên Roboflow thì chia lại theo ngày (`tools/split_by_day.py`).
- [ ] Model: xem mục 3.

### G-13 — Đo dòng tải (P1, It. 3)

- [ ] Firmware: ADS1115 (Adafruit ADS1X15), học dòng bình thường 30 giây đầu mỗi tải, so với trạng thái relay (BR-32), `ACTUATOR_FAULT`; telemetry `pump_current_a`, `fan_current_a`; test native TC-F06-01..03.
- [ ] Backend lưu dòng, nhận cảnh báo (HIGH).

### G-14 — Mô hình dữ liệu theo ERD (P1)

- [ ] `users.status` thay `is_active` (+ `locked_reason`, `locked_at`, `deletion_requested_at`, `deleted_at`).
- [ ] `auditlogs`: `actor_role`, `farm_id`, `before`, `after`, `source_ip`, `client`, `correlation_id`.
- [ ] `harvestbatches`: `nest_type`, `photo_object_key` (MinIO); `flock_snapshot` của House (HARVEST-FR-003).
- [ ] `notifications.ref.type` mở rộng (SDD 6.1).
- [ ] `telemetries`: `stale_fields`, `anomaly_fields`, `buffered`.
- [ ] Migration theo SDD 6.4; `npm run db:script`; test `dbScript`/`databaseScript` xanh.

### G-15 — Dọn web (P1)

- [ ] Bỏ dữ liệu giả của màn chuyên gia (`expertFallback.service.ts`, `data/mocks/`), nối API thật; chuyển thư mục theo FE_Design §12 (`domain-expert/`, `apis/`).
- [ ] Xoá stub `FarmOwnerLiveStreamPage` (ghi Raspberry Pi); đổi chữ "PLC" → "Bộ điều khiển"; `HARVEST_ROLES` bỏ Admin, chuyên gia chỉ xem.
- [ ] Đóng DF-5.

### G-16 — Mobile đủ phạm vi phiếu (P0-Demo cho luồng Farm Owner, P1 phần còn lại)

Thứ tự:

1. Đăng nhập (đổi mật khẩu lần đầu), lưu token an toàn.
2. FCM (G-10).
3. Dashboard số đo hiện tại + chế độ relay.
4. Cảnh báo: danh sách, chi tiết, xác nhận, `DISMISSED`.
5. Can thiệp tay có xác nhận (G-06).
6. Setup QR (G-09).
7. Trạng thái ngày + chấm điểm (G-11).
8. Phân tích số đếm + live stream HLS (`expo-video`, token 60 giây; đổi route `livestream/[zoneId]` → theo camera của House).
9. Báo cáo.
10. Thu hoạch.
11. Màn chuyên gia (kết luận cảnh báo, tham số).

Socket: gọi `off*` khi unmount.

### G-17 — Staging (P0-Demo)

- [ ] `deploy/docker-compose.staging.yml`, Dockerfile backend và web, Caddyfile, tls-proxy (8883 MQTT, 8322 RTSPS), file auth/authz EMQX, `.env.staging.example`.
- [ ] Seed demo đủ 22 kịch bản Phụ lục A2.
- [ ] `mongodump` hằng ngày, chép ra ngoài VPS.
- [ ] Theo `docs/deploy/staging.md`; hướng dẫn rollback theo tag.

### G-18 — Việc nhỏ (P2)

- [ ] ENV-FR-007: bắt buộc nguồn khi Admin đổi ngưỡng mặc định (422).
- [ ] HARVEST-FR-001: số tổ, khối lượng > 0, ngày không ở tương lai.
- [ ] (Tùy chọn) ENV-FR-026; device ID lấy từ MAC.

## 5. Thứ tự đề xuất

1. **Trước tag `review-2`:** G-01; bỏ đăng ký công khai (G-02); điền `[TEAM]`; sinh lại Word; merge → chạy CI đủ module bằng tay trên commit cuối → gắn tag đúng commit xanh → CI trên tag → sinh Report 5 từ artifact → BM02 → xuất PDF.
2. **Đầu Iteration 2, chạy song song:**
   - G-07 + G-08 (Bảo);
   - G-17 + G-10 + G-02 (Kiệt);
   - G-11 (Nhi);
   - G-03 + G-04 + G-15 (Tuấn);
   - G-06 + G-05 (Len).
3. **Giữa Iteration 2:**
   - G-09 và G-16 (mobile chia thêm người nếu chậm, RK-8);
   - G-12 khi đã có model;
   - G-14 làm dần theo từng gap chạm tới model.
4. **Iteration 3:** G-13, G-18; chạy thực địa ≥ 14 ngày; đo NFR; tổng duyệt demo trên staging.
