# Việc cần làm — Review 2 và Iteration 2

Cập nhật 27/10/2026 (phân công lại theo vai trò từng người), sau khi đồng bộ hồ sơ: phiếu v3 + BM03 1.1, SRS 3.1.0, SDD 1.1.0, Design Brief 1.1, Report 5 1.1.0 (136 test case).

**Cách dùng:**
- Trạng thái chỉ ghi ở `project-tracking.md`. File này chỉ liệt kê **các bước** làm từng gap (G-xx).
- Đóng một gap thì trong cùng PR: sửa **đúng dòng** gap của mình ở Project Tracking §6 và trạng thái tính năng ở §3, đổi nguồn test trong `report5/tc.py` từ `todo-auto` sang test thật. **Không** tự sinh lại `report5-test.md` trong PR (file sinh ra, sửa song song sẽ xung đột): Bảo sinh lại trước mỗi mốc.
- Không sửa SRS/SDD để "khớp code"; code theo SRS/SDD. Hằng số mới thì thêm vào Report 3 §4.5, vị trí trong code thì thêm vào Report 4 §5.5.
- Mức ưu tiên: **P0-Tag** phải xong trước khi gắn tag `review-2` · **P0-Nộp** làm sau khi gắn tag, xong trước hạn nộp và buổi Review 2 · **P0-Demo** phải xong trước khi demo Defense 1.1 trên staging · **P1** yêu cầu M của Report 3, chưa chặn tag hay demo · **P2** dọn dẹp, tùy chọn.

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

## 0. Phân công và cách làm song song

### 0.1 Ai làm gì

| Người | Vai trò | Phần sở hữu (Ownership Map, Design Brief §8) | Workflow sở hữu | Tính năng sở hữu |
|---|---|---|---|---|
| **Bảo** (leader) | Backend, firmware, AI, ít web/mobile, tài liệu | Firmware + MQTT; AI pipeline; backend MQTT, đếm chim, push FCM, đo dòng; staging; tài liệu, tag | WF-01, 03, 06 | F-01, 02, 03, 04, 09, 10, 11, 12 |
| **Kiệt** | Backend, firmware | Backend thiết bị, tài khoản, cảnh báo, chuyên gia, sức khỏe ngày; firmware tự chẩn đoán | WF-04, 10 | F-05, 06, 08, 18, 19 |
| **Len** | Web + mobile — Farm Owner | Màn Farm Owner (web, mobile, cả live stream HLS); E2E các DS của mình; gán nhãn; NFR-01 | WF-02, 05, 09 | F-07, 17 |
| **Tuấn** | Web + mobile — Domain Expert, một phần Technician | Màn chuyên gia (web `/expert/*`, mobile); màn Technician; E2E các DS của mình; gán nhãn; NFR-08, 13 | WF-07, 08 | F-13, 14, 15, 16 |
| **Nhi** | Web + mobile — Admin, sức khỏe theo ngày | Màn Admin; màn trạng thái ngày, chấm điểm, báo cáo (web, mobile); nền mobile (đăng nhập, push, setup QR); E2E các DS của mình; gán nhãn; NFR-02, 03, 14 | WF-11 | F-20, 21, 22 |

**Staging và tài liệu: cả team cùng làm, Bảo chịu trách nhiệm chính** (Report 2 RACI: Bảo A, mọi người R cho phần của mình). Phần của từng người ở staging ghi tại G-17; tài liệu: mỗi người viết phần workflow của mình trong Report 3 và Report 4 (AD, SM, mô tả luồng), hướng dẫn sử dụng màn của mình, kết quả test của mình trong Report 5 (qua `tc.py`) và khối cam kết cá nhân trong BM04; Bảo biên tập, giữ nhất quán, sinh Word/PDF, làm BM02 và gắn tag.

**Code backend chỉ do Bảo và Kiệt viết.** Len, Tuấn, Nhi không sửa `backend/`; công của họ ghi đúng phần họ làm: màn hình, test E2E, số đo NFR, dữ liệu gán nhãn, đề xuất API.

**Chủ tính năng** (Report 2 RACI: A cho tính năng, R cho phần giao diện) chịu trách nhiệm tính năng chạy đủ đầu cuối: đề xuất endpoint màn mình cần, kiểm tra API trả đúng, **chạy 3 test case cam kết và ghi kết quả** (Report 5 §5). Test tự động phía backend do người viết backend viết (Bảo hoặc Kiệt); Project Tracking §3 ghi PR của mọi người góp vào tính năng.

**Chủ workflow** viết điều kiện đầu và dữ liệu cần cho các kịch bản DS của mình (Phụ lục A2), viết **test E2E Playwright** cho các DS đó (`frontend/e2e/ds-xx.spec.ts`, FE_Design §13.17) và trình bày workflow ở Defense 1.1. Kiệt và Bảo viết seed theo điều kiện đó (G-17).

Việc không cần backend mà Len, Tuấn, Nhi nhận thêm (mục 3, mục 5):

- gán nhãn hộp `swiftlet` trên Roboflow và đếm tay clip cho NFR-09 (Bảo chia ngày quay, duyệt 20 khung đầu của mỗi người);
- đo NFR phía client trên staging: Len NFR-01; Nhi NFR-02, 03 (k6); Tuấn NFR-13;
- ảnh màn hình cho Report 4 §5 và hướng dẫn sử dụng phần màn của mình.

### 0.2 Quy tắc để không giẫm chân nhau

1. **Một gap một nhánh** (`feat/g05-breach-dwell`, `refactor/g01-enum-cleanup`…). Gap nhiều người làm (G-01, G-02) thì dùng **chung một nhánh**, mỗi người chỉ sửa file trong phần của mình, commit theo thứ tự ghi ở mục 0.3, một PR duy nhất do người đầu tiên mở.
2. **Hợp đồng API trước:** người làm giao diện ghi endpoint màn mình cần (đường dẫn, dữ liệu vào, ra) vào mô tả PR spec; người làm backend viết vào `docs/api/api-spec.yaml`, người làm giao diện duyệt, merge xong mới code hai phía theo spec. Trong lúc chờ backend, giao diện dùng dữ liệu giả đúng theo spec (FE_Design §7). Không tự đặt tên endpoint ở phía client.
3. **File dùng chung có một chủ:**

   | File | Chủ | Người khác |
   |---|---|---|
   | `backend/` | Kiệt, Bảo | Len, Tuấn, Nhi không sửa |
   | `docs/api/api-spec.yaml` | Kiệt (Bảo cho phần MQTT/stream) | Đề xuất trong PR spec |
   | `frontend/playwright.config.ts`, `frontend/e2e/` | Len lập cấu hình (PR E2E đầu tiên) | Mỗi người file DS của mình |
   | `backend/src/types/domain.types.ts`, `frontend/src/types/`, `mobile/types/` | Chỉ sửa trong PR G-01 | Sau G-01 thêm kiểu mới trong PR của gap đó |
   | `frontend/src/constants/roles.ts`, dòng `RequireRole` trong `routes/*.tsx`, sidebar các layout | Nhi (PR ma trận quyền G-15) | Không sửa nhóm quyền trong PR khác |
   | `frontend/src/routes/farm-owner.routes.tsx`, `pages/farm-owner/`, `components/features/farm-owner/` | Len | — |
   | `routes/expert.routes.tsx`, `pages/expert/` (sau đổi `domain-expert/`), `routes/technician.routes.tsx`, `pages/technician/` | Tuấn | — |
   | `routes/admin.routes.tsx`, `pages/admin/`, `pages/auth/` | Nhi | — |
   | `mobile/app/_layout.tsx`, `(auth)/`, `store/`, `services/api/client`, `constants/api.ts` | Nhi | Len, Tuấn thêm màn trong thư mục route của mình |
   | `docs/reports/*` | Bảo duyệt mọi PR tài liệu | Mỗi người sửa phần workflow của mình (Report 3, 4), dòng gap của mình ở Tracking §6 và `report5/tc.py` |
   | File sinh ra: Word trong `docs/reports/`, `report5-test.md` | Chỉ Bảo sinh lại | Không sửa tay |
4. **Thứ tự phụ thuộc** (gap sau chỉ bắt đầu khi gap trước đã merge): G-01 → mọi gap; G-02 P0 → G-16 bước 1; spec G-03/G-04 → web G-03/G-04; G-07 → G-06 phần lệnh, G-08 → G-09 tiến trình setup; G-03 (`DISMISSED`) → G-11 tính tiếng ồn; G-15 ma trận quyền → các màn mới của web; G-10 backend → push trên mobile. Gán nhãn và đếm clip không phụ thuộc gì: làm trong những ngày chờ API.
5. Rebase lên `develop` mỗi sáng; PR nhỏ, merge sớm; ai sửa file của người khác thì nhờ chủ file duyệt.

### 0.3 Trước tag `review-2` — từng người làm gì, theo thứ tự

Chỉ có 2 PR code và phần hồ sơ. Mỗi bước xong mới sang bước sau của cùng PR.

**PR A — G-01, nhánh `refactor/g01-enum-cleanup` (Kiệt mở PR, Bảo duyệt và merge):**

1. **Kiệt:** backend `domain.types.ts`, model, service, `ALERT_TYPE_ALIAS`, nhánh `DEGRADED` ở `device.service.ts`, migration `migrate:alert-types` + test, `api-spec.yaml` (enum), `npm run db:script`; firmware gửi tên mới, `reset_reason`, bump `FIRMWARE_VERSION`, `pio test -e native`. — **Xong 28/10** (backend `31e85d2`, firmware 1.5.0 `70e5ff3`; `pio test -e native` chạy ở CI vì máy Kiệt chưa có g++)
2. **[x] Len:** `frontend/src/types/` (alert, device, auth), nhãn i18n, gỡ `heating` ở `ControlSubsystemPanel`, `dashboardMetrics`, `deviceInventory` (+ test), gỡ Zalo/SMS ở `SettingsPage.tsx`, `auth.types.ts`, `en.ts`. — **Xong 29/10** (28/10 Tuấn làm phần chính theo uỷ quyền, `c54f050`; 29/10 Len làm lại phần Farm Owner, `2839abc`, `dff99d3`: `zoneComponents` đổi `PUMP_DRY` → `MISTING_INEFFECTIVE` và bỏ qua cảnh báo `DISMISSED`, `HarvestStatus` bỏ `ARCHIVED`, bỏ `heating` khỏi test và comment, bỏ nhãn mất điện/thiên địch và dòng Zalo/SMS thừa ở `en.ts`, sửa nhãn "Phun sương"; lint+tsc+vitest: 0 error, 108 pass, build xanh)
3. **[x] Tuấn:** gỡ `heating` ở `ExpertControlPanel`, nhãn predator và nhãn tên cảnh báo cũ trong màn chuyên gia và Technician. — **Xong 28/10** (ESLint 0 w, tsc exit 0, vitest 106/106)
4. **[x] Nhi:** `mobile/src/types/` (enum, bỏ `zalo`/`sms`, `heating`, `ERROR`/`DEGRADED`) và `src/utils/label.utils.ts`. — **Xong 28/10**, chuyển sang `mobile/src/` ngày 29/10 khi gỡ xung đột với PR #114
5. Kiệt chạy lint/typecheck/test cả 4 module rồi mở PR. — *Kiểm tra xong 29/10: backend lint + tsc + 524/524 test; web lint + tsc + vitest 108/108 + build; mobile lint + typecheck + jest 18/18 (chạy lại sau khi gộp PR #114, cấu trúc `mobile/src`); firmware `pio test -e native` để CI chạy (máy Kiệt chưa có g++). Kèm sửa chữ "phún sương" → "phun sương" ở 6 file màn chuyên gia (Tuấn duyệt). Còn mở PR.*

**PR B — phần P0 của G-02, nhánh `refactor/g02-invitation-accounts` (Kiệt mở PR, Bảo duyệt):**

1. **[x] Kiệt — spec trước** (commit đầu, Nhi duyệt): bỏ `/auth/register`, `/auth/otp/send`, `/auth/otp/verify`; thêm `POST /invitations/{token}/create-account` (công khai, body `full_name`, `password`; e-mail và role lấy từ lời mời; 201; lời mời hết hạn hoặc đã dùng → 409, token sai → 404). — **Xong 29/10** (`59b39d2`, bổ sung schema `GET /invitations/{token}` theo góp ý của Nhi)
2. **[x] Kiệt — backend:** bỏ `registerUser`, `sendOtp`, `verifyOtp`, controller, `otp_code`/`otp_expires` (migration `$unset`); thêm endpoint mới, đánh dấu lời mời `ACCEPTED`; đổi tên `otpSendLimiter`; test 404 cho 3 route cũ và test endpoint mới. — **Xong 29/10** (đổi tên `otpSendLimiter` → `passwordResetLimiter`; migration `migrate:remove-otp-login`; lint + tsc + 531/531 test)
3. **[x] Nhi — web:** xoá `RegisterPage`, route `/register`, link "Đăng ký" ở `LoginPage`, `authApi.register`, mutation `register`, `RegisterRequest`; `InvitationPage` có form tên + mật khẩu gọi endpoint mới; bỏ kiểu `salesAssignment` còn sót trong `invitations.api.ts`. — **Xong 30/10** (`13073b5`; tạo xong chuyển `/login?email=…`, `LoginPage` điền sẵn email; lint + tsc + vitest 108/108 + build)
4. **[x] Nhi — mobile:** xoá `(auth)/register.tsx`, `AUTH_REGISTER`, `AUTH_OTP_SEND`, `AUTH_OTP_VERIFY`, `register`, `sendOtp`, `verifyOtp`. — **Xong 30/10** (`5402753`; màn đăng ký, `AUTH_REGISTER`, `register` đã bỏ ở PR #114; lint + typecheck + jest 18/18)

**Hồ sơ (song song với 2 PR):**

| Người | Việc |
|---|---|
| Mỗi người | Điền PR tiêu biểu của mình vào Design Brief §8 và Project Tracking §3 (gửi Bảo); đọc lại code của phần mình sở hữu, sơ đồ AD/SM của workflow mình, chuẩn bị trả lời "nếu… thì sao" (Review 2, mục 5 hướng dẫn). Chủ tính năng và chủ quyết định (BM01 §3) không viết backend vẫn phải mở được và giải thích luồng route → service → model của tính năng, quyết định đó: Len F-07, 17; Tuấn F-13–16, D3; Nhi F-20–22, D5 |
| Kiệt | Ô `[TEAM]` Report 4 về phiên bản mạch; ghi phần firmware đã thử trên board vào `firmware/README.md` nếu có |
| Bảo | Mọi ô `[TEAM]` còn lại (mục 2); sinh lại Word; chạy CI tay → gắn tag → sinh Report 5 từ artifact → BM02 → PDF (mục 1) |

---

## 1. Hồ sơ Review 2

| | Việc | Ưu tiên | Ghi chú |
|---|---|:---:|---|
| [x] | Đồng bộ **cấu trúc** phiếu v3, BM03, SRS, SDD, BM01, Tracking, Report 5 theo các quyết định trên (chưa phải baseline cuối: còn G-01, G-02, `[TEAM]`, CI trên tag, BM02) | P0-Tag | 26/10/2026 |
| [x] | Sinh lại Word: `tools/make_registration_v3.py`, `make_bm03.py`, `make_bm01.py`; BM01 mục 0–8 = 4 trang (đo bằng Word 26/10) | P0-Tag | Sinh lại và đo lại sau khi điền `[TEAM]` |
| [ ] | Điền các ô `[TEAM]` (mục 2) | P0-Tag | |
| [ ] | PR code nhỏ **G-01** (enum + dọn phạm vi) và phần P0 của **G-02** (bỏ đăng ký công khai, bỏ đăng nhập OTP, thay luồng tạo tài khoản từ lời mời) merge trước khi gắn tag | P0-Tag | Mục 4 |
| [x] | Mở PR nhánh tài liệu vào `develop` | P0-Tag | PR #108, #109, #111 đã merge |
| [ ] | Chạy CI đủ mọi module trên commit cuối của `develop` (Actions → CI → *Run workflow*); xanh thì gắn tag `review-2` **đúng commit đó** (push tag chạy CI lần nữa, không phải dời tag). Tải 3 artifact của lần chạy trên tag (`backend-jest-results`, `firmware-pio-junit`, `ai-pipeline-pytest-junit`), rồi `python docs/reports/report5/gen_report5.py docs/reports/report5/template.md docs/reports/report5-test.md --jest jest-results.json --pio pio-junit.xml --pytest pytest-junit.xml`; ghi link lần chạy CI vào Report 5 §6 | P0-Tag | CI đã có trigger tag `review-*`, chạy tay và artifact (26/10) |
| [ ] | **BM02**: chạy prompt chuẩn trên tag, không sửa prompt, giữ nguyên kết quả; trả lời Fixed/Kept/Planned, mỗi điểm Planned ghi **một** người chịu trách nhiệm và hạn (gap nhiều người thì tách theo phần, như Tracking §6); điểm High Kept/Planned thêm vào BM01 §5 | P0-Nộp | Tắt Memory trước khi chạy |
| [ ] | Xuất PDF, đặt tên `SWP490_<Mã đề tài>_R2_<Tên hồ sơ>.pdf` (hướng dẫn mục 01, 03): `Registration` (phiếu v3 + BM03 trong một file), `Report1`…`Report5`, Project Tracking, `SelfReview` (BM02), `DesignBrief` (BM01, có link repo tag `review-2`) | P0-Nộp | Mermaid render sẵn; Bảo |
| [ ] | **Máy demo cho buổi review** (mục 07): một máy chạy được Iteration 1 từ tag (`docker compose up -d mongodb emqx`, backend, web), chạy được bộ test (`npm test`, `vitest run`, `pio test -e native`, `pytest`), mở sẵn repo, Design Brief và các sơ đồ Report 4 | P0-Nộp | Bảo chuẩn bị, Kiệt chạy thử trước 1 ngày |
| [ ] | **Diễn tập phần 2 và 3** (mục 07): trình bày 5 quyết định (mỗi chủ quyết định tự nói), 3 rủi ro, các điểm Kept/Planned của BM02; tập phân tích tác động của tình huống thay đổi trên sơ đồ và code — thêm một role, thêm một trạng thái cho Alert hoặc Device, Telegram/FCM/Open-Meteo ngừng hoạt động, tải tăng 10 lần — chỉ ra thực thể, trạng thái, luồng, API, test nào đổi | P0-Nộp | Cả team, ít nhất 1 buổi |
| [ ] | **Diễn tập phần 5** (xác minh sở hữu): từng người mở code phần mình trong BM01 §8, giải thích, chạy test của mình, trả lời 2–3 câu "nếu… thì sao" do người khác hỏi | P0-Nộp | Cả team; tất cả phải có mặt ở buổi review |
| [ ] | (Tùy chọn) Chuyển `SwiftletCare_SRS.md` sang `docs/archive/` | P2 | |

**Ngưỡng Defense 1.1** (không phải điều kiện nộp Review 2): 100 % workflow chạy end-to-end trên staging · ≥ 90 % test đạt · ≥ 50 % test tự động trong CI · không còn defect Critical/High.

**BM04 (sau buổi review, hướng dẫn mục 08):** mỗi tính năng một chủ, mỗi workflow một chủ (đúng như BM01 §8, A1); mỗi test case tính cho **một** người — chủ tính năng/workflow theo Report 5 §5, không tính cho người viết test; mỗi việc phải sửa gắn một workflow, **một** người, một hạn. Tổng theo workflow và tổng theo thành viên phải ra cùng con số.

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
| [ ] | **Len, Tuấn, Nhi:** gán nhãn hộp ≥ 200 khung mỗi điều kiện sáng cho tập test và phần train được giao, theo ngày quay Bảo chia (không trộn ngày train với ngày test) | P0-Demo |
| [ ] | **Len, Tuấn, Nhi:** đếm tay 20 clip 5 phút (10 ban ngày, 10 hồng ngoại), mỗi clip 2 người đếm, đối chiếu từng khung chỗ lệch | P0-Demo |
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

### G-01 — Enum và dọn phạm vi (P0-Tag) — Kiệt, Len, Tuấn, Nhi (mục 0.3, PR A)

Một PR cho backend, web, mobile, firmware:

- [x] `AlertType`:
  - đổi `PUMP_DRY` → `MISTING_INEFFECTIVE`, `POWER_OUTAGE` → `UNEXPECTED_RESTART`;
  - thêm `CONFIG_MISMATCH`, `ACTUATOR_FAULT`;
  - bỏ `PREDATOR_DETECTED`.
  - *Backend `31e85d2`, web `c54f050`, mobile `9d17fbc`.*
- [x] `AlertStatus`: thêm `DISMISSED`. *Cả 3 phía (chỉ thêm giá trị; luồng bác bỏ ở G-03).*
- [x] Ở 3 phía `backend/src/types/domain.types.ts`, `frontend/src/types/`, `mobile/types/`: bỏ `DeviceStatus` `ERROR`/`DEGRADED`, `HarvestStatus` `ARCHIVED`, trường `heating` trong `RelayStates`, Zalo/SMS trong tùy chọn thông báo (backend `user.model.ts`, `auth.service.ts`, `notification.service.ts`; web `SettingsPage.tsx`, `auth.types.ts`, `en.ts`). *Cả 3 phía: backend `31e85d2`, web `c54f050` + `dff99d3`, mobile `9d17fbc`.*
- [x] Backend (`31e85d2`):
  - `ALERT_TYPE_ALIAS` nhận tên cũ từ firmware cũ (`PUMP_DRY`, `POWER_OUTAGE`, `BIRD_PANIC`);
  - `UNEXPECTED_RESTART` mang `details.reset_reason` lấy từ heartbeat; *code lưu ở `metadata.reset_reason` (lấy từ cảnh báo, thiếu thì từ heartbeat) — đổi `metadata` → `details` theo ERD làm ở G-05/G-14;*
  - bỏ các nhánh `DEGRADED` ở `device.service.ts` (lệnh từ xa và dời thiết bị chỉ khi `ONLINE`), sửa test `deviceOnboarding.test.ts` theo.
- [x] Firmware 1.5.0 (`70e5ff3`):
  - gửi tên mới;
  - `UNEXPECTED_RESTART` kèm `reset_reason` (`POWER_ON` | `WATCHDOG` | `BROWNOUT` | `CRASH`); *thêm: mất điện (`POWER_ON`) giờ được báo, trừ lần cấp điện đầu khi thiết bị chưa từng kết nối;*
  - không gửi sau RESTART/OTA chủ động;
  - bump `FIRMWARE_VERSION`.
- [x] Web/mobile (`c54f050`, `2839abc`, `dff99d3`, `9d17fbc`):
  - nhãn i18n mới;
  - gỡ `heating` khỏi `ExpertControlPanel`, `ControlSubsystemPanel`, `dashboardMetrics`, `deviceInventory` và test;
  - gỡ nhãn predator.
- [x] `migrate:alert-types` (đổi tên trong `alerts`, xoá cảnh báo predator, bỏ `heating`, map `ERROR`/`DEGRADED` → `ONLINE`, bỏ `ARCHIVED`, bỏ Zalo/SMS, bỏ `sla_hours` trong `systemsettings`) kèm test migration. (`31e85d2`)
- [x] Sau khi sửa: `api-spec.yaml`, `npm run db:script`. (`31e85d2`)

### G-02 — Tài khoản theo lời mời, không đăng ký công khai, không đăng nhập OTP — Kiệt (backend), Nhi (web, mobile)

**P0-Tag:** bỏ các endpoint công khai và thay luồng tạo tài khoản từ lời mời. **P1:** Admin tạo Farm Owner, gửi e-mail thật.

- [x] **P0-Tag — backend:** *(29/10, nhánh `refactor/g02-invitation-accounts`)*
  - bỏ `POST /auth/register` và `registerUser`;
  - bỏ luồng **đăng nhập không mật khẩu bằng OTP** (ngoài SRS: chỉ có AUTH-FR-002 đăng nhập bằng mật khẩu và AUTH-FR-009 đặt lại mật khẩu): `POST /auth/otp/send`, `POST /auth/otp/verify`, `sendOtp`/`verifyOtp` trong `auth.service.ts` và controller, các trường `otp_code`/`otp_expires` của `users` (migration `$unset`, `npm run db:script`);
  - thêm luồng tạo tài khoản từ link lời mời (e-mail và role lấy từ lời mời, người nhận chỉ đặt tên và mật khẩu) — hiện người được mời chưa có tài khoản đi qua `/auth/register` (`registerUser` tự nhận lời mời theo e-mail), bỏ route mà thiếu luồng này thì chuyên gia mới không vào được;
  - bỏ các endpoint cũ khỏi `api-spec.yaml` (kể cả dòng giới hạn tốc độ nhắc `/auth/register`, `/auth/otp/send`), thêm endpoint mới; `otpSendLimiter` chỉ còn cho `/auth/forgot-password`, đổi tên cho đúng;
  - test: `/auth/register`, `/auth/otp/send`, `/auth/otp/verify` trả 404; người được mời tạo tài khoản từ link có đúng e-mail và role; link hết hạn hoặc đã dùng bị từ chối.
- [x] **P0-Tag — web:**
  - xoá `pages/auth/RegisterPage.tsx`, route và import `/register` ở `routes/public.routes.tsx`, link "Đăng ký" trên `LoginPage.tsx`;
  - xoá `authApi.register` (`apis/auth/auth.api.ts`), mutation `register` trong `hooks/auth/useAuth.ts`, `RegisterRequest` (`types/auth.types.ts`) và các comment AUTH-FR-001;
  - `InvitationPage.tsx`: người chưa có tài khoản đặt tên và mật khẩu ngay trên trang lời mời, gọi endpoint mới, không điều hướng sang `/register`.
- [x] **P0-Tag — mobile:** xoá `app/(auth)/register.tsx`; xoá `AUTH_REGISTER`, `AUTH_OTP_SEND`, `AUTH_OTP_VERIFY` (`constants/api.ts`) và `register`, `sendOtp`, `verifyOtp` (`services/api/auth.ts`).
- [ ] **P1 — Admin tạo Farm Owner:** `POST /admin/farm-owners` (mật khẩu tạm, đổi ở lần đăng nhập đầu, như Technician); màn Admin "Tạo Farm Owner"; test quyền và đổi mật khẩu lần đầu; sửa `api-spec.yaml`, `docs/database/` nếu đổi model.
- [ ] **P1 — e-mail thật** cho lời mời, mã đặt lại mật khẩu và mật khẩu tạm (SF-03 chạy end-to-end; hiện `auth.service.ts` chỉ `console.log` mã reset, `notification.service.ts#sendEmail` chỉ ghi log):
  - SMTP qua `nodemailer` (đã có trong dependencies), thông tin đăng nhập SMTP bằng biến môi trường, thêm vào `.env.example`;
  - không ghi log mật khẩu tạm, mã reset hay token lời mời;
  - không gửi OTP đăng nhập: luồng này bị bỏ ở trên vì không thuộc SRS;
  - link và mã hết hạn đúng Report 3 (lời mời 7 ngày, mã reset 15 phút);
  - test bằng adapter mail giả; trên staging gửi thử một lời mời, một mã reset và một mật khẩu tạm của tài khoản do Admin tạo tới hộp thư thật.

### G-03 — Vòng chuyên gia (P1) — Kiệt (backend), Tuấn (web)

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

### G-04 — Mục duyệt và đề xuất hệ số (P1) — Kiệt (backend), Tuấn (màn chuyên gia), Len (nút "gửi chuyên gia" của Farm Owner)

- [ ] Collection `parameterreviews`, `coefficientproposals` theo SDD 6.1; route accept/revert/adjust, submit/approve/reject; thông báo hai chiều; Farm Owner áp gợi ý trực tiếp khi farm có chuyên gia → 403.
- [ ] Web: màn duyệt cho chuyên gia, nút "gửi chuyên gia" cho Farm Owner.

### G-05 — Vượt ngưỡng có thời gian chờ (P1) — Kiệt; Len hiện chi tiết cảnh báo ở màn Farm Owner

- [ ] `telemetry.service.ts`:
  - giữ thời điểm bắt đầu vượt ngưỡng theo `(node, metric, direction)`;
  - chỉ tạo `THRESHOLD_BREACH` khi vượt liên tục `BREACH_DWELL_MS`: 10 phút cho nhiệt độ/độ ẩm, 5 phút cho ánh sáng/NH3/CO2;
  - mẫu stale không tính;
  - `details = {metric, observed, threshold, direction, started_at}`.
- [ ] Test `thresholdBreach.test.ts` (TC-F07-02): 9 phút không có cảnh báo, 10 phút có 1 cảnh báo.
- [ ] Đóng defect DF-6.

### G-06 — Can thiệp tay (P1) — Kiệt (backend), Bảo (firmware, trong G-07), Len (web, mobile)

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

### G-07 — MQTT theo thiết bị (P1, PR lớn nhất) — Bảo

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

### G-08 — Phiên bản cấu hình (P1) — Bảo

- [ ] `zones.config_version` tăng mỗi lần đổi ngưỡng, hệ số hoặc tham số phát hiện; `config` retained mang version; heartbeat báo `applied_config_version`; job `configSync` publish lại khi còn version cũ, quá 3 heartbeat lúc online thì `CONFIG_MISMATCH`; firmware cũ không báo version thì `UNKNOWN`.
- [ ] API trả trạng thái đồng bộ theo controller (PENDING/APPLIED/MISMATCH/UNKNOWN).
- [ ] Test TC-ST config sync 4 dòng.

### G-09 — Màn MF-10 (P1) — Kiệt (backend), Nhi (in nhãn ở Admin, setup QR trên mobile), Len (in mã tầng), Tuấn (`/onboarding` web)

- [ ] Web Admin: in nhãn ngay sau khi thêm thiết bị (`qrcode`), hiện broker secret một lần để flash.
- [ ] Màn Zone: in mã QR tầng.
- [ ] Cấp lại key cho thiết bị đã gỡ (BR-26), sửa `rotateProvisionedKey` và comment cũ "secretKey trong NVS".
- [ ] Mobile: quét nhãn + mã tầng (`expo-camera`), hướng dẫn Wi-Fi AP-mode, màn tiến trình (PENDING → ONLINE → APPLIED).
- [ ] Web: `/onboarding` cho Farm Owner + Technician.

### G-10 — FCM (P0-Demo, cần cho NFR-02) — Bảo (backend), Nhi (mobile, đo NFR-02)

- [ ] Backend:
  - collection `pushtokens`;
  - `POST`/`DELETE /notifications/push-tokens`;
  - adapter `push` dùng `firebase-admin` (credential qua biến môi trường, không commit);
  - xoá token FCM báo invalid;
  - không log token.
- [ ] Mobile: `expo-notifications` lấy FCM token sau đăng nhập, huỷ khi đăng xuất; mở thông báo thì vào chi tiết cảnh báo.
- [ ] Test TC-F08-03 (mock Firebase Admin).

### G-11 — MF-11 (P0-Demo) — Kiệt (backend), Nhi (web, mobile)

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

### G-12 — Đếm chim (P1) — Bảo (AI, backend), Tuấn (trình vẽ vòng đếm), Len, Tuấn, Nhi (gán nhãn, đếm clip)

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

### G-13 — Đo dòng tải (P1, It. 3) — Bảo

- [ ] Firmware: ADS1115 (Adafruit ADS1X15), học dòng bình thường 30 giây đầu mỗi tải, so với trạng thái relay (BR-32), `ACTUATOR_FAULT`; telemetry `pump_current_a`, `fan_current_a`; test native TC-F06-01..03.
- [ ] Backend lưu dòng, nhận cảnh báo (HIGH).

### G-14 — Mô hình dữ liệu theo ERD (P1) — Kiệt; trường của gap nào thì làm trong PR gap đó; Len làm form thu hoạch (web, mobile)

- [ ] `users.status` thay `is_active` (+ `locked_reason`, `locked_at`, `deletion_requested_at`, `deleted_at`).
- [ ] `auditlogs`: `actor_role`, `farm_id`, `before`, `after`, `source_ip`, `client`, `correlation_id`.
- [ ] `harvestbatches`: `nest_type`, `photo_object_key` (MinIO); `flock_snapshot` của House (HARVEST-FR-003).
- [ ] `notifications.ref.type` mở rộng (SDD 6.1).
- [ ] `telemetries`: `stale_fields`, `anomaly_fields`, `buffered`.
- [ ] Migration theo SDD 6.4; `npm run db:script`; test `dbScript`/`databaseScript` xanh.

### G-15 — Dọn web (P1) — Tuấn (chuyên gia, Technician), Nhi (ma trận quyền), Bảo (`/stream/:id`)

- [ ] **Tuấn:** bỏ dữ liệu giả của màn chuyên gia (`expertFallback.service.ts`, `data/mocks/`), nối API thật; chuyển thư mục theo FE_Design §12 (`domain-expert/`, `apis/`).
- [ ] **Bảo:** xoá route `/stream/:id` và trang stub `FarmOwnerLiveStreamPage` (ghi Raspberry Pi); live xem ở `/vision` (`LiveCameraCard`/`useWhepStream`, token 60 giây, chỉ Farm Owner và Domain Expert); bỏ mọi chữ Raspberry Pi/RPi (FE_Design §12.0 c dòng 3).
- [ ] **Tuấn — màn chuyên gia (đã chốt, FE_Design §12.0 c dòng 1–2):** chuyên gia đọc màn vận hành của Farm Owner ở chế độ chỉ đọc, không làm bản sao; khu `/expert/*` chỉ còn việc quyết định: trang chủ là hàng đợi việc (cảnh báo chờ kết luận, mục duyệt, đề xuất, báo cáo chờ kết luận), kết luận cảnh báo, tham số phát hiện + vòng đếm + lịch đếm, ngưỡng/hệ số, báo cáo + kết luận, lịch sử hoạt động; bỏ `/expert/analytics`; các màn quyết định mở cho Farm Owner khi farm chưa có chuyên gia (BR-22).
- [ ] **Len:** đổi chữ "PLC" → "Bộ điều khiển" (`farmStructure.i18n.ts`, `ScadaModeBanner`).
- [ ] **Nhi — ma trận quyền (PR đầu tiên của Iteration 2, trước các màn mới):** đồng bộ route, menu và nút theo Report 3 §2.4 (hiện `OPS_ROLES = FARM_OWNER, TECHNICIAN, ADMIN` dùng cho `/devices`, `/alerts`, `/farms`, `/onboarding`, `/ota`, `/stream/:id`; `HARVEST_ROLES` còn Admin):
  - `/dashboard`, `/analytics`, `/vision`: Farm Owner; Domain Expert chỉ đọc qua chính các trang đó (`FARM_SIDE_ROLES`);
  - `/harvests`: Farm Owner ghi, Domain Expert chỉ đọc, bỏ Admin;
  - `/farms`: Farm Owner quản lý, Domain Expert chỉ đọc, Technician chỉ xem cấu trúc mọi farm, bỏ Admin;
  - `/devices`: Farm Owner, Technician; Domain Expert chỉ đọc; bỏ Admin;
  - `/onboarding`: Farm Owner và Technician; `/ota`: chỉ Technician;
  - `/alerts`: Farm Owner xem và xác nhận; Technician chỉ cảnh báo thiết bị; Domain Expert dùng hàng đợi kiểm chứng; bỏ Admin;
  - Admin chỉ dùng `/system/devices`, `/system/health`, `/system/settings`, `/system/audit-log`, `/users`, `/account-requests`;
  - sửa `constants/roles.ts` (`OPS_ROLES`, `HARVEST_ROLES`, `MENU_ACCESS`), sidebar, `RequireRole` ở `routes/*.tsx`; test Vitest cho bảng role → route.
- [ ] Đóng DF-5.

### G-16 — Mobile đủ phạm vi phiếu (P0-Demo cho luồng Farm Owner, P1 phần còn lại) — Nhi (nền, setup QR, trạng thái ngày), Len (màn Farm Owner), Tuấn (màn chuyên gia), Len (live stream)

Thứ tự:

1. **Nhi:** đăng nhập (đổi mật khẩu lần đầu), lưu token an toàn, điều hướng theo role, `off*` socket khi unmount — làm trước, các bước sau dựa vào.
2. **Nhi:** FCM (G-10).
3. **Len:** dashboard số đo hiện tại + chế độ relay.
4. **Len:** cảnh báo: danh sách, chi tiết, xác nhận, `DISMISSED`.
5. **Len:** can thiệp tay có xác nhận (G-06).
6. **Nhi:** setup QR (G-09).
7. **Nhi:** trạng thái ngày + chấm điểm (G-11).
8. **Len:** phân tích số đếm, live stream HLS (`expo-video`, token 60 giây; đổi route `livestream/[zoneId]` → theo camera của House).
9. **Nhi:** báo cáo.
10. **Len:** thu hoạch.
11. **Tuấn:** màn chuyên gia (hàng đợi việc, kết luận cảnh báo, tham số).

Phân quyền trên mobile (backend vẫn là lớp chặn chính, nhưng app không hiện màn hay nút không được phép):
- chỉ Farm Owner xác nhận cảnh báo và bật/tắt relay;
- Domain Expert chỉ đọc vận hành, được kết luận cảnh báo, chỉnh tham số, viết kết luận;
- Farm Owner chỉ làm thay quyết định của chuyên gia khi farm chưa có Domain Expert (BR-22);
- Technician và Admin không dùng mobile (đăng nhập bằng hai role này thì báo dùng web).

### G-17 — Staging (P0-Demo) — cả team, Bảo chịu trách nhiệm chính; điều kiện DS và test E2E: chủ từng workflow

- [ ] **Bảo:** VPS, `deploy/docker-compose.staging.yml`, Caddyfile, tls-proxy (8883 MQTT, 8322 RTSPS), file auth/authz EMQX, AI node nối vào staging, rollback theo tag.
- [ ] **Kiệt:** Dockerfile backend, `.env.staging.example`, chạy migration và seed trên staging, `mongodump` hằng ngày chép ra ngoài VPS.
- [ ] **Len:** Dockerfile và bản build web; kiểm tra nhanh các màn Farm Owner trên staging sau mỗi lần triển khai.
- [ ] **Nhi:** bản build mobile (EAS profile `preview`) trỏ tới staging; kiểm tra nhanh màn Admin, đăng nhập và push.
- [ ] **Tuấn:** kiểm tra nhanh màn chuyên gia và Technician; chạy bộ E2E trên staging trước mỗi buổi tổng duyệt.
- [ ] Seed demo đủ 22 kịch bản Phụ lục A2 (Kiệt, Bảo), theo điều kiện chủ workflow ghi.
- [ ] Test E2E Playwright cho từng DS (chủ workflow; FE_Design §13.17); Bảo thêm job E2E vào CI (test chỉ được tính là tự động khi chạy trong CI, hướng dẫn mục 9.4) và đọc kết quả JUnit vào Report 5 (`gen_report5.py --playwright`); PR cài Playwright ghi tên và phiên bản vào dòng Testing của Report 4 §3 (Technology Declaration).
- [ ] Theo `docs/deploy/staging.md`; mỗi người ghi phần mình vào đó (Bảo duyệt), để ai cũng trả lời được "staging hỏng thì làm gì" ở phần mình.

### G-18 — Việc nhỏ (P2) — Kiệt

- [ ] ENV-FR-007: bắt buộc nguồn khi Admin đổi ngưỡng mặc định (422).
- [ ] HARVEST-FR-001: số tổ, khối lượng > 0, ngày không ở tương lai.
- [ ] (Tùy chọn) ENV-FR-026; device ID lấy từ MAC.

## 5. Thứ tự đề xuất

1. **Trước tag `review-2`:** mục 0.3 (PR A G-01, PR B phần P0 của G-02, hồ sơ) → merge → Bảo chạy CI đủ module bằng tay trên commit cuối → gắn tag đúng commit xanh → CI trên tag → sinh Report 5 từ artifact → BM02 → xuất PDF.
2. **Tuần 1 Iteration 2:**
   - Nhi: ma trận quyền web (G-15), rồi nền mobile (G-16 bước 1–2);
   - Kiệt: PR spec cho G-03, G-04, G-10, G-11 (một PR `api-spec.yaml`, Tuấn và Nhi ghi endpoint cần), rồi backend G-05;
   - Bảo: G-07 (nhánh dài, thử trên bàn); chia ngày quay và giao gán nhãn (mục 3);
   - Len: G-15 chữ "PLC", form thu hoạch (G-14), cấu hình Playwright, màn Farm Owner mobile bước 3–4 khi nền mobile xong;
   - Len, Tuấn, Nhi: gán nhãn trong những ngày chờ API;
   - Tuấn: dời màn chuyên gia sang `domain-expert/`, bỏ dữ liệu giả, trang chủ hàng đợi việc (G-15).
3. **Tuần 2–3:** Kiệt backend G-03 → G-04 → G-11 → G-02 phần P1; Bảo train model, G-10 backend; Tuấn web G-03/G-04 theo spec, trình vẽ vòng đếm (G-12); Nhi màn G-11 web + mobile, in nhãn và setup QR (G-09); Len G-06 web/mobile (sau backend G-06), in mã tầng (G-09); Bảo G-08 sau G-07, G-12 backend, staging (G-17).
4. **Iteration 3:** G-13 (Bảo), G-18 (Kiệt); seed (Kiệt, Bảo) + test E2E từng DS (chủ workflow); đếm tay clip, đánh giá NFR-09; chạy thực địa ≥ 14 ngày, đo NFR (mỗi người số đo của mình); tổng duyệt demo trên staging.
