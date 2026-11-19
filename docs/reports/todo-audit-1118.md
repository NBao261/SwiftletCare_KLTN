# Việc cần sửa sau đợt soát web và backend (18/11/2026)

Kết quả đối chiếu **backend** và **web** với Report 3 (SRS), Report 4 (SDD) và `docs/api/api-spec.yaml`, làm ngày 18/11/2026 trên `develop` (sau PR #181). Mobile soạn sau, ở một file riêng.

**Người làm: Bảo (toàn bộ file này).**

## 0. Kết quả soát

**Đã khớp, không cần sửa:**
- Backend có 180 route, khớp 1–1 với `api-spec.yaml` (cùng method và path).
- Web không gọi endpoint nào mà backend không có.
- Nhóm role trên web (`frontend/src/constants/roles.ts`) khớp `requireRole` của backend ở mọi màn đang có; các nút ghi bị ẩn đúng role (đã kiểm tay các chỗ dễ lỗi: kết luận báo cáo, góp ý kế hoạch bảo trì, lịch trực, hệ số mờ, bằng chứng cảnh báo). Nút gửi lệnh: PUSH_CONFIG và OTA chỉ cho Admin, Restart cho Admin và Farm Technician. **Farm Owner có quyền Restart nhưng không trang nào của Farm Owner có nút** (W-12).
- 157 mã FR của Report 3 đều có dấu vết trong backend. Các FR còn lại của firmware và AI node không thuộc đợt soát này.

**Tiến độ (19/11/2026):** mọi mục đã có PR. D-04 đã merge (#185). Các PR đang mở: #186 (W-11), #187 (W-01, B-04, B-05), #188 (B-01, W-05, W-06, W-07), #189 (W-03), #190 (W-02, merge sau #187), #191 (W-04, W-12), #192 (B-06, W-08), #193 (W-09, W-10), #194 (B-02, B-03, W-13) và PR tài liệu D-01, D-02, D-03 (merge sau cùng: `tc.py` trỏ tới test của #187 và #189). Gap G-28 trong `project-tracking.md` §6 đóng khi tất cả đã merge.

**Còn phải sửa:** 1 bug mất dữ liệu (W-01) và 3 việc P0 trên web (W-02, W-03, W-05). Hai chức năng hiện không dùng được ở cả web lẫn mobile: quản lý bài loa ru (W-04) và Restart của Farm Owner (W-12). Ngoài ra có vài chức năng mobile đã có mà web chưa có, vài endpoint và hàm thừa, và 3 chỗ tài liệu cần chốt (D-01, D-02, D-04).

**Bổ sung ngày 19/11/2026** (soát lại trên `develop` sau PR #183, bằng script lần theo import từ mỗi trang web theo role tới từng hàm API rồi so với `requireRole` của backend): thêm W-04, W-12, W-13, D-04; sửa số route ở trên, câu về nút Restart, W-02 (kết luận mùa vụ) và W-11 (đã làm ở PR #182 nhưng chưa vào `develop`).

**Giới hạn của đợt soát:** chỉ đọc code, không chạy test. Chỉ kiểm theo route, role và mã FR, không kiểm từng tiêu chí chấp nhận.

## 1. Cách làm

Giữ quy tắc của `todo-final-scope.md` §0:
- Spec trước, code sau: route mới hoặc route bị bỏ thì sửa `api-spec.yaml` trong commit đầu của nhánh.
- Viết test trong cùng PR.
- Cập nhật nguồn test trong `report5/tc.py` khi test bị đổi hoặc bỏ.
- Đóng việc nào thì ghi vào dòng G-28 của `project-tracking.md` §6 (thêm dòng này ở D-03).

Mức ưu tiên:
- **P0**: bug, hoặc FR mức M không dùng được trên web.
- **P1**: FR đã có trên mobile nhưng web chưa có.
- **P2**: dọn dẹp, làm chặt hơn.

## 2. Tổng quan

| ID | Việc | Căn cứ | Phần | Ưu tiên | Phụ thuộc |
|---|---|---|---|---|---|
| W-01 | Sửa bug: mức giảm tỷ lệ chim về lưu sai chỗ, không bao giờ được lưu | EXPERT-FR-008 (M) | web | P0 | B-05 (phần reset) |
| W-02 | Mở các trang quyết định chuyên gia cho Farm Owner (BR-22, quyền "read ¹", lịch sử quyết định) | BR-22; EXPERT-FR-003, 008, 009, 020; VISION-FR-018, 019; ENV-FR-030; Report 4 §5.4 | web | P0 | W-01 |
| W-03 | Hộp thông báo trong app cho mọi role | EXPERT-FR-007 (M); EXPERT-FR-005, 006, 009, 020; ENV-FR-026; FARM-FR-009, 012; AUTH-FR-012 | web | P0 | — |
| W-04 | Farm Owner quản lý bài loa ru (upload, xoá, đánh dấu đã chép thẻ SD) | ENV-FR-013c (O); Report 3 §2.4 | web | P1 | — |
| W-05 | Admin từ chối yêu cầu xoá tài khoản | AUTH-FR-012 | web | P0 | — |
| W-06 | Người dùng hủy yêu cầu xoá tài khoản của mình | AUTH-FR-012, Report 3 §6.14 | web | P1 | B-01 |
| W-07 | Liên kết / gỡ Telegram ở trang Cài đặt | ALERT-FR-013, SF-04 | web | P1 | B-01 |
| W-08 | Khôi phục thiết bị đã gỡ trong 24 giờ | FARM-FR-008, Report 3 §6.6 | web | P1 | B-06 |
| W-09 | Danh sách lời mời đang chờ của farm | AUTH-FR-005, 010 | web | P1 | — |
| W-10 | Farm Technician xem ca trực của mình | Report 3 §2.4 ("read own roster") | web | P2 | D-02 |
| W-11 | Bỏ dữ liệu giả `farmMock.api.ts` — đã làm ở PR #182, chỉ còn đưa vào `develop` | FE_Design §7; Report 3 §8 | web | P2 | — |
| W-12 | Farm Owner khởi động lại bộ điều khiển | FARM-FR-013 (S); Report 3 §2.4 | web | P1 | — |
| W-13 | Bỏ hàm API và hook web không màn nào dùng | FE_Design §13 | web | P2 | — |
| B-01 | `GET /auth/me` | ALERT-FR-013, AUTH-FR-012 (hỗ trợ W-06, W-07) | backend | P1 | — |
| B-02 | Bỏ `PUT /devices/sensor-nodes/:id/thresholds` | trùng ENV-FR-006 | backend | P2 | — |
| B-03 | Bỏ `GET /health-reports/preview` | deprecated, không client nào gọi | backend | P2 | — |
| B-04 | Trả 400 khi tham số phát hiện có khóa lạ | EXPERT-FR-008 | backend | P2 | W-01 |
| B-05 | Reset về mặc định cho tham số phát hiện và mức giảm tỷ lệ chim về | EXPERT-FR-008 ("reset to defaults") | backend | P1 | — |
| B-06 | Liệt kê thiết bị gỡ trong 24 giờ còn khôi phục được | FARM-FR-008 | backend | P1 | — |
| D-01 | Report 3 §2.4: dòng audit log của Farm Owner không có FR nào | Report 3 §2.4, SYSTEM-FR-001 | tài liệu | P1 | — |
| D-02 | Chốt màn của Farm Technician trên web | Report 3 §1.2, §2.4; Report 4 §5.4 | tài liệu (hoặc web) | P1 | — |
| D-03 | Thêm gap G-28 vào Project Tracking, cập nhật spec và Report 5 | `project-tracking.md` §6 | tài liệu | P1 | — |
| D-04 | Kết luận mùa vụ chỉ do Domain Expert viết — **đã chốt Cách A và sửa backend (19/11/2026)** | BR-22; EXPERT-FR-020 (M) | backend | P1 | — |

Thứ tự đề nghị: W-11 (chỉ cần PR đưa #182 vào `develop`) → W-01 → W-05 → B-05 → W-02 → W-03 → W-12 → W-04 → B-01 → W-06, W-07 → B-06 → W-08 → W-09 → D-01, D-02, D-03 → B-02, B-03, B-04, W-10, W-13.

## 3. Web

### W-01 — Mức giảm tỷ lệ chim về không bao giờ được lưu (P0, bug)

**Vấn đề:**
- Ô "Ngưỡng sụt giảm tỉ lệ chim về" nằm trong cột tham số phát hiện **của Zone** (`components/features/domain-expert/tuning/DetectionColumn.tsx:150`).
- Web gửi `return_rate_drop_pct` vào `PUT /farms/zones/:zoneId/detection-tuning` (`services/expert/expertApi.service.ts:73`).
- Backend chỉ nhận 5 khóa của Zone (`backend/src/utils/detectionTuning.util.ts:16`) nên bỏ qua trường này mà không báo lỗi.
- Hậu quả: web báo "Đã lưu", ô luôn hiện 20 %, và không có dòng nào trong lịch sử chuyên gia.
- Từ SRS v2.1.8, mức này thuộc **nhà yến**: `PUT /farms/houses/:houseId/bird-count-tuning`, và web chưa gọi endpoint đó ở đâu.

**Việc cần làm:**
1. Bỏ `return_rate_drop_pct` khỏi `ExpertDetectionTuning` (`types/expert/tuning.types.ts:44`), khỏi giá trị khởi tạo ở `DetectionColumn.tsx:108` và khỏi `onReset` ở `pages/domain-expert/DomainExpertZoneTuningPage.tsx:141-144`.
2. Thêm `bird_count_tuning?: { return_rate_drop_pct: number }` vào kiểu `House` (`types/farm.types.ts`). `GET /farms/:id/houses` đã trả trường này.
3. Thêm hàm API `updateBirdCountTuning(houseId, { return_rate_drop_pct })` → `PUT /farms/houses/:houseId/bird-count-tuning`, đặt ở `apis/domain-expert/`. Thêm hook mutation trong `hooks/domain-expert/useZoneTuning.ts`; khi thành công thì invalidate query danh sách nhà.
4. Trên trang tinh chỉnh, thêm một khối **theo nhà** "Mức giảm tỷ lệ chim về":
   - Đọc từ nhà đang chọn (`selectedHouseId` của `useZoneStore`). Chưa chọn nhà thì hiện "Chọn một nhà".
   - Khoảng 5–50 %, bước 5, mặc định 20 (khớp `detectionTuning.util.ts:41`).
   - Nút "Khôi phục mặc định" gọi endpoint reset của B-05.
5. Cũng nhờ B-05, nút "Khôi phục" của tham số Zone gọi endpoint reset thay vì gửi bộ số mặc định viết cứng trong web.

**Xong khi:**
- Đổi 20 → 30, tải lại trang vẫn thấy 30.
- `GET /farms/:id/houses` trả `bird_count_tuning.return_rate_drop_pct = 30`.
- Lịch sử chuyên gia có dòng "chỉnh mức giảm tỷ lệ chim về".
- Nhập 60 thì nhận lỗi nhóm "không hợp lệ", không hiện mã HTTP.

**Test:** Vitest cho hàm dựng payload: payload Zone không còn `return_rate_drop_pct`, payload nhà chỉ có trường này.

### W-02 — Mở các trang quyết định chuyên gia cho Farm Owner (P0)

**Vấn đề:**
- `EXPERT_ROLES = ['DOMAIN_EXPERT']` (`constants/roles.ts:36`) bọc cả nhóm `/domain-expert/*` (`routes/domain-expert.routes.tsx:86`), nên Farm Owner bị đưa về /403. Trong khi đó:
  - Report 4 §5.4: các trang quyết định "open to a Farm Owner while the farm has no expert (BR-22)", và backend đã cho phép.
  - Report 3 §2.4 cho Farm Owner **xem** (read ¹) các mục sau, kể cả khi farm có chuyên gia: kết luận cảnh báo, tham số phát hiện, lịch đếm, luật thời tiết, vòng đếm, mục duyệt, profile, luật khuyến nghị.
  - EXPERT-FR-009 (M): Farm Owner đọc được lịch sử quyết định của chuyên gia (`/domain-expert/history`).
- Comment trong các trang đã giả định Farm Owner dùng được, ví dụ `DomainExpertCountingRingPage.tsx:1`, `DomainExpertWeatherRulesPage.tsx:1`, `CycleConclusionDrawer.tsx:1`.

**Việc cần làm:**
1. `constants/roles.ts`: thêm nhóm `EXPERT_DECISION_ROLES = ['DOMAIN_EXPERT', 'FARM_OWNER']`. `EXPERT_ROLES` chỉ còn giữ `/domain-expert/queue`.
2. `routes/domain-expert.routes.tsx`: bỏ `RequireRole` ở route cha, bọc từng route con. `queue` dùng `EXPERT_ROLES`; mọi trang còn lại dùng `EXPERT_DECISION_ROLES`.
3. Thêm từng path vào `MENU_ACCESS`. Cập nhật bảng test role → path của G-15.
4. `components/layouts/FarmOwnerLayout.tsx`: thêm nhóm menu "Chuyên môn" với các trang: Thẩm định cảnh báo, Ngưỡng & hệ số, Lịch đếm, Vòng đếm, Luật thời tiết, Duyệt & đề xuất, Báo cáo & kết luận, Hồ sơ cấu hình, Luật khuyến nghị, Lịch sử quyết định.
5. Thêm hook dùng chung `useExpertDecisionRights(farm)`, trả `canDecide`:
   - Domain Expert: `true`.
   - Farm Owner: `true` khi `farm.has_active_expert === false` (từ `GET /farms`).
   - Nếu backend vẫn trả 403 thì chuyển sang chỉ xem, giống `HealthLevelsModal`.
6. Quyền sửa trên từng trang. Mọi trang đều mở cho cả hai role; cột Farm Owner ghi khi nào Farm Owner được sửa:

   | Trang | Domain Expert | Farm Owner |
   |---|---|---|
   | Thẩm định cảnh báo | kết luận | kết luận khi `canDecide`; bằng chứng `GET /alerts/:id/evidence` luôn xem được |
   | Ngưỡng & hệ số | sửa | ngưỡng và hệ số mờ: luôn sửa được (tạo mục duyệt); tham số phát hiện và mức giảm tỷ lệ chim về (W-01): khi `canDecide` |
   | Lịch đếm, Vòng đếm, Luật thời tiết | sửa | khi `canDecide` |
   | Duyệt & đề xuất | chấp nhận, hoàn lại, duyệt | chỉ xem; gửi đề xuất vẫn ở `FuzzyTuningModal` |
   | Báo cáo & kết luận | viết kết luận | kết luận báo cáo: **ẩn form** (`PUT /health-reports/:id/conclusion` chỉ cho Domain Expert, EXPERT-FR-006); kết luận mùa vụ: **ẩn form** (đã chốt ở D-04: chỉ Domain Expert viết, kể cả khi farm chưa có chuyên gia); ngày lệch: theo `can_edit` |
   | Hồ sơ cấu hình, Luật khuyến nghị | soạn, duyệt | chỉ xem (Report 3 §2.4) |
   | Lịch sử quyết định | xem | xem |

7. Các trang đang đọc farm từ `useZoneStore`. Khi mở cho Farm Owner, kiểm tra khung lọc farm, nhà, Zone có đặt đúng store đó không. Nếu không, gắn `ScopeFilter` giống các trang Farm Owner khác.
8. Khi chỉ xem: hiện một dòng "Farm đã có chuyên gia — chỉ xem", không hiện nút ghi.

**Xong khi:**
- Farm Owner của farm **không** có chuyên gia làm được:
  - bác bỏ một `NOISE_ANOMALY` kèm ghi chú → cảnh báo thành `DISMISSED`, lịch sử ghi role `FARM_OWNER`;
  - sửa tham số phát hiện, lịch đếm, vòng đếm, luật thời tiết → đều 200; kết luận mùa vụ → 403 (D-04).
- Farm Owner của farm **có** chuyên gia mở được mọi trang nói trên ở chế độ chỉ xem, không gặp lỗi 403 nào.
- Farm Technician và Admin mở `/domain-expert/*` thì bị đưa về /403.

**Test:**
- Vitest: bảng role → path, và `useExpertDecisionRights`.
- Playwright: một test Farm Owner trên farm không có chuyên gia (thêm farm này vào `seed:demo` nếu chưa có).

### W-03 — Hộp thông báo trong ứng dụng (P0)

**Vấn đề:**
- Web không gọi `GET /notifications`, `PUT /notifications/:id/read` hay `PUT /notifications/read-all`, và không nghe socket `NOTIFICATION_NEW` (`backend/src/socket/index.ts:174`).
- Chuông `components/common/NotificationPopover.tsx` chỉ đọc `/alerts`.
- Vì vậy trên web không ai thấy các thông báo trong app:
  - Chuyên gia: mục duyệt, đề xuất, báo cáo mới, cảnh báo suy luận chờ kiểm chứng (EXPERT-FR-007).
  - Farm Owner: quyết định của chuyên gia (EXPERT-FR-009), kết luận (EXPERT-FR-006, 020), lệnh Admin gửi tới thiết bị (FARM-FR-009), thiết bị kẹt `PENDING` (FARM-FR-012), Zone lệch ngưỡng mặc định mới (ENV-FR-026).
  - Admin: yêu cầu xoá tài khoản và lời nhắc (AUTH-FR-012, gửi bằng `notifyAdmins`).

**Việc cần làm:**
1. Thêm `apis/shared/notifications.api.ts` với 3 hàm:
   - `list({ page, limit, unread })` → `GET /notifications`. Dữ liệu trả về có `unreadCount`.
   - `markRead(id)` → `PUT /notifications/:id/read`.
   - `markAllRead()` → `PUT /notifications/read-all`.
2. Thêm kiểu `AppNotification` (`types/notification.types.ts`) theo `NotificationDto`: `_id`, `title`, `body`, `ref { kind, id }`, `read_at`, `created_at`.
3. Thêm `hooks/shared/useNotifications.ts`: infinite query, số chưa đọc, hai mutation đọc.
4. `lib/socket.ts`: thêm `onNotificationNew(callback)`. Gắn listener trong `AppShell`, cạnh `useAlertNotifications`: invalidate query và hiện toast.
5. Thêm tab "Thông báo" trong `NotificationPopover`, bên cạnh tab "Cảnh báo" hiện có, cho cả 4 role. Badge chuông bằng số cảnh báo chưa đọc cộng số thông báo chưa đọc. Có nút "Đánh dấu đã đọc hết".
6. Bấm một thông báo thì đánh dấu đã đọc và chuyển trang theo `ref.kind`. Viết thành một bảng thuần trong `constants/`:

   | `ref.kind` | Trang đích |
   |---|---|
   | `alert` | `/alerts?highlight=`; chuyên gia: `/domain-expert/alert-verdicts` |
   | `health_report` | trang báo cáo |
   | `health_day` | `/health` |
   | `expert_decision` | `/domain-expert/history` |
   | `parameter_review`, `coefficient_proposal` | `/domain-expert/reviews` |
   | `work_order` | `/work-orders` |
   | `device_action` | `/devices` |
   | không có `ref` (thông báo của Admin) | `/account-requests` |

**Xong khi:**
- Farm Owner sửa ngưỡng trên farm có chuyên gia → trong vòng vài giây, chuông của chuyên gia hiện thông báo mới mà không cần tải lại trang.
- Admin gửi RESTART → Farm Owner thấy thông báo.
- Đánh dấu đã đọc làm badge giảm; "đọc hết" đưa badge về 0.
- Admin thấy thông báo yêu cầu xoá tài khoản.

**Test:**
- Vitest: bảng `ref.kind` → path.
- Playwright: thông báo của chuyên gia hiện sau một lần Farm Owner sửa ngưỡng.

### W-04 — Farm Owner quản lý bài loa ru (P1)

**Vấn đề:**
- ENV-FR-013c và Report 3 §2.4: Farm Owner đăng ký bài đã chép vào thẻ SD, chọn bài mặc định, phát thử. Backend chỉ cho `FARM_OWNER` upload, xoá, đánh dấu đã chép (`POST/DELETE /devices/sensor-nodes/:id/audio-tracks…`, `PUT …/sync-status`).
- Trên web, form upload, xoá và công tắc "Đã chép vào thẻ SD" nằm trong `components/features/technician/devices/AudioTracksModal.tsx`. Modal này chỉ mở từ `pages/technician/TechnicianDevicesPage.tsx:478`, tức trang `/devices` của Admin, Domain Expert và Farm Technician (`routes/technician.routes.tsx:28-30`). Trong modal, các nút ghi chỉ hiện với `FARM_OWNER` (`AudioTracksModal.tsx:25-26`), nên không ai thấy.
- Trang `/devices` của Farm Owner dùng `components/features/farm-owner/devices/LullabyTracksModal.tsx`, chỉ chọn bài, phát thử và dừng.
- Mobile chưa có phần này.
- Hậu quả: không ai thêm được bài vào hệ thống. Vì "a track not marked as copied to the SD card cannot be selected or played" (400), chọn và phát thử cũng không dùng được.

**Việc cần làm:**
1. Đưa upload, xoá và công tắc "Đã chép vào thẻ SD" vào `LullabyTracksModal` của Farm Owner (hoặc mở `AudioTracksModal` từ trang thiết bị của Farm Owner).
2. Trên `TechnicianDevicesPage`, Admin, Domain Expert và Farm Technician chỉ xem danh sách bài (`GET` cho mọi role), không có nút ghi. Bỏ câu "Kỹ thuật viên sẽ upload và chép file vào thẻ SD" (`AudioTracksModal.tsx:60`), vì không còn đúng.
3. Chuyển modal về `components/features/farm-owner/devices/` theo FE_Design §12.

**Xong khi:**
- Farm Owner upload `0001.mp3`, bật "Đã chép", chọn làm bài mặc định và phát thử, cả 4 bước đều thành công.
- Domain Expert, Farm Technician và Admin không thấy nút ghi nào.

**Test:** Vitest cho hàm quyết định hiện nút theo role.

### W-05 — Admin từ chối yêu cầu xoá tài khoản (P0)

**Vấn đề:** AUTH-FR-012 yêu cầu Admin "completes or rejects". Web chỉ có "Hoàn tất" (`apis/admin/users.api.ts:45`, `pages/admin/AdminAccountRequestsPage.tsx:79`). Admin chỉ dùng web nên chức năng từ chối hiện không có ở đâu.

**Việc cần làm:**
1. Thêm `rejectDeleteRequest(id, reason)` → `PUT /admin/delete-requests/:id/reject` với body `{ reason }` (bắt buộc).
2. Thêm hook `useRejectDeleteRequest` trong `hooks/admin/useAccountRequests.ts`.
3. Trên trang, thêm nút "Từ chối" cạnh "Hoàn tất", mở modal có ô lý do bắt buộc. Thành công thì invalidate danh sách.

**Xong khi:**
- Từ chối kèm lý do → tài khoản về `ACTIVE` và rời khỏi danh sách.
- Lý do rỗng bị chặn ngay trên form.

**Test:** thêm một bước vào Playwright `admin-accounts.spec.ts`.

### W-06 — Hủy yêu cầu xoá tài khoản (P1)

**Vấn đề:** Report 3 §6.14 có chuyển trạng thái `DELETION_REQUESTED` → `ACTIVE` khi "User cancels". Web chỉ gửi yêu cầu (`apis/auth/auth.api.ts:24`), không gọi `DELETE /auth/delete-request`.

**Việc cần làm:**
1. Thêm `cancelDeletion()` → `DELETE /auth/delete-request`.
2. Trong `pages/SettingsPage.tsx` (khu vực quanh dòng 272), khi `user.deletion_requested_at` có giá trị:
   - hiện "Đã gửi yêu cầu xoá ngày …, hạn xử lý …" (30 ngày);
   - hiện nút "Hủy yêu cầu".
3. Sau khi gửi hoặc hủy, đọc lại user bằng `GET /auth/me` (B-01).

**Xong khi:** gửi rồi hủy thì trang hiện lại nút gửi, và tài khoản không còn trong danh sách của Admin.

### W-07 — Liên kết và gỡ Telegram (P1)

**Vấn đề:** ALERT-FR-013 và SF-04 cho mọi người dùng tự liên kết Telegram. `SettingsPage.tsx:114-175` chỉ hiện công tắc khi tài khoản **đã** liên kết sẵn, và web không gọi `POST/DELETE /auth/telegram/link`.

**Việc cần làm:**
1. Thêm `createTelegramLink()` → `POST /auth/telegram/link`, trả `{ deep_link, expires_at }`.
2. Thêm `unlinkTelegram()` → `DELETE /auth/telegram/link`.
3. Chưa liên kết:
   - nút "Liên kết Telegram" mở `deep_link` ở tab mới và hiện QR của link (thư viện `qrcode` đã có), kèm giờ hết hạn;
   - nút "Tôi đã bấm Start" gọi `GET /auth/me` (B-01) để cập nhật `telegram_linked`.
4. Đã liên kết: nút "Gỡ liên kết" có xác nhận. Nếu chỉ còn Telegram là kênh ngoài app cho CRITICAL thì cảnh báo trước khi gỡ.
5. Backend trả 503 (chưa cấu hình bot) thì hiện câu lỗi nhóm "hệ thống".

**Xong khi:** liên kết xong, bấm kiểm tra thì công tắc Telegram hiện ra; gỡ thì công tắc biến mất.

### W-08 — Khôi phục thiết bị đã gỡ trong 24 giờ (P1)

**Vấn đề:** FARM-FR-008 và Report 3 §6.6 cho khôi phục trong 24 giờ. Web không gọi `POST /devices/sensor-nodes/:id/restore` hay `POST /devices/camera-nodes/:id/restore`. Các danh sách thiết bị cũng không trả thiết bị đã gỡ (`backend/src/services/device.service.ts:171-178`, lọc `IN_SERVICE`).

**Việc cần làm (cần B-06):**
1. Thêm `restoreSensorNode(id, reason)` và `restoreCameraNode(id, reason)` vào `apis/shared/devices.api.ts`. Lý do bắt buộc.
2. Ngay sau khi gỡ thành công, toast có nút "Hoàn tác" mở modal lý do.
3. Trên trang `/devices` của Farm Owner, thêm khối "Đã gỡ trong 24 giờ" lấy từ B-06. Mỗi dòng có thời gian còn lại và nút "Khôi phục".
4. Backend trả 409 (quá hạn, hoặc đã có thiết bị khác thế chỗ) thì hiện câu lỗi nhóm "không hợp lệ".

**Xong khi:** gỡ rồi khôi phục trong 24 giờ → thiết bị về `OFFLINE` hoặc `PENDING` trong danh sách, và audit có ghi lại.

### W-09 — Lời mời đang chờ của farm (P1)

**Vấn đề:** `GET /farms/:id/invitations` (AUTH-FR-005, 010) có backend nhưng web không hiện. Primary Owner không biết lời mời nào còn chờ hoặc đã hết hạn.

**Việc cần làm:**
1. Thêm `listInvitations(farmId, { status, page, limit })` vào `apis/shared/farms.api.ts`.
2. Trong `components/features/farm-owner/farms/FarmMembersManager.tsx`, thêm khối "Lời mời" (mặc định lọc `PENDING`) với e-mail, vai trò (`INVITE_ROLE_LABEL`), ngày gửi, ngày hết hạn.
3. Chỉ Primary Owner thấy khối này. Gặp 403 thì ẩn khối.

**Xong khi:** mời một e-mail → dòng mới hiện ngay ở `PENDING`; qua 7 ngày (job) dòng chuyển sang `EXPIRED`.

### W-10 — Farm Technician xem ca trực của mình (P2, tùy D-02)

`GET /farms/:id/houses` đã trả `roster` chỉ gồm ca của thợ (`backend/src/services/farm.service.ts:520`). Hiện `useHouseRoster` chỉ chạy khi người dùng là Farm Owner (`FarmMembersManager.tsx:68`).

Trên `pages/technician/TechnicianFarmsPage.tsx` (`TechnicianHouseRow`), hiện các ca của thợ theo từng nhà: thứ trong tuần, giờ, chính hay dự phòng.

### W-11 — Bỏ dữ liệu giả (P2) — đã làm ở PR #182, chưa có trên `develop`

PR #182 (`refactor/web-remove-farm-mock`) đã làm việc này, nhưng nó merge vào nhánh `fix/review-1118-leftovers` **sau khi** PR #181 đã vào `develop`. Vì vậy các commit `a9857363` và `f6d1bca4` chưa có trên `develop`.

PR #182 đã:
- bỏ `apis/farm-owner/farmMock.api.ts` cùng các hook `useStructureExtras`, `useHouseAdvice`, `useDeviceProfile` và các key i18n của chúng;
- bỏ thẻ "Khuyến nghị kỹ thuật từ hệ thống AI" ở trang nhà (`AiAdviceCard`) và ô "Gợi ý thuật toán AI" ở Dashboard (`NestingDensityCard`). Khuyến nghị thật ở `/recommendations` (EXPERT-FR-017).
- bỏ ô "Dự kiến thu tiếp" (`HouseProductionCard`), vì dự đoán sản lượng nằm ngoài phạm vi (Report 3 §8);
- bỏ dòng "Kỹ thuật viên lắp đặt" và nhãn "Mới nhất" của firmware (`DeviceDetailDrawer`);
- cập nhật FE_Design, `frontend/CLAUDE.md` và Change Log của Project Tracking.

(Bản trước của mục này ghi `useHouseAdvice` và `useDeviceProfile` "không màn nào dùng". Câu đó sai: `AiAdviceCard`, `NestingDensityCard` và `DeviceDetailDrawer` đều dùng hai hook này.)

**Việc cần làm:** mở PR từ `fix/review-1118-leftovers` vào `develop`, rồi xem CI xanh.

### W-12 — Farm Owner khởi động lại bộ điều khiển (P1)

**Vấn đề:**
- FARM-FR-013 và Report 3 §2.4 ("Remote commands … — Farm Owner: restart") cho Farm Owner restart bộ điều khiển của farm.
- `DEVICE_RESTART_ROLES` có `FARM_OWNER`, và nút Restart nằm ở `TechnicianDevicesPage` (`canRestart`). Nhưng Farm Owner không bao giờ vào trang đó: `/devices` của Farm Owner là `FarmOwnerDevicesPage` (`routes/technician.routes.tsx:28-30`).
- `FarmOwnerDevicesPage` và `/devices/detail` không gọi `POST /devices/sensor-nodes/:id/commands`, và mobile cũng chưa có. Vì vậy Farm Owner không restart được ở đâu.

**Việc cần làm:**
1. Thêm nút "Khởi động lại" trên trang thiết bị và trang chi tiết thiết bị của Farm Owner, chỉ khi thiết bị `ONLINE`.
2. Dùng lại `useSendNodeCommand` với `type: 'RESTART'`, có hộp xác nhận. Firmware chưa hỗ trợ (501, `COMMAND_SUPPORT_SINCE` 1.4.0) thì báo như `rebootUnsupportedIds` của `TechnicianDevicesPage`.
3. Domain Expert đọc chung trang này nên không thấy nút (`usePermission('FARM_OWNER')`).

**Xong khi:** Farm Owner restart một bộ điều khiển `ONLINE` thành công và audit có ghi lại; Domain Expert không thấy nút.

### W-13 — Hàm API và hook web không màn nào dùng (P2)

Hàm API không màn nào gọi tới (lần theo import từ mọi trang):
- `analyticsApi.birdCountDaily` (`apis/farm-owner/analytics.api.ts:179`);
- `expertApi.compareZones` (`services/expert/expertApi.service.ts:88`);
- `harvestCyclesApi.get` (`apis/domain-expert/harvestCycles.api.ts:24`);
- `healthDayApi.getOne` (`apis/shared/healthDays.api.ts:19`);
- `expertApi.getSensorNodes`, `expertApi.getRelayOverrideLogs` (chỉ hook chết `useRelayOverrideLogs` gọi);
- `profilesApi.getOne` (chỉ hook chết `useProfile` gọi).

Hook không màn nào dùng:
- trong `hooks/domain-expert/useExpertDashboard.ts`: `useRelayOverrideLogs`, `useExpertBirdTrends`, `useExpertFuzzySuggestion`, `useSetAlertVerdict` (trang phán quyết dùng `useSubmitAlertVerdict`);
- trong `hooks/domain-expert/useProfiles.ts`: `useProfile`.

**Việc cần làm:** bỏ các hàm và hook trên. Khi bỏ, kiểm `expertDomain.service.ts` để bỏ luôn hàm bọc không còn ai gọi. Chạy lint, tsc và vitest.

## 4. Backend

### B-01 — `GET /auth/me` (P1)

**Vấn đề:** web và mobile chỉ có thông tin user lúc đăng nhập (`backend/src/controllers/auth.controller.ts:37-41`). Sau khi liên kết Telegram qua bot, hủy yêu cầu xoá hay bị đổi trạng thái, client không có cách đọc lại. Mobile hiện cũng không bao giờ thấy `telegram_linked: true` nếu chưa đăng nhập lại.

**Việc cần làm:**
1. Thêm `router.get('/me', authenticate, authController.me)` vào `routes/auth.route.ts`. Trả đúng dạng `user` của login: `telegram_linked`, `notification_preferences`, `deletion_requested_at`, `must_change_password`, `is_active`/`status`. Không trả hash hay mã liên kết.
2. Viết spec trong `api-spec.yaml` trước.
3. Test tích hợp:
   - 200 với token hợp lệ;
   - 401 khi không có token;
   - `telegram_linked` đổi sau khi giả lập `/start` của bot;
   - không lộ trường nhạy cảm.

### B-02 — Bỏ `PUT /devices/sensor-nodes/:id/thresholds` (P2)

**Vấn đề:** route này trùng `PUT /farms/zones/:zoneId/thresholds` (cùng validate, cùng publish config). Web và mobile không gọi.

**Việc cần làm:**
1. Bỏ route (`routes/devices.route.ts`), controller và `updateNodeThresholds` (`services/device.service.ts:194`), cùng path trong spec.
2. Chuyển các kiểm tra của nó sang route của Zone để độ phủ test không giảm:
   - `tests/integration/zoneThresholds.test.ts:118-128`;
   - `domainExpert.test.ts:152`;
   - `parameterReview.test.ts:110`.
3. Sửa nguồn test tương ứng trong `report5/tc.py` nếu có.

### B-03 — Bỏ `GET /health-reports/preview` (P2)

**Vấn đề:** spec ghi `deprecated: true`, lý do "giữ cho các màn hiện có", nhưng không còn màn nào dùng (báo cáo theo nhà dùng `POST /health-reports`).

**Việc cần làm:**
1. Bỏ route (`routes/healthReports.route.ts`), controller `preview` và hàm service nếu chỉ route này dùng. Bỏ path trong spec.
2. Bỏ test `healthReport.test.ts:160-170` và `healthDays.test.ts:566`. Nếu cần, chuyển kiểm tra BR-31 sang `POST /health-reports`.
3. Sửa `report5/tc.py` nếu có case trỏ vào các test này.

### B-04 — Khóa lạ trong tham số phát hiện trả 400 (P2)

**Vấn đề:** `pickDetectionTuning` và `pickBirdCountTuning` lặng lẽ bỏ khóa lạ. Đây chính là lý do bug W-01 không ai phát hiện.

**Việc cần làm:**
1. Trong `updateZoneDetectionTuning` và `updateHouseBirdCountTuning` (`services/farm.service.ts`), body có khóa ngoài `DETECTION_TUNING_KEYS` / `BIRD_COUNT_TUNING_KEYS` thì trả 400, câu lỗi nêu tên khóa và gợi ý endpoint đúng cho `return_rate_drop_pct`.
2. Ghi vào spec.
3. Test: gửi `return_rate_drop_pct` vào endpoint của Zone → 400.

### B-05 — Reset tham số phát hiện và mức giảm tỷ lệ chim về (P1)

**Vấn đề:** EXPERT-FR-008 ghi "with history and reset to defaults", nhưng backend chỉ có reset cho ngưỡng (`/zones/:zoneId/thresholds/reset`). Web đang tự gửi bộ số mặc định viết cứng (`DomainExpertZoneTuningPage.tsx:141-144`), lặp hằng số của `detectionTuning.util.ts`.

**Việc cần làm:**
1. Thêm `PUT /farms/zones/:zoneId/detection-tuning/reset` và `PUT /farms/houses/:houseId/bird-count-tuning/reset`. Quyền như route sửa: `FARM_OWNER`, `DOMAIN_EXPERT`; BR-22 kiểm ở service bằng `assertExpertDecision`.
2. Hai route dùng `DEFAULT_DETECTION_TUNING` / `DEFAULT_BIRD_COUNT_TUNING`. Ghi lịch sử, audit, `notifyExpertDecision`. Với Zone thì tăng `config_version` và publish `config`, như sửa thường.
3. Viết spec trước.
4. Test:
   - reset đưa về mặc định;
   - lịch sử có dòng mới;
   - Farm Owner trên farm có chuyên gia → 403;
   - Zone tăng `config_version`.

### B-06 — Thiết bị gỡ trong 24 giờ còn khôi phục được (P1)

**Vấn đề:** client không có cách tìm thiết bị đã gỡ để khôi phục, vì danh sách chỉ trả thiết bị đang dùng.

**Việc cần làm:**
1. Thêm tham số `removed=recent` cho `GET /devices/sensor-nodes` và `GET /devices/camera-nodes`, chỉ Farm Owner dùng được. Trả các thiết bị có `decommissioned_at` trong 24 giờ qua (hằng số khôi phục ở Report 3 §4.5), trong phạm vi Zone/nhà người gọi được xem, kèm `restorable_until`.
2. Hai trường hợp không trả: thiết bị đã có thiết bị khác thế chỗ, và thiết bị mà ID đã được đăng ký lại (cùng điều kiện như `restore`).
3. Viết spec trước.
4. Test:
   - thiết bị gỡ 1 giờ trước có trong danh sách, gỡ 25 giờ trước thì không;
   - Domain Expert và Farm Technician gọi → 403;
   - thiết bị đã bị thay thế thì không xuất hiện.

## 5. Tài liệu

### D-01 — Audit log của Farm Owner (P1) — đã sửa 19/11/2026 (Report 3 4.2.12, chú thích ³)

Report 3 §2.4, dòng "View the audit log and the technical overview", cho Farm Owner "read own farm". Nhưng không FR nào yêu cầu (SYSTEM-FR-001 chỉ cho Administrator) và `GET /system/audit-logs` chỉ cho `ADMIN`.

**Đề nghị:** sửa ô của Farm Owner thành "–", thêm chú thích rằng lịch sử các quyết định trên farm của Farm Owner là EXPERT-FR-009 (W-02). Thêm một dòng vào Revision History của Report 3. Sinh lại Word bằng `docs/reports/tools/`.

Nếu muốn giữ quyền này thì phải viết thêm FR và endpoint audit lọc theo farm. Việc này lớn hơn và không có trong phiếu đăng ký v3.

### D-02 — Màn của Farm Technician trên web (P1) — đã chốt Cách A 19/11/2026 (Report 4 2.2.16 §5.4)

Report 3 §1.2 ghi web phục vụ cả Farm Technician, và §2.4 cho thợ dashboard, analytics, xem chim, sức khỏe và chấm ngày, Work Order, bảo trì, khuyến nghị, nhập thu hoạch, can thiệp tay, vẽ vòng đếm, kiểm tra tại chỗ. Report 4 §5.4 lại ghi mobile là "công cụ chính" của thợ.

Web hiện chỉ cho thợ vào `/devices`, `/alerts`, `/farms`, `/settings`. Vì vậy web không gọi `POST /work-orders/:id/start|done`, `PUT /work-orders/:id/checklist` và `POST /alerts/:id/onsite-check`.

Hai cách chốt:
- **Cách A (đề nghị):** ghi rõ trong Report 4 §5.4 rằng trên web, Farm Technician có thiết bị, cảnh báo (xác nhận kèm nguyên nhân), cấu trúc nhà được giao, ca trực của mình (W-10) và cài đặt; mọi việc còn lại của thợ làm trên mobile. Không cần code thêm ngoài W-10. Sinh lại Word.
- **Cách B:** mở các trang `FARM_SIDE_ROLES`, `/health`, `/harvests`, `/work-orders` (bắt đầu, xong, checklist có ảnh) cho thợ, giới hạn ở nhà được giao. Khoảng 1–2 tuần web, và phải soát lại mọi nút ghi theo §2.4.

### D-03 — Ghi nhận vào Project Tracking (P1) — đã làm 19/11/2026

1. Thêm dòng **G-28** vào `project-tracking.md` §6, gồm W-01…W-13, B-01…B-06 và kết quả của D-04, người làm Bảo, hạn theo iteration. Khi xong từng việc thì cập nhật dòng này. Thêm một dòng vào §7 Change Log.
2. Mỗi PR của B-xx sửa `api-spec.yaml`. Nếu thêm model hay trường thì chạy `npm run db:script`.
3. Trong `report5/tc.py`, đổi nguồn test của các case liên quan (AUTH-FR-012, EXPERT-FR-007, 008, FARM-FR-008) sang test thật khi viết xong.
   *(Đã làm 19/11/2026: TC-F14-01 (EXPERT-FR-008) và TC-F16-02 (EXPERT-FR-007) thêm test của #187, #189. FARM-FR-008: thêm chuyển trạng thái khôi phục thiết bị của SRS §6.6 vào bảng ST (Report 5 1.5.1, Design Brief 2.1: 75 chuyển trạng thái, 171 case cam kết), vì SRS có chuyển này từ 4.2.1 mà Report 5 chưa kiểm. AUTH-FR-012 thuộc luồng phụ SF-03 nên không vào danh sách cam kết, giống HarvestBatch/HarvestCycle ở Report 5 1.5.0; test của nó vẫn chạy trong Jest (#188).)*

### D-04 — Kết luận mùa vụ khi farm chưa có chuyên gia (P1) — đã chốt Cách A, đã sửa 19/11/2026

**Vấn đề:**
- Report 3 BR-22: "No conclusions are written without an expert (EXPERT-FR-006)". EXPERT-FR-020 (M): "a non-expert request is rejected with 403 (Farm Owner without an expert, BR-22)".
- Backend lại cho Farm Owner viết kết luận mùa vụ khi farm chưa có chuyên gia:
  - route `requireRole('DOMAIN_EXPERT', 'FARM_OWNER')` (`backend/src/routes/harvests.route.ts:47`);
  - `concludeCycle` kiểm bằng `assertExpertDecision` (`backend/src/services/harvestCycle.service.ts:291-298`);
  - test `harvestCycle.test.ts:179` "farm chưa có chuyên gia: Farm Owner viết kết luận được (BR-22)";
  - dòng G-26 của Project Tracking cũng ghi như vậy.
- Kết luận báo cáo sức khỏe thì đã đúng SRS: chỉ Domain Expert (`PUT /health-reports/:id/conclusion`).

**Hai cách chốt:**
- **Cách A (đề nghị, vì code phải theo SRS — `todo-final-scope.md` §0, quy tắc 5):**
  - route chỉ cho `DOMAIN_EXPERT`;
  - test 179 đổi thành "Farm Owner → 403 kể cả khi farm chưa có chuyên gia";
  - sửa comment của service và dòng G-26;
  - W-02 ẩn form kết luận mùa vụ với Farm Owner;
  - cập nhật `api-spec.yaml`.
- **Cách B:** giữ code. Khi đó sửa BR-22 và EXPERT-FR-020 trong Report 3 (thêm dòng Revision History), cập nhật BM03 nếu cần, và sinh lại Word.

**Đã chốt Cách A (19/11/2026, Bảo).** Lý do, theo vận hành thật của một doanh nghiệp có nhiều nhà yến:
- BR-22 chỉ để Farm Owner làm thay những quyết định mà thiếu người làm thì hệ thống bị kẹt: cảnh báo suy luận treo chờ kết luận, tham số phát hiện, vòng đếm. Kết luận mùa vụ không chặn gì: chu kỳ vẫn đóng, sản lượng, so sánh và sức khỏe chu kỳ vẫn được tính tự động.
- Kết luận là ý kiến chuyên môn. Trộn ghi chú của chủ trại vào thì khi so các nhà, các mùa sẽ không còn biết đâu là đánh giá của chuyên gia. Kết luận báo cáo sức khỏe cũng đã chỉ cho chuyên gia viết (EXPERT-FR-006), nên hai loại kết luận giống nhau.
- Không mất gì: chuyên gia vào sau vẫn viết được kết luận cho mọi chu kỳ đã đóng, vì không có hạn chót.
- Giữ nguyên Report 3, BM04 và Report 5 đã nộp.

**Đã làm:**
- route chỉ cho `DOMAIN_EXPERT` (`backend/src/routes/harvests.route.ts`), bỏ `assertExpertDecision` ở `concludeCycle`;
- test `harvestCycle.test.ts` đổi thành "Farm Owner vẫn không viết kết luận (BR-22), chu kỳ giữ CLOSED";
- `api-spec.yaml`, chú thích của `CycleConclusionDrawer.tsx`, `todo-final-scope.md` và Change Log của Project Tracking cập nhật theo.

Không client nào gọi endpoint này với vai Farm Owner (chỉ màn chuyên gia trên web), nên không phải sửa màn hình.
