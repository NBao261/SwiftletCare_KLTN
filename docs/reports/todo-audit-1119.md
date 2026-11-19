# Việc cần sửa sau đợt soát web và backend (19/11/2026)

Đợt soát thứ hai trên `develop` (sau PR #196), lần này soát theo **tiêu chí chấp nhận** của từng FR trong Report 3, phần thiết kế ở Report 4 §5.4 và §7, và soát giao diện web theo từng role (header, sidebar, chức năng). Đợt 18/11 (`todo-audit-1118.md`, G-28) chỉ soát theo route, role và mã FR. Mobile không thuộc đợt này.

**Người làm: Bảo (toàn bộ file này), một nhánh `fix/audit-1119-web-backend`, một PR.** Các màn web của Nhi và Tuấn được sửa theo cùng cách các đợt trước (Bảo làm thay, ghi rõ trong PR).

**Giới hạn:** chỉ đọc code. Sau khi sửa thì chạy lint, tsc, Vitest, build của web và lint, build:check, Jest của backend.

**Tiến độ (19/11/2026): đã làm hết trên nhánh `fix/audit-1119-web-backend`**, trừ các mục ghi ở "Không sửa". Chưa chạy thử trên trình duyệt; E2E chạy trong CI.

## 1. Cách làm

- Spec trước, code sau: tham số mới của route thì sửa `api-spec.yaml` trong cùng commit với backend.
- Test viết trong cùng PR: backend bắt buộc với logic service mới; web có test cho logic thuần (`*.utils.ts`, `roles.test.ts`).
- Mỗi nhóm việc là một commit (spec + backend, từng nhóm web, tài liệu).
- Đóng việc thì ghi vào dòng G-29 của `project-tracking.md` §6.

Mức ưu tiên giữ như đợt 18/11: **P0** bug hoặc FR mức M không dùng được trên web; **P1** FR thiếu một phần; **P2** dọn dẹp.

## 2. Tổng quan

| ID | Việc | Căn cứ | Phần | Ưu tiên |
|---|---|---|---|---|
| B-01 | SDD §7.3 và DF-13 ghi hai sự kiện socket mà backend không phát (`ALERT_ESCALATED`, `WORK_ORDER_UPDATE`): sửa SDD cho khớp code | Report 4 §2.2, §7.3 | tài liệu | P2 |
| B-02 | `GET /alerts?open=true`: chỉ cảnh báo còn hiệu lực (`ACTIVE`, `ACKNOWLEDGED`) | ALERT-FR-007 | backend, spec | P1 |
| B-03 | `backend/CLAUDE.md` còn ghi `register`, `otp` (đã bỏ từ G-02) | G-02 | tài liệu | P2 |
| W-01 | Domain Expert đổi được giai đoạn nhà trên web | FARM-FR-014, Report 3 §2.4 | web | P0 |
| W-02 | Farm Owner thực hiện Work Order trên web: bắt đầu, ghi checklist, báo xong kèm nguyên nhân, ghi chú, ảnh | OPS-FR-002, 007, ALERT-FR-018, Report 3 §2.4 và chú thích ¹ (nhà không có thợ) | web | P0 |
| W-03 | Số cảnh báo chờ xác nhận = số `ACTIVE`, bỏ trạng thái "đã đọc" của cảnh báo lưu trong trình duyệt; trang Cảnh báo mặc định chỉ hiện cảnh báo còn hiệu lực và nêu số chờ xác nhận | ALERT-FR-007 | web | P0 |
| W-04 | Bug: badge của "Thẩm định cảnh báo" trên menu Farm Owner lặp số của "Cảnh báo" | EXPERT-FR-003 | web | P0 |
| W-05 | Màn lắp đặt thiết bị có bước "đã áp cấu hình của khu vực" | FARM-FR-012, ENV-FR-027 | web | P1 |
| W-06 | Web không quét QR (quét là của mobile, FARM-FR-003): bỏ `html5-qrcode` và câu tương ứng trong SDD | FARM-FR-003, Report 4 §3.2, §5.4 | web, tài liệu | P2 |
| W-07 | Số chim đếm hôm nay trên thẻ camera tự làm mới 30 giây/lần | VISION-FR-012, VISION-FR-006 (30 s) | web | P1 |
| W-08 | Admin thấy vị trí (farm, nhà, khu vực) của thiết bị và cảnh báo thiết bị | FARM-FR-009, Report 3 §2.4 ² | web | P1 |
| W-09 | Tổng quan hệ thống của Admin có số tài khoản theo role và trạng thái | SYSTEM-FR-003 | web | P2 |
| U-01 | Popup avatar: bỏ mục "Cài đặt thông báo" (trùng đích `/settings`) và mục "Trợ giúp" bị khoá; trang Cài đặt bỏ nút Đăng xuất thứ ba (đã có ở sidebar và popup avatar) | — | web | P2 |
| U-02 | Sidebar: chữ "Role:" chưa dịch; bỏ comment mồ côi trong `AppHeader` | FE_Design §6 | web | P2 |
| U-03 | Menu Farm Owner: Cảnh báo, Phân tích, Sức khỏe chuyển lên nhóm Vận hành; dock mobile có Cảnh báo | MF-02 | web | P1 |
| U-04 | Farm Owner xem báo cáo và ngày lệch ở 2 nơi: bỏ "Báo cáo & kết luận" khỏi menu Farm Owner (đã có ở `/health`) | — | web | P2 |
| U-05 | Hàng KPI của `/farms` trùng hàng KPI của Tổng quan: bỏ; thẻ "Trạng thái nhà yến" luôn hiện nhãn xanh "Ổn định" kể cả khi có nhà lỗi | — | web | P1 |
| U-06 | Menu Domain Expert dùng 3 bộ icon; cùng một trang mang 2 tên ("Lịch sử hoạt động" / "Lịch sử quyết định"); viết hoa không đều; 13 nhãn menu (nhóm Chuyên môn của Farm Owner, Kho thiết bị, Console thiết bị…) thiếu trong `navigation.i18n.ts` nên bản EN vẫn hiện tiếng Việt | FE_Design §2.9, §6 | web | P2 |
| U-07 | Admin có 2 danh sách thiết bị (`/system/devices` chỉ xem, có vị trí và camera; `/devices` có lệnh, thiếu vị trí và camera): gộp làm một | FARM-FR-009, 013 | web | P1 |
| U-08 | Trang Cài đặt hiện thẻ Thông báo và Telegram cho Admin, trong khi Report 3 §2.4 không cho Admin cấu hình kênh | ALERT-FR-005, 006, 013, Report 3 §2.4 | web | P2 |
| U-09 | Trang lắp đặt (`/onboarding`) không nằm dưới mục menu nào nên tiêu đề header là "SwiftletCare": chuyển sang `/devices/onboarding` | — | web | P2 |
| C-01 | Bỏ 13 route chuyển hướng cũ (`/expert/*`, `/domain-expert/audit-logs`, `alerts`, `disagreements`, `/system-status`) không còn link nào trỏ tới | FE_Design §13 | web | P2 |
| C-02 | Bỏ component không ai dùng: `ExpertPageShell.tsx`, `ExpertAlertKpiCards.tsx` | FE_Design §13 | web | P2 |
| C-03 | Bỏ dependency không dùng: `video.js`, `html5-qrcode` | — | web | P2 |
| C-04 | Trang của Farm Owner và Admin nằm trong `pages/technician/`: chuyển `TechnicianOnboardingPage` → `pages/farm-owner/FarmOwnerDeviceSetupPage`, `TechnicianOtaPage` → `pages/admin/AdminOtaPage` | FE_Design §12 | web | P2 |
| C-05 | `frontend/CLAUDE.md` mô tả cấu trúc cũ (`/expert/*`, `TECHNICIAN`, `OPS_ROLES`) | — | tài liệu | P2 |
| D-01 | Thêm gap G-29 và dòng Change Log vào `project-tracking.md` | `project-tracking.md` §6 | tài liệu | P1 |

**Không sửa (có lý do):**
- Nhóm "Chuyên môn" 10 mục của Farm Owner vẫn hiện khi farm đã có chuyên gia: Report 3 §2.4 cho Farm Owner đọc các mục này (read ¹) và Report 4 §5.4 mở các trang quyết định cho Farm Owner; ẩn đi là mất quyền đọc.
- Gộp hẳn 3 trang Tổng quan (`/dashboard`), Tổng quan trại (`/overview`), Trang trại (`/farms`) là đổi thiết kế, cần cả nhóm thống nhất; đợt này chỉ bỏ phần trùng (U-05).
- `RECOMMENDATION_NEW`: web nhận khuyến nghị mới qua thông báo trong app của Farm Owner (`NOTIFICATION_NEW`, `recommendation.service`).
- `meta.unreadCount` của `GET /alerts` thật ra là số `ACTIVE`; đổi tên sẽ làm hỏng mobile, nên chỉ ghi rõ trong spec.

## 3. Backend và tài liệu

### B-01 — Sự kiện socket của SDD
- Không client nào nghe `ALERT_ESCALATED` hay `WORK_ORDER_UPDATE`. Leo thang (ALERT-FR-017) gửi push và Telegram (`dispatchAlertNotification`), không vào hộp thông báo; Work Order mới, mở lại, giao lại, chưa ai bắt đầu và chờ duyệt báo trong app (`notifyUser` → `NOTIFICATION_NEW`); bắt đầu, duyệt, huỷ không báo ai.
- Sửa Report 4 §7.3 (danh sách sự kiện) và DF-13 (§2.2) cho khớp; tăng phiên bản 2.2.17, ghi Revision History.

### B-02 — Lọc cảnh báo còn hiệu lực
- `GET /alerts` nhận `open=true` (chuỗi `'true'`, `isIn(['true'])`): lọc `status ∈ {ACTIVE, ACKNOWLEDGED}`; đi cùng `status` thì `status` thắng (giống `/work-orders`).
- `api-spec.yaml`: tham số `open`; mô tả `meta.unreadCount` = số `ACTIVE` của bộ lọc.
- Test tích hợp: `open=true` không trả `DISMISSED`, `RESOLVED`.

### B-03 — `backend/CLAUDE.md`
- Dòng Auth: bỏ `register`, `otp/send`, `otp/verify`; thêm `me`, `password`, `forgot-password`, `reset-password`, tạo tài khoản từ lời mời.

## 4. Web — chức năng

### W-01 — Domain Expert đổi giai đoạn nhà
- `FarmOwnerFarmZonesPage`: `HouseStageCard canEdit` = `usePermission('FARM_OWNER', 'DOMAIN_EXPERT')` (backend `PUT /farms/houses/:houseId/stage` đã cho cả hai).

### W-02 — Farm Owner thực hiện Work Order
- `workOrders.api.ts`: `start(id)`, `done(id, { cause?, work_note?, photos[] })` (multipart), `recordChecklist(id, { item_index, result })`.
- `ownerActions`: `OPEN` thêm `start`; `IN_PROGRESS` thêm `done`. Unit test trong `workOrder.utils.test.ts`.
- Popup "Báo xong" mới (`WorkOrderDoneModal`): nguyên nhân (bắt buộc với cảnh báo thiết bị của BR-39, như backend trả 422), ghi chú việc đã làm (≤ 2000 ký tự), ảnh (tổng ≤ 5 ảnh mỗi Work Order, Report 3 §4.5). Danh sách nguyên nhân và loại cảnh báo cần nguyên nhân dùng chung với popup xác nhận cảnh báo (`constants/siteCause.ts`).
- Ngăn chi tiết: phiếu phòng ngừa đang làm có nút "Đạt" / "Hỏng" ở từng mục checklist (OPS-FR-007). Ghi chú và ảnh từng mục vẫn ở mobile.

### W-03 — Cảnh báo chờ xác nhận
- `useUnreadAlertCount` → số `ACTIVE` từ `meta.unreadCount`, không trừ gì.
- Bỏ `alertStore`, `readAlertStore`, `useReadAlerts`, dấu "chưa đọc" và nút "chưa đọc trước" trong popup chuông (đọc/chưa đọc chỉ thuộc tab Thông báo); số chờ xác nhận lấy thẳng từ query (`usePendingAlertTotal`), xoá theo cache khi đăng xuất.
- Trang `/alerts`: bộ lọc trạng thái mặc định "Đang hiệu lực" (`open=true`), thêm "Tất cả"; mô tả thẻ nêu số đang chờ xác nhận.

### W-04 — Badge "Thẩm định cảnh báo"
- `AppSidebar`: badge của mục này chỉ cho Domain Expert (số cảnh báo suy luận chờ kết luận); Farm Owner không có badge ở mục này.

### W-05 — Bước áp cấu hình khi lắp đặt
- Kiểu `SensorNode` thêm `config_sync`.
- `Step5WaitOnline`: với bộ điều khiển, sau khi ONLINE thì đọc lại thiết bị 5 giây/lần tới khi `config_sync = APPLIED` (mốc thứ ba). `UNKNOWN` (firmware trước 2.1.0) thì coi như xong và ghi rõ. Cùng logic với `getConfigApplyStep` của mobile.

### W-06 — Không quét QR trên web
- Bỏ `html5-qrcode` khỏi `package.json` (C-03); Report 4 §3.2 bỏ thư viện này khỏi bảng công nghệ web, §5.4 bỏ câu "a scan in the web console…": web chỉ dán nội dung QR hoặc gõ mã (FARM-FR-003).

### W-07 — Số chim hôm nay tự làm mới
- `useHousesBirdCountCurrent`: `refetchInterval: 30_000`, bằng nhịp AI node gửi số đếm phiên (VISION-FR-006).

### W-08, U-07 — Thiết bị và cảnh báo của Admin
- `/devices` của Admin mở trang thiết bị của Admin (danh sách từ `GET /devices/system-status`: bộ điều khiển và camera kèm farm, nhà, khu vực); ngăn chi tiết có thêm nút Khởi động lại và Đẩy cấu hình (bộ điều khiển), như trang cũ.
- Bỏ mục menu "Trạng thái Node" và route `/system/devices` (route cũ chuyển về `/devices`).
- Trang `/alerts`: Admin lấy vị trí theo thiết bị của cảnh báo từ `system-status` (`useSystemNodeStatus(isAdmin)`), các role khác từ cấu trúc farm như cũ.

### W-09 — Số tài khoản trên tổng quan Admin
- `AdminSystemHealthPage`: ô thứ tư "Tài khoản" = số tài khoản đang hoạt động, dòng phụ là số bị khoá; bỏ khoá `NONE` (buyer) khỏi chú thích kiểu `byRole`.

## 5. Web — giao diện thừa

- **U-01** `ProfilePopover`: còn Cài đặt tài khoản, Quyền riêng tư, Đăng xuất; `SettingsPage` bỏ nút Đăng xuất.
- **U-02** `AppSidebar`: "Role:" qua `navigationLabel`; `AppHeader` bỏ comment mồ côi dòng 81.
- **U-03** `FarmOwnerLayout`: Vận hành = Tổng quan, Cảnh báo, Thiết bị & Cảm biến, Giám sát đàn chim, Sức khỏe nhà yến, Phân tích, Phiếu công việc, Khuyến nghị; Khác = Cài đặt. Dock = 4 mục đầu.
- **U-04** `FarmOwnerLayout` bỏ "Báo cáo & kết luận"; `/domain-expert/reports` chỉ còn Domain Expert (`MENU_ACCESS`, `RequireRole`); viên KPI báo cáo trên thanh chuyên gia dẫn Farm Owner tới `/health?tab=report`.
- **U-05** `FarmOwnerFarmsPage` bỏ `HouseKpiRow`; `EcoHealthCard` hiện "Ổn định" (xanh) khi không nhà nào lỗi, "Có sự cố" (cam) khi có.
- **U-06** `DomainExpertLayout` dùng icon Phosphor như Farm Owner; cùng tên "Lịch sử quyết định", viết hoa kiểu câu ở cả hai menu; `navigation.i18n.ts` có đủ mọi nhãn menu của 4 role.
- **U-08** `SettingsPage`: Admin không có thẻ Thông báo và Telegram.
- **U-09** Route `/devices/onboarding` (Farm Owner); `MENU_ACCESS` thêm dòng trước `/devices`; nút "Lắp đặt" trỏ đường mới.

## 6. Dọn dẹp

- **C-01** `domain-expert.routes.tsx`, `admin.routes.tsx`: bỏ redirect cũ.
- **C-02** Xoá 2 file component.
- **C-03** `npm uninstall video.js html5-qrcode`.
- **C-04** Chuyển 2 trang, sửa import ở `technician.routes.tsx` → route của role sở hữu.
- **C-05** `frontend/CLAUDE.md`: phần "Scope gap", cấu trúc `pages/`, `routes/`, nhóm role, layout cho khớp code.

## 7. Xong khi

- Backend: lint, build:check, Jest qua (test mới của B-02).
- Web: lint, tsc, Vitest, build qua; `roles.test.ts` khớp bảng quyền mới.
- `project-tracking.md` §6 có dòng G-29, §7 có dòng Change Log.

## 8. Sửa sau review của PR #197

- Checklist: bấm đúng kết quả đang có thì không gửi; đổi kết quả thì gửi kèm ghi chú cũ (backend xoá ghi chú khi không gửi `note`).
- Report 4 §7.3, DF-13, changelog 2.2.17: leo thang đi qua push và Telegram, không vào hộp thông báo; chỉ Work Order mới, mở lại, giao lại, chưa ai bắt đầu, chờ duyệt báo trong app.
- Tổng quan Admin: `inactive` chỉ là tài khoản bị khoá (`DELETION_REQUESTED` vẫn đăng nhập được, đếm vào `active`).
- `Step5WaitOnline` đọc trạng thái qua `useSensorNode` / `useHouseCameras` (không gọi `apis/` trong component), đọc lại 10 s/lần (heartbeat 30 s); đã online mà `MISMATCH` hoặc hết giờ chưa áp cấu hình thì báo riêng lỗi cấu hình.
- `SettingsPage` dùng `usePermission`; trang `/alerts` chỉ ghi số chờ xác nhận khi đã tải xong, câu trung tính với Admin; nút lệnh từ xa của Admin khoá khi thiết bị không ONLINE.
- Báo xong Work Order: số ảnh còn lại lấy từ chi tiết phiếu, chỉ JPEG/PNG/WebP, timeout 120 s, câu báo theo trạng thái trả về (`VERIFYING` hoặc `AWAITING_APPROVAL`).
- Bỏ ternary lồng và khối comment nhiều dòng ở dòng mới; `nodeLocation` sang `lib/deviceLocation.ts`; component lắp đặt sang `features/farm-owner/onboarding/`, OTA sang `features/admin/ota/`.
- Tài liệu: `docs/reports/README.md`, `FE_Design_Claude.md` 2.13.0 (12.0, 12.2, 13.14, Phụ lục D, Changelog), `frontend/README.md`, root `CLAUDE.md`, dòng G-29 ghi PR #197.
- Chưa làm: ảnh chụp desktop và mobile, tự kiểm bước 3 của FE_Design 13.13 trên trình duyệt; tên nhánh không theo `<type>/<module>-<role>-<tính-năng>` (đổi phải mở PR mới — chờ nhóm quyết).

## 9. Soát lại giao diện sau khi merge PR #197

Soát lại web trên `develop` sau PR #197, theo Report 3 §2.4 và Report 4 §5.4. **Người làm: Bảo, nhánh `fix/web-all-ui-audit`, một PR.** Màn chuyên gia của Nhi và Tuấn được sửa giống các đợt trước (Bảo làm thay, ghi rõ trong PR).

| ID | Việc | Căn cứ | Ưu tiên |
|---|---|---|---|
| S-01 | `/domain-expert/tuning`: lưu hoặc khôi phục ngưỡng và hệ số mờ lỗi thì không báo gì (thiếu `catch`). Trang tự vẽ toast riêng thay vì dùng `toastStore` | FE_Design 13.5 | P0 |
| S-02 | Chỉ sửa ngưỡng và hệ số mờ ở `/domain-expert/tuning`. Bỏ `ZoneThresholdsModal` (trang chi tiết thiết bị, trang chi tiết khu vực) và `FuzzyTuningModal` (`/analytics`); các nút đó mở `/domain-expert/tuning` đúng khu vực. Trang tuning thêm những gì modal có mà trang chưa có: cờ lọc nhiễu đầu vào (ENV-FR-022); Farm Owner ở farm có chuyên gia thì gửi gợi ý cho chuyên gia duyệt, người được quyết thì áp gợi ý qua API của EXPERT-FR-011. Khoảng giá trị và giá trị mặc định lấy từ `FUZZY_TUNING_LIMITS` và `DEFAULT_FUZZY_TUNING`, không gõ lại | ENV-FR-020…022, EXPERT-FR-011, BR-22 | P1 |
| S-03 | Domain Expert mở `/devices` thì thấy trang của Farm Technician; đổi sang trang Thiết bị của Farm Owner ở chế độ chỉ xem | FE_Design 12.0 c, Report 4 §5.4 | P1 |
| S-04 | Cảnh báo suy luận và gợi ý hệ số đều bị gọi là "AI", trong khi cảnh báo chạy theo luật và gợi ý là hồi quy (ANALYTICS-FR-010). Ô gợi ý tự bịa giá trị (`?? 8`, `?? 6`…) khi API thiếu số | ANALYTICS-FR-010, FE_Design 6.1 | P1 |
| S-05 | Hàng đợi việc ghi "Ưu tiên P0", trong khi hệ thống chỉ có 3 mức P1–P3 | FE_Design 2.4 | P2 |
| S-06 | Mã yêu cầu `VISION-FR-018` hiện ra trên màn Vòng đếm camera | FE_Design 13.16 | P2 |
| S-07 | Các màn chuyên gia không đổi sang tiếng Anh: chỉ 9/36 component có i18n. Dùng `src/i18n` (khoá là câu tiếng Việt), bản dịch để ở file riêng `i18n/en.expert.ts` | FE_Design §6 | P1 |
| S-08 | `TechnicianDevicesPage` còn code của Farm Owner và Admin (kích hoạt, dời Zone, thay, gỡ thiết bị, đẩy cấu hình; gọi `deviceApi` ngay trong component), trong khi hai role này đã có trang riêng. Bỏ hết nhánh đó cùng `ReplaceDeviceModal` và `DecommissionDeviceModal`. Thêm thứ Farm Technician còn thiếu: danh sách bài loa ru chỉ xem | Report 4 §5.4, FE_Design 13.1 | P1 |
| S-09 | `TechnicianLayout` còn khối comment nhiều dòng nhắc `/onboarding` cũ | FE_Design 13 | P2 |

Xong khi lint, tsc, Vitest và build của web đều qua, và `frontend/CLAUDE.md`, FE_Design (Phụ lục D, Changelog) cùng dòng G-29 đã ghi các thay đổi.

**Tiến độ (19/11/2026): đã làm hết S-01…S-09 trên nhánh `fix/web-all-ui-audit`.** Lint, tsc, Vitest (384 test) và build của web đều qua; chưa chạy thử trên trình duyệt. Làm thêm khi sửa: nhãn mức `MEDIUM` ở trang thẩm định ghi "Trung bình" (trước ghi nhầm "Cao"); khung chọn ở Hàng đợi việc không còn tự điền "Tầng 1" khi chưa chọn khu vực.
