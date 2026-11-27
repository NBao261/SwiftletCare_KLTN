# FE_Design_Claude.md
### Hệ thống thiết kế Frontend — SwiftletCare Ops Console

> Nguồn sự thật duy nhất (single source of truth) về thiết kế FE của SwiftletCare. Mọi trang, component, màu sắc khi code (kể cả qua Claude Code) phải bám theo file này. Nếu thiếu quy định cho 1 tình huống mới — bổ sung vào đây trước, không tự sáng tạo lệch chuẩn.

**Phiên bản:** 2.19.0 · **Cập nhật:** 24/11/2026 · **Thay thế:** v2.18.0 · **Theo:** Report 3 – SRS 3.0.0 (`docs/reports/report3-srs.md`) và Report 4 – SDD (`docs/reports/report4-sdd.md`)

---

## Quy tắc viết code TypeScript/TSX — đọc trước khi code

> Áp dụng cho mọi file `.ts`/`.tsx` **tạo mới hoặc viết lại** trong `frontend/src/`. File cũ chưa theo (VD chưa có dấu chấm phẩy) chỉ đổi khi sửa cả file, không trộn 2 kiểu trong cùng 1 file. Công cụ tự bắt các quy tắc này (Prettier + ESLint + pre-commit hook) **chưa cài** — cấu hình đích ở 13.15; tới khi cài, người viết và người review tự kiểm.

### TypeScript/TSX Coding Standards & Guidelines

#### 1. Code Style & Formatting
- **Indentation:** Use 2 spaces for indentation. Never use tabs.
- **Line Length:** Keep lines under 100 characters where possible. Wrap long JSX attribute lists onto new lines, with one attribute per line and the closing bracket on its own line.
- **Semicolons:** Always use semicolons at the end of statements.
- **Quotes:** Use single quotes (`'`) for strings in TypeScript/JavaScript, and double quotes (`"`) for JSX attributes.
- **Trailing Commas:** Use trailing commas in multiline object literals, arrays, and type definitions.

#### 2. Line Breaks & Spacing
- **Blank Lines:**
  - Leave one blank line between import groups (external vs. internal) and above `return` statements if complex.
  - Leave one blank line between methods inside a class and between exported functions.
- **Control Flow:** Place opening braces (`{`) on the same line as the statement (`if`, `for`, `function`), with a space before it.

#### 3. Naming Conventions
- **Components & Classes:** Use `PascalCase` (e.g., `UserProfileCard`, `AuthContext`).
- **Variables & Functions:** Use `camelCase` (e.g., `fetchUserData`, `isActive`).
- **Constants:** Use `UPPER_CAMEL_CASE` or `UPPER_SNAKE_CASE` for global/compile-time constants (e.g., `API_BASE_URL`, `MAX_RETRIES`).
- **Types & Interfaces:** Use `PascalCase`. Do not prefix interfaces with `I` (e.g., use `User` instead of `IUser`). Use `Props` or `State` suffixes for component-specific types (e.g., `ButtonProps`).
- **Boolean Variables:** Prefix with verbs like `is`, `has`, `should`, or `can` (e.g., `isLoading`, `hasPermission`).

#### 4. TypeScript & TSX Best Practices
- **Explicit Typing:** Always type function return types and component props explicitly. Avoid using `any`; use `unknown` or precise type unions instead.
- **Props Destructuring:** Destructure props directly in the component parameter definition for better readability.
- **Event Handlers:** Prefix handler functions with `handle` (e.g., `handleClick`, `handleSubmit`) and props with `on` (e.g., `onClick`, `onSubmit`).
- **Nullability:** Handle optional values safely using optional chaining (`?.`) and nullish coalescing (`??`).

### Bổ sung bắt buộc của dự án

| # | Quy tắc |
|---|---|
| 1 | **Tên rõ nghĩa, không viết tắt** — file, hàm, biến, prop đều viết đủ chữ: `deviceName` (không `dn`/`devName`), `alertList` (không `alList`), `useTranslation` (không `useT`). Ngoại lệ duy nhất: chữ viết tắt đã là thuật ngữ (`id`, `url`, `api`, `ota`, `rtsp`). Tham số callback cũng đặt tên đủ: `alerts.map(alert => …)`, không `a => …`. |
| 2 | **Comment chỉ 1 dòng** dạng `// <tên hoặc tính năng>` đặt trên khối code, chart, button, hàm: `// Bảng nhật ký cảnh báo`, `// Nút tạo trang trại`. Không viết khối `/** … */` nhiều dòng, không giải thích lại code làm gì. |
| 3 | **Độ phức tạp ≤ O(n)** cho mỗi lần render/xử lý: tra cứu theo id dùng `Map` dựng 1 lần (`useMemo`), không `array.find` lồng trong `array.map` (O(n²)). Sắp xếp O(n log n) chỉ khi bắt buộc và không lặp mỗi render. Phân trang ở server khi danh sách dài (13.10). |
| 4 | **Logic ở mức Junior đọc được**: mỗi hàm làm 1 việc, ưu tiên `if` tuần tự thay cho ternary lồng nhau, không viết một dòng nhồi nhiều phép biến đổi; tách biến trung gian có tên rõ. |
| 5 | **Cấm tự tạo dữ liệu giả trong code** — xem mục 7. Khi được yêu cầu dữ liệu giả: đặt trong `src/data/<tên>.data.ts` rồi import vào, không viết thẳng mảng/số giả trong component, hook hay api. |
| 6 | **Tự kiểm sau mỗi lần code** — xem 13.13: đọc lại toàn bộ luồng thao tác và code của role vừa sửa (route → page → hook → api → backend), đối chiếu quyền theo 12.0. |

> **Ký hiệu ⏳** trong tài liệu: file/màn đó **chưa có trên `develop`** (đang ở nhánh ghi kèm). Quy tắc gắn ⏳ chỉ bắt buộc từ khi nhánh đó merge — trước đó **không import** các file này, dùng phần đang có trên `develop` được ghi ngay cạnh.

---

## 0. Changelog

### v2.18.0 → v2.19.0 (menu đồng bộ giữa các vai trò)

| # | Thay đổi |
|---|---|
| 1 | **Một danh mục menu cho cả 4 vai trò** (`components/layouts/menuCatalog.ts`) thay 4 file `<Role>Layout.tsx`: cùng một trang thì cùng tên, icon (Phosphor), nhóm tab ở mọi vai trò; mỗi vai trò chỉ thấy mục, tab `MENU_ACCESS` cho phép. Bốn nhóm cố định Theo dõi · Vận hành · Chuyên môn · Hệ thống; nhóm việc chính của vai trò đứng đầu. 12.5 viết lại. |
| 2 | Nhóm chỉ đọc ghi "(chỉ đọc)" và thu gọn được (Chuyên gia: Theo dõi, Vận hành); nhóm ít dùng thu gọn được (Chuyên môn của chủ nhà yến, kỹ thuật viên). Bỏ giới hạn "≤ 12 mục": tiêu chí là không cuộn ở 1440×900. |
| 3 | Tên thống nhất: Thiết bị (bỏ "Thiết bị & Cảm biến", "Danh sách thiết bị"), Trang trại (bỏ "Nhà được giao" ở menu), Sức khoẻ & báo cáo; Chuyên môn của chủ nhà yến tách thành các mục như của chuyên gia thay một mục 9 tab. Icon tự vẽ của menu Admin đổi sang Phosphor. |
| 4 | **Quản trị viên:** menu gồm Tổng quan hệ thống · Cảnh báo · Thiết bị (tab Kho thiết bị, Cập nhật firmware) · Người dùng · Nhật ký · Cấu hình mặc định (`with` và `title` trong `ROLE_PLAN`). Tổng quan hệ thống có 4 ô chỉ để xem, không ô nào bấm được; ô Cảnh báo đang mở đếm cảnh báo còn hiệu lực (`open=true`) và hiện `--` khi chưa tải hoặc lỗi. Tải firmware chỉ ở trang Cập nhật firmware; kho thiết bị chỉ liệt kê. |

### v2.17.0 → v2.18.0 (web đủ việc của Farm Technician, G-33, `docs/reports/todo-web-all-roles-1123.md`)

| # | Thay đổi |
|---|---|
| 1 | **12.0 a, cột Technician** viết lại theo Report 3 §2.4: Farm Technician làm trên web mọi việc ở nhà được giao (phiếu công việc kèm ảnh, đánh giá ngày, thu hoạch chờ xác nhận, điều khiển tay, vòng đếm, trả lời kiểm tra tại chỗ), đọc tham số; không lắp thiết bị, không sửa tham số. |
| 2 | **12.8 nhóm role** theo code: thêm `FARM_WORK_ROLES`, `RELAY_CONTROL_ROLES`; `HARVEST_ROLES` có kỹ thuật viên; bỏ các nhóm đích cũ không còn (`OPS_ROLES`, `SETUP_ROLES`, `EXPERT_ONLY`, `FARM_OWNER_ONLY`). |

### v2.16.0 → v2.17.0 (bố cục Farm Owner, `docs/reports/todo-ui-layout-1120.md` §5)

| # | Thay đổi |
|---|---|
| 1 | **Menu Farm Owner 10 mục, 3 nhóm** (Theo dõi · Vận hành · Chuyên môn): Tổng quan (1 nhà một lúc: camera, cảm biến, điều khiển; Điều khiển tay là mục riêng; So sánh nhà là nhóm thứ tư của Phân tích, `/overview` chuyển sang đó); Công việc = Phiếu công việc · Bảo trì định kỳ · Khuyến nghị; Chuyên môn = 9 trang `/domain-expert/*`. Badge: Cảnh báo, Công việc (phiếu chờ duyệt), Chuyên môn (cảnh báo chờ kết luận ở trang trại chưa có chuyên gia, BR-22), gom ở `hooks/common/useMenuBadges`. Tab đang mở là tab có đường dẫn dài nhất chứa trang (`activeTabPath`), nên tab con không sáng cả tab cha. |
| 2 | **Tổng quan:** 4 ô KPI (Nhà cần chú ý · Cảnh báo chưa xử lý, dòng phụ số chờ xác nhận · Thiết bị mất kết nối (chỉ OFFLINE) · Phiếu chờ duyệt) · lưới thẻ nhà (số đo từng Zone tô theo ngưỡng kèm icon, chế độ tự động/tay, giai đoạn, trạng thái hôm nay, cảnh báo chưa xử lý và phiếu đang mở, chim về, ANALYTICS-FR-015; ô KPI và thẻ cùng lấy số từ overview) · Việc cần làm. Không ảnh, không dải tình trạng, không bảng cảnh báo lặp trang Cảnh báo. "Ổn định" chỉ khi nhà có ít nhất 1 bộ điều khiển, mọi bộ online và số đo trong ngưỡng (`houseLiveStatus`), ô "Nhà cần chú ý" đếm theo cùng luật. Dock điện thoại có mục "Thêm" (`Drawer side="bottom"`) mở các mục còn lại. |
| 3 | **So sánh nhà** là nhóm thứ tư của Phân tích (`/analytics?tab=houses`): một ma trận, bấm tên cột để sắp xếp (tình hình từng nhà đã ở trang Tổng quan). |
| 4 | **Thanh phạm vi chỉ ở header** ở mọi khổ màn; trang không vẽ bản sao `ScopeFilter` cho điện thoại. Điện thoại: khung lọc thành lưới 2 cột, hàng tab xuống dòng. |
| 5 | **Biểu đồ:** đường đếm chim nối thẳng các điểm (`tension: 0`); so sánh Zone chỉ còn bảng (không cột từ 0); phân bổ loại tổ là thanh ngang một màu có số kg, % ghi bên cạnh (không vòng tổng 100 %). |

### v2.15.0 → v2.16.0 (khung chung cho 4 role, `docs/reports/todo-ui-layout-1120.md` §4)

| # | Thay đổi |
|---|---|
| 1 | **Sidebar và header hết "đóng băng" (4.1 viết lại).** Bỏ khối "Xin chào · Vai trò" và nút Đăng xuất ở sidebar; bỏ nhóm "Khác": Cài đặt chỉ ở menu avatar. Menu avatar (tên, email, vai trò · Cài đặt · Quyền riêng tư · Đăng xuất) hiện ở mọi khổ màn và là chỗ đăng xuất duy nhất. Nhóm menu thu gọn được (`MenuSection.collapsible`). |
| 2 | **Tên trang là `<h1>`** (gốc breadcrumb trên header); trang trong khung không tự đặt `h1`. |
| 3 | **Không chữ nào dưới 13px:** `text-caption`, `text-xs` và `.label-caption` lên 13px; bỏ `text-[10px]`, `text-[11px]`. |
| 4 | **Một nút tô đậm mỗi màn:** chip lọc, chip sắp xếp, tab và nút chọn đoạn đang chọn là pill trắng (`bg-white shadow-card`), không tô charcoal. |
| 5 | **Vùng bấm điện thoại ≥ 44px:** `Button sm`, `SelectMenu`, `FilterChip`, `SortChips`, `SearchInput` cao 44px dưới `sm`, desktop giữ 36px. |
| 6 | **Phạm vi tự chọn:** `scopeLevelOf(path)` trong `constants/roles.ts`; trang cần một trang trại / nhà / Zone thì `useScopeFilter` tự chọn bậc có dữ liệu và `ScopeFilter` bỏ mục "Tất cả" ở bậc đó. Thanh phạm vi dưới 1280px xuống hàng riêng dưới header. |
| 7 | **Không ảnh trang trí:** bỏ `pageHeroStore`, `usePageHero` và ảnh nền Tổng quan (4.2). |
| 8 | **Mô tả card một dòng** `text-body text-graphite`; giải thích dài vào nút (i) (`ui/InfoTip`, prop `help` của `SectionCard`, `FarmFrame`). |
| 9 | **Bảng thành thẻ ở điện thoại:** `DataTable` / `FixedRowsTable` nhận `mobileCard`. |
| 10 | **Một ô KPI cho 4 role:** `components/common/KpiTile` thay `ui/StatTile` và `features/farm-owner/farms/KpiTile`. |
| 11 | **Trang Cài đặt theo role** (bảng ở 4.1): một cột; kênh cảnh báo theo mức (Thông báo đẩy · Telegram) cho Chủ nhà yến và Kỹ thuật viên, giờ im lặng 24 giờ chỉ Chủ nhà yến, chuyên gia chỉ có dòng "thông báo trong ứng dụng"; mỗi khối một nút lưu, thành nút chính khi có thay đổi. |

### v2.14.0 → v2.15.0 (bố cục Farm Technician và Admin, `docs/reports/todo-ui-layout-1120.md` §3.3, §3.4)

| # | Thay đổi |
|---|---|
| 1 | **Mục menu có tab.** `MenuItem.tabs` (`{ label, path }[]`) gộp nhiều trang vào một mục menu: sidebar sáng mục đó ở mọi trang con, header lấy tên mục làm tên trang, `common/SectionTabs` vẽ hàng tab pill trên nội dung (lọc bằng `canAccessPath`). Route cũ giữ nguyên. Ngoại lệ thứ ba của vùng đóng băng 4.1. Admin: Người dùng = Tài khoản (`/users`) + Yêu cầu xoá tài khoản (`/account-requests`). |
| 2 | **Bảng:** `FixedRowsTable` và `DataTable minRows` chỉ đệm dòng trống khi có từ 2 trang trở lên; 1 trang thì bảng cao vừa dữ liệu, bảng rỗng cao 4 dòng. Bỏ cột STT ở mọi bảng, kể cả Nhật ký hệ thống (dòng đã xếp mới nhất trước và có giờ ở cột Thời gian). |
| 3 | **Một card một trang thì card không lặp tên trang:** `SectionCard` cho bỏ `title`, chỉ còn dòng mô tả (Cảnh báo, Kho thiết bị, OTA Firmware, Yêu cầu xoá tài khoản). Trang OTA vào khung `SectionCard` như các trang Admin khác. |
| 4 | **Farm Technician:** menu Cảnh báo · Thiết bị & Cảm biến · Nhà được giao · Cài đặt, trang chủ là `/alerts` (MF-02). Trang Thiết bị dùng khung lọc `ScopeFilter` trên header như trang Farm Owner (bỏ card "Vị trí:"); trang Nhà được giao mở Thiết bị đã lọc đúng nhà qua `zoneStore.setScopePath`, không đưa mã vào URL. |
| 5 | **Bảng thuật ngữ 6.2 viết lại** (người · thiết bị · chuyên môn, có cột "Không dùng") và **mục mới 6.4 Cách viết chữ tiếng Việt**: dấu kiểu mới (khoẻ, xoá, huỷ), "tỷ lệ", Chủ nhà yến, Kỹ thuật viên, Zone viết hoa, Bộ điều khiển, Camera đếm chim (thay "Nút AI"), Mất kết nối (thay Offline), Kết nối cuối (thay heartbeat), Kiểm chứng cảnh báo và Kết luận (thay thẩm định, phán quyết), Điều khiển tay (thay SCADA); không gạch dài nối câu, không "Vui lòng", không tên kỹ thuật. Sửa toàn bộ chữ hiển thị của web (khoảng 550 chuỗi, khoá `en.ts` đổi theo, tên loại cảnh báo viết lại). |
| 6 | **Kiểm tự động thuật ngữ:** `src/i18n/wording.test.ts` quét mọi chuỗi tiếng Việt trong `src` (trừ test) và báo chữ thuộc cột "Không dùng" của 6.2. |

### v2.13.0 → v2.14.0 (soát lại sau PR #197, G-29, `todo-audit-1119.md` §9)

| # | Thay đổi |
|---|---|
| 1 | **Ngưỡng và hệ số mờ chỉ sửa ở `/domain-expert/tuning`.** Bỏ `ZoneThresholdsModal` và `FuzzyTuningModal`; nút ở trang khu vực, trang thiết bị và `/analytics` mở trang tuning đúng Zone qua `useOpenZoneTuning()` (`hooks/shared/`). Trang tuning có cờ lọc nhiễu (ENV-FR-022) và nút gợi ý theo quyền (áp ngay hoặc gửi chuyên gia duyệt, EXPERT-FR-011). |
| 2 | **Thiết bị:** Domain Expert mở `/devices` thấy trang của Farm Owner ở chế độ chỉ xem; `TechnicianDevicesPage` chỉ còn của Farm Technician (khởi động lại, danh sách bài loa chỉ xem). Farm Owner dời, thay, gỡ bộ điều khiển ở menu "Thao tác khác" của thẻ thiết bị trên trang chi tiết (FARM-FR-007b, 008; `MoveControllerModal`, `ReplaceControllerModal`, `RemoveControllerModal`). |
| 3 | **i18n:** các màn chuyên gia dùng Hệ 1 (`src/i18n`), bản dịch ở `i18n/en.expert.ts` (không trùng khoá với `en.ts`, `en.expert.test.ts` kiểm); mức độ cảnh báo dùng `SeverityBadge` và 3 cấp của 2.4. Không gọi cảnh báo suy luận hay gợi ý hệ số là "AI"; không hiện mã FR/BR/G hay tên enum trên màn hình. |

### v2.12.0 → v2.13.0 (đợt soát 19/11/2026, G-29, PR #197)

| # | Thay đổi |
|---|---|
| 1 | **Lắp thiết bị** là màn của Farm Owner ở `/devices/onboarding` (`pages/farm-owner/FarmOwnerDeviceSetupPage`, component ở `features/farm-owner/onboarding/`): dán nội dung QR hoặc gõ mã, 3 bước của FARM-FR-012; quét QR chỉ ở mobile, bỏ `html5-qrcode`. **OTA** là màn của Admin (`pages/admin/AdminOtaPage`, `features/admin/ota/`). Admin có một danh sách thiết bị ở `/devices` (bỏ `/system/devices`). 12.0, 12.2, 13.14 sửa theo. |
| 2 | **Cảnh báo:** số trên chuông và menu là số `ACTIVE` từ `usePendingAlertTotal()` (`hooks/shared/useAlerts`); bỏ `alertStore`, `readAlertStore`, `useReadAlerts` — đọc/chưa đọc chỉ thuộc hộp thông báo (ALERT-FR-007). Nguyên nhân tại chỗ dùng chung ở `constants/siteCause.ts`; vị trí thiết bị của Admin ở `lib/deviceLocation.ts`. Phụ lục D sửa theo. |
| 3 | **Menu:** mọi nhãn menu phải có trong `constants/navigation.i18n.ts`; cùng một trang mang cùng tên ở mọi role; Farm Owner đọc báo cáo và ngày lệch ở `/health`, `/domain-expert/reports` chỉ của chuyên gia. |

### v2.11.0 → v2.12.0 (đã xoá code ticket, SLA, vùng, Sales Staff — PR #106)

| # | Thay đổi |
|---|---|
| 1 | **Đã xoá** màn, component, API, hook, type, hằng số của ticket, chat ticket, SLA, lịch bảo trì, vùng Technician, màn farm của Admin và role `SALES_STAFF` (PR #100–#107). Các mục 2.4, 2.10, 5.5, 6.2, 6.3, 7, 12.0, 12.2, 12.7, 13.4, 13.14, 13.16 và Phụ lục D bỏ phần mô tả code đã xoá. |
| 2 | **2.4:** mức độ cảnh báo vẫn 3 cấp, kiểu `SeverityLevel`; `PriorityBadge`, `constants/priority.ts` bỏ — `SeverityBadge` là badge duy nhất. **2.10** chỉ còn `Stepper` cho luồng nhiều bước. |
| 3 | **Form farm:** ô vị trí ("Dùng vị trí hiện tại" + vĩ độ/kinh độ, bắt buộc khi tạo) thay ô khu vực; validator `validations/farm-owner/farm.validation.ts`. Thuật ngữ "Vị trí · Vĩ độ · Kinh độ" thêm vào 6.2. |
| 4 | **Admin** chỉ tạo tài khoản Kỹ thuật viên (AUTH-FR-005c); "Yêu cầu tài khoản" chỉ còn yêu cầu xoá. 12.0 c dòng 6, 7, 9, 11 đánh dấu xong. |

### v2.10.0 → v2.11.0 (bỏ ticket, SLA, vùng — Report 3 §8, BM03 dòng 9)

| # | Thay đổi |
|---|---|
| 1 | **Ticket, chat ticket, SLA, lịch bảo trì, vùng của Technician và việc Admin quản lý farm ra ngoài phạm vi** (Report 3 §8). Màn và component ticket còn trong code chỉ được gỡ, không thêm hay sửa rộng; đã gỡ ở PR #100–#107. Các mục 2.4, 2.10, 6.2, 7, 12.2, 13.4 và Phụ lục D vẫn tả code hiện có cho tới khi gỡ xong. |
| 2 | **12.0 viết lại:** Technician là vai trò kỹ thuật, thấy nhà/tầng/thiết bị và cảnh báo thiết bị của **mọi farm**, không xem dữ liệu môi trường; đăng ký, dời, gỡ thiết bị, lệnh từ xa, OTA; **không** bật/tắt relay, không sửa ngưỡng/hệ số, không xác nhận cảnh báo; Farm Owner được báo mỗi thao tác thiết bị của Technician. Admin không tạo, xem hay quản lý farm. 12.0 c thêm dòng gỡ ticket và màn farm của Admin. |
| 3 | **12.8 `OPS_ROLES`:** nút relay và xác nhận cảnh báo chỉ Farm Owner thấy. **13.4:** phòng `ticket:<id>` và sự kiện chat ticket sẽ gỡ. **13.14:** thêm nợ ticket/vùng. Cảnh báo `ACTIVE` quá 15 phút giờ được **gửi lại** cho Farm Owner (ALERT-FR-015), không còn sinh ticket; loại cảnh báo mới `MAINTENANCE_DUE` (ALERT-FR-016) cần nhãn ở `enumLabels.i18n.ts` khi backend có. |

### v2.9.0 → v2.10.0 (theo Report 3 – SRS 3.0.0 và Report 4 – SDD)

| # | Thay đổi |
|---|---|
| 1 | **Căn cứ đổi sang Report 3/Report 4** (`docs/reports/`). Chỗ code còn lệch với Report 3/Report 4 ghi ở `docs/reports/project-tracking.md` §6. |
| 2 | **12.0 viết lại theo Report 3 §2.4:** Farm Owner tự thiết lập thiết bị bằng QR (SF-01), Technician chỉ làm khi có ticket lắp đặt; Technician không sửa ngưỡng/hệ số mờ; Technician chỉ can thiệp tay và xác nhận cảnh báo khi đang giữ ticket; Admin không xác nhận cảnh báo, không can thiệp tay; farm chưa có chuyên gia thì Farm Owner quyết thay (BR-22); chuyên gia duyệt thay đổi của chủ farm (EXPERT-FR-010) và là người duy nhất áp gợi ý hệ số (EXPERT-FR-011); chủ farm xem lịch sử quyết định của chuyên gia (EXPERT-FR-009). |
| 3 | **12.8 nhóm role:** thêm `SETUP_ROLES` (Farm Owner · Technician); kiểm chứng cảnh báo, tham số phát hiện, vòng đếm, lịch đếm chuyển sang `FARM_SIDE_ROLES` (Farm Owner ghi khi farm chưa có chuyên gia); `EXPERT_ONLY` chỉ còn kết luận, duyệt thay đổi, duyệt đề xuất; `HARVEST_ROLES` đích bỏ Admin. |
| 4 | **2.5, 2.6.1:** trạng thái thiết bị theo vòng đời Report 3 §6.6 (`ERROR`/`DEGRADED` không dùng); thêm trạng thái cảnh báo `DISMISSED` (Đã bác bỏ); NH3/CO2 là ngưỡng cảnh báo của Zone; bỏ "Quá lạnh (sưởi)"; mốc 20 giây của nhãn bộ điều khiển và các mốc của điểm cân bằng Zone là hằng số tự chọn của giao diện (Report 3 §4.5). |
| 5 | **6.2 thuật ngữ** thêm nhóm thiết lập thiết bị, kiểm chứng, đồng bộ cấu hình, vòng đếm, lịch đếm; "Bộ điều khiển / Controller" thay chữ PLC; "Loa dẫn dụ / Attractant speaker" theo Report 3. |
| 6 | **Mục 7** cập nhật trạng thái API theo backend hiện tại và thêm các màn Report 3 mới (duyệt thay đổi, đề xuất hệ số, lịch sử chuyên gia, gói bằng chứng, đồng bộ cấu hình, lịch đếm, thiết lập thiết bị). **13.4** đủ sự kiện socket theo Report 4 §7.3. **13.14** thêm nợ theo Report 3. |
| 7 | **MF-06 (Report 3 bản sau):** bảng 12.0 a thêm trạng thái sức khỏe theo ngày, đánh giá ngày, báo cáo ngày/tuần/tháng và tải PDF/CSV; mục 7 và 6.2 thêm các dòng tương ứng. |
| 8 | **Sau PR #93:** mục 7 ghi các màn Farm Owner mới (thiết bị, live stream qua WHEP, phân tích theo nhà yến, báo cáo sức khỏe, lịch sử can thiệp tay) và màn Domain Expert của PR #91; 12.0 c dòng 8 (Marketplace) đã gỡ. |

### v2.8.0 → v2.9.0

| # | Thay đổi |
|---|---|
| 1 | **Thông số chưa có dữ liệu hiện `_`** (hằng số `NO_VALUE` trong `constants/display.ts`), không hiện số `0` thay cho số chưa đo/chưa tính được, không dùng `—`/`--` cho giá trị trống. Áp toàn role Farm Owner, kể cả popup/drawer. Xem 6.1. |
| 2 | **Biểu đồ không có dữ liệu vẫn hiện khung biểu đồ** (lưới ngang + trục), không cột/đường, không số trục dọc, không tooltip/chú thích, chữ thông báo ở giữa — dùng `ui/ChartEmptyFrame` (Chart.js) hoặc giữ `CartesianGrid` + trục của recharts. Không thay biểu đồ bằng `EmptyState`. Xem 8. |
| 3 | **Khung số liệu không có dữ liệu vẫn hiện đủ khung**: ô KPI hiện `_`, các mục (VD loại yến ở khung phân bổ) ghi "Chưa có dữ liệu", màu xám. `EmptyState` chỉ dùng cho lỗi tải (kèm nút Thử lại) hoặc khi chưa có farm/nhà/Zone nào để xem. |

### v2.7.0 → v2.8.0

| # | Thay đổi |
|---|---|
| 1 | **13.15 Công cụ tự kiểm** — Prettier, rule ESLint, husky + lint-staged chạy trước mỗi commit. |
| 2 | **13.5 Error Boundary** — lỗi khi render chỉ làm hỏng khu vực đó, không trắng cả app. |
| 3 | **13.16 Không lộ thông tin nội bộ** — không hiện id/mã/enum thô trên giao diện và URL; lỗi API gộp theo nhóm, mỗi nhóm 1 câu chung, không hiện chi tiết mã lỗi. |
| 4 | **6.1 Định dạng ngày, giờ, số** — `DD/MM/YYYY`, `HH:mm`, giờ Việt Nam, số lẻ, giá trị trống. |
| 5 | **2.9 Icon** — được dùng 2 thư viện (Phosphor, Lucide) + `ui/icons.tsx`, nhưng chung 1 thang cỡ và màu token. |
| 6 | **4.4 Responsive, 4.5 Thang z-index, 4.6 Chuyển động** — theo giá trị đang chạy trong code. |
| 7 | **6.2 Bảng thuật ngữ VI/EN, 6.3 Quy ước key i18n.** |
| 8 | **5.5 Chỉ báo realtime** — mẫu "● Trực tiếp / Tự làm mới" cho mọi màn dùng socket. |
| 9 | **13.17 Chiến lược kiểm thử** và **quy ước tên nhánh** (13.13). |
| 10 | **Phụ lục D — Danh mục dùng chung cho mọi role**: màu/nhãn/trạng thái, component `ui/` + `common/`, `lib/`, hook/API/store/validator, dữ liệu giả — kèm đường dẫn; tra trước khi viết mới. Thêm **2.10** trạng thái ticket + thanh tiến độ dùng chung. |

### v2.6.1 → v2.7.0

| # | Thay đổi |
|---|---|
| 1 | **Thêm phần "Quy tắc viết code TypeScript/TSX" lên đầu tài liệu** + 6 quy tắc bổ sung (tên không viết tắt, comment 1 dòng, ≤ O(n), logic dễ đọc, dữ liệu giả vào `src/data/`, tự kiểm luồng sau mỗi lần code). |
| 2 | **UI Farm Owner là mẫu chung cho mọi role** (Admin, Technician, Domain Expert và role thêm sau); chỉ Landing Page và Mobile thiết kế riêng. Thông số bo góc, khung, bảng, nút ghi ở **1.1**. Bo góc thật trong `tailwind.config.ts` (`xl` 16px · `2xl` 20px · `3xl` 28px) thắng các con số cũ ở 4.3/11. |
| 3 | **Mức độ cảnh báo chỉ còn 3 cấp: Khẩn cấp · Cao · Thường** (= P1/P2/P3), dùng chung với ưu tiên ticket. Backend vẫn gửi 4 giá trị (ALERT-FR-001) — giao diện gộp `CRITICAL` vào Khẩn cấp. Cấu hình đích ở `constants/severity.ts` + `constants/severity.i18n.ts` (đã có trên develop từ PR #79). Mục 2.4 viết lại, 2.6.1 chỉ trỏ về. |
| 4 | **Thêm 12.0 — Bản đồ role theo SRS** (mỗi role có gì, dùng chung/riêng, ai nắm quyền) và bảng kiểm tra luồng kiểu BA giữa code hiện tại và SRS §4.4. |
| 5 | Sửa chỗ lệch: cây 12.2 (thêm file đang có + `src/data/`), mục 6 (danh sách từ điển), mục 7 (chat ticket đã có API thật), 13.7 (câu màu bị ghép sai), 13.12 (comment 1 dòng), 13.13 (7 file test, tự kiểm), 13.14 (nợ i18n). |

### v2.6.0 → v2.6.1

| # | Thay đổi |
|---|---|
| 1 | **Thêm lớp `src/i18n/` (i18next + react-i18next), chạy song song với hệ từ điển `useTranslation`.** Khoá là chính câu tiếng Việt; bản dịch ở `i18n/en.ts`. Cả 2 hệ đọc chung `languageStore` nên 1 nút VI/EN đổi cả hai. Mục 6 ghi lại trạng thái và quy tắc chọn hệ. |
| 2 | **`components/ui/` được import `@/i18n`** (chỉ để dịch chữ, không biết domain). Sửa 12.2, 12.6, 12.11, 12.12; 12.10 bỏ `i18n/` khỏi ví dụ "lớp mới" vì đã có. |

### v2.5.0 → v2.6.0 (theo SRS v2.0.0, sau Review 1)

> Khi file này mâu thuẫn với Report 3 (`docs/reports/report3-srs.md`, yêu cầu) hoặc Report 4 (`docs/reports/report4-sdd.md`, thiết kế), hai Report thắng và file này phải sửa theo.

| # | Thay đổi |
|---|---|
| 1 | **Mô hình actor đích: Admin · Farm Owner · Domain Expert · Technician.** Domain Expert (role `DOMAIN_EXPERT`, cả farm, không có `zone_ids`) thay Farm Operator — Farm Operator chưa từng có code FE nên mọi chỗ nhắc `farm-operator/`/`FarmOperatorLayout` được thay bằng `domain-expert/`/`DomainExpertLayout`. Quyền theo SRS 4.4: chuyên gia **đọc** dashboard/analytics/live stream/thu hoạch, **kiểm chứng** cảnh báo suy luận, **viết kết luận**, **chỉnh** ngưỡng, hệ số mờ và tham số phát hiện (EXPERT-FR-008); **không** relay, không ticket, không ghi thu hoạch, không xác nhận (acknowledge) cảnh báo. Mục 12.1, 12.2, 12.4, 12.8, 12.9 viết lại theo trạng thái đích; nhóm role mới ở 12.8. |
| 2 | **Bỏ Marketplace/Buyer** (chỉ giữ ghi nhận thu hoạch), **bỏ** cảnh báo thiên địch, relay sưởi, kênh Zalo/SMS. Cây 12.2 không còn `MarketplacePage`, `ListingDetailPage`, `marketplace.api`, `useMarketplace`; `pages/` gốc còn 2 trang. |
| 3 | **Màn mới (đích, chưa có code):** Farm Owner — lịch sử can thiệp tay, thẻ tỷ lệ thời gian tự động, đọc kết luận của chuyên gia, live stream có khung + số đếm trực tiếp; Domain Expert — báo cáo sức khỏe Zone, kiểm chứng cảnh báo, duyệt gợi ý hệ số, chỉnh tham số phát hiện. `NOISE_ANOMALY` thay `BIRD_PANIC`, hiển thị kèm số đếm chim cùng khoảng thời gian. NH3/CO2 chỉ cảnh báo: UI ghi rõ là ngưỡng cảnh báo do chuyên gia đặt, không gắn với quạt. Mục 7 đã có các dòng tương ứng. |
| 4 | **Code hiện tại chưa theo kịp** — còn `sales-staff/`, role `SALES_STAFF`, trang Marketplace, chưa có `DOMAIN_EXPERT`. Ghi vào nợ 13.14: PR mới **không** được mở rộng các phần này, chỉ gỡ/thay. |
| 5 | **CI đã chạy lint + test + build** cho `frontend/` (`.github/workflows/ci.yml`); 13.13 và 12.8 sửa theo. Repo đã có test vitest (5 file), bỏ câu "chưa có test FE". |
| 6 | **Thêm 3 token màu trạng thái** cho Dashboard Farm Owner: `safetyOrange` `#FF7426` (lỗi thiết bị, mức HIGH, giá trị vượt ngưỡng), `infoBlue` `#4A89EB` (cảnh báo "Mới"), `statusYellow` `#FFE033` (PLC "Đang chờ kết nối"). Xem 2.3 và 2.6.1. |
| 7 | **Ghi lại bảng màu trạng thái đang áp dụng ở Dashboard**: 6 ô cảm biến (icon + 3 trạng thái màu), 3 trạng thái xử lý cảnh báo, mức độ cảnh báo, PLC. Xem 2.6.1. |
| 8 | **Kính mờ (glassmorphism)**: AppHeader kính trong; `SelectMenu`, `ActionsMenu`, popup thông báo và khung xem trước ngôn ngữ dùng kính mờ nền trắng theo thông số glass-card (class `.glass-panel`). Thêm token bóng `shadow-glass`. Xem 5.2.1. |

### v2.4.0 → v2.5.0
| # | Thay đổi |
|---|---|
| 1 | **Đổi mô hình actor theo SRS v1.23.0: thêm Farm Operator, bỏ Sales Staff + Module SALES.** Farm Operator (role `FARM_OPERATOR`) là nhân viên vận hành do Primary Owner mời, phạm vi cả farm hoặc một số Zone; được giám sát, xác nhận cảnh báo, relay/lịch loa, ngưỡng Zone, ticket + chat, nhập thu hoạch — không sửa/xoá farm, không quản lý thành viên, không tạo House/Zone, không đăng bán. Các mục 7, 8, 12, 13 viết lại theo **trạng thái đích**: bucket `farm-operator/` thay `sales-staff/`, `FarmOperatorLayout` thay `SalesStaffLayout`, thêm nhóm role `FARM_SIDE_ROLES`, bỏ dòng Module SALES. |
| 2 | **Code frontend chưa theo kịp** — hiện vẫn còn `pages/sales-staff/`, `SalesStaffLayout`, `salesStaffRoutes`, role `SALES_STAFF` trong `types/`, và chưa có layout/route/menu cho Operator. Backend đã xong (SRS §5 AUTH-FR-004/005); việc chuyển code FE là follow-up riêng. |
| 3 | **Bỏ chữ in hoa (`uppercase`) ở nhãn nhỏ, chuyển sang sentence case.** Tiếng Việt in hoa ở 11px chồng dấu (Ế, Ữ, Ặ) nên khó đọc, và nhãn in hoa ở mọi section làm giao diện đơn điệu. `.label-caption` (`index.css`) đổi thành 12px/16px, 600, không `uppercase`, không giãn chữ. Line-height giữ 16px nên layout không xô. Tiêu đề cột `DataTable` dùng chung `.label-caption`. Ngoại lệ giữ in hoa: nhãn nhóm menu sidebar (đóng băng, mục 4.1) và banner chế độ SCADA (nhãn trạng thái, không phải tiêu đề). Xem 2.8. |
| 4 | **Nút "Hủy lọc" đổi từ Danger sang Secondary** ở 4 trang Admin (Người dùng, Ticket, Trang trại, Audit log). Xoá bộ lọc không phá huỷ dữ liệu, trong khi Danger chỉ dành cho hành động phá huỷ/khẩn cấp (5.1). |

### v2.3.1 → v2.4.0
| # | Thay đổi |
|---|---|
| 1 | **Thêm mục 13 — Quy tắc code bắt buộc khi review PR** (luồng dữ liệu, React Query, Zustand, socket, xử lý lỗi, TypeScript, style, phân quyền, hợp đồng API, hiệu năng, a11y, checklist trước PR). Mỗi quy tắc gắn mức **[Bắt buộc]** (vi phạm → Request changes) hoặc **[Nên]** (góp ý). Rút ra từ code đang chạy — code hiện tại đã đạt tất cả quy tắc [Bắt buộc] trừ các nợ đã liệt kê ở 13.14. |
| 2 | **Đối chiếu lại với code thật và sửa chỗ lệch:** mục 6 (i18n chưa cài — ghi rõ trạng thái), mục 7 (SYSTEM-FR-001/002/003 đã xong), mục 9 (`Timeline`/`ThresholdConfigCard` chưa tồn tại), 12.2 (thêm `audioTracks`, `validations/technician/`, hook còn thiếu), 12.7 (số file `shared/`), 12.8 (ESLint đã có cấu hình), 12.9/12.11 (component trong `features/` **không** mang tiền tố role — khớp toàn bộ file đang có). |

### v2.3.0 → v2.3.1
| # | Thay đổi |
|---|---|
| 1 | **Mục 5.4 đổi từ `<MockDataNotice />` (component riêng) sang 1 dòng `<p>` italic viết trực tiếp tại nơi dùng.** Nhãn "dữ liệu giả" chỉ có 1 dòng chữ, không có logic/props gì đáng để tách file riêng trong `components/ui/` — tạo file cho nó là dư thừa. |

### v2.2.0 → v2.3.0
| # | Thay đổi |
|---|---|
| 1 | **Thêm mục 12 — Cấu trúc thư mục Frontend, tổ chức theo role.** Quy định file mới đặt ở đâu: cây thư mục đầy đủ, bảng quyết định 2 câu hỏi, quy ước đặt tên `[Role][ChứcNăng]Page`, ba tầng component `ui`/`common`/`features`, mỗi role một layout với menu khai ngay trong file, các ngoại lệ đã thống nhất và checklist thêm màn hình mới. Không sửa đổi quy định thiết kế nào của các mục 1–11. |
| 2 | **Thêm 12.9–12.11 — quy tắc đặt tên file, quy tắc sinh thư mục mới, và bảng đối chiếu với quy ước doanh nghiệp.** Chốt công thức `[Role][ChứcNăng]` PascalCase cho component/page, giải thích vì sao `hooks/`, `apis/`, `types/`, `validations/`, `routes/` cố ý KHÔNG dùng PascalCase. Không đổi tên file nào trong mã nguồn. |

### v2.1.0 → v2.2.0
| # | Thay đổi |
|---|---|
| 1 | **Bỏ hoàn toàn 2 khối blur trang trí (lime + cam)** khỏi nền cố định. `.content-canvas` giờ là **1 màu phẳng duy nhất `#EAEAEA`**, không còn pseudo-element `::before/::after`. Cấu trúc 2 lớp "nền cố định / nội dung cuộn riêng" (mục 4.2) vẫn giữ nguyên — chỉ bỏ phần trang trí bên trong lớp nền, không bỏ cơ chế fixed-canvas + scroll riêng. |

### v2.0.0 → v2.1.0
| # | Thay đổi |
|---|---|
| 1 | **Xoá bỏ hoàn toàn màu "Ink" `#111728`** — đã xác minh bằng số: màu này có **hue 224° (xanh dương/navy), saturation 40%**, hoàn toàn lệch tông so với phần còn lại của hệ thống (mọi màu khác đều là warm-neutral hue ~26–30° hoặc các hue lime/cam/đỏ đã định nghĩa). Đây chính xác là điều người dùng phát hiện: *"Web không hề có màu #111728 ám xanh dương"*. |
| 2 | **Gộp "Ink" vào chung 1 thang "Gray" ấm (warm neutral)** duy nhất, neo bằng 4 mã màu mới: `WHITE #FFFFFF`, `WARM GRAY #878380`, `GRAPHITE #4E4A46`, `CHARCOAL #27231F`, `BLACK #000000` — tất cả cùng hue ~28°, không còn 2 hệ màu tối song song (Ink vs Gray) như v2.0.0, giảm rủi ro lệch tông về sau. |
| 3 | `LIME MIST #ECFFA9` xác nhận lại giá trị chính xác cho vai trò "xanh nền bề mặt" (trước là `#F0FEB3`, chênh lệch không đáng kể — cập nhật về đúng mã mới). |
| 4 | Mọi nơi từng dùng `--ink-850` (button Primary, text-primary, modal overlay, shadow tint, sidebar/topbar qua token) nay trỏ về `--gray-900` (= Charcoal). `--gray-950` (= Black) dành riêng cho nhu cầu tương phản tuyệt đối (nếu có). |

### v1.0.0 → v2.0.0
Xem tóm tắt ở Phụ lục C.

---

## 1. Tổng quan & Nguyên tắc thiết kế

SwiftletCare Ops Console là phần mềm vận hành kỹ thuật (giám sát cảm biến, bộ điều khiển ESP32, AI vision, cảnh báo, chuyên gia kiểm chứng, nhân sự) — ưu tiên **đọc số liệu nhanh, chính xác, đáng tin cậy** hơn trang trí.

1. **Nền xám là sân khấu, nền trắng là diễn viên.** `#EAEAEA` (canvas) không bao giờ là nơi đặt nội dung trực tiếp — mọi text/số liệu/control đều nằm trong 1 khung trắng nổi lên trên.
2. **Không pha màu ngoài hệ thống — tuyệt đối.** Kể cả các sắc xám/đen cũng phải nằm trong đúng 1 hue ấm (~28°) đã chốt ở mục 2 — không dùng lại bất kỳ mã xám/đen "mặc định của framework" (VD `#000`, `#333`, Tailwind `slate/zinc` mặc định) vì các mã đó thường có tông lạnh khác hue hệ thống.
3. **Sidebar/Topbar dùng chung cho 4 role, chỉ đổi theo 4.1.** Menu của mọi role lấy từ một danh mục (`menuCatalog.ts`, 12.5); khung (sidebar, header, menu avatar, dock) chỉ sửa ở `components/layouts/` và áp cho cả 4 role cùng lúc.
4. **Không có gì "giả" mà không được gắn nhãn.** Số liệu chưa có API thật phải tự khai báo (mục 7).
5. **Một ngôn ngữ chữ, một hệ bo góc, một hệ shadow, một hệ xám** — dùng xuyên suốt, không phát sinh biến thể lẻ tẻ giữa các trang/role (mục 9).

### 1.1. UI Farm Owner là mẫu chung cho cả hệ thống

**[Bắt buộc]** Mọi màn của Admin, Technician, Domain Expert (và role thêm sau) dựng theo đúng khung, bo góc, khoảng cách, bảng, nút, badge của màn Farm Owner hiện tại. Trước khi làm màn mới cho role khác: mở màn Farm Owner cùng loại (Dashboard, Cấu trúc Farm, Thu hoạch, Thiết bị) và dùng lại component của nó. **Chỉ Landing Page và Mobile (`mobile/`) được thiết kế riêng.**

| Thành phần | Chuẩn (lấy từ code Farm Owner) | Nguồn |
|---|---|---|
| Khung trang | Cột nội dung `max-w-[1400px] mx-auto px-6 lg:px-8`; các khối trong trang xếp `flex flex-col gap-5` (Dashboard, chi tiết) hoặc `gap-6` (danh sách) | `layouts/AppShell.tsx` |
| Bo góc (token thật) | `rounded-xl` 16px · `rounded-2xl` 20px · `rounded-3xl` 28px · `rounded-full` | `tailwind.config.ts` |
| Card | `Card size="md"` = `rounded-2xl p-5`; `Card size="lg"` = `rounded-3xl p-6`; nền trắng + `shadow-card` | `ui/Card.tsx` |
| Khung section | Card lớn, tiêu đề `text-h2 text-charcoal` + mô tả 1 dòng `text-body text-graphite` (giải thích dài vào prop `help`, nút (i)), nút bên phải header, không icon vuông | `features/farm-owner/farms/FarmFrame.tsx` |
| Ô chỉ số (KPI) | `rounded-2xl border border-warmGray/15 bg-white p-4 shadow-card`, nhãn `.label-caption` 13px, icon tròn 28px, số `text-2xl font-extrabold`, dòng phụ 13px; hàng KPI `grid grid-cols-2 lg:grid-cols-4`, 4 ô một hàng, không khung bao | `common/KpiTile.tsx` (mọi role) |
| Bảng | **Chỉ dùng `DataTable`** (hoặc `FixedRowsTable` — bảng danh sách 10 dòng mỗi trang; có từ 2 trang trở lên thì trang cuối đệm dòng trống để khung không nhảy khi lật trang, 1 trang thì bảng cao vừa dữ liệu, bảng rỗng cao 4 dòng; `DataTable minRows` theo cùng quy tắc; không có cột STT; dữ liệu phân trang ở server thì truyền `serverPagination={{ page, total, onChange }}`; **ngoại lệ:** bảng đợt thu ở trang Thu hoạch nằm trong cột 8/12 cạnh khung phân bổ loại tổ nên dùng `DataTable visibleRows={4} fillHeight`: màn xl hai khung khoá cứng cao `556px`, bảng lấp phần còn lại của khung (màn hẹp cao cố định 4 dòng), dòng còn lại cuộn dọc với tiêu đề cột đứng yên, không phân trang, không đệm dòng trống, `minTableWidth` 640, ô đệm ngang `px-3`): khung `rounded-2xl border-warmGray/15 shadow-card`, header `bg-warmGray/5`, `table-fixed` chia cột theo %, hover dòng `bg-warmGray/5` (chỉ nổi nền, chữ không đổi màu), ô 2 tầng (dòng chính đậm + dòng phụ xám). **Thao tác qua menu ⋯ ở cột cuối (`ActionsMenu`: Xem chi tiết, …) — bấm vào dòng không chuyển trang** | `ui/DataTable.tsx`; mẫu cột: `features/farm-owner/harvest/HarvestTable.tsx` |
| Phân trang | `Pagination variant="full"` đặt dưới bảng, nút tròn `h-9` | `ui/Pagination.tsx` |
| Lọc + tìm | Bảng danh sách: `SelectMenu` cho từng điều kiện (Trạng thái kèm số đếm, Mức độ, Trang trại…) + `ClearFiltersButton tone="danger" count` bên trái — cùng cao `h-9`, ô lọc rộng theo chữ `min-w-[80px] max-w-[220px]` (dài hơn thì cắt "…"), `px-3.5 text-xs font-medium`, cách nhau `gap-2`; `SearchInput` `lg:w-72` bên phải. `FilterChip` chỉ dùng khi ít lựa chọn và cần thấy hết cùng lúc (VD chọn khoảng thời gian, thời hạn điều khiển tay) | `ui/SelectMenu.tsx`, `ui/ClearFiltersButton.tsx`, `ui/SearchInput.tsx` |
| Nút | `Button` bo tròn hoàn toàn: `sm` `h-9 px-4` (dưới `sm` cao `h-11` = 44px), `md` `h-12 px-5`; nút phụ trong card dùng `CAPSULE_ACTION_CLASS`; nút "Chi tiết" dùng `DETAIL_BUTTON_CLASS` | `ui/Button.tsx`, `farmStructure.constants.ts`, `harvest.constants.ts` |
| Badge | Cỡ `px-2.5 py-0.5 text-small`; mức độ theo 2.4; trạng thái theo bảng 2.6.1 | `common/SeverityBadge` |
| Khung cảnh báo | Nền cam rất nhạt `bg-orange-50` + viền dày `border-2 border-orange-300`, **không** vạch màu ở cạnh; dòng bên trong nền trắng `bg-white border-orange-100`. Không dùng nền `orange-100` trở lên cho khung — trùng màu badge mức độ Cao làm badge chìm | `features/farm-owner/dashboard/ScadaNodeCard.tsx`, `features/farm-owner/farms/StructureEditModal.tsx` |
| Ô nhập | Class `.input`: `rounded-xl border-warmGray/25 px-4 py-2.5` | `src/index.css` |
| Popup | `Modal`/`ConfirmModal`/`NoteActionModal`: `rounded-3xl p-6 shadow-popover`, nền mờ theo 5.2. **Popup form nhiều ô**: ngang `className="max-w-3xl"`, 2 cột `md:grid-cols-[15rem_1fr]` — trái: lựa chọn loại (thẻ chọn: đang chọn `border-accent-600 bg-accent-600`, icon ô `bg-charcoal text-accent-600`) + ghi chú `bg-warmGray/5`; phải: các ô nhập. Chân popup `border-t`, canh phải: Secondary "Huỷ" + Primary "Gửi…" (không nút full width). Popup xác nhận ngắn vẫn dọc `max-w-sm/md` | `ui/Modal.tsx` |
| Trạng thái rỗng/lỗi/tải | **Bảng rỗng:** `FixedRowsTable emptyContent={<TableEmptyState title description? />}` — hình minh hoạ chuẩn (vòng tròn mờ, chồng 3 thẻ giả với thẻ giữa viền `accent-600`, 6 icon lucide thiết bị/kỹ thuật/chim yến quanh) + tiêu đề `text-h3` + mô tả `text-small`, nằm giữa khung bảng. Khối không phải bảng: `EmptyState` (có nút Thử lại khi lỗi). Đang tải: `LoadingSkeleton` đúng chiều cao khối thật | `common/TableEmptyState.tsx`, `ui/FixedRowsTable.tsx`, `ui/` |

Component Farm Owner nằm trong `features/farm-owner/` (VD `FarmFrame`) mà role thứ hai cần dùng → **dời lên `components/common/`** theo 12.3 trong PR đó, không chép thành bản thứ hai. Màu chỉ lấy từ token mục 2; màu riêng Dashboard Farm Owner ở 2.6.1 là màu chuẩn cho trạng thái tương ứng ở mọi role.

---

## 2. Bảng màu hệ thống (Design Tokens — Màu)

### 2.1. Các màu neo (anchor)

| Vai trò | Hex | Ghi chú |
|---|---|---|
| Nền chính toàn app | `#EAEAEA` | Canvas cố định phía sau mọi trang nội dung |
| Cam cảnh báo/quá nhiệt | `#ED8F50` | Giá trị vượt ngưỡng, quá nhiệt (mức độ cảnh báo dùng bảng 2.4) |
| Đỏ cảnh báo/nguy hiểm | `#D53F35` | CRITICAL, badge thông báo |
| **Xanh chanh — `accent-600`** (`success`) | `#B5D32C` | **Màu xanh chanh DUY NHẤT của hệ thống [Bắt buộc]** — mọi chỗ trước đây dùng xanh chanh (`#D5E688`, LIME MIST `#ECFFA9`, `limeMist`, `lime-*`, `accent-100…300` làm nền nhạt) **đều thay bằng màu này**, chữ trên nền là `charcoal`. Mẫu: badge "Ổn định" (Badge `positive`). Dùng cho online / thành công / thiết bị bật, vòng icon mục đang chọn ở sidebar, thẻ đang chọn, cột biểu đồ chính, loại Yến trắng |
| Xanh đậm — **`accent-700`** | `#89A022` | **Dùng tự do** khi cần thêm một sắc xanh (nhóm thứ 2 trong biểu đồ, viền/chữ nhấn trên nền trắng…); chữ trên nền là `charcoal`. Trang Thu hoạch: loại Yến hồng |
| Rêu — **`accent-900`** | `#414C10` | **Dùng tự do** khi cần sắc xanh tối (nhóm thứ 3 trong biểu đồ, chữ xanh đậm trên nền nhạt…); chữ trên nền là trắng. Trang Thu hoạch: loại Yến huyết |
| ~~Xanh nền bề mặt — LIME MIST `#ECFFA9`~~ | `#B5D32C` | **Đã bỏ màu cũ:** alias `limeMist` trong `tailwind.config.ts` giờ trỏ cùng mã `#B5D32C` với `accent-600`, nên mọi chỗ còn ghi `limeMist` (Stepper `soft`, popover thông báo, màn Admin/Technician…) đã hiện đúng xanh chanh mới. Code mới viết `accent-600`, không dùng tên `limeMist` |
| Trắng — **WHITE** | `#FFFFFF` | Sidebar, khung nổi |
| Xám ấm trung — **WARM GRAY** | `#878380` | Text phụ, icon mờ |
| Xám ấm đậm — **GRAPHITE** | `#4E4A46` | Text đậm phụ, icon neutral đậm |
| Đen ấm — **CHARCOAL** | `#27231F` | **Text chính, bề mặt tối chính** — thay thế hoàn toàn `#111728` |
| Đen tuyệt đối — **BLACK** | `#000000` | Dự phòng cho nhu cầu tương phản tối đa |

**Quy tắc phân bổ màu theo ý nghĩa [Bắt buộc]:**
- **Cam** (`safetyOrange` / thang `orange`) chỉ xuất hiện khi có cảnh báo, lỗi thiết bị hoặc tình huống khẩn cấp.
- **Xanh chanh** (`success` = `accent-600` `#B5D32C`, màu xanh chanh duy nhất) chỉ xuất hiện khi thiết bị đang bật, online hoặc ở trạng thái bình thường. Ngoại lệ có chủ đích: bộ 3 màu loại yến (`accent-600` trắng · `accent-700` hồng · `accent-900` huyết) dùng cho badge, biểu đồ và khung phân bổ ở trang Thu hoạch (`harvest.constants.ts`, `chartTheme.ts`: `accentGreen` · `accentDeep` · `accentMoss`). `accent-700` và `accent-900` dùng tự do cho nhu cầu riêng của từng màn.
- **Mọi số liệu báo cáo, thống kê tĩnh còn lại** (ô KPI, icon của ô KPI, huy hiệu so sánh tăng/giảm) dùng tông xám/trắng: nền `warmGray/10`, chữ và icon `graphite`/`charcoal`, viền `warmGray/15`. Mẫu: ô KPI trang Trang trại (`KpiTile` tone `neutral`) và khối "Tổng quan thu hoạch" (`HarvestStatsCards`).

**Bằng chứng loại bỏ `#111728`:**

| Màu | Hue | Saturation | Kết luận |
|---|---|---|---|
| `#111728` (cũ) | **224°** (xanh dương) | 40% | Lệch hoàn toàn khỏi hệ thống — đây là lỗi cần sửa |
| `#27231F` Charcoal | 30° (ấm) | 11% | |
| `#4E4A46` Graphite | 30° (ấm) | 5% | Cùng 1 họ hue ấm — nhất quán |
| `#878380` Warm Gray | 26° (ấm) | 3% | |

### 2.2. Thang màu đầy đủ

```css
/* GRAY — 1 thang xám ấm DUY NHẤT, thay cho cặp Gray+Ink cũ. Hue ~28° xuyên suốt. */
--gray-0:   #FFFFFF;   /* = WHITE */
--gray-50:  #F9F9F9;
--gray-100: #F0F0F0;
--gray-200: #EAEAEA;   /* = neo "nền chính toàn app" — giữ nguyên giá trị đã chốt, không nội suy */
--gray-300: #C5C4C3;   /* border trên nền trắng */
--gray-400: #A5A3A1;   /* icon/text disabled */
--gray-500: #878380;   /* = WARM GRAY — text phụ (secondary) */
--gray-600: #6D6865;
--gray-700: #4E4A46;   /* = GRAPHITE — icon neutral đậm, text đậm phụ */
--gray-800: #393430;
--gray-900: #27231F;   /* = CHARCOAL — TEXT CHÍNH, bề mặt tối chính (thay #111728) */
--gray-950: #000000;   /* = BLACK — dự phòng tương phản tối đa */

/* LIME — thang cũ, KHÔNG dùng cho màn mới: mọi xanh chanh dùng --accent-600 (#B5D32C) — xem 2.1 */
--lime-50:  #FDFFF3; --lime-100: #FAFFE6; --lime-200: #F5FFD0;
--lime-300: #ECFFA9;  /* = LIME MIST — "xanh nền bề mặt" */
--lime-400: #DFFD73; --lime-500: #D2F93A; --lime-600: #BEEC08;
--lime-700: #8FAF08; --lime-800: #677E09; --lime-900: #445407;

/* ACCENT — xanh thương hiệu: --accent-600 #B5D32C là xanh chanh duy nhất; --accent-700, --accent-900 dùng tự do */
--accent-50:  #F9FBEE; --accent-100: #F0F6D5; --accent-200: #E6F0B7;
--accent-300: #D5E688;  /* = màu neo — 42926A cũ */
--accent-400: #CCE170; --accent-500: #C6DD5D; --accent-600: #B5D32C;
--accent-700: #89A022; --accent-800: #627218; --accent-900: #414C10;

/* ORANGE — cảnh báo mức vừa/quá nhiệt, neo tại #ED8F50 */
--orange-50: #FDF3ED; --orange-100: #FAE1D1; --orange-200: #F6CAAC;
--orange-300: #F3B287; --orange-400: #EF9A62;
--orange-500: #ED8F50;  /* = màu neo — "mức độ quá nhiệt" */
--orange-600: #E87121; --orange-700: #B95613; --orange-800: #8B400E; --orange-900: #612D0A;

/* RED — cảnh báo/nguy hiểm, neo tại #D53F35 */
--red-50: #FBEFEE; --red-100: #F6D7D5; --red-200: #EFB7B3;
--red-300: #E68F89; --red-400: #DC5E56;
--red-500: #D53F35;  /* = màu neo — "thông báo hoặc cảnh báo" */
--red-600: #B12E25; --red-700: #87231C; --red-800: #611914; --red-900: #44110E;
```

### 2.3. Token ngữ nghĩa

```css
--bg-canvas:          var(--gray-200);  /* #EAEAEA */
--bg-surface:          #FFFFFF;
--bg-surface-sunken:   var(--gray-50);

--text-primary:   var(--gray-900);   /* = Charcoal #27231F — KHÔNG còn dùng #111728 */
--text-secondary: var(--gray-500);   /* = Warm Gray #878380 */
--text-disabled:  var(--gray-400);
--text-on-dark:   #FFFFFF;

--border-default: var(--gray-300);
--border-subtle:  var(--gray-200);

--success:  var(--accent-600);
--brand:    var(--accent-300);
--warning:  var(--orange-500);
--danger:   var(--red-500);
--badge-default: var(--red-500);

/* v2.6.0 — trạng thái ở Dashboard Farm Owner (xem 2.6.1). Tên Tailwind trong ngoặc */
--safety-orange: #FF7426;  /* (safetyOrange) lỗi thiết bị, mức HIGH, giá trị vượt ngưỡng */
--status-new:    #4A89EB;  /* (infoBlue) trạng thái cảnh báo "Mới" */
--status-wait:   #FFE033;  /* (statusYellow) PLC "Đang chờ kết nối", dùng nền 70% + chữ charcoal */

--focus-ring: rgba(213, 230, 136, 0.55);  /* accent-300 mờ */
```

> **Không tạo token `--ink-*` mới.** Bất kỳ chỗ nào cần "màu đậm/quyền lực" (nút Primary, avatar, logo box, nav active...) đều dùng `--gray-900` (Charcoal) — kể cả bên trong sidebar/topbar, thông qua token, không hardcode lại `#111728`.

### 2.4. Mức độ cảnh báo — 4 cấp như BR-15

**Giao diện có 4 cấp đúng 4 mức của backend: Khẩn cấp · Cao · Trung bình · Thấp** (`SeverityLevel` = `P1 | P2 | P3 | P4`, `types/alert.types.ts`; `CRITICAL | HIGH | MEDIUM | LOW`, ALERT-FR-001, BR-15). Từ G-32 (quyết định Q-07, `docs/reports/todo-audit-1121.md`) không gộp mức nữa: mỗi mức được gửi khác nhau (`CRITICAL` tới cả Farm Owner và thợ ngay và vượt giờ im lặng; `HIGH` tới thợ trước rồi lên Farm Owner sau 15 phút; `CRITICAL` và `HIGH` được gửi lại khi chưa ai xác nhận; `MEDIUM` không gửi lại; `LOW` là thông tin; ALERT-FR-006, 015, 017), và trang Cài đặt chọn kênh theo đúng 4 mức đó. Lý do gộp 3 cấp lúc trước (dùng chung với ưu tiên ticket) đã hết khi bỏ ticket.

**Nguồn duy nhất — chỉ import, không khai lại ở nơi khác:**

| File | Xuất ra | Nội dung |
|---|---|---|
| `src/constants/severity.ts` | `LEVELS`, `SEVERITY_TO_LEVEL`, `severityQueryOf()`, `LEVEL_BADGE_CLASS`, `LEVEL_BADGE_MUTED_CLASS`, `LEVEL_BADGE_SIZE`, `isAlertFinished()` | Thứ tự 4 cấp, bảng mức backend ↔ cấp, màu badge, cỡ badge |
| `src/constants/severity.i18n.ts` | `levelDict`, `severityLabels()` | Nhãn VI/EN của 4 cấp |
| `src/components/common/SeverityBadge.tsx` | badge mức cảnh báo | Nhận `severity` từ backend, đổi qua `SEVERITY_TO_LEVEL`; props `isMuted?`, `className?` |

| Cấp | Mức backend | Nhãn VI / EN | Màu badge |
|---|---|---|---|
| P1 | `CRITICAL` | Khẩn cấp / Critical | nền `alertRed` đặc, chữ trắng |
| P2 | `HIGH` | Cao / High | nền `safetyOrange` đặc, chữ trắng |
| P3 | `MEDIUM` | Trung bình / Medium | nền `orange-100`, chữ `orange-800` |
| P4 | `LOW` | Thấp / Low | nền `warmGray/15`, chữ `warmGray` |

- **[Bắt buộc]** Đếm, lọc, nhóm cảnh báo theo cấp dùng `LEVELS` và `SEVERITY_TO_LEVEL` (VD bộ lọc mức độ ở trang Cảnh báo, ô đếm theo cấp). Không tự viết `if (severity === 'CRITICAL' || ...)`.
- **[Bắt buộc]** Câu chữ nhắc tên cấp lấy nhãn từ `levelDict` truyền vào làm tham số (VD "Lỗi {urgent} chưa ai xác nhận sau 15 phút…"), không gõ lại "Khẩn cấp".
- Đổi màu/nhãn một cấp → sửa đúng 1 dòng trong `severity.ts`/`severity.i18n.ts`; mọi badge đổi theo.
- **Cảnh báo đã xử lý** (`RESOLVED`) → badge mức độ về xám: `<SeverityBadge isMuted={isAlertFinished(alert.status)} />`, màu `LEVEL_BADGE_MUTED_CLASS` (= màu cấp Thấp). Cột/nhãn ghi **"Mức độ"**.
- Cảnh báo `CRITICAL`/`HIGH` chưa xác nhận sau 15 phút được backend **gửi lại** cho người nhận đầu (ALERT-FR-015) = cấp Khẩn cấp và Cao.

### 2.5. Trạng thái an toàn / thiết bị

| Trạng thái thiết bị (Report 3 §6.6) | Nghĩa | Hex |
|---|---|---|
| `ONLINE` | Đang gửi heartbeat | `--accent-600` `#B5D32C` |
| `PENDING` | Đã đăng ký, chưa có heartbeat đầu tiên (đang thiết lập, SF-01) | `--orange-500` `#ED8F50` |
| `OFFLINE` | Mất kết nối: không có tín hiệu (bộ điều khiển 30 giây, camera đếm chim 90 giây — BR-10) | `--gray-400` `#A5A3A1` |
| Đã gỡ (`decommissioned_at`) | Không còn hoạt động, lịch sử vẫn xem được | `--gray-400` `#A5A3A1` + chữ "Đã gỡ" |

`ERROR` và `DEGRADED` có trong enum backend nhưng không chỗ nào gán (Report 3 §6.6) — giao diện không dựng màu/nhãn riêng cho hai giá trị này. Màu đỏ `--red-500` `#D53F35` dành cho giá trị vượt ngưỡng và lỗi, không phải trạng thái thiết bị.

### 2.6. Nguyên tắc màu dữ liệu cảm biến (không đổi so với v2.0.0)

Màu **không** gắn với loại cảm biến — gắn với **trạng thái an toàn hiện tại**: an toàn → `accent-600`, gần ngưỡng → `orange-500`, vượt ngưỡng → `red-500`. Loại cảm biến nhận diện bằng icon + label: Nhiệt độ `Thermometer`, Độ ẩm `Droplets`, Ánh sáng `Sun`, CO2 `Wind`, NH3 `FlaskConical`, Âm thanh `Volume2`. Series so sánh/ngữ cảnh trong chart đa-đường dùng thang `gray-300 → gray-700` (giờ đã là xám ấm, không còn ám xanh).

> **Ngoại lệ:** Dashboard Farm Owner đang áp dụng bảng icon và màu ở 2.6.1 (CO2 dùng đám mây, âm thanh dùng sóng âm, vượt ngưỡng dùng cam thay vì đỏ, thêm trạng thái "thiết bị không hoạt động").

### 2.6.1. Dashboard Farm Owner — màu trạng thái đang áp dụng (v2.6.0)

**Màu cam và màu trạng thái dùng trên Dashboard**

| Token Tailwind | Hex | Dùng ở |
|---|---|---|
| `safetyOrange` | `#FF7426` | Thẻ nhà ở Tổng quan: nhãn "Cần chú ý", số đo vượt ngưỡng (kèm icon). Bảng *Cảnh báo*: nhãn mức HIGH, giá trị vượt ngưỡng (in đậm) |
| `climateOrange` (= `orange-500`) | `#ED8F50` | Ô cảm biến vượt ngưỡng; relay "Quá nóng"; thanh điểm cân bằng Zone 65–79 (`ZoneBalanceCard`; dải chỉ để hiển thị — xem ghi chú dưới bảng b) |
| `orange-100` / `orange-800` | `#FAE1D1` / `#8B400E` | Nhãn mức MEDIUM ở bảng *Cảnh báo* |
| `infoBlue` | `#4A89EB` | Trạng thái cảnh báo "Mới" |
| `statusYellow` | `#FFE033` | Nhãn "Bộ điều khiển: Đang chờ kết nối" (code cũ ghi "PLC") (nền 70%, chữ charcoal) |

**a) 6 chỉ số cảm biến — icon**

| Chỉ số | Icon | Đơn vị | Ngưỡng an toàn (từ Zone) |
|---|---|---|---|
| Nhiệt độ | `IconTemp` (nhiệt kế, `ui/icons.tsx`) | °C | `temp_min`–`temp_max` |
| Độ ẩm | `Droplets` (lucide, hai giọt nước — cùng icon relay Phun sương) | % | `humidity_min`–`humidity_max` |
| Ánh sáng | `IconLight` (mặt trời) | lux | < `light_max` |
| NH3 | `FlaskConical` (lucide, bình thí nghiệm) | ppm | < `nh3_max` — ngưỡng **cảnh báo** của Zone, chưa có chuẩn cho nhà yến, không điều khiển quạt (ALERT-FR-012, BR-02) |
| CO2 | `IconCloud` (đám mây) | ppm | < `co2_max` — như NH3 |
| Âm thanh | `IconSound` (sóng âm) | dB | Không có ngưỡng |

**b) 3 trạng thái màu của ô cảm biến** — "thiết bị hoạt động" = có ít nhất 1 SensorNode `ONLINE` trong phạm vi đang chọn.

| Trạng thái | Điều kiện | Ô | Icon | Số đo | Dòng dưới |
|---|---|---|---|---|---|
| **Cam** — vượt ngưỡng | Thiết bị hoạt động **và** giá trị ngoài ngưỡng | Nền `climateOrange/[0.06]`, viền `climateOrange/40` | Nền `climateOrange` đặc, icon trắng | `climateOrange` | "Ngoài ngưỡng an toàn" |
| **Xanh** — trong ngưỡng | Thiết bị hoạt động **và** giá trị trong ngưỡng | Nền trắng, viền `warmGray/15` | Nền `warmGray/10`, icon `success` (`#B5D32C`) | charcoal | "An toàn …" |
| **Xám đen** — thiết bị không hoạt động | Không có SensorNode `ONLINE` (offline / chưa kết nối) | Nền trắng | Nền `warmGray/10`, icon charcoal | charcoal (số đo cuối, chỉ để tham khảo) | "An toàn …" |
| Không có dữ liệu | Chưa có số đo, đang tải, hoặc chọn "Tất cả nhà yến" | Nền trắng | Icon charcoal | `_` màu `warmGray` | Trống khi chọn "Tất cả" |

Âm thanh không có ngưỡng nên icon luôn charcoal. Relay ở khung *Phân hệ điều khiển*: BẬT `success`, TẮT `warmGray`, "Quá nóng" (thông gió) `climateOrange`, không có dữ liệu hoặc chọn "Tất cả" hiện `_`. Hệ thống không có sưởi (Report 3 §8): nhãn "Quá lạnh (sưởi)" còn trong code là nợ 13.14, chỉ được gỡ.

Các mốc của điểm cân bằng Zone (`ZoneBalanceCard`: ≥ 90 "Rất tối ưu", ≥ 80 "Tối ưu" xanh, ≥ 65 "Bình thường" cam) **không có nguồn nuôi yến** — chỉ để tô màu, không phải ngưỡng cảnh báo; giao diện không tự đặt dải màu nào cho tỷ lệ chim về. Cảnh báo tỷ lệ chim về là `LOW_RETURN_RATE` theo `return_rate_drop_pct` của nhà yến (VISION-FR-011, BR-21). Các mốc này đã ghi ở Report 3 §4.5; đổi giá trị thì sửa cả ở đó.

**c) Trạng thái xử lý cảnh báo** (cột *Trạng thái* ở bảng Cảnh báo — `status` từ BE)

| `status` | Nhãn VI / EN | Nền | Chữ | Ý nghĩa |
|---|---|---|---|---|
| `ACTIVE` | Mới / New | `infoBlue/10` | `infoBlue` | Chưa ai xác nhận. Cấp Khẩn cấp để quá 15 phút thì BE gửi lại thông báo (ALERT-FR-015) |
| `ACKNOWLEDGED` | Tiếp nhận / Received | `accent-600` | charcoal | Đã có người xác nhận — **chưa** có nghĩa là đã sửa |
| `DISMISSED` ⏳ backend | Đã bác bỏ / Dismissed | `warmGray/10` | `graphite` | Chuyên gia (hoặc chủ farm khi farm chưa có chuyên gia) bác bỏ cảnh báo suy luận: không còn hiệu lực, không báo lại; đổi kết luận sang xác nhận thì về trạng thái trước (Report 3 §6.1, EXPERT-FR-003). Hiện người bác bỏ, lúc nào, lý do |
| `RESOLVED` | Đã xử lý / Resolved | `warmGray/15` | `warmGray` | Sự cố đã hết (vượt ngưỡng không lặp lại 5 phút, thiết bị online lại, hoặc thiết bị bị gỡ) |

Mức độ (cột *Mức độ*): **theo 2.4**. Hiển thị 4 cấp qua `SeverityBadge`, bộ lọc "Mọi mức độ · Khẩn cấp · Cao · Trung bình · Thấp".

**d) Trạng thái bộ điều khiển trên Tổng quan** (thanh "Giám sát vận hành SCADA" đã bỏ ở v2.17.0)

Thẻ nhà ghi "Tự động / Điều khiển tay · còn N phút · x/y bộ điều khiển online"; nhà chỉ "Ổn định" khi mọi bộ điều khiển online và số đo trong ngưỡng (`houseLiveStatus`). Tab Điều khiển tay gộp bộ điều khiển chưa kết nối (mất kết nối hoặc chờ kết nối lần đầu) thành 1 dòng. Ô "Thiết bị mất kết nối" chỉ đếm `OFFLINE`, không đếm `PENDING`.

Mốc 20 giây (`LIVE_MAX_AGE_MS`, `STALE_TIMEOUT_MS`) là hằng số tự chọn của giao diện (Report 3 §4.5), khác mốc mất kết nối của backend (heartbeat 30 giây, BR-10). Trạng thái thiết bị chính thức là `DEVICE_STATUS_CHANGE`/`status` của backend; nhãn này chỉ nói số đo trên màn có còn mới hay không.

### 2.7. Icon-box content area — 4 biến thể tông màu

| Biến thể | Nền | Icon | Border | Dùng khi |
|---|---|---|---|---|
| Neutral (mặc định) | `--gray-100` | `--gray-700` (Graphite) | `--gray-200` | Icon chức năng chung |
| Lime/Accent (tích cực) | `--lime-200` | `--accent-700` | `--accent-200` | An toàn, hoàn tất |
| Orange (cảnh báo) | `--orange-100` | `--orange-600` | `--orange-200` | Cấp Cao/Khẩn cấp, vượt ngưỡng |
| Red (nguy hiểm) | `--red-100` | `--red-600` | `--red-200` | Lỗi hệ thống, hành động phá huỷ (không dùng cho mức cảnh báo) |

Vuông bo nhẹ `--radius-md` (12px), 40×40px chuẩn / 56×56px feature lớn. **Ngoại lệ:** icon trong sidebar giữ nguyên code hiện tại.

### 2.8. Typography

Font duy nhất: **Plus Jakarta Sans** (Google Fonts), weight 400–800.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
```

| Token | Size/Line-height | Weight | Dùng cho |
|---|---|---|---|
| `text-h1` | 26px/34px | 700 | Tiêu đề trang |
| `text-h2` | 20px/28px | 600 | Tiêu đề section/card |
| `text-h3` | 16px/24px | 600 | Tiêu đề nhỏ |
| `text-body` | 14px/22px | 400/500 | Nội dung mặc định |
| `text-small` | 13px/18px | 400 | Label phụ, timestamp |
| `text-caption` · `text-xs` | 13px/18px | 600 (caption) | Giữ tên cũ; cùng cỡ `text-small` |
| `.label-caption` (class trong `index.css`) | 13px/18px | 600, `--gray-500` | Nhãn section, nhãn ô form, tiêu đề cột bảng, nhãn trước nhóm nút ("Sắp xếp:") |
| `text-metric` | 32px/38px | 700, tabular-nums | Số liệu lớn |
| `text-mock-notice` | 13px/18px | 500, italic | `--gray-500` — dòng "FAKE data" |

**Không chữ nào dưới 13px (v2.16.0)**, kể cả badge và tiêu đề cột; không viết `text-[10px]`, `text-[11px]`. Chữ đọc (mô tả card, dòng phụ trong thẻ) `text-body` màu `graphite`; `warmGray` chỉ cho nhãn, ngày, đơn vị. Mỗi trang một `<h1>` (tên trang trên header); card dùng `h2`.

**Không in hoa nhãn/tiêu đề (v2.5.0).** Nhãn nhỏ viết sentence case bằng `.label-caption`, không thêm `uppercase` hay `tracking-[...]` rời. Chỉ 2 chỗ được in hoa: nhãn nhóm menu sidebar (mục 4.1) và banner chế độ SCADA. Số trong cột bảng/số liệu dùng `tabular-nums` để thẳng hàng theo cột.

### 2.9. Icon — 2 thư viện, 1 thang cỡ, 1 bộ màu

Được dùng **`@phosphor-icons/react`**, **`lucide-react`** và icon tự vẽ trong **`components/ui/icons.tsx`**. Ba nguồn phải trông như một bộ:

| Vị trí | Cỡ (`size`) |
|---|---|
| Trong badge, nút rất nhỏ, mũi tên phụ | 12 |
| Trong nút `sm`, ô KPI, dòng phụ | 14 |
| Mặc định: nút `md`, dòng thông tin, menu | 16 |
| Tiêu đề card, icon đầu dòng danh sách | 18 – 20 |
| Icon nổi bật trong section, banner cảnh báo | 24 |
| `EmptyState` | 32 |

- **[Bắt buộc]** Chỉ dùng cỡ trong bảng; không `size={15}`, `size={22}`.
- **[Bắt buộc]** Màu icon đi theo chữ (`currentColor`): đặt class màu token lên icon hoặc phần tử cha (`text-charcoal`, `text-warmGray`, `text-safetyOrange`…). Không truyền `color="#…"`, không màu ngoài mục 2.
- **[Bắt buộc]** Trong cùng 1 nhóm (1 hàng nút, 1 menu, 1 danh sách, 1 bộ ô KPI) dùng **1 thư viện**, cùng cỡ, cùng độ đậm nét — không trộn Phosphor với Lucide cạnh nhau.
- Độ đậm: nút và badge dùng nét đậm (Phosphor `weight="bold"`); icon nội dung dùng nét thường (Phosphor mặc định, Lucide mặc định `strokeWidth` 2).
- Icon chỉ có hình (không chữ) phải có `aria-label` (13.11); icon trang trí cạnh chữ thêm `aria-hidden`.

### 2.10. Thanh tiến độ nhiều bước — `Stepper`

Ticket, chat ticket, SLA và thanh tiến độ ticket đã gỡ (Report 3 §8, v2.12.0). Luồng nhiều bước còn lại (wizard onboarding thiết bị của Technician, về sau là tiến trình thiết lập thiết bị SF-01) dùng chung `components/ui/Stepper.tsx`:

| File | Xuất ra | Dùng để |
|---|---|---|
| `components/ui/Stepper.tsx` | `<Stepper steps current completed activeTone />` | Vẽ thanh tiến độ; `activeTone="strong"` = bước đang làm nền `accent-800` chữ trắng (tương phản 5.3:1), mặc định `soft` = `accent-600` (`limeMist` = cùng mã); `showNextProgress` = đoạn nối tới bước kế tiếp kéo dài từ bước hiện tại tới bước sau rồi mờ đi, lặp lại (`animate-step-progress`, `scaleX` + `opacity`; tắt khi giảm chuyển động); `completed` = mọi bước đều xong |

- Nhãn bước lấy từ từ điển của màn; không tự vẽ thanh tiến độ riêng.

---

## 3. Logo

2 file ảnh, đầu sidebar: `[Logo_SCare_Icon.png]  [Logo_SCare_Text.png]`

- Container: `display:flex; align-items:center; gap:10px;` — giữ nguyên khối padding sidebar hiện có.
- Icon: 40×40px, `object-fit:contain`. Nếu file là icon phẳng chưa có nền → giữ khung lót `background: var(--gray-900)` (Charcoal, **không còn `#111728`**) bo góc `--radius-md` hiện có của sidebar; nếu ảnh đã tự có nền → đặt trực tiếp, bỏ khung lót.
- Text: `height:24px; object-fit:contain; width:auto`.
- Asset tại `/public/brand/`, dùng `<img alt="SwiftletCare">`, không dùng `background-image`.

---

## 4. Bố cục (Layout)

### 4.1. Sidebar & Topbar

Khung dùng chung 4 role (`components/layouts/`); menu của từng role lấy từ danh mục chung `menuCatalog.ts` (12.5).

- **Sidebar** `w-64`: logo, rồi các nhóm menu (không khối chào, không nút đăng xuất). Menu không cuộn ở 1440×900; nhóm ít dùng hoặc chỉ đọc thu gọn được. Nhóm có `collapsible: true` thu gọn bằng mũi tên cạnh tiêu đề, nhớ trong `localStorage`; nhóm chứa trang đang mở luôn mở. Mục menu có `tabs`: sidebar chỉ hiện mục cha và sáng ở mọi trang con, header lấy tên mục cha, hàng tab pill (`common/SectionTabs`) nằm đầu vùng nội dung. Nhãn nhóm là chỗ duy nhất được in hoa.
- **Header:** trái là tên trang (`<h1>`, điện thoại `text-xl` xuống tối đa 2 dòng) + breadcrumb trang chi tiết; phải là VI/EN (cao 36px, không popup; dưới `sm` nằm trong menu avatar) · chuông · avatar. Khe `HeaderActions` (thanh phạm vi) cùng hàng từ 1280px, dưới 1280px xuống hàng riêng ngay dưới; `AppShell` đo chiều cao header để chừa đúng chỗ.
- **Menu avatar** (mọi khổ màn): tên, email, vai trò · Cài đặt · Quyền riêng tư · Đăng xuất. Đây là chỗ duy nhất có Cài đặt và Đăng xuất; route `/settings` vẫn trong `MENU_ACCESS`.
- **Dock điện thoại:** 4 mục (`dock` của role trong `menuCatalog.ts`) và mục "Thêm" (`Drawer side="bottom"`) mở các mục còn lại theo nhóm, kèm badge; chấm đỏ trên "Thêm" khi một mục bên trong có badge. Dock có "Thêm" thì mục đang mở chỉ tô nền, không hiện nhãn, để 5 nút vừa màn 360px.

**Đúng theo role** (✓ có, — không có):

| Thành phần | Chủ nhà yến | Chuyên gia | Kỹ thuật viên | Quản trị viên |
|---|---|---|---|---|
| Tên trang `h1` + breadcrumb trang chi tiết | ✓ | ✓ | ✓ | ✓ |
| Thanh phạm vi Trang trại → Nhà → Zone | trang có dữ liệu trang trại | trang có dữ liệu trang trại | Thiết bị, Nhà được giao | — |
| VI/EN | ✓ | ✓ | ✓ | ✓ |
| Chuông · tab Cảnh báo (ALERT-FR-007) | ✓ | — | ✓ (nhà được giao) | ✓ (cảnh báo thiết bị) |
| Chuông · tab Thông báo (EXPERT-FR-007) | ✓ | ✓ | ✓ | ✓ |
| Menu avatar | ✓ | ✓ | ✓ | ✓ |

**Trang Cài đặt theo role** (`pages/SettingsPage.tsx`, một cột `max-w-3xl`):

| Khối | Chủ nhà yến | Kỹ thuật viên | Chuyên gia | Quản trị viên |
|---|---|---|---|---|
| Hồ sơ (chỉ xem; trống thì `_`) | ✓ | ✓ | ✓ | ✓ |
| Kênh cảnh báo theo mức × Thông báo đẩy · Telegram (ALERT-FR-005) | ✓ | ✓ | — | — |
| Giờ im lặng, 24 giờ (ALERT-FR-006) | ✓ | — | — | — |
| Telegram (ALERT-FR-013) | ✓ | ✓ | — | — |
| Dòng "Thông báo chuyên môn hiện trong hộp thông báo của ứng dụng" (EXPERT-FR-007) | — | — | ✓ | — |
| Bảo mật (AUTH-FR-009) · Quyền riêng tư · Yêu cầu xoá tài khoản (AUTH-FR-012) | ✓ | ✓ | ✓ | ✓ |

### 4.2. Content Canvas System — nền cố định 1 màu phẳng

Không còn khối blur trang trí, không ảnh nền đầu trang (đã bỏ `usePageHero` ở v2.16.0). Nền cố định là **1 màu phẳng duy nhất `#EAEAEA`**, không hoa văn, không blob màu. Vẫn giữ nguyên cơ chế 2 lớp (nền không cuộn / nội dung cuộn riêng) — chỉ đơn giản hoá phần thị giác của lớp nền:

```
.content-shell (position:relative; height:100vh; overflow:hidden)
 ├─ .content-canvas (position:absolute; inset:0; z-index:0; pointer-events:none)
 │    background: var(--bg-canvas);              ← #EAEAEA cố định, phẳng, KHÔNG cuộn
 └─ .content-scroll (position:relative; z-index:1; height:100%; overflow-y:auto; padding:32px)
      [Topbar sticky — không đổi]
      [Card trắng cuộn theo nội dung]
```

```css
.content-shell { position: relative; height: 100vh; overflow: hidden; }
.content-canvas { position: absolute; inset: 0; z-index: 0; background: var(--bg-canvas); pointer-events: none; }
.content-scroll { position: relative; z-index: 1; height: 100%; overflow-y: auto; padding: 32px; max-width: 1440px; margin: 0 auto; }
```

> Đã bỏ `.content-canvas::before/::after` (2 khối blur lime/cam) so với v2.1.0 — không dùng `filter:blur()` hay pseudo-element màu trong lớp nền nữa. Card trắng vẫn nổi rõ nhờ shadow (mục 4.3), không cần thêm khối màu phía sau để tạo chiều sâu.

### 4.3. Card trắng — bo góc & shadow

```css
--radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:20px; --radius-2xl:28px; --radius-full:9999px;

/* Shadow tint theo đúng Charcoal (39,35,31) — không còn dùng rgb của #111728 (17,23,40) */
--shadow-card:       0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06);
--shadow-card-hover: 0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09);
--shadow-modal:      0 24px 64px rgba(39,35,31,.18);
```

Card mặc định: `background:#FFFFFF; border-radius:var(--radius-xl); box-shadow:var(--shadow-card); padding:24px;` (không cần border — shadow đã đủ tách khỏi canvas xám). Card lớn bọc nhiều card con: `padding:28–32px`, `radius-2xl`.

> **Giá trị đang chạy (thắng các con số CSS ở trên và ở mục 11):** Tailwind `rounded-xl` 16px · `rounded-2xl` 20px · `rounded-3xl` 28px; `Card size="md"` = `rounded-2xl p-5`, `size="lg"` = `rounded-3xl p-6`. Chuẩn áp cho mọi role xem 1.1.

### 4.4. Responsive — breakpoint

Dùng breakpoint mặc định của Tailwind, **thiết kế từ mobile lên** (class không tiền tố = điện thoại, thêm `sm:`/`lg:` cho màn rộng hơn):

| Breakpoint | Từ | Dùng cho |
|---|---|---|
| (mặc định) | 0 | Điện thoại: 1 cột, dock điều hướng nổi dưới đáy, `px-6` |
| `sm:` | 640px | Xếp ngang các phần tử trong 1 dòng (nút cạnh tiêu đề, dòng cảnh báo nằm ngang), lưới 2 cột cho form |
| `md:` | 768px | Ít dùng — chỉ khi `sm` và `lg` đều không hợp |
| `lg:` | 1024px | **Mốc chính**: hiện sidebar trái thay dock, `lg:px-8`, lưới KPI 4 cột, trang chi tiết 2/3 + 1/3, bộ lọc và ô tìm cùng hàng |
| `xl:` / `2xl:` | 1280 / 1536px | Chỉ tăng số cột khi thật cần; nội dung không rộng quá `max-w-[1400px]` |

- **[Bắt buộc]** Bảng (`DataTable`) giữ `min-w-[960px]` và **cuộn ngang trong khung bảng** trên màn hẹp — không để cả trang cuộn ngang.
- **[Bắt buộc]** Không ẩn chức năng trên điện thoại; được đổi cách bày (xếp dọc, thu gọn) nhưng thao tác phải còn đủ.
- Kiểm ở 4 bề rộng: **375 · 768 · 1280 · 1920px** — ảnh chụp đính PR (13.13) lấy 375 và 1280.

### 4.5. Thang z-index

Chỉ dùng các tầng dưới đây (khớp code hiện tại); không thêm số lẻ (`z-[6]`, `z-[999]`):

| Tầng | Class | Dùng cho |
|---|---|---|
| Nền | `z-0` | Lớp nền trang trí, gradient sau nội dung |
| Nội dung nổi | `z-10` | Phần tử nổi trong card (nhãn đè ảnh, nút đè video) |
| Khung app | `z-20` | `AppHeader`, `AppSidebar`, dock mobile |
| Popover neo | `z-30` | `NotificationPopover`, popover gắn nút trên header |
| Lớp phủ | `z-40` | Nền mờ phía sau `Drawer` |
| Lớp nổi | `z-50` | `Modal`, khung `Drawer`, `SelectMenu`, `ActionsMenu` (render qua portal) |
| Thông báo | `z-[60]` | `Toast` — luôn trên cùng |

Dropdown mở trong Modal vẫn nổi đúng vì render qua portal ra `document.body` sau Modal; không tăng z-index để "chữa".

### 4.6. Chuyển động

| Thời gian | Dùng cho |
|---|---|
| `duration-150` | Đổi màu khi rê chuột: dòng bảng, chip, link, tiêu đề dòng |
| `duration-200` | Nút, mở/đóng menu, dropdown, tooltip |
| `duration-300` | Drawer, Modal, panel trượt, mở rộng/thu gọn khối |
| `duration-500` | Thanh tiến độ, đổi số liệu lớn |
| `duration-1000` | Chỉ cho hiệu ứng lặp (nhấp nháy trạng thái, đang tải) |

- Chỉ animate `color`, `background-color`, `opacity`, `transform` (`transition-colors`, `transition-opacity`, `transition-transform`); không animate `width`/`height`/`top`/`left` (gây giật).
- **[Bắt buộc]** Hiệu ứng lặp và chuyển động lớn thêm `motion-reduce:animate-none` / `motion-reduce:transition-none` cho người bật "giảm chuyển động".

---

## 5. Thư viện Component

### 5.1. Button

| Variant | Nền | Chữ |
|---|---|---|
| Primary | `--gray-900` (Charcoal) | trắng |
| Success | `--accent-600` | `--gray-900` |
| Secondary | `#FFFFFF`, border `--gray-300` | `--gray-900` |
| Danger | `--red-500` | trắng |
| Ghost | trong suốt | `--gray-700` |

Radius `--radius-md`, height 40px. Trong code: `Button sm` cao 36px, dưới `sm` 44px; `md` 48px.

**Một nút tô đậm cho việc chính mỗi màn.** Chip lọc (`FilterChip`), chip sắp xếp (`SortChips`), tab và nút chọn đoạn đang chọn dùng pill trắng `bg-white text-charcoal shadow-card` (trên nền `bg-warmGray/10` hoặc kèm `ring-1 ring-warmGray/25`), không tô charcoal. Nút lưu của một khối là nút phụ, thành nút chính khi khối có thay đổi chưa lưu. Nút bị khoá nói lý do (`title` + dòng phụ). Vùng bấm dưới `sm` cao ≥ 44px (`Button sm`, `SelectMenu`, `FilterChip`, `SortChips`, `SearchInput` đã có sẵn).

Danger chỉ dành cho hành động phá huỷ/khẩn cấp. Nút đặt lại bộ lọc dùng `ClearFiltersButton`: mẫu Farm Owner là `tone="danger"` (nền `red-500/10` → rê chuột `red-500/15`, viền `red-500/20`, chữ + icon `red-600` `font-medium`) kèm `count` = số điều kiện đang lọc → "✕ Hủy lọc 2"; chỉ hiện khi có ít nhất 1 điều kiện. Màn Admin còn kiểu cũ (Secondary trơn) tới khi chuyển.

### 5.2. Popup xác nhận (CRUD & Đăng xuất) — nền mờ, không nền đen

```css
.modal-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(39, 35, 31, 0.14);   /* Charcoal rất nhạt — KHÔNG dùng rgba(0,0,0,x) */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.modal-panel {
  background:#FFFFFF; border-radius:var(--radius-xl);
  box-shadow: var(--shadow-modal); padding:28px; max-width:420px;
}
```
Icon-box cảnh báo trên cùng (biến thể Orange/Red mục 2.7) → tiêu đề → mô tả hậu quả → 2 nút: Secondary "Huỷ" / Danger hoặc Primary "Xác nhận". Đóng bằng `Esc`/click-outside, trừ hành động CRITICAL không thể hoàn tác bắt buộc bấm nút.

### 5.2.1. Kính mờ (Glassmorphism) — AppHeader & lớp nổi

Lớp nằm đè lên nội dung dùng nền trong suốt + blur thay cho nền đặc, để nội dung bên dưới hiện thành mảng màu nhòe. Có 2 biến thể:

| Biến thể | Dùng cho | Class |
|---|---|---|
| Kính trong | AppHeader (nổi đè vùng cuộn, phủ hết bề ngang cột) | Lớp nền `absolute inset-0 -z-10` bên trong header (`relative isolate`): `bg-white/10 backdrop-blur-lg backdrop-saturate-150`; khi cuộn thêm `border-white/60 shadow-glass`. Không làm tối (`backdrop-brightness`) |
| Kính mờ lớp nổi | `SelectMenu`, `ActionsMenu`, popup thông báo (chuông), khung xem trước ngôn ngữ | `.glass-panel` (`src/index.css`) + bo góc của từng component (`rounded-2xl` = 20px, khung ngôn ngữ `rounded-xl`) |

`.glass-panel` theo thông số glass-card:
- **Nền:** phủ trắng 5%, lót dưới cùng trắng 30%, `backdrop-filter: blur(24px) saturate(150%)` — mờ hơn AppHeader (16px) một bậc (mẫu glass-card là blur 10px). Lớp lót khác mẫu: chỉ phủ trắng 5% (hoặc 10% như header) thì nút/khối tối phía sau hiện thành vệt xám đậm ngay dưới chữ menu cỡ nhỏ; 30% vẫn thấy mảng màu nhòe phía sau mà chữ đọc rõ.
- **Viền:** `1px` trắng 30%.
- **Bóng:** `0 8px 32px` đen 10% · `inset 0 1px 0` trắng 50% · `inset 0 -1px 0` trắng 10% · `inset 0 0 2px 1px` trắng 10% (viền sáng mảnh phía trong mép).
- **Vệt sáng mảnh:** mép trên gradient 90° (trong suốt → trắng 80% → trong suốt), mép trái gradient 180° (trắng 80% → trong suốt → trắng 30%). Vẽ bằng lớp nền thay cho `::before`/`::after` để không trôi khi danh sách `SelectMenu` tự cuộn.

Chữ trên kính trắng: chính `text-charcoal`, phụ `text-warmGray`, mục đang trỏ/đang chọn `bg-charcoal/5`, vạch ngăn `border-charcoal/10` hoặc `bg-charcoal/10`, mục nguy hiểm (Xóa) `text-alertRed`. Nền của từng mục dùng màu có độ trong (`/5`, `/10`, `accent-600/15`) thay cho nền đặc (`bg-white`, `bg-gray-100`) để không che mất lớp kính.

Popup thông báo: tin chưa đọc nền `bg-charcoal/5` + chấm cam, tin đã đọc trong suốt + `opacity-80`, tin đang xổ chi tiết nền `bg-accent-600/15` (code `limeMist/50` = cùng mã) với nút mũi tên đen.

**[Bắt buộc]** Không đặt `backdrop-filter` (hay `filter`, `opacity` < 1, `mask`, `clip-path`, `mix-blend-mode`) lên phần tử **chứa** popup kính: phần tử đó thành *backdrop root*, kính của popup con chỉ làm nhòe được nội dung bên trong nó — phần popup thò ra ngoài nhìn xuyên thấy nội dung trang sắc nét. Vì vậy kính của AppHeader nằm ở lớp nền riêng, còn `SelectMenu`/`ActionsMenu` render qua portal ra `document.body`.

Màu trong `.glass-panel` lấy bằng `theme(colors.… / x%)` trong CSS, không viết hex/`rgba()` thẳng trong className (13.7). Bóng kính của header là token `glass` trong `tailwind.config.ts`. Modal/ConfirmModal (5.2) vẫn nền trắng.

### 5.3–5.9. Card, Table, Tabs, Form, Alert, Gauge...

Hành vi giữ nguyên theo v2.0.0 — chỉ đổi giá trị màu: mọi chỗ trước đây ghi `--ink-850`/`#111728` nay đọc `--gray-900`. Vạch ngưỡng trên Gauge dùng `--gray-700` (Graphite, tự động cập nhật qua token).

### 5.4. Nhãn "dữ liệu giả"

Không tạo component riêng cho việc này — chỉ 1 dòng `<p>` italic đặt cạnh/dưới tiêu đề section chứa số liệu chưa có API thật:

```html
<p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
```

```
Tiêu đề section
This data is FAKE and has not been MOCKAPI     ← text-mock-notice, --gray-500, italic
```

### 5.5. Chỉ báo realtime

Màn nhận dữ liệu qua socket (Dashboard, cảnh báo, trạng thái thiết bị) phải cho người dùng biết dữ liệu đang **trực tiếp** hay **tự làm mới**, dựa trên trạng thái kết nối socket (mẫu: `isLive` của `hooks/farm-owner/useTelemetry.ts`, `useSocketConnected` ở `useFarmOwnerDashboard.ts`):

| Trạng thái | Chấm | Chữ VI / EN |
|---|---|---|
| Socket đang kết nối | `bg-success` | Trực tiếp / Live |
| Mất socket, đang hỏi lại định kỳ | `bg-warmGray/40` | Tự làm mới / Auto-refresh |

- Đặt ở góc phải header của khối dữ liệu, `text-small font-semibold`, chấm `h-1.5 w-1.5 rounded-full`.
- Khối có mốc thời gian dữ liệu thì ghi lúc cập nhật, như "Cập nhật HH:mm" trên lưới thẻ nhà của Tổng quan.
- **[Bắt buộc]** Mất socket thì hook tự chuyển sang hỏi lại định kỳ, không để màn đứng im mà vẫn ghi "Trực tiếp".

---

## 6. i18n — Đa ngôn ngữ (VI/EN)

**Trạng thái: hai hệ dịch chạy song song, chưa phủ toàn app.** Nút VI/EN ở `AppHeader` ghi vào `stores/languageStore.ts`; cả hai hệ dưới đây đọc chung store này nên một nút đổi cả hai. Màn chưa dùng hệ nào vẫn tiếng Việt như cũ.

**Hệ 1 — `src/i18n/` (i18next + react-i18next), khoá là câu tiếng Việt.** `t('Danh sách trang trại')` → VI trả nguyên câu, EN tra `i18n/en.ts`, thiếu bản dịch thì vẫn hiện tiếng Việt (không lỗi). Biến dạng `t('Còn {{n}} ngày', { n: 3 })`. Các helper trong `i18n/index.ts`: `t` (gọi được cả ngoài component — column builder, helper định dạng), `tr`/`trChildren` (dịch prop chữ/children của component dùng chung, bỏ qua ReactNode), `translated(labels)` (bọc bảng nhãn constants để đọc ra bản dịch hiện tại), `intlLocale()`, `setLang()`. `AppShell` remount vùng nội dung theo `key = ngôn ngữ` để mọi chỗ gọi `t` ra đúng ngôn ngữ. **Không** tính nhãn bằng `t` ở cấp module (hằng số top-level) — giá trị đóng băng theo ngôn ngữ lúc nạp; dùng `translated(...)`, getter, hoặc dựng trong component. Đang dùng ở các màn Admin, các màn chuyên gia (`/domain-expert/*`, bản dịch ở `i18n/en.expert.ts`; trùng khoá thì `en.ts` thắng) và các component `ui/`. Thêm câu mới = thêm 1 dòng vào `en.ts` (hoặc `en.expert.ts` cho màn chuyên gia).

**Hệ 2 — từ điển theo module.** Hạ tầng tối thiểu: `lib/i18n.ts` (`Dictionary<K>` — `en` bắt buộc đủ đúng key của `vi`, thiếu là lỗi biên dịch; `translate`, định dạng số/ngày/"x giây trước" theo locale) + `hooks/common/useTranslation.ts` (`const { t, num, day, time, date, hourMinute, dateTime, ago } = useTranslation(dict)`). Từ điển mỗi module đặt ở `constants/<module>.i18n.ts`; hiện có `farmStructure.i18n.ts` (màn Cấu trúc Farm), `dashboard.i18n.ts` (Dashboard) của Farm Owner, `navigation.i18n.ts` (nhãn sidebar/dock/tiêu đề trang — tra qua `hooks/common/useNavigationLabel.ts`) và `shell.i18n.ts` (popup thông báo, tài khoản, đăng xuất, nút ngôn ngữ). Ngoài ra có `support.i18n.ts` (Ticket `/support`), `severity.i18n.ts` (`levelDict`, 2.4) và hàm `dateTime` của `useTranslation`. Tên file/hook viết đầy đủ, không viết tắt (VD `useTranslation`, không `useT`). Đơn vị đo (°C/%/ppm/lux/dB) không dịch. Màn chưa có từ điển: khi review **không** bắt buộc `t('...')`; viết tiếng Việt có dấu, giữ thuật ngữ ("Zone", "Farm", "Ticket") nhất quán với màn đã có. Đang dùng ở các màn Farm Owner, màn Trang trại của Technician và khung app (sidebar, popup thông báo/tài khoản).

**Chọn hệ nào:** sửa màn đang dùng hệ nào thì giữ hệ đó, không trộn hai hệ trong một file. Màn mới theo hệ mà role đó đang dùng (Admin, Domain Expert → Hệ 1; Farm Owner, Technician → Hệ 2). Gộp về một hệ (chuyển các `*.i18n.ts` thành namespace i18next) là PR riêng — xem nợ 13.14. Bảng thuật ngữ 6.2 áp cho cả hai hệ.

### 6.1. Định dạng ngày, giờ, số

| Loại | Chuẩn | Ví dụ |
|---|---|---|
| Ngày | `DD/MM/YYYY`, đệm số 0, **giống nhau ở VI và EN** | 06/10/2026 |
| Giờ | `HH:mm`, 24 giờ, không giây | 08:05 |
| Ngày giờ | `DD/MM/YYYY, HH:mm` — dấu phẩy tách ngày với giờ | 06/10/2026, 08:05 |
| Giây | Chỉ ở nhật ký hệ thống (audit log) và mốc kỹ thuật | 08:05:33 |
| Thời gian tương đối | `ago` của `useTranslation` cho sự kiện mới (cảnh báo, đồng bộ) | 9 ngày trước / 9 days ago |
| Múi giờ | **Luôn `Asia/Ho_Chi_Minh`**, bất kể máy người dùng | — |
| Số đo cảm biến | Tối đa 1 chữ số lẻ, số nguyên thì không lẻ; dấu thập phân theo ngôn ngữ (`num`) | 33,5 / 33.5 |
| Số đếm, số lượng | Số nguyên, dấu phân cách hàng nghìn theo ngôn ngữ | 1.250 / 1,250 |
| Đơn vị | Đặt sau số, không dịch (°C, %, lux, ppm, dB, g) | 70 % |
| Không có giá trị | **`_`** ở mọi nơi (ô KPI, bảng, chú thích, popup/drawer) — hằng số `NO_VALUE` (`constants/display.ts`), không viết tay ký tự. Hai giá trị trống đi cặp thì `_ · _` | _ |

- **[Bắt buộc] Không hiện số `0` thay cho số chưa có.** `0` chỉ hiện khi đó là số đếm thật (0 thiết bị, 0 cảnh báo, 0 đợt thu). Tổng/trung bình tính trên tập rỗng (sản lượng tháng chưa có đợt thu, số chim hôm nay chưa có tin đếm, tỷ lệ chưa đủ phiên), số đo chưa về, trường backend trả `null`/thiếu → hiện `NO_VALUE` (`_`) và bỏ đơn vị (không ghi `_ kg`). Áp mọi màn Farm Owner, kể cả popup và drawer.
- **[Bắt buộc]** Dùng hàm định dạng chung, không tự `toLocaleString` rải trong component:
  - `lib/i18n.ts`: `formatStandardDate` (DD/MM/YYYY) · `formatHourMinute` (HH:mm) · `formatDateTime` (DD/MM/YYYY, HH:mm) · `formatTimestampsInText` (đổi mốc ISO trong chuỗi backend, VD ghi chú "hạn 2026-09-17T15:34:00.721Z" → "17/09/2026, 22:34"). Gọi được cả ngoài component (column builder).
  - Trong component: `useTranslation` → `date`, `hourMinute`, `dateTime`, `num`, `ago`.
  - Ghi chú/nhật ký do backend tự sinh: đổi mốc ISO qua `formatTimestampsInText` (`lib/i18n.ts`) và bỏ mã yêu cầu SRS (VD `(ALERT-FR-015)`) trước khi hiện.
- Nợ: `formatDate`/`formatDateOnly` (`lib/helpers.ts`) có giây hoặc không đệm số 0; `day` và `time` của `useTranslation` đang theo định dạng của ngôn ngữ (EN ra `M/D/YYYY`, có giây) — màn mới dùng `date`/`hourMinute`/`dateTime`; màn cũ đổi khi sửa (13.14).

### 6.2. Bảng thuật ngữ VI / EN

**[Bắt buộc]** Mọi chữ hiển thị (từ điển Hệ 2, khoá Hệ 1, nhãn trong component) dùng đúng cột "Dùng"; cột "Không dùng" là các biến thể đã gặp trong code và đã sửa hết ở v2.15.0. `src/i18n/wording.test.ts` chặn cột "Không dùng" trong CI; thuật ngữ mới thêm vào bảng (và vào test nếu có biến thể dễ lẫn) trước khi dùng. Báo cáo (Report 3, 4) và backend vẫn dùng tên tiếng Anh (Farm Owner, Work Order, AI node); bảng này chỉ cho giao diện.

**Người và vai trò**

| Dùng (VI) | EN | Không dùng | Ghi chú |
|---|---|---|---|
| Chủ nhà yến | Farm Owner | Farm Owner, chủ trang trại, chủ trại, chủ farm | Giữa câu viết thường: "báo cho chủ nhà yến" |
| Chủ chính · Đồng sở hữu | Primary owner · Co-owner | Primary Owner | |
| Kỹ thuật viên · Kỹ thuật viên chính | Technician · Primary technician | thợ, thợ chính, Kỹ thuật viên nhà yến | Người được giao nhà (AUTH-FR-013) |
| Chuyên gia | Domain Expert | Domain Expert | |
| Quản trị viên | Administrator | Administrator | |

**Trang trại và thiết bị**

| Dùng (VI) | EN | Không dùng | Ghi chú |
|---|---|---|---|
| Trang trại | Farm | farm, Farm, trại (đứng một mình) | Tên do người dùng đặt ("Trại yến Demo") giữ nguyên |
| Nhà yến · Nhà | House | | |
| Zone | Zone | khu vực, khu, zone, phòng | Luôn viết hoa; một Zone là một tầng có bộ điều khiển |
| Tầng · Mã QR tầng | Floor · Floor code | | QR dán ở mỗi tầng (FARM-FR-011) |
| Thiết bị | Device | | Gọi chung bộ điều khiển và camera đếm chim |
| Bộ điều khiển | Controller | node, Node cảm biến môi trường, bộ kit, ESP32, PLC | Bộ đo và điều khiển ở mỗi Zone |
| Cảm biến | Sensor | | Chỉ đầu đo (nhiệt độ, độ ẩm…), không gọi bộ điều khiển là cảm biến |
| Camera đếm chim · Camera | Bird-count camera | Nút AI, camera AI, máy AI, AI | Report 4 gọi là AI node; trên màn chỉ cần biết nó đếm chim |
| Online · Mất kết nối · Chờ kết nối | Online · Offline · Awaiting connection | Offline, offline | 3 trạng thái thiết bị (`deviceStatusDict`) |
| Lần kết nối cuối · Kết nối cuối | Last seen | Heartbeat, heartbeat | |
| Mật khẩu kết nối · Mã kích hoạt | Connection password · Activation key | mật khẩu broker | Admin in trên nhãn thiết bị (FARM-FR-010) |
| Cập nhật firmware | Firmware update | OTA, OTA Firmware, đẩy OTA | |
| Kho thiết bị · Nhãn thiết bị | Device stock · Device label | | |
| Thiết lập thiết bị | Device setup | | SF-01 |
| Rơ-le | Relay | relay | Khi nói được tên tải thì gọi tên tải: bơm phun sương, quạt, loa |
| Phun sương · Thông gió | Misting · Ventilation | | |
| Loa dẫn dụ (loa ru) | Attractant speaker | Lullaby | Thuật ngữ của Report 3 |

**Điều khiển, cảnh báo, chuyên môn**

| Dùng (VI) | EN | Không dùng | Ghi chú |
|---|---|---|---|
| Tự động · Điều khiển tay | Automatic · Manual override | SCADA, "Logic mờ" làm nhãn chế độ | |
| Trực tiếp | Live | realtime, thời gian thực | |
| Ngưỡng | Threshold | | |
| Hệ số mờ | Fuzzy coefficient | Fuzzy, hệ số Fuzzy, hệ số logic mờ, hệ số điều khiển (mờ) | Bốn hệ số: Dải biên độ ẩm · Dải biên nhiệt độ · Mức quạt khử ẩm · Chu kỳ điều khiển; một tên ở mọi màn |
| Lọc nhiễu số đo | Reading noise filter | median + Kalman | |
| Tham số phát hiện · Mức ồn vượt nền | Detection parameter · Noise above baseline | P90, tham số phát hiện lỗi | EXPERT-FR-008; năm tham số: Mức ồn vượt nền · Thời gian ồn kéo dài tối thiểu · Thời gian bơm chạy không tăng ẩm · Độ ẩm cần tăng tối thiểu · Độ sụt âm lượng báo hỏng loa |
| Cảnh báo | Alert | | |
| Xác nhận (cảnh báo) | Acknowledge | | Trạng thái: Mới · Tiếp nhận · Bác bỏ · Đã xử lý |
| Cảnh báo suy luận | Inferred alert | AI | `NOISE_ANOMALY`, `SENSOR_ANOMALY`, `FORECAST_BREACH`, `LOW_RETURN_RATE` |
| Kiểm chứng cảnh báo · Kết luận · Xác nhận đúng · Bác bỏ | Verdict · Conclusion · Confirm · Reject | thẩm định, phán quyết, đối soát | Việc của chuyên gia (EXPERT-FR-003), khác "Xác nhận (cảnh báo)" |
| Duyệt thay đổi · Giữ · Hoàn tác | Review · Accept · Revert | thẩm định, hoàn nguyên, chấp thuận | Chuyên gia duyệt thay đổi ngưỡng, hệ số của chủ nhà yến (EXPERT-FR-010); trạng thái: Chờ duyệt · Đã giữ · Đã hoàn tác |
| Đề xuất hệ số · Duyệt · Từ chối | Proposal · Approve · Reject | | EXPERT-FR-011 |
| Bằng chứng | Evidence | | ALERT-FR-014 |
| Mức độ: Khẩn cấp · Cao · Thường | Level: Urgent · High · Normal | CRITICAL (chữ enum) | 2.4 |
| Đồng bộ cấu hình · Đã áp dụng · Đang chờ · Lệch cấu hình | Configuration sync · Applied · Pending · Mismatch | | ENV-FR-027 |
| Trạng thái sức khoẻ: Tốt · Cần theo dõi · Cần xử lý · Không đủ dữ liệu | Good · Watch · Action needed · Insufficient data | | MF-06; là chỉ báo, không phải chẩn đoán |
| Chỉ số sức khoẻ: Bình thường · Lệch nhẹ · Lệch rõ | Normal · Slight · Clear | | BR-28 |
| Đánh giá ngày | Daily rating | chấm thực địa | EXPERT-FR-012 |
| Đếm chim · Tỷ lệ chim về · Vòng đếm · Lịch đếm | Bird count · Return rate · Counting ring · Counting schedule | tỉ lệ, vạch đếm | Menu Chuyên gia: "Cài đặt đếm chim" (Lịch đếm, Vòng đếm), để khỏi nhầm với trang "Chim ra vào" của chủ nhà yến |
| Thu hoạch | Harvest | | |
| Phiếu công việc · Tạo · Chưa đóng · Duyệt · Mở lại · Huỷ · Giao lại | Work order · Create · Open · Approve · Reopen · Cancel · Reassign | Work Order, mở phiếu | MF-02 |
| Thời gian xác nhận trung bình · Thời gian xử lý trung bình | Mean time to acknowledge · Mean time to resolve | MTTA, MTTR, TB | OPS-FR-009; không viết tắt "TB" trên màn |
| Vị trí (trang trại) · Vĩ độ · Kinh độ | Location · Latitude · Longitude | | Một trang trại là một địa điểm (FARM-FR-001) |

**Tên loại cảnh báo** (`alertTypeDict`, nguồn duy nhất): Vượt ngưỡng môi trường · Thiết bị mất kết nối · Lỗi loa ru · Phun sương không hiệu quả · Tiếng ồn bất thường · Tỷ lệ chim về thấp · Camera đếm chim gặp sự cố · Thiết bị tự khởi động lại · Lỗi cảm biến · Lỗi đường truyền cảm biến · Cảm biến bất thường · Sắp vượt ngưỡng · Đến hạn bảo trì bơm/quạt · Bơm, quạt hoặc loa không chạy · Thiết bị chưa nhận cấu hình mới. Tên viết theo điều người nuôi thấy, không theo tên linh kiện (không "bus RS485", "cơ cấu chấp hành", "suy giảm").

### 6.3. Quy ước key i18n

- **Hệ 1** (`src/i18n/`): khoá là chính câu tiếng Việt, biến dạng `{{n}}` — không đặt key kiểu `list.title`.
- **Hệ 2** (`*.i18n.ts`): key dạng `<khu-vực>.<tên>` camelCase, khu vực là khối trên màn: `list.title`, `kpi.openSub`, `farmForm.location`, `form.errFarm`. Giá trị enum từ backend ghép thẳng: `status.ACTIVE`, `alert.SENSOR_FAULT`.
- **[Bắt buộc]** Không ghép câu bằng cộng chuỗi (`t('a') + ' ' + n + t('b')`) — dùng tham số: `'kpi.openSub': '{n} cảnh báo chờ xác nhận'`.
- **[Bắt buộc]** Bản `en` đủ đúng key của `vi` (kiểu `Dictionary<K>` đã bắt lỗi biên dịch); không để chuỗi tiếng Việt trong bản `en`.
- Nhãn dùng chung nhiều màn (4 cấp mức độ, tên menu) chỉ khai ở 1 từ điển chung (`navigation.i18n.ts`; `severity.i18n.ts`) rồi import, không khai lại ở từ điển màn.
- **[Bắt buộc] Nhãn của mã backend chỉ khai 1 lần** ở `constants/enumLabels.i18n.ts`: `alertTypeDict` (thêm `CONFIG_MISMATCH` khi backend có), `alertStatusDict` (thêm `DISMISSED` khi backend có), `deviceStatusDict`, `roleDict` (VI/EN). Mức độ ở `severity.i18n.ts` (`levelDict`; `severityLabels()` cho nhãn theo key 4 mức backend). Từ điển màn cần key riêng (`status.ACTIVE`, `alert.NODE_OFFLINE`) thì lấy lại bằng `...prefixLabels('status.', alertStatusDict.vi)` — không gõ lại nhãn. Đang áp: `dashboard.i18n.ts`, `farmStructure.i18n.ts`, `shell.i18n.ts` (popup thông báo mọi role).
- Nội dung do người dùng hoặc backend sinh ra (ghi chú, tin nhắn, tên farm) không dịch, hiện nguyên văn.

### 6.4. Cách viết chữ tiếng Việt trên màn hình

**[Bắt buộc]** Người đọc là người nuôi yến và kỹ thuật viên, không phải lập trình viên. Viết như người trong nghề nói với nhau, ngắn và cụ thể. `src/i18n/wording.test.ts` kiểm các mục máy kiểm được (chính tả, chữ cấm, gạch dài); phần còn lại kiểm khi review.

1. **Chính tả:** dấu đặt kiểu mới, thống nhất cả giao diện: hoà, xoá, huỷ, tuỳ, khoẻ, thuỷ, toạ (không hòa, xóa, hủy, tùy, khỏe). Viết "tỷ lệ", không "tỉ lệ". "Zone" luôn viết hoa.
2. **Câu ngắn:** mô tả dưới tiêu đề tối đa 1 dòng; giải thích quy tắc dài thì để trong (i) hoặc bỏ. Mỗi câu một ý.
3. **Nút và lệnh:** động từ + đối tượng ("Tạo phiếu công việc", "Lưu ngưỡng", "Xem thiết bị"). Câu nhắc bắt đầu bằng động từ ("Nhập lý do khoá"); không "Vui lòng", không "Hãy" ở đầu câu.
4. **Dấu câu:** không dùng " — " để nối câu; tách bằng dấu chấm, phẩy hoặc hai chấm. Cặp "việc · đối tượng" trong tiêu đề dùng " · " ("Tạo phiếu công việc · Nhà A"), bước dùng hai chấm ("Bước 1: Chọn vị trí"). Không dấu chấm than, không viết hoa mỗi chữ, không IN HOA (trừ nhãn nhóm menu sidebar, 4.1). Chữ mono (`font-mono`) chỉ cho mã người dùng phải chép (mã kích hoạt, mật khẩu kết nối); số cần thẳng cột dùng `tabular-nums`. Class `uppercase` chỉ ở nhãn nhóm menu sidebar.
5. **Chủ ngữ rõ:** viết ai làm gì ("Chuyên gia duyệt lại sau", "Bộ điều khiển nhận khi kết nối lại"). Tránh "Hệ thống sẽ…" khi không cần và các từ sáo: tối ưu, thông minh, liền mạch, toàn diện, nâng cao, đảm bảo, giúp bạn, một cách.
6. **Không tên kỹ thuật:** không ESP32, RS485, MQTT, broker, token, API, backend, SCADA, heartbeat, P90, median, Kalman, Feedback Loop, mã enum (CRITICAL, ACTIVE) hay mã yêu cầu (FR, BR, G-xx). Màn chuyên gia được ghi R² trong ngoặc để chuyên gia biết độ tin cậy của gợi ý.
7. **Chữ tiếng Anh:** chỉ các từ đã quen trong tiếng Việt và có trong 6.2: Online, Zone, firmware, Wi-Fi, email, QR, Telegram, PDF, CSV, NH3, CO2 và đơn vị đo. Còn lại viết tiếng Việt.
8. **Báo lỗi:** nói điều gì xảy ra rồi làm gì tiếp: "Không tải được danh sách camera. Thử lại." Không "Đã xảy ra lỗi…", không mã HTTP (13.16).
9. **Trạng thái rỗng:** nói chưa có gì và cách có: "Chưa có Zone nào. Thêm Zone để gắn thiết bị."
10. **Đổi chữ:** đổi một câu Hệ 1 thì đổi cả khoá trong `en.ts` / `en.expert.ts` (khoá là câu tiếng Việt). Không sửa tên test đang dùng trong Report 5 (`report5/tc.py` tra theo nguyên văn).

---

## 7. Chính sách công khai dữ liệu giả (Mock Data Disclosure)

**[Bắt buộc] Nghiêm cấm tự tạo dữ liệu giả.** Màn chưa có API, hoặc API có rồi mà chưa có dữ liệu → hiện khung trống / `EmptyState` / `ComingSoon`, không bịa số. Chỉ khi prompt **yêu cầu rõ** dữ liệu giả mới được tạo, và phải theo đúng đường đi:

```
src/data/<tên>.data.ts      ← chỉ nơi này chứa dữ liệu giả (tạo thư mục nếu chưa có)
        ↓ import
apis/<bucket>/<resource>.api.ts hoặc hook   ← trả dữ liệu giả thay cho gọi backend
        ↓
component                   ← không biết dữ liệu là thật hay giả, không chứa mảng/số giả
```

- Tên file nói rõ nội dung: `birdCount.data.ts`, `healthReport.data.ts`. Mỗi file 1 dòng comment đầu: `// Dữ liệu giả <tính năng> — chờ API <endpoint>`.
- Màn hiển thị dữ liệu giả phải có dòng nhãn 5.4 và có dòng trong bảng dưới.
- Khi backend có API thật: xoá file trong `src/data/` và dòng import, đổi trạng thái trong bảng.

Đối chiếu Report 3, danh sách chỗ lệch ở `docs/reports/project-tracking.md` §6 và backend thật trước khi bỏ nhãn. Bảng chi tiết:

| Màn hình | FR liên quan | Trạng thái | Cần nhãn? |
|---|---|---|---|
| AI Giám sát đàn — đếm chim, return rate | VISION-FR-006/008/009/010/011 | 🟡 chờ dữ liệu thật từ Edge AI | **Có** |
| Phân tích `/analytics` — chim ra/vào theo giờ, số đếm hôm nay, tỷ lệ chim về theo tuần (theo nhà yến, `houseId`), tương quan môi trường ↔ tỷ lệ chim về | ANALYTICS-FR-002/003, VISION-FR-012/017 | 🟡 API thật (`/analytics/bird-count/buckets`, `/current`, `/trends`, `/analytics/correlation`) nhưng chưa có dữ liệu tới khi nút AI chạy → khung trống | Không (không có số liệu giả) |
| ~~Cảnh báo thiên địch từ camera~~ | THREAT-FR-001/002/003 | ❌ Ngoài phạm vi (Report 3 §8) — không làm màn này | — |
| Giám sát đàn chim `/vision` | VISION-FR-008..011 | 🟡 API thật nhưng chưa có dữ liệu (AI chưa triển khai) → khung trống | Không (không có số liệu giả) |
| Reset ngưỡng Zone về mặc định | ENV-FR-020 | ✅ Đã code (v1.18.0) | Không |
| Audit Log toàn hệ thống (Admin) | SYSTEM-FR-001 | ✅ Đã code (`GET /system/audit-logs`) | Không |
| Cấu hình ngưỡng mặc định hệ thống (Admin) | SYSTEM-FR-002 | ✅ Đã code (`GET/PUT /system/settings/default-thresholds`) | Không |
| Tổng quan sức khỏe hệ thống (Admin) | SYSTEM-FR-003 | ✅ Đã code (`GET /system/health-overview`) | Không |
| ~~Đăng bán/Truy xuất nguồn gốc (Marketplace)~~ | (yêu cầu marketplace cũ, đã bỏ ở Review 1) | ❌ Ngoài phạm vi (Report 3 §8) — đã gỡ các trang; chỉ giữ ghi nhận thu hoạch (HARVEST-FR-001..005) | — |
| Thông báo ngoài ứng dụng: Telegram bot và push FCM, cả hai (Report 3; Zalo/SMS ngoài phạm vi) | ALERT-FR-002/013 | 🟡 backend gửi Telegram thật, FCM mới ghi log | Có (màn cấu hình kênh) |
| Báo cáo sức khỏe Zone + đọc kết luận chuyên gia (Farm Owner, trang `/analytics`) | EXPERT-FR-005/006 | ✅ API thật (`GET /health-reports`); Report 3 đổi sang báo cáo theo nhà yến ngày/tuần/tháng (#34) | Không |
| Kiểm chứng cảnh báo, kết luận, tham số phát hiện (Domain Expert, `/expert/*`) | EXPERT-FR-003..006, 008 | 🟡 Màn có từ PR #91, gọi API thật (`PUT /alerts/:id/verdict`, `GET /alerts/verdict-stats`, `/health-reports`, `PUT /farms/zones/:zoneId/detection-tuning`) nhưng còn dữ liệu giả dự phòng (`services/expert/expertFallback.service.ts`, `data/mocks/`) — phải bỏ (mục 7) | Không — dùng API thật |
| Lịch sử can thiệp tay, tỷ lệ thời gian tự động (trang `/analytics`) | ENV-FR-019, ANALYTICS-FR-011 | ✅ API thật (`GET /devices/sensor-nodes/:id/relay-overrides`, `GET /analytics/autonomy`) | Không |
| Live stream có khung trên từng con chim | VISION-FR-013/014 | 🟡 Màn có (`useWhepStream`, token `/devices/camera-nodes/:id/stream-token`); nút AI chưa phát video trên develop → khung trống | Không (không có hình giả) |
| Vẽ vòng đếm của camera | VISION-FR-018 | 🟡 Backend có API (`PUT /devices/camera-nodes/:id/counting-ring`); màn FE chưa làm | Không |
| Thiết lập thiết bị bằng QR (quét nhãn, quét mã tầng, tiến trình), in nhãn ở kho thiết bị, in mã QR tầng | FARM-FR-003…012 (SF-01) | 🟡 Backend có đăng ký/dời/gỡ nhưng mới cho Technician/Admin; tiến trình "đã áp cấu hình" cần ENV-FR-027 | Không — làm phần đã có API, phần chưa có dùng `ComingSoon` |
| Duyệt thay đổi của chủ farm, đề xuất hệ số, lịch sử quyết định của chuyên gia | EXPERT-FR-009, 010, 011 | ⬜ Chưa có endpoint (`docs/reports/project-tracking.md` §6 G-03, G-04) | `ComingSoon` |
| Trạng thái `DISMISSED`, gói bằng chứng của cảnh báo suy luận | EXPERT-FR-003, ALERT-FR-014 | ⬜ Chưa có ở backend (#19, #23) | `ComingSoon` cho phần bằng chứng |
| Đồng bộ cấu hình theo bộ điều khiển | ENV-FR-027 | ⬜ Chưa có (#22) | `ComingSoon` |
| Lịch đếm theo mùa / tạm thời, phiên không đầy đủ | VISION-FR-019, 020 | ⬜ Chưa có (#20, #24) | `ComingSoon` |
| Trạng thái sức khỏe nhà yến theo ngày (lý do, thời tiết), màn đánh giá ngày (hiện trạng thái và lý do, người dùng xác nhận hoặc sửa — BR-31), báo cáo ngày/tuần/tháng, tải PDF (`jspdf`) và CSV | ANALYTICS-FR-012, 013, EXPERT-FR-005, 012, 013 (MF-06) | ✅ API thật (`/health-reports/days*`, `/health-reports`, `/farms/houses/:id/health-levels`); màn `/health` và trang báo cáo `/health/report` (PR #126) | Không |
| Cấu trúc Farm — người phụ trách nhà, thiết bị, số đo, cảnh báo, thu hoạch | FARM-FR-*, AUTH-FR-013 | 🟢 API thật (người phụ trách = thợ chính của nhà). Lịch thu dự kiến, khuyến nghị AI, kỹ thuật viên lắp và firmware mới nhất đã gỡ ngày 18/11/2026 cùng `farmMock.api.ts`: Report 3 không có (dự báo sản lượng ngoài phạm vi §8; khuyến nghị thật ở `/recommendations`, EXPERT-FR-017) | Không |
| Dashboard Farm Owner — 4 ô KPI, thẻ từng nhà (số đo theo Zone, chế độ AUTO/MANUAL, trạng thái hôm nay), việc cần làm; chọn 1 nhà thì 6 chỉ số và rơ-le | ENV-FR-004/005, ANALYTICS-FR-015 | ✅ API thật (`/farms/{id}/overview`, `/analytics/env/compare`, telemetry + socket, `/devices/sensor-nodes`, `/alerts`, `/work-orders`) | Không |
| Dashboard Farm Owner — đếm chim (7/14/30/90 ngày), tỉ lệ chim về theo Zone | VISION-FR-008/009/010, ANALYTICS-FR-002 | 🟡 API thật nhưng chưa có dữ liệu (AI Vision chưa triển khai) → khung trống, không số giả | Không (không có số liệu giả) |
| Chi tiết thiết bị `/devices/detail` — thiết bị con của bộ kit | FARM-FR-005/006 (phần mở rộng UI) | 🟢 Không có tên riêng cho từng thiết bị con (không có endpoint): mỗi dòng ghi mã bộ kit; trạng thái/thông số là API thật (`/devices/sensor-nodes/:id`, telemetry, `/alerts`) — dữ liệu giả `deviceComponents.data.ts` đã gỡ 18/11/2026 | Không |

*Giới hạn:* bảng này cập nhật theo backend ngày 23/10/2026 (v2.9.0). Nguồn sự thật là backend thật cùng danh sách chỗ lệch trong `docs/reports/project-tracking.md` §6 — lệch nhau thì tin hai nguồn đó và sửa bảng này.

---

## 8. Biểu đồ — Ma trận chọn loại theo mục tiêu dữ liệu

| Nhóm biểu đồ | Loại dữ liệu | Áp dụng SwiftletCare |
|---|---|---|
| Line/Area | Chuỗi thời gian | Nhiệt độ/độ ẩm/khí/dB theo 1h–30d, return rate theo ngày |
| Bar/Column | So sánh danh mục | So sánh đa-Zone, sản lượng theo đợt |
| Donut/Pie/Treemap | Tỷ trọng/cơ cấu | Tỷ lệ cảnh báo theo mức độ, tỷ lệ thiết bị Online/Offline, cơ cấu tài khoản theo role |
| Histogram/Box Plot | Phân phối/mật độ | Phân phối nhiệt độ 30 ngày (phát hiện outlier) |
| Gauge/Bullet | 1 giá trị realtime vs ngưỡng | NH3/CO2/nhiệt độ/độ ẩm hiện tại vs `zones.thresholds`, đếm ngược Manual Override |

Trước khi dựng chart: tự hỏi *"chuỗi thời gian, danh mục, tỷ trọng, phân phối, hay giá trị-so-ngưỡng?"* — câu trả lời quyết định nhóm chart.

**[Bắt buộc] Biểu đồ không có dữ liệu vẫn hiện khung biểu đồ:**
- Giữ nguyên tiêu đề, mô tả, thanh điều khiển (khoảng thời gian, chỉ số…) và khung biểu đồ cùng chiều cao lúc có số.
- Trong khung: lưới ngang + trục dưới, **không** cột/đường/điểm, **không** số trên trục dọc, **không** tooltip, **không** chú thích; giữa khung 1 dòng chữ xám `text-sm text-warmGray` nói chưa có dữ liệu.
- Chart.js: render `<ChartEmptyFrame message className="h-…" />` (`components/ui/ChartEmptyFrame.tsx`) thay cho `<Line>/<Bar>/<Scatter>`. Recharts: giữ `CartesianGrid` + `XAxis`, `YAxis tick={false}`, bỏ `Bar`/`Tooltip`/`Legend` (mẫu `HarvestYearChart`).
- Biểu đồ vòng/thanh tỉ lệ tự vẽ (VD `NestTypeBreakdownCard`, `NestingDensityCard`): vẫn vẽ vòng/thanh ở màu xám (rãnh nền), số hiện `_`, mục ghi "Chưa có dữ liệu".
- Ô KPI cạnh biểu đồ vẫn hiện, giá trị `_` (6.1).
- **Không** thay biểu đồ bằng `EmptyState`. `EmptyState` chỉ cho lỗi tải (kèm nút Thử lại) hoặc khi chưa có farm/nhà/Zone nào. Đang tải vẫn dùng `LoadingSkeleton` đúng chiều cao biểu đồ.

**Thư viện:** mặc định Chart.js qua `lib/chartTheme.ts`. **Ngoại lệ:** biểu đồ sản lượng trang Thu hoạch (`HarvestYearChart`) dùng recharts qua `features/farm-owner/harvest/ChartParts.tsx` (mẫu shadcn chart-bar-stacked, đã đổi sang recharts 2 + Tailwind 3 + token màu): cột xếp chồng theo loại tổ từ dưới lên yến trắng `accentGreen` → yến hồng `accentDeep` → yến huyết `accentMoss`, loại không có trong kỳ thì không vẽ, chỉ đoạn trên cùng bo góc đỉnh. `ChartParts.tsx` kéo theo recharts nên không được chuyển vào `ui/` hay `common/`.

---

## 9. Đồng bộ bố cục đa vai trò

| Loại màn hình | Component dùng chung | Áp dụng |
|---|---|---|
| Bảng dữ liệu | `<DataTable />` (`components/ui/`) | Mọi role |
| Popup xác nhận | `<ConfirmModal />` (`components/ui/`) | Toàn bộ 4 role đăng nhập |
| Nhật ký/lịch sử | `<Timeline />` — **chưa tồn tại** | Admin Audit Log, threshold_history |
| Cấu hình ngưỡng cảm biến | `<ThresholdConfigCard />` — **chưa tồn tại** (hiện là `features/technician/devices/ThresholdsModal`, Technician không được sửa nữa — nợ 13.14) | Farm Owner + Domain Expert (Zone) + Admin (mặc định hệ thống, bắt buộc ghi nguồn — ENV-FR-007) — cùng component, khác quyền ghi |
| Stat card | `<StatCard />` — **chưa dùng chung** (đang là hàm cục bộ trong `AdminSystemHealthPage`) | Dashboard mọi role |

Component "chưa tồn tại" là định hướng: PR **không** bị yêu cầu dùng chúng. Khi màn thứ hai cần đúng giao diện đó thì tách ra theo bảng 12.3 thay vì viết bản thứ hai.

Trước khi thêm màn hình riêng cho 1 role: kiểm tra role khác đã có màn tương tự chưa — tái dùng component, khác nhau ở **data/quyền**, không khác nhau ở **giao diện**.

---

## 10. Nên / Không nên

**Nên:** icon-box đúng 4 biến thể (2.7) · kiểm bảng mục 7 trước khi hiển thị số liệu mới · tra bảng mục 8 trước khi chọn chart · dùng `t('...')` cho mọi chuỗi *(khi i18n đã cài — xem mục 6)* · dùng đúng 1 thang xám ấm (2.2) cho mọi nhu cầu "đậm/nhạt".

**Không nên:** không dùng màu ngoài mục 2 (kể cả xám mặc định của framework) · không đổi layout sidebar/topbar ngoài 2 ngoại lệ mục 4.1 · không dùng overlay đen `rgba(0,0,0,x)` cho modal — luôn `rgba(39,35,31,x)` + blur · không để card trắng chạm sát nhau không padding trên nền xám · không tạo bảng/form riêng cho từng role nếu bản chất giống nhau.

---

## 11. Implementation snippet

```css
:root {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --gray-0:#FFFFFF; --gray-50:#F9F9F9; --gray-100:#F0F0F0; --gray-200:#EAEAEA;
  --gray-300:#C5C4C3; --gray-400:#A5A3A1; --gray-500:#878380; --gray-600:#6D6865;
  --gray-700:#4E4A46; --gray-800:#393430; --gray-900:#27231F; --gray-950:#000000;

  --lime-50:#FDFFF3; --lime-100:#FAFFE6; --lime-200:#F5FFD0; --lime-300:#ECFFA9;
  --lime-400:#DFFD73; --lime-500:#D2F93A; --lime-600:#BEEC08; --lime-700:#8FAF08;
  --lime-800:#677E09; --lime-900:#445407;

  --accent-50:#F9FBEE; --accent-100:#F0F6D5; --accent-200:#E6F0B7; --accent-300:#D5E688;
  --accent-400:#CCE170; --accent-500:#C6DD5D; --accent-600:#B5D32C; --accent-700:#89A022;
  --accent-800:#627218; --accent-900:#414C10;

  --orange-50:#FDF3ED; --orange-100:#FAE1D1; --orange-200:#F6CAAC; --orange-300:#F3B287;
  --orange-400:#EF9A62; --orange-500:#ED8F50; --orange-600:#E87121; --orange-700:#B95613;
  --orange-800:#8B400E; --orange-900:#612D0A;

  --red-50:#FBEFEE; --red-100:#F6D7D5; --red-200:#EFB7B3; --red-300:#E68F89;
  --red-400:#DC5E56; --red-500:#D53F35; --red-600:#B12E25; --red-700:#87231C;
  --red-800:#611914; --red-900:#44110E;

  --bg-canvas: var(--gray-200);
  --bg-surface: #FFFFFF;
  --bg-surface-sunken: var(--gray-50);
  --text-primary: var(--gray-900);
  --text-secondary: var(--gray-500);
  --text-disabled: var(--gray-400);
  --border-default: var(--gray-300);
  --success: var(--accent-600);
  --brand: var(--accent-300);
  --warning: var(--orange-500);
  --danger: var(--red-500);
  --badge-default: var(--red-500);
  --focus-ring: rgba(213,230,136,.55);

  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:20px; --radius-2xl:28px; --radius-full:9999px;

  --shadow-card: 0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06);
  --shadow-card-hover: 0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09);
  --shadow-modal: 0 24px 64px rgba(39,35,31,.18);

  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
}
```

### 11.1. Tailwind config extend

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      colors: {
        gray:   { 0:'#FFFFFF',50:'#F9F9F9',100:'#F0F0F0',200:'#EAEAEA',300:'#C5C4C3',
                  400:'#A5A3A1',500:'#878380',600:'#6D6865',700:'#4E4A46',800:'#393430',
                  900:'#27231F',950:'#000000' },
        lime:   { 50:'#FDFFF3',100:'#FAFFE6',200:'#F5FFD0',300:'#ECFFA9',400:'#DFFD73',
                  500:'#D2F93A',600:'#BEEC08',700:'#8FAF08',800:'#677E09',900:'#445407' },
        accent: { 50:'#F9FBEE',100:'#F0F6D5',200:'#E6F0B7',300:'#D5E688',400:'#CCE170',
                  500:'#C6DD5D',600:'#B5D32C',700:'#89A022',800:'#627218',900:'#414C10' },
        orange: { 50:'#FDF3ED',100:'#FAE1D1',200:'#F6CAAC',300:'#F3B287',400:'#EF9A62',
                  500:'#ED8F50',600:'#E87121',700:'#B95613',800:'#8B400E',900:'#612D0A' },
        red:    { 50:'#FBEFEE',100:'#F6D7D5',200:'#EFB7B3',300:'#E68F89',400:'#DC5E56',
                  500:'#D53F35',600:'#B12E25',700:'#87231C',800:'#611914',900:'#44110E' },
      },
      borderRadius: { sm:'8px', md:'12px', lg:'16px', xl:'20px', '2xl':'28px' },
      boxShadow: {
        card:'0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06)',
        cardHover:'0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09)',
        modal:'0 24px 64px rgba(39,35,31,.18)',
      },
    },
  },
};
```

---

## 12. Cấu trúc thư mục Frontend — tổ chức theo role

> Mục này quy định **file mới đặt ở đâu**. Mục 9 nói về tái dùng component giữa các role; mục này nói về vị trí vật lý của file. Hai mục bổ sung cho nhau: tái dùng component (mục 9) nhưng vẫn phải đặt đúng thư mục role sở hữu (mục này).

### 12.0. Bản đồ role — đọc từ Report 3 (§2.3 vai trò, §2.4 phân quyền)

**4 actor người dùng** (Report 3 §2.3). Luồng chính (MF-01…06): Farm Owner + Domain Expert. Luồng phụ: thiết lập thiết bị bằng QR (SF-01, vẫn phải làm) và phần của Technician + Administrator (giữ chạy, không mở rộng). Buyer, Sales Staff, Farm Operator đã bỏ. Phía Farm có 3 mức: **Primary Owner** (người tạo farm) · **đồng sở hữu** (Farm Owner được mời) · **Domain Expert** (được mời, chỉ đọc + kiểm chứng + tinh chỉnh). UI của mọi role theo mẫu Farm Owner (1.1).

**a) Ai nắm quyền gì** (R = thực hiện, A = quyết định cuối/can thiệp, I = chỉ xem/được báo, – = không có)

| Nhóm chức năng | Farm Owner | Domain Expert | Technician | Admin |
|---|:---:|:---:|:---:|:---:|
| Dashboard môi trường, Analytics, đếm chim, live stream | R | I (chỉ đọc) | I (nhà được giao) | – |
| Báo cáo sức khỏe Zone | R | R | I (nhà được giao) | – |
| Lịch sử quyết định của chuyên gia (EXPERT-FR-009) | R (xem, được báo từng quyết định) | R | – | – |
| Trạng thái sức khỏe nhà yến theo ngày, đánh giá ngày từ quan sát của mình (MF-06) | R | R | R (nhà được giao) | – |
| Báo cáo ngày/tuần/tháng, tải PDF/CSV | R | R | R (nhà được giao) | – |
| Mức của chỉ số sức khỏe theo nhà yến (BR-28) | R (farm có chuyên gia: mở mục duyệt, BR-22) | R (xem lại thay đổi của chủ farm) | – | – |
| Duyệt thay đổi ngưỡng/hệ số của chủ farm (EXPERT-FR-010) | I | R | – | – |
| Thông báo ngoài ứng dụng (Telegram, push) | R | – (chỉ trong ứng dụng) | R (cảnh báo nhà được giao, nhận trước chủ nhà yến) | – |
| Xác nhận (acknowledge) cảnh báo | R | – | R (nhà được giao, ghi nguyên nhân tại chỗ) | – |
| Kiểm chứng cảnh báo suy luận, viết kết luận | I (đọc kết luận; kiểm chứng thay khi farm chưa có chuyên gia, BR-22) | R | R (trả lời kiểm tra tại chỗ, EXPERT-FR-021) | – |
| Can thiệp tay relay có thời hạn | R | – | R (nhà được giao) | – |
| Ngưỡng Zone, reset mặc định | R | R | I (nhà được giao) | I |
| Hệ số logic mờ | R (áp gợi ý chỉ khi farm chưa có chuyên gia) | R (duyệt thay đổi của chủ farm, áp gợi ý) | I (nhà được giao) | I |
| Tham số phát hiện, vòng đếm, lịch đếm theo mùa | R (farm có chuyên gia: mở mục duyệt, BR-22) | R (xem lại thay đổi của chủ farm) | R vòng đếm; I tham số phát hiện, lịch đếm | I |
| Luật bù thời tiết, hồ sơ cấu hình (nháp), luật khuyến nghị | R (farm có chuyên gia: gửi đề xuất, chỉ có hiệu lực khi chuyên gia duyệt, BR-22) | R (duyệt đề xuất của chủ farm) | I (luật bù thời tiết, khuyến nghị của nhà được giao) | – |
| Đăng ký thiết bị bằng nhãn QR, gán Zone bằng mã QR tầng, dời, gỡ (SF-01) | R (farm mình) | – | – | – |
| Lệnh từ xa, OTA, file loa | – (chỉ xem) | – | R khởi động lại (nhà được giao); I file loa | – |
| Kho thiết bị: thêm, in nhãn QR, cấp lại/thu hồi khoá | – | – | – | R |
| Cấu trúc Farm (Farm/House/Zone) | R (farm mình) | I | I (nhà được giao, ca trực của mình) | – |
| Xoá farm, mời/gỡ thành viên | R (chỉ Primary Owner) | – | – | – |
| Ghi nhận thu hoạch | R | I | R (lần thu chờ chủ nhà yến xác nhận; sửa, xoá lần chưa xác nhận của mình) | – |
| Phiếu công việc (Work Order) sửa chữa: mở tay, duyệt, mở lại, huỷ, giao lại; MTTA/MTTR theo nhà (OPS-FR-001…004, 009) | R | I (chỉ đọc) | R (bắt đầu, checklist, báo xong kèm ảnh; nhà được giao) | – |
| Tài khoản (tạo Technician, khoá/mở), cấu hình mặc định, audit log, tổng quan kỹ thuật | I | I | I | R |
| Chọn bài loa ru / nghe thử | R | – | – | – |
| Lịch loa của bộ điều khiển (BR-07) | R | – | I | – |
| Lịch sử can thiệp tay, tỷ lệ thời gian tự động (ENV-FR-019, ANALYTICS-FR-011) | R | I | I (nhà được giao) | – |

Nguồn: Report 3 §2.4. Technician là Farm Technician, nhân viên của chủ nhà yến, chỉ trên các nhà được giao (AUTH-FR-013); trên web có đủ các việc này từ G-33 (`docs/reports/todo-web-all-roles-1123.md`). Farm chưa có chuyên gia (BR-22): Farm Owner làm thay các việc R của Domain Expert ở bảng trên, trừ viết kết luận, duyệt thay đổi của chính mình và duyệt hồ sơ cấu hình. Farm có chuyên gia: Farm Owner nhắc chuyên gia một lần mỗi kết luận còn chờ.

**b) Cây màn theo role** — màn nào dùng chung, màn nào riêng

```
Farm Owner (luồng chính — UI MẪU)
├── Riêng:     /dashboard · /analytics · /vision · /harvests (ghi)
├── Đích (Report 3): đọc kết luận + lịch sử quyết định của chuyên gia · gửi đề xuất hệ số cho chuyên gia
├── Thiết lập thiết bị (SF-01, mobile là chính; web là đích): quét nhãn, quét mã tầng, tiến trình setup, in mã tầng
├── Dùng chung với Domain Expert (Domain Expert chỉ đọc, ẩn nút ghi bằng usePermission):
│              /dashboard · /analytics · /vision (live stream) · /harvests (xem) · báo cáo sức khỏe Zone (đích)
├── Dùng chung với Technician (trang thuộc technician/, mở bằng OPS_ROLES):
│              /devices (relay, lịch loa — chỉ Farm Owner) · /alerts (xác nhận — chỉ Farm Owner) · /farms (cấu trúc)
└── Chung mọi role: /settings · chuông thông báo · đổi ngôn ngữ

Domain Expert (luồng chính — CHƯA CÓ CODE FE; backend có một phần, xem mục 7)
├── Riêng (đích, bucket domain-expert/): kiểm chứng cảnh báo (kèm bằng chứng) · viết kết luận · duyệt thay đổi của chủ farm
│              · duyệt đề xuất hệ số · tham số phát hiện · vòng đếm · lịch đếm theo mùa
└── Đọc chung trang Farm Owner: dashboard · analytics · vision · live stream · thu hoạch · cấu trúc farm (chỉ xem)
    KHÔNG BAO GIỜ: relay, lịch loa, ghi thu hoạch, acknowledge cảnh báo, sửa/xoá farm, mời thành viên

Technician (luồng phụ — vai trò kỹ thuật, thấy MỌI farm) — mô tả cũ trước G-20; Farm Technician hiện chỉ có nhà được giao (frontend/CLAUDE.md)
├── Lắp thiết bị /devices/onboarding là của Farm Owner, OTA /ota là của Admin (G-20, G-29)
├── Dùng chung với Farm Owner: /devices (không nút relay) · /alerts (cảnh báo thiết bị, không nút xác nhận) · /farms (cấu trúc)
└── KHÔNG: relay, ngưỡng/hệ số, xác nhận cảnh báo, Dashboard/Analytics/đếm chim/live stream/thu hoạch (Report 3 FARM-FR-009)

Administrator (luồng phụ)
├── Riêng:     /system/health (tổng quan kỹ thuật) · /system/device-stock (kho, in nhãn) · /users
│              /account-requests · /system/settings (ngưỡng mặc định) · /system/audit-log
└── KHÔNG xem farm nào, không relay, không xác nhận cảnh báo; chỉ tạo tài khoản Kỹ thuật viên (AUTH-FR-005c)

Riêng ngoài hệ thống role: Landing Page (công khai) · Mobile app (mobile/) — thiết kế riêng, không theo 1.1
```

**c) Kiểm tra luồng (BA) — code hiện tại so với Report 3 §2.4** — cập nhật mỗi khi sửa route/quyền

| # | Chỗ | Code hiện tại | Report 3 | Việc cần làm |
|---|---|---|---|---|
| 1 | Domain Expert | Role `DOMAIN_EXPERT` có màn từ PR #91 nhưng nằm ở `expert/`, `ExpertLayout` (13.14); `/expert/analytics` lặp lại phân tích của Farm Owner; `SALES_STAFF` đã gỡ (PR #106) | Luồng chính | **Đã chốt 27/10/2026:** màn vận hành dùng chung (dòng 2); khu `/expert/*` chỉ giữ việc quyết định của chuyên gia: trang chủ là hàng đợi việc (cảnh báo chờ kết luận, mục duyệt, đề xuất hệ số, báo cáo chờ kết luận), kết luận cảnh báo, tham số phát hiện + vòng đếm + lịch đếm, ngưỡng/hệ số, báo cáo + kết luận, lịch sử hoạt động. Bỏ `/expert/analytics` (dùng `/analytics` chỉ đọc). Các màn quyết định này mở cho Farm Owner khi farm chưa có chuyên gia (BR-22, backend quyết). Dời về bucket `domain-expert/`, `DomainExpertLayout` theo 12.10 |
| 2 | `/dashboard`, `/analytics`, `/vision`, `/devices`, `/harvests` | `FARM_OWNER_ONLY` / `OPS_ROLES` / `HARVEST_ROLES` | Farm Owner + Domain Expert (chỉ đọc) | Đổi sang `FARM_SIDE_ROLES`; trang giữ nguyên của Farm Owner, nút ghi đã ẩn theo role (PR #101) — kiểm lại từng nút, không tạo bản sao cho chuyên gia |
| 3 | `/stream/:id` | `OPS_ROLES` (có Technician, Admin), trỏ tới stub `FarmOwnerLiveStreamPage` (ghi RPi) | Chỉ Farm Owner + Domain Expert | **Đã chốt 27/10/2026:** xoá route và trang stub; xem live ở `/vision` (`LiveCameraCard`/`useWhepStream`, token 60 giây). ✅ Đã xoá 01/11/2026 (G-15) |
| 4 | `/harvests` | `HARVEST_ROLES` (Farm Owner + Admin) | Farm Owner R, Domain Expert I, Admin – | Bỏ Admin, thêm Domain Expert chỉ xem |
| 5 | `/ota` | `ADMIN_ONLY`, trang `AdminOtaPage` | Chỉ Administrator (FARM-FR-013, G-20) | ✅ Xong (G-20; trang chuyển về `pages/admin/` ở G-29) |
| 5b | `/devices/onboarding` | `DEVICE_SETUP_ROLES`, trang `FarmOwnerDeviceSetupPage` | Chỉ Farm Owner (SF-01, FARM-FR-003…012) | ✅ Dán nội dung QR hoặc gõ mã, tiến trình setup 3 bước (FARM-FR-012); quét QR chỉ ở mobile, nơi làm chính (G-29) |
| 6 | ~~Ticket ở mọi role: `/tickets`, `/support`, `/system/tickets`~~ | Đã gỡ route, menu (PR #101) và xoá trang, component, API (PR #106) | Ngoài phạm vi (Report 3 §8, BM03 dòng 9) | ✅ Đã gỡ |
| 7 | `/alerts`, nút relay ở `/devices` | Nút xác nhận và nút relay chỉ Farm Owner thấy (PR #101); backend chỉ trả cảnh báo thiết bị cho Technician (PR #105) | Chỉ Farm Owner xác nhận và bật/tắt relay; Technician chỉ xem cảnh báo thiết bị; Admin không | ✅ Đã xong |
| 8 | ~~`/marketplace`, `/marketplace/:id`~~ | Đã gỡ route, trang và API (PR #93) | Ngoài phạm vi (Report 3 §8) | ✅ Đã gỡ |
| 9 | ~~Sửa ngưỡng / hệ số mờ ở màn Technician (`ThresholdsModal`)~~ | Gỡ khỏi màn (PR #101), xoá file (PR #106) | Chỉ Farm Owner + Domain Expert của farm (ENV-FR-006, 021) | ✅ Đã gỡ |
| 10 | Kho thiết bị (Admin) | Trả khoá một lần, chưa in nhãn | Admin in nhãn QR ngay khi thêm (FARM-FR-010); màn Zone in mã QR tầng (FARM-FR-011) | Sinh QR ở client bằng `qrcode`, định dạng ở Report 4 §5.4 |
| 11 | ~~`/system/farms(…)`, ô khu vực (`region`) ở form farm và form người dùng~~ | Đã gỡ màn farm của Admin và ô vùng; form farm có ô **vị trí** ("Dùng vị trí hiện tại" + vĩ độ/kinh độ, bắt buộc khi tạo, `validations/farm-owner/farm.validation.ts`) — PR #106 | Admin không có farm; Technician thấy mọi farm, không có vùng (FARM-FR-009); một farm là một địa điểm (FARM-FR-001) | ✅ Đã xong |

Backend vẫn là chốt chặn thật (13.8) — bảng này chỉ nói giao diện đang lệch với Report 3. Mỗi dòng sửa trong PR của role sở hữu màn đó.

### 12.1. Nguyên tắc

1. **Mỗi lớp quan tâm chia theo role ở cấp thư mục con.** `apis/`, `hooks/`, `components/features/`, `pages/`, `routes/`, `validations/` đều có các bucket `admin/` · `farm-owner/` · `domain-expert/` · `technician/` · `auth/` · `shared/` · `common/`. `domain-expert/` chứa các màn do chuyên gia sở hữu (kiểm chứng cảnh báo, viết kết luận, duyệt thay đổi của chủ farm, duyệt đề xuất hệ số, tham số phát hiện, vòng đếm, lịch đếm — farm chưa có chuyên gia thì Farm Owner mở cùng trang, BR-22); màn chuyên gia chỉ xem (dashboard, analytics, live stream, thu hoạch) là trang Farm Owner mở với nhóm role rộng hơn, không nhân bản sang `domain-expert/`. Không gom theo feature, không để file rải rác cạnh trang dùng nó.
2. **Vào `shared/` chỉ khi từ 2 role trở lên thật sự dùng.** Một role dùng thì về thư mục role đó, dù file trông "chung chung" tới đâu. Đây là luật chống `shared/` phình thành bãi rác.
3. **Thư mục cho biết role SỞ HỮU nghiệp vụ, không phải danh sách quyền.** Ví dụ `/devices` là một URL nhưng mỗi role một trang (`DevicesIndexRoute` trong `routes/technician.routes.tsx`): Farm Owner và Domain Expert mở `FarmOwnerDevicesPage`, Admin `AdminDevicesPage`, Farm Technician `TechnicianDevicesPage`. Quyền thật nằm ở `allow={...}` trong `routes/<role>.routes.tsx` — muốn biết ai vào được trang nào thì đọc `routes/`, không suy từ tên file.
4. **Mọi import dùng alias `@/`**, không dùng đường dẫn tương đối `../`. Nhờ vậy dời file chỉ phải sửa đúng đường dẫn của chính nó.
5. **Một tính năng = một thư mục.** Component/modal/hằng số riêng của một màn hình nằm cùng chỗ trong `components/features/<role>/<area>/`, kể cả khi chỉ một trang dùng.

### 12.2. Cây thư mục

```
frontend/src/
├── apis/                      Tầng HTTP — 1 file <resource>.api.ts mỗi tài nguyên
│   ├── admin/                 users.api · system.api
│   ├── auth/                  auth.api · invitations.api
│   ├── farm-owner/            analytics.api · telemetry.api · harvests.api
│   ├── domain-expert/         (đích) kiểm chứng cảnh báo, kết luận, duyệt thay đổi, đề xuất hệ số, tham số phát hiện, vòng đếm, lịch đếm
│   └── shared/                farms.api · alerts.api · devices.api
│                              audioTracks.api (Farm Owner ghi, các role khác đọc — ENV-FR-013c)
│
├── components/
│   ├── auth/                  RequireRole
│   ├── ui/                    Design system — KHÔNG biết domain (chỉ phụ thuộc lib/cn + i18n)
│   │                          primitive: Button Card Badge Input Select Textarea Toggle Modal
│   │                          tổ hợp:    DataTable Pagination FilterChip EmptyState
│   │                                     LoadingSkeleton ActionsMenu SelectMenu
│   │                                     ConfirmModal NoteActionModal ComingSoon
│   │                          + icons.tsx · useFloatingMenu.ts · index.ts (barrel duy nhất)
│   ├── common/                CÓ biết domain và dùng ở >= 2 nơi. Cố ý giữ nhỏ.
│   │                          NotificationPopover · Toast · ScopeFilter · StatusDot
│   │                          ProfilePopover · SeverityBadge · TableEmptyState
│   ├── features/              Component riêng của từng tính năng
│   │   ├── admin/             users/ · system/ · devices/ · audit-log/ · dashboard/
│   │   ├── farm-owner/        dashboard/ · analytics/ · farms/ · harvest/ · vision/ · devices/
│   │   ├── domain-expert/     (đích) alert-verdicts/ · health-reports/ · detection-tuning/ · change-reviews/
│   │   │                      · coefficient-proposals/ · counting-ring/ · counting-schedule/
│   │   └── technician/        devices/ · alerts/ · farms/ · onboarding/ · ota/
│   └── layouts/               Khung dùng chung và danh mục menu của mọi role
│                              menuCatalog · AppShell · AppSidebar · AppHeader
│
├── pages/                     CHỈ chứa *Page.tsx
│   ├── admin/                 AdminUsersPage · AdminAccountRequestsPage · AdminSystemHealthPage
│   │                          AdminSystemSettingsPage · AdminAuditLogPage
│   ├── farm-owner/            FarmOwnerDashboardPage · FarmOwnerAnalyticsPage · FarmOwnerFarmsPage
│   │                          FarmOwnerFarmHousesPage · FarmOwnerFarmZonesPage
│   │                          FarmOwnerFarmZoneDetailPage · FarmOwnerHarvestPage · FarmOwnerLiveStreamPage
│   │                          FarmOwnerVisionPage · FarmOwnerDevicesPage · FarmOwnerDeviceDetailPage
│   │                          FarmOwnerAlertsPage — /alerts của Farm Owner, Farm Technician và Admin
│   │                          FarmOwnerDeviceSetupPage — SF-01, /devices/onboarding
│   ├── domain-expert/         (đích) DomainExpert<ChứcNăng>Page — kiểm chứng cảnh báo, báo cáo
│   │                          sức khỏe Zone, duyệt thay đổi, duyệt đề xuất hệ số, tham số phát hiện,
│   │                          vòng đếm, lịch đếm
│   ├── technician/            TechnicianDevicesPage · TechnicianFarmsPage
│   ├── auth/                  LoginPage · ForgotPasswordPage · InvitationPage (không có đăng ký công khai —
│   │                          người được mời tạo tài khoản trên trang lời mời, G-02)
│   └── (gốc)                  SettingsPage · ForbiddenPage
│                              — 2 trang không thuộc nghiệp vụ role nào
│
├── routes/                    1 file cho mỗi thư mục pages/<role>/
│                              admin · farm-owner · domain-expert · technician · public
│
├── hooks/                     React Query hooks bọc apis/
│   ├── admin/                 useUsers · useSystem · useAccountRequests
│   ├── auth/                  useAuth · useInvitations
│   ├── farm-owner/            useAnalytics · useTelemetry · useHarvests
│   ├── shared/                useFarms · useAlerts (gồm usePendingAlertTotal) · useDevices
│   │                          useAlertNotifications (listener socket AppShell mount)
│   │                          useAudioTracks (Farm Owner ghi, các role khác đọc — ENV-FR-013c)
│   └── common/                Hạ tầng không gắn role:
│                              usePermission · useSocket · usePaginatedListQuery · useBreadcrumb
│
├── validations/               Hàm kiểm tra form, thuần logic
│   ├── admin/                 user.validation.ts
│   ├── farm-owner/            farm.validation.ts (vị trí farm) · audioTrack.validation.ts (bài loa ru) · …
│   └── common/                threshold.validation.ts · fuzzyTuning.validation.ts · speakerSchedule.validation.ts
│
├── types/                     Chia theo MODULE backend, không theo role (xem 12.7)
│                              auth · farm · device · telemetry · alert
│                              harvest · healthReport · vision · system · socket · expert · common
│                              + index.ts (barrel, giữ `@/types` chạy như cũ)
│
├── constants/                 roles (nhóm role + getRoleHomePath + canAccessPath)
│                              thresholds · auditActions · display · siteCause
│                              <module>.i18n.ts (dashboard · farmStructure · navigation · shell)
│                              (severity + severity.i18n — 4 cấp mức độ, 2.4 · enumLabels.i18n · error.i18n)
│
├── stores/                    Zustand: authStore · toastStore
│                              zoneStore · breadcrumbStore · languageStore · pinnedHouseStore
│
├── lib/                       axios · queryClient · socket · cn
│                              helpers · navigation · chartTheme · i18n (Hệ 2, mục 6)
│
├── i18n/                      Hệ dịch 1 (mục 6): index.ts (t · tr · trChildren · translated
│                              intlLocale · setLang) · en.ts (khoá tiếng Việt → tiếng Anh)
│
├── data/                      (tạo khi cần) <tên>.data.ts — NƠI DUY NHẤT chứa dữ liệu giả (mục 7)
│
├── providers/                 AppProviders.tsx — mọi provider bọc cây React
│
├── App.tsx                    Ghép các nhóm route + RoleLayout + 2 route không thuộc role nào
└── main.tsx                   Điểm vào, chỉ mount AppProviders
```

### 12.3. Bảng quyết định — file mới đặt ở đâu

Hỏi lần lượt 2 câu, dừng ở câu trả lời đầu tiên:

| # | Câu hỏi | Trả lời | Đặt vào |
|---|---|---|---|
| 1 | File có import `@/types` (enum nghiệp vụ), `@/hooks`, `@/apis` hoặc `@/stores` không? | **Không** | `components/ui/` — bất kể mấy nơi dùng |
| 2 | Có bao nhiêu role thật sự dùng? | **1 role** | thư mục của chính role đó (`features/<role>/<area>/`, `apis/<role>/`, `hooks/<role>/`) |
| 2 | | **>= 2 role** | `shared/` (với `apis/` · `hooks/`) hoặc `components/common/` (với component) |

Trường hợp đặc biệt: hạ tầng không gắn nghiệp vụ nào (`usePermission`, `useSocket`) → `hooks/common/`.

### 12.4. `pages/` — quy ước đặt tên `[Role][Chức năng]Page`

- Tên file **mang luôn tên role sở hữu**: `AdminUsersPage.tsx`, `FarmOwnerHarvestPage.tsx`, `TechnicianDevicesPage.tsx`.
- **Tên hàm component trùng tên file** — `export default function TechnicianDevicesPage()`.
- `pages/` **không có** thư mục `shared/` hay `public/`. Trang nhiều role dùng chung đặt ở thư mục role sở hữu nghiệp vụ chính (Thiết bị/Cảnh báo → `technician/`; Trang trại/Dashboard/Analytics/Thu hoạch/Camera và **thiết lập thiết bị bằng QR (SF-01)** → `farm-owner/`; kiểm chứng/kết luận/duyệt thay đổi/đề xuất hệ số/tham số phát hiện/vòng đếm/lịch đếm → `domain-expert/`).
- Trang không thuộc nghiệp vụ role nào để thẳng ở gốc `pages/`; màn đăng nhập/đăng ký/nhận lời mời ở `pages/auth/`.
- **Trong `pages/` không được có gì ngoài `*Page.tsx`.** Modal, tab, cột bảng, hằng số riêng của trang đều nằm ở `components/features/<role>/<area>/`.

### 12.5. `layouts/` — một danh mục menu cho mọi role

- `menuCatalog.ts` khai **một lần** mọi mục menu theo 4 nhóm cố định (Theo dõi · Vận hành · Chuyên môn · Hệ thống), mỗi mục `{ label, path, icon, tabs? }`: cùng một trang thì cùng tên, cùng icon Phosphor, cùng nhóm tab ở mọi vai trò (test `menuAccess.test.ts`). `tabs` gộp nhiều trang cùng một việc vào một mục menu (4.1); mỗi tab vẫn cần dòng `MENU_ACCESS` và nhãn trong `navigation.i18n.ts` (test bắt nhãn thiếu).
- `ROLE_PLAN` chỉ chọn cho mỗi role: thứ tự nhóm (nhóm việc chính đứng đầu), nhóm nào chỉ đọc (`readOnly`: thêm "(chỉ đọc)" và thu gọn được) hay chỉ thu gọn (`collapsible`), và 4 mục dock điện thoại. Mục, tab role đó không vào được (theo `MENU_ACCESS`) tự rơi khỏi menu; mục chỉ còn một tab thì mở thẳng trang đó, không hiện tab.
- Không có nhóm "Khác" hay mục Cài đặt trong menu: Cài đặt ở menu avatar (4.1).
- `AppShell` giữ toàn bộ khung (sidebar + header + nội dung + Toast) và mount listener socket cảnh báo. `AppSidebar` thuần trình bày, render cùng menu ở 2 breakpoint (rail `w-64` desktop + dock nổi mobile). `AppHeader` giữ tên trang (`h1`) + breadcrumb + khe thanh phạm vi + ngôn ngữ + chuông + menu avatar.
- `RoleLayout` trong `App.tsx` dựng `AppShell` với `roleMenu(user.role)` **lúc chạy**, vì URL của SwiftletCare không có tiền tố role (`/devices` dùng chung 3 role) nên không gắn layout theo nhánh route được.
- **Thêm trang vào menu:** thêm mục (hoặc tab) vào đúng nhóm trong `menuCatalog.ts`, dòng `MENU_ACCESS` trong `constants/roles.ts` cho các role được vào, và nhãn trong `navigation.i18n.ts`. Cho một role thấy hay không thấy một mục là đổi `MENU_ACCESS`, không sửa danh mục.

### 12.6. Ba tầng component — phân biệt `ui/` · `common/` · `features/`

| Tầng | Biết domain? | Số nơi dùng | Ví dụ |
|---|---|---|---|
| `ui/` | Không | bất kỳ | `Button` · `DataTable` · `EmptyState` · `ConfirmModal` |
| `common/` | Có | >= 2 | `ScopeFilter` · `StatusDot` |
| `features/<role>/<area>/` | Có | 1 | `ThresholdsModal` · `SensorCard` · `CreateUserModal` |

`ui/` là design system **tự chứa**: chỉ phụ thuộc `@/lib/cn` và `@/i18n` (dịch nhãn mặc định/prop chữ — không mang kiến thức domain). Không file nào trong `ui/` được import barrel `@/components/ui` của chính nó — import thẳng module anh em để tránh vòng lặp.

### 12.7. Ngoại lệ đã thống nhất — đừng "sửa lại cho đúng"

| Chỗ | Vì sao lệch quy tắc chung |
|---|---|
| `types/` chia theo **module backend**, không theo role | Type là shape thực thể mirror model Mongoose. `Zone`, `Alert`, `SensorNode` được 3 role đọc, không có chủ sở hữu duy nhất. Ép vào thư mục role thì hoặc phải nhân bản, hoặc 80% type dồn vào `types/shared/`. |
| `constants/roles.ts` giữ bảng `MENU_ACCESS` tách rời menu trong layout | Không thể đọc ngược menu từ file layout: `useAuth` cần `canAccessPath`, mà layout lại render `AppHeader` gọi `useAuth` → import vòng, lỗi lúc chạy. |
| `apis/shared/` + `hooks/shared/` còn tồn tại (10 file; `audioTracks`: Farm Owner ghi, mọi role đọc danh sách) | Đã kiểm bằng đồ thị import: `farms`/`alerts` được cả 4 role chạm tới vì chính khung app render `NotificationPopover` (cùng các trang farm của từng role); `devices` dùng bởi Farm Owner, Admin và Technician. **Không có `components/features/shared/`.** |

### 12.8. Checklist khi thêm một màn hình mới

1. Màn này thuộc nghiệp vụ role nào? → tạo `pages/<role>/<Role><ChứcNăng>Page.tsx`, tên hàm trùng tên file.
2. Khai route trong `routes/<role>.routes.tsx`, bọc `<RequireRole allow={...}>` bằng nhóm role lấy từ `constants/roles.ts`, chọn theo bảng phân quyền Report 3 §2.4:

   | Nhóm | Gồm | Dùng cho |
   |---|---|---|
   | `FARM_SIDE_ROLES` | Farm Owner · Domain Expert | So sánh nhà (`/analytics?tab=houses`, `/overview` chuyển sang đó), chi tiết thiết bị theo nhà (`/devices/detail`) |
   | `FARM_WORK_ROLES` | Farm Owner · Domain Expert · Farm Technician | Màn của nhà yến cho cả ba vai trò trại: tổng quan, phân tích, đếm chim, sức khoẻ và đánh giá ngày, phiếu công việc, bảo trì, khuyến nghị, vòng đếm, tham số chỉ đọc. Kỹ thuật viên chỉ thấy nhà được giao; nút backend trả 403 thì ẩn bằng `usePermission` |
   | `RELAY_CONTROL_ROLES` | Farm Owner · Farm Technician | Điều khiển tay relay (`/relay-control`) |
   | `HARVEST_ROLES` | Farm Owner · Domain Expert · Farm Technician | Thu hoạch: Farm Owner ghi và xác nhận, kỹ thuật viên ghi lần chờ xác nhận, chuyên gia chỉ xem |
   | `FARM_STRUCTURE_ROLES` | Farm Owner · Domain Expert · Farm Technician | Trang trại, nhà, Zone |
   | `DEVICE_LIST_ROLES` | Admin + `FARM_STRUCTURE_ROLES` | `/devices` (mỗi role một trang) |
   | `DEVICE_SETUP_ROLES` | Farm Owner | Lắp thiết bị (SF-01) |
   | `ALERT_ROLES` | Admin · Farm Owner · Farm Technician | `/alerts`; Domain Expert dùng trang kiểm chứng |
   | `EXPERT_DECISION_ROLES` | Domain Expert · Farm Owner | Trang quyết định `/domain-expert/*` (Farm Owner ghi theo BR-22) |
   | `EXPERT_ROLES` | Domain Expert | Hàng đợi việc, báo cáo và kết luận |
   | `ADMIN_ONLY` | Admin | Quản trị hệ thống, kho thiết bị và in nhãn |

   Domain Expert **không bao giờ** thuộc nhóm có hành động ghi vận hành (relay, ghi thu hoạch, acknowledge cảnh báo). Trang dùng chung có nút ghi (VD Thu hoạch mà chuyên gia chỉ xem) thì thêm chuyên gia vào `allow` và ẩn nút bằng `usePermission` (13.8).
3. Cần lên sidebar? → thêm `{ label, path, icon }` vào đúng nhóm trong `components/layouts/menuCatalog.ts`, dòng `MENU_ACCESS` (`constants/roles.ts`) và nhãn trong `navigation.i18n.ts`.
4. Endpoint mới → `apis/<role>/<resource>.api.ts`; hook bọc React Query → `hooks/<role>/use<Resource>.ts`.
5. Component riêng của màn → `components/features/<role>/<area>/`. **Không để trong `pages/`.**
6. Kiểu dữ liệu mới → `types/<module>.types.ts` (theo module backend), barrel `types/index.ts` tự re-export.
7. Form có kiểm tra hợp lệ → hàm thuần trong `validations/<role|common>/<tên>.validation.ts`, component chỉ gọi.
8. Chạy `npm run lint`, `npx tsc --noEmit`, `npx vitest run` và `npm run build` trước khi commit (xem 13.13) — CI chạy lại đúng các lệnh này.

### 12.9. Quy tắc đặt tên file

**Nguyên tắc gốc:** file nào *là một thực thể của React* (component, page, layout) → **PascalCase**, viết hoa chữ cái đầu của mọi từ, không gạch nối, không gạch dưới. File nào *là một module hạ tầng* (endpoint, kiểu dữ liệu, store, hằng số, tiện ích) → giữ quy ước đuôi phân loại của hệ sinh thái React/TypeScript. Trộn hai quy ước này là **cố ý**, không phải thiếu nhất quán — xem 12.11.

**Công thức tên:** tiền tố role **chỉ** dùng ở nơi thư mục không tự nói lên role.
- **Page** trong `pages/<role>/` và **layout** của role → bắt đầu bằng tên role PascalCase: `Admin`, `FarmOwner`, `DomainExpert`, `Technician` (URL không có tiền tố role nên tên file bù lại).
- **Component trong `components/features/<role>/<area>/`** → **không** tiền tố role, chỉ tên feature (`ThresholdsModal`, `CreateUserModal`) — đường dẫn `features/<role>/` đã nói role. Đây là quy ước đang chạy ở toàn bộ file trong `features/`; không đổi tên file cũ.
- File **không thuộc role nào** (`ui/`, `common/`, `auth/`, 4 trang gốc `pages/`) → không tiền tố role.
- **Tên hàm export trùng đúng tên file**: `AdminUsersPage.tsx` → `export default function AdminUsersPage()`.

| Lớp | Quy tắc tên | Ví dụ |
|---|---|---|
| `pages/<role>/` | `[Role][ChứcNăng]Page.tsx` | `AdminUsersPage.tsx` · `FarmOwnerHarvestPage.tsx` · `TechnicianDevicesPage.tsx` |
| `pages/auth/` + 2 trang gốc `pages/` | `[ChứcNăng]Page.tsx` — không role | `LoginPage.tsx` · `SettingsPage.tsx` · `ForbiddenPage.tsx` |
| `components/features/<role>/<area>/` | `[TênFeature].tsx` — không tiền tố role; cột bảng `<area>Columns.tsx` (camelCase, vì là hàm build cột chứ không phải component) | `CreateUserModal.tsx` · `CreateHarvestModal.tsx` · `RelayToggle.tsx` · `userColumns.tsx` |
| `components/layouts/` | `App[Phần].tsx` cho khung dùng chung · `menuCatalog.ts` cho danh mục menu | `AppShell.tsx` · `AppSidebar.tsx` · `menuCatalog.ts` |
| `components/ui/` · `components/common/` | `[TênFeature].tsx` — **không** tiền tố role | `DataTable.tsx` · `ConfirmModal.tsx` · `ScopeFilter.tsx` |
| `hooks/<bucket>/` | `use[Resource].ts` — camelCase, **bắt buộc** bắt đầu bằng `use` | `useUsers.ts` · `useFarms.ts` · `usePermission.ts` |
| `apis/<bucket>/` | `<resource>.api.ts` | `users.api.ts` · `farms.api.ts` |
| `types/` | `<module>.types.ts` | `auth.types.ts` · `device.types.ts` |
| `validations/<bucket>/` | `<resource>.validation.ts` | `user.validation.ts` · `threshold.validation.ts` |
| `routes/` | `<role>.routes.tsx` | `admin.routes.tsx` · `farm-owner.routes.tsx` |
| `stores/` | `<tên>Store.ts` — camelCase | `authStore.ts` · `toastStore.ts` |
| `constants/` · `lib/` · `providers/` | camelCase, tên nói đúng nội dung | `auditActions.ts` · `chartTheme.ts` · `AppProviders.tsx` |
| Thư mục | **kebab-case** cho tên role nhiều từ | `farm-owner/` · `domain-expert/` |

**Hằng số riêng của một feature** đi kèm component trong cùng thư mục, đặt `<area>.constants.ts`: `users.constants.ts`, `harvest.constants.ts`. Hằng số dùng chung toàn app thì về `constants/`.

### 12.10. Khi nào được tạo thư mục mới, và tạo ở đâu

Không tự sinh thư mục tuỳ ý. Chỉ 4 trường hợp dưới đây được tạo mới:

| Tình huống | Tạo ở đâu | Điều kiện |
|---|---|---|
| Thêm một **nhóm màn hình mới** cho role đã có | `components/features/<role>/<area-mới>/` | `<area>` đặt theo danh từ nghiệp vụ số nhiều, kebab-case nếu nhiều từ: `harvest/`, `account-requests/` |
| Thêm **role mới** vào hệ thống | Đồng thời 5 chỗ: `pages/<role>/` · `routes/<role>.routes.tsx` · `ROLE_PLAN` trong `components/layouts/menuCatalog.ts` · `apis/<role>/` và `hooks/<role>/` (chỉ khi có endpoint riêng) | Phải cập nhật luôn `Role` trong `types/common.types.ts`, `ROLE_LABEL` + `ROLE_HOME` + `MENU_ACCESS` trong `constants/roles.ts` |
| Một file trong `shared/` chuyển thành **chỉ 1 role dùng** (hoặc ngược lại) | Dời sang bucket đúng, tạo thư mục đích nếu chưa có | Kiểm bằng đồ thị import thật, không đoán. Một role dùng → về thư mục role; >= 2 role → `shared/` |
| Thêm một **lớp quan tâm mới** (VD `workers/`) | Cấp 1 trong `src/` | Chỉ khi thật sự là một lớp mới, và phải bổ sung vào cây ở mục 12.2 trước khi code |

**Không tạo:** `components/features/shared/` · thư mục con trong `pages/<role>/` · thư mục `components/` hay `utils/` riêng bên trong một feature · thư mục chỉ chứa đúng 1 file mà lớp cha đã đủ rõ.

### 12.11. Đối chiếu với quy ước doanh nghiệp

Cấu trúc này theo mô hình **phân lớp + cắt lát theo role** (layered + sliced) — cùng họ với `bulletproof-react` và Feature-Sliced Design, là mặc định của phần lớn dự án React quy mô vừa/lớn. Ba điểm bám chuẩn quan trọng nhất:

| Tiêu chí chuẩn ngành | SwiftletCare |
|---|---|
| Component PascalCase, tên file trùng tên component | Đạt — mọi file component và page |
| Hook `useXxx` camelCase | Đạt — đổi sang PascalCase sẽ làm quy tắc `react-hooks` của ESLint không nhận diện được, nên **không** áp PascalCase cho `hooks/` |
| Module hạ tầng dùng đuôi phân loại (`.api`, `.types`, `.validation`, `.routes`) | Đạt — giống Angular style guide (`*.service.ts`) và NestJS (`*.module.ts`); đây là lý do `apis/`, `types/`, `validations/`, `routes/` **không** PascalCase |
| Tầng UI không phụ thuộc domain | Đạt — `components/ui/` chỉ phụ thuộc `lib/cn` và `i18n` |
| Không có "thư mục rác" dùng chung phình to | Đạt — `common/` giữ ở mức nhỏ, không có `features/shared/`, `utils/` đã gộp vào `lib/` |
| Quyền truy cập khai tập trung | Đạt — toàn bộ `allow={...}` nằm trong `routes/`, nhóm role khai một chỗ ở `constants/roles.ts` |

**Khác biệt có chủ đích so với mẫu ngành:** `types/` chia theo module backend chứ không theo role (lý do ở 12.7), và tên page mang tiền tố role — mẫu ngành thường chỉ có `UsersPage.tsx` vì URL đã có tiền tố `/admin/`. SwiftletCare không có tiền tố role trên URL nên tiền tố được đưa vào tên file để bù lại.

### 12.12. Nên / Không nên

**Nên:** đặt file theo bảng 12.3 · đặt tên theo bảng 12.9 · tên trang mang tên role · giữ `pages/` chỉ có `*Page.tsx` · dùng alias `@/` · dời file sang bucket khác ngay khi số role dùng nó thay đổi · đọc `routes/` khi cần biết ai vào được trang nào.

**Không nên:** không tạo `components/features/shared/` · không để file một role dùng nằm trong `shared/` "để dành sau này" · không nhét component/modal vào `pages/` · không import `@/types`/`@/hooks`/`@/apis`/`@/stores` từ trong `components/ui/` (`@/i18n` thì được) · không suy quyền truy cập từ tên thư mục · không tách file chỉ vì nguyên tắc — số file ít và tên file tự nói lên chủ sở hữu quan trọng hơn.

---

## 13. Quy tắc code — áp dụng khi viết và khi review PR frontend

> Mục 1–12 nói *trông thế nào* và *đặt ở đâu*; mục này nói *viết thế nào*. Mỗi quy tắc có mức:
> **[Bắt buộc]** — vi phạm thì PR bị *Request changes*. **[Nên]** — góp ý, không chặn merge.
> Quy tắc chỉ áp cho code **thêm/sửa trong PR**; nợ cũ đã liệt kê ở 13.14 không tính vào PR không đụng tới nó.
> Mọi quy tắc ở đây đều khớp code đang chạy tại v2.4.0 — nếu thấy code cũ "vi phạm" mà không có trong 13.14, sửa tài liệu hoặc code trong cùng PR, đừng để hai bên lệch nhau.

### 13.1. Luồng dữ liệu — một chiều, qua hook

```
page / component  →  hooks/<bucket>/useX.ts  →  apis/<bucket>/x.api.ts  →  lib/axios.ts  →  backend
```

- **[Bắt buộc]** Component và page **không** import `@/lib/axios`, không gọi `fetch`, không gọi hàm trong `apis/` trực tiếp. Chỉ được `import type` từ `apis/` (VD `AnalyticsRange`, `CreateHarvestInput`).
- **[Bắt buộc]** Mỗi endpoint mới = 1 hàm trong `apis/<bucket>/<resource>.api.ts` + hook React Query trong `hooks/<bucket>/use<Resource>.ts`. Bucket chọn theo bảng 12.3.
- **[Bắt buộc]** Endpoint danh sách trả `{ data, meta: { page, limit, total } }` → hook dùng `usePaginatedListQuery` (`hooks/common/`), không tự bóc `meta` lại.
- **[Bắt buộc]** Đường dẫn, tên field, kiểu dữ liệu khớp `docs/api/api-spec.yaml` (nguồn sự thật hợp đồng API). Route **không** có tiền tố `/api/v1`; `lib/axios` đã gắn base `/api` (Vite proxy bỏ prefix). Không đoán field — endpoint chưa có trong spec thì phải có PR backend/spec đi kèm.

### 13.2. Server state — React Query

- **[Bắt buộc]** Dữ liệu lấy từ backend chỉ sống trong cache React Query. **Không** chép vào Zustand hay `useState` để "giữ cho tiện" (trừ giá trị nháp của form).
- **[Bắt buộc]** `queryKey` là mảng bắt đầu bằng tên resource, tham số theo sau: `['farms']`, `['farms', farmId]`, `['sensor-nodes', zoneId]`. Key mới phải khớp tiền tố của key đang có cho cùng resource để `invalidateQueries` bắt được.
- **[Nên]** Mutation tự `invalidateQueries` ngay trong hook (`onSuccess`), không để component phải nhớ. Dùng `queryClient` trực tiếp trong component chỉ khi cập nhật lạc quan/đặc thù màn đó (như `NotificationPopover`).
- **[Bắt buộc]** Không tự đặt `staleTime`/`retry` khác mặc định (`lib/queryClient.ts`: 30s, 1 lần) nếu không có lý do ghi bằng comment.

### 13.3. Client state — Zustand

- **[Bắt buộc]** Store chỉ giữ trạng thái **thuần client** dùng ở nhiều màn: `authStore`, `zoneStore` (zone đang chọn), `toastStore`, `breadcrumbStore`. Thêm store mới phải trả lời được "vì sao không phải React Query / state cục bộ".
- **[Nên]** Đọc store bằng selector (`useToastStore(s => s.push)`), không lấy cả object để tránh re-render thừa.

### 13.4. Realtime — Socket.io

- **[Bắt buộc]** Component/page **không** import `@/lib/socket`. Kết nối và đăng ký sự kiện đi qua hook (`useSocket`, `useTelemetry`, `useAlertNotifications`).
- **[Bắt buộc]** Mọi `on*`/`joinZone`/`joinHouse` trong `useEffect` phải huỷ ở cleanup (`off`/`leaveZone`/`leaveHouse`) — thiếu cleanup là rò listener mỗi lần đổi zone hoặc nhà.
- **[Bắt buộc]** Tên sự kiện và payload khớp backend và Report 4 §7.3: phòng `zone:<id>` (`JOIN_ZONE`), `house:<id>` (`JOIN_HOUSE` — số đếm chim, camera, cảnh báo của nhà yến), phòng riêng `user:<id>`; sự kiện `TELEMETRY_UPDATE`, `RELAY_UPDATE`, `DEVICE_STATUS_CHANGE`, `ALERT_NEW`, `BIRD_COUNT_UPDATE`, `NOTIFICATION_NEW`; type trong `types/socket.types.ts`.

### 13.5. Lỗi, loading, rỗng

- **[Bắt buộc]** Lỗi API hiển thị cho người dùng bằng **câu chung theo nhóm lỗi** (13.16 b) — qua toast (`useToastStore(s => s.push)(message, 'error')`) hoặc dòng lỗi dưới form. **Không** nuốt lỗi im lặng (`catch {}` trống), không in object lỗi thô, mã lỗi, stack ra UI.
- **[Bắt buộc]** Hành động thành công mà người dùng không tự thấy kết quả (lưu, xoá, gửi) → toast `success`.
- **[Bắt buộc]** Màn có dữ liệu bất đồng bộ phải có đủ 3 trạng thái: đang tải (`LoadingSkeleton`), rỗng (`EmptyState`), lỗi. Không để màn trắng.
- **[Bắt buộc]** Hành động phá huỷ/không hoàn tác (xoá, khoá tài khoản, tắt relay khẩn…) đi qua `ConfirmModal` theo 5.2; nút đang gửi request phải `disabled` để không bấm 2 lần.
- **[Bắt buộc] Error Boundary** — một component lỗi khi render không được làm trắng cả app:
  - `AppShell` bọc `<Outlet />` trong `ErrorBoundary` (component trong `components/ui/`, không biết domain), đặt `key={location.pathname}` để chuyển trang là tự hồi phục. App dùng `BrowserRouter` nên không dùng `errorElement` của data router.
  - Khối nặng dễ lỗi riêng (biểu đồ, video/live stream, bảng lớn) bọc thêm `ErrorBoundary` riêng để 1 khối hỏng không kéo cả trang.
  - Màn dự phòng dùng `EmptyState`: "Có lỗi khi hiển thị phần này" + nút **Thử lại** (reset boundary) + nút **Về trang chủ**. Không hiện `error.message` hay stack (13.16).
  - Trạng thái: **chưa có** (0 chỗ) — ghi ở 13.14.

### 13.6. TypeScript

- **[Bắt buộc]** Không `any`, không `as any`, không `@ts-ignore`/`@ts-expect-error` (code hiện tại: 0 chỗ). Kiểu chưa rõ → `unknown` rồi thu hẹp.
- **[Bắt buộc]** Kiểu thực thể lấy từ `@/types` (chia theo module backend, 12.7). Không khai lại interface `Zone`, `Alert`… cục bộ.
- **[Bắt buộc]** Enum (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`…) phải đồng bộ với `backend/src/types/domain.types.ts`. Đổi/thêm giá trị enum thì sửa **cả hai phía trong cùng PR** hoặc PR phải ghi rõ PR backend đi kèm.
- **[Bắt buộc]** `eslint-disable` chỉ được dùng từng dòng (`-next-line`), đúng 1 rule, kèm comment giải thích vì sao (như `ActionsMenu.tsx`, `useBreadcrumb.ts`). Cấm `eslint-disable` cả file.

### 13.7. Style

- **[Bắt buộc]** Màu chỉ lấy từ token trong `tailwind.config.ts`: thang `gray` / `lime` / `accent` / `orange` / `red` và alias `charcoal` · `graphite` · `warmGray` · `limeMist` (cũ, không dùng cho màn mới — xem 2.1) · `success` (= `accent-600` `#B5D32C`) · `climateOrange` · `safetyOrange` (`#FF7426`, lỗi thiết bị ở widget Trạng thái nhà yến) · `infoBlue` (`#4A89EB`, nhãn trạng thái cảnh báo "Mới") · `statusYellow` (`#FFE033`, nhãn "PLC: Đang chờ kết nối") · `alertRed` · `stone` · `white`. **Không** viết hex/`rgb()` trong `className` hay `style` (kể cả arbitrary value `bg-[#...]` — code hiện 0 chỗ), không dùng palette mặc định của Tailwind (`slate`, `zinc`, `neutral`, `blue`, `green`…). Lưu ý `stone` đã bị ghi đè = `#EAEAEA` (canvas), không phải thang stone của Tailwind.
- **[Nên]** Chữ dùng thang `text-h1` · `text-h2` · `text-h3` · `text-body` · `text-small` · `text-caption` · `text-metric` (mục 2.8) thay cho `text-sm`/`text-2xl` mặc định. Code cũ còn ~230 chỗ dùng size mặc định (13.14) nên chưa bắt buộc; file mới tạo thì nên dùng thang này ngay từ đầu.
- **[Bắt buộc]** Modal/popup dùng `Modal` / `ConfirmModal` / `NoteActionModal` trong `components/ui/`, không tự dựng overlay (overlay tự dựng rất dễ dùng `bg-black/…` — trái 5.2).
- **[Bắt buộc]** Không sửa layout/kích thước sidebar, topbar (4.1).
- **[Nên]** Dùng `cn()` (`lib/cn`) để ghép class điều kiện thay vì nối chuỗi template.

### 13.8. Phân quyền

- **[Bắt buộc]** Trang mới được chặn bằng `<RequireRole allow={...}>` trong `routes/<role>.routes.tsx`, nhóm role lấy từ `constants/roles.ts` — không viết mảng role literal tại chỗ.
- **[Bắt buộc]** Ẩn/disable nút theo quyền dùng `usePermission(...)`, không rải `user.role === '...'` trong component (so sánh role của **dòng dữ liệu** để hiển thị — như cột role trong bảng user — thì được).
- **[Bắt buộc]** Ẩn UI **không phải** là bảo mật. Hành động nhạy cảm phải được backend chặn; PR thêm nút mới cho role nào thì endpoint tương ứng phải cho phép đúng role đó (đối chiếu `requireRole` phía backend / spec).
- **[Bắt buộc]** Thêm mục menu: thêm vào `menuCatalog.ts` **và** dòng `MENU_ACCESS` trong `constants/roles.ts` (12.5); không khai menu riêng cho một role.

### 13.9. Dữ liệu giả & tính năng chưa có

- **[Bắt buộc]** Tính năng chưa có API thật: dùng `ComingSoon` (`components/ui/`), hoặc hiển thị số liệu giả **kèm** dòng thông báo theo 5.4 và bảng mục 7. Không đưa số liệu hardcode lên như thật.
- **[Bắt buộc]** Không để lại dữ liệu mock/hardcode ở màn **đã** có API thật (mục 7 ghi "Không cần nhãn").

### 13.10. Routing & hiệu năng

- **[Bắt buộc]** Trang mới được `lazy()` trong file `routes/` của role (code-splitting; hiện mọi trang đều lazy, kể cả `SettingsPage` trong `App.tsx`). Không import tĩnh trang vào `App.tsx` hay file route.
- **[Bắt buộc]** Không import thư viện nặng (`chart.js`, `react-chartjs-2`, `recharts`, `date-fns`, `video.js`, `leaflet`) vào file nằm trong bundle chính: `App.tsx`, `components/layouts/`, `components/common/`, `components/ui/`, `stores/`, `lib/` (trừ `lib/chartTheme.ts`).
- **[Nên]** Danh sách dài dùng phân trang server (`usePaginatedListQuery` + `Pagination`), không tải hết rồi cắt ở client.

### 13.11. Accessibility tối thiểu

- **[Bắt buộc]** Hành động bấm được là `<button>` (hoặc `Button`), điều hướng là `<Link>`/`NavLink` — không `div onClick` cho hành động (wrapper chỉ để `stopPropagation`, như cột ⋯ của `AlertTable`, thì được).
- **[Bắt buộc]** Nút chỉ có icon phải có `aria-label` tiếng Việt.
- **[Bắt buộc]** Input trong form có label gắn đúng (`Input`/`Select`/`Textarea` của `ui/` đã hỗ trợ `label`).
- **[Nên]** Trạng thái không chỉ truyền bằng màu — kèm chữ hoặc icon (mục 2.6 đã yêu cầu icon + label cho cảm biến).

### 13.12. Vệ sinh code

- **[Bắt buộc]** Không để `console.log`/`console.debug` (hiện 0 chỗ), không để code bị comment-out, không để import/biến thừa (ESLint `no-unused-vars` sẽ báo).
- **[Bắt buộc]** Mọi import dùng alias `@/` (12.1).
- **[Bắt buộc]** Comment chỉ **1 dòng** dạng `// <tên hoặc tính năng>` trên khối code/chart/button/hàm (`// Bảng nhật ký cảnh báo`, `// Nút tạo trang trại`). Không khối `/** … */` nhiều dòng, không giải thích lại code. Áp cho code mới/sửa; comment cũ dọn khi sửa file.
- **[Bắt buộc]** Tên file, hàm, biến viết đủ chữ, không viết tắt (phần đầu tài liệu, quy tắc bổ sung #1).
- **[Bắt buộc]** Mỗi lần render/xử lý ≤ O(n): tra cứu theo id bằng `Map` dựng 1 lần trong `useMemo`, không `find` lồng trong `map`; logic viết tuần tự, dễ đọc ở mức Junior.

### 13.13. Trước khi mở PR

- **[Bắt buộc]** Các lệnh sau pass trong `frontend/`: `npm run lint` (không lỗi; warning không chặn) · `npx tsc --noEmit` · `npx vitest run` · `npm run build`. CI (`.github/workflows/ci.yml`, job Frontend) chạy lại đúng các lệnh này trên mỗi PR sửa `frontend/`; PR có job đỏ thì chưa merge.
- **[Bắt buộc]** PR điền đủ `.github/pull_request_template.md`; commit theo `.commitlintrc.json` (scope FE thường dùng: `web`, `pwa`).
- **[Bắt buộc] Tên nhánh** `<type>/<module>-<role>-<tính-năng>`, toàn chữ thường, nối bằng gạch ngang, tách từ develop và mở PR vào `develop`:
  - `type` lấy từ `type-enum` của commitlint: `feat` · `fix` · `refactor` · `perf` · `test` · `docs` · `chore` · `style`.
  - `module`: `fe` (frontend) · `be` (backend) · `fw` (firmware) · `mobile` · `ai`.
  - `role` viết liền: `farmowner` · `expert` · `technician` · `admin`; tính năng chung nhiều role thì bỏ phần role.
  - Ví dụ: `feat/fe-farmowner-farm-location`, `fix/fe-technician-ota-upload`, `refactor/fe-shared-level-badge`. Không dùng `feature/…`, không đặt tên cá nhân hay ngày tháng.
- **[Bắt buộc]** PR đổi giao diện đính kèm ảnh chụp màn hình (desktop + mobile width) vào mô tả PR.
- **[Nên]** Logic thuần (validation, helper, format) mới thêm có test vitest `*.test.ts` cạnh file (đã có 7 file mẫu, VD `validations/common/fuzzyTuning.validation.test.ts`).
- **[Bắt buộc] Tự kiểm sau mỗi lần code** (người viết, kể cả Claude Code — làm sau **mỗi** prompt có sửa code, trước khi báo xong):
  1. Đọc lại toàn luồng của role vừa sửa: route + `allow` → page → component → hook → api → endpoint backend (đối chiếu `docs/api/api-spec.yaml`).
  2. Đối chiếu quyền với 12.0 (bảng a): role đó có được thấy/bấm nút này không; Domain Expert không có nút ghi vận hành.
  3. Đi lại từng thao tác người dùng: đang tải, rỗng, lỗi, thành công, F5, quay lại; đổi VI/EN nếu màn có từ điển.
  4. Không có dữ liệu giả ngoài `src/data/` (mục 7), không màu ngoài token, UI khớp 1.1.
  5. Không có vòng lặp lồng vượt O(n), không tên viết tắt, comment đúng 1 dòng.
  6. Chạy `npm run lint` · `npx tsc --noEmit` · `npx vitest run`; báo lại kết quả thật (kể cả lỗi có sẵn).

### 13.14. Nợ đã biết — không tính vào PR không đụng tới

| Chỗ | Vi phạm | Cách trả nợ |
|---|---|---|
| ~~`pages/technician/TechnicianDevicesPage.tsx`~~ | ~~Gọi `queryClient.invalidateQueries` ngay trong page (13.2 [Nên])~~ | ✅ Đã bỏ cùng các nhánh Farm Owner / Admin (G-29, `todo-audit-1119.md` §9) |
| Mục 6 i18n | Hai hệ dịch song song (`src/i18n/` cho Admin + `ui/`; `useTranslation` + `*.i18n.ts` cho Farm Owner, Technician farms, khung app); nhiều màn vẫn hardcode tiếng Việt | PR riêng gộp về một hệ, sau đó 13.x mới yêu cầu `t('...')` |
| `StatCard` cục bộ trong `AdminSystemHealthPage` | Mục 9 muốn dùng chung | Tách ra khi màn thứ hai cần |
| Chưa có `ErrorBoundary` (0 chỗ) | 13.5 | Thêm `ui/ErrorBoundary.tsx`, bọc `<Outlet />` trong `AppShell` |
| `getApiErrorMessage` trả câu lỗi nguyên văn của backend — màn trang trại, thiết bị của Farm Owner đã chuyển; khoảng 40 file còn gọi `getApiErrorMessage` | 13.16 b | Màn khi sửa đổi sang `useApiErrorMessage()` (`hooks/common/`); hết chỗ gọi thì xoá `getApiErrorMessage` |
| Chưa có Prettier, husky, lint-staged; ESLint thiếu rule ở 13.15 | 13.15 | 1 PR cài công cụ + 1 commit format toàn bộ |
| `formatDate`/`formatDateOnly` (`lib/helpers.ts`), `day`/`time` của `useTranslation` lệch chuẩn 6.1 | 6.1 | Chuyển sang `formatStandardDate`/`formatHourMinute`/`formatDateTime` khi sửa màn |
| ~~Màn Admin/Technician còn hiện mã rút gọn từ id (`TechnicianAlertsPage`, bảng OTA)~~ | 13.16 a | ✅ Đã gỡ ở PR #106 — tra tên Zone (`useAllZones`) và mã thiết bị (`useSensorNodes`) |
| Nhãn mã backend khai riêng/viết cứng ngoài `enumLabels.i18n.ts`: `STATUS_LABEL` (`common/StatusDot.tsx`), `ROLE_LABEL` (`constants/roles.ts`), bản dịch trùng trong `src/i18n/en.ts` | 6.3 | Người phụ trách role đó chuyển sang đọc `enumLabels.i18n.ts` khi sửa màn |
| ~230 chỗ `text-xs`/`text-sm`/`text-lg`/`text-2xl`… | Lệch thang chữ 2.8 (13.7 [Nên]) | Đổi dần khi sửa file đó |
| ~~`pages/sales-staff/` · `routes/sales-staff.routes.tsx` · `SalesStaffLayout` · role `SALES_STAFF`, form tạo chuyên gia và tab đề xuất chuyên gia của Admin~~ | Role đã bỏ từ SRS v1.23.0 | ✅ Đã gỡ ở PR #106; Admin chỉ tạo Kỹ thuật viên (AUTH-FR-005c) |
| ~~`MarketplacePage` · `ListingDetailPage` · route công khai marketplace · `useMarketplace` · `marketplace.api` · kiểu `NestListing`/`ContactInquiry`/`ListingStatus`~~ | Ngoài phạm vi (Report 3 §8) | ✅ Đã gỡ ở PR #93; `HarvestStatus` chỉ còn `DRAFT` (bỏ `ARCHIVED` ở PR #113, G-01). Gói `qrcode` vẫn giữ cho nhãn thiết bị và mã QR tầng (SF-01) |
| Màn `DOMAIN_EXPERT` nằm ở `expert/`, `ExpertLayout`; chưa có `FARM_SIDE_ROLES`/`EXPERT_ONLY` | Mục 12 mô tả trạng thái đích | Dời theo checklist "Thêm role mới" ở 12.10 |
| ~~Trường `heating` trong `RelayStates` (`types/device.types.ts`), tùy chọn kênh Zalo/SMS ở `SettingsPage`~~ | Ngoài phạm vi (Report 3 §8) | ✅ Đã gỡ ở PR #113 (G-01) |
| ~~`/onboarding` chỉ là màn Technician nhập tay Device ID + khoá~~ | SF-01 (12.0 c dòng 5b) | ✅ `FarmOwnerDeviceSetupPage` ở `/devices/onboarding`, `DEVICE_SETUP_ROLES`; quét QR ở mobile (G-29) |
| Chữ "PLC" trên Dashboard; mốc 20 giây và mốc điểm cân bằng Zone tự chọn; câu "Camera AI đếm chim, Raspberry Pi" ở `BirdTab`, `CorrelationCard` | 6.2, 2.6.1; Report 3: nút AI là PC/máy chủ, không phải Raspberry Pi | Đổi chữ thành "Bộ điều khiển", "nút AI" khi sửa màn; mốc giữ đúng giá trị ghi ở Report 3 §4.5 |

PR đụng vào file trong bảng thì **nên** trả nợ luôn; bắt buộc chỉ khi PR làm nợ nặng thêm (VD thêm consumer thứ hai vẫn chỉ của Technician vào `shared/`, hoặc thêm lại ticket, SLA, vùng, Sales Staff, Marketplace, sưởi, Zalo/SMS — các phần này đã gỡ hoặc chỉ được gỡ, không được mở rộng).


### 13.15. Công cụ tự kiểm — Prettier, ESLint, pre-commit

Quy tắc định dạng ở đầu tài liệu phải do máy bắt, không trông vào trí nhớ. Cấu hình **đích** (chưa cài — làm trong 1 PR riêng):

```json
// frontend/.prettierrc
{
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid"
}
```

| Công cụ | Việc | Ghi chú |
|---|---|---|
| Prettier + `prettier-plugin-tailwindcss` | Định dạng code, tự sắp thứ tự class Tailwind | Script `npm run format` / `format:check`; CI chạy `format:check` |
| `eslint-config-prettier` | Tắt rule ESLint đụng với Prettier | Thêm cuối `extends` |
| Rule ESLint thêm | `no-nested-ternary: error` · `complexity: ['warn', 10]` · `max-depth: ['warn', 3]` · `id-length: ['warn', { min: 2, exceptions: ['_', 'i', 'x', 'y'] }]` · `@typescript-eslint/explicit-function-return-type: ['warn', { allowExpressions: true }]` · `no-console: error` | Hỗ trợ quy tắc "dễ đọc, không viết tắt" — tên viết tắt dài hơn 1 chữ vẫn phải người review bắt |
| husky + lint-staged | Trước mỗi commit: `eslint --fix` + `prettier --write` trên file `.ts/.tsx` đang stage trong `frontend/` | Repo không có `package.json` gốc → cài trong `frontend/` với script `"prepare": "cd .. && husky frontend/.husky"` |

- Khi cài: format lại toàn bộ `frontend/src` trong **1 commit riêng** `style(web): format with prettier` để diff tính năng không lẫn đổi định dạng.
- **[Bắt buộc]** Không tắt hook bằng `--no-verify`; hook báo lỗi thì sửa code.

### 13.16. Không lộ thông tin nội bộ

**a) Không hiện id, mã, enum thô** — **[Bắt buộc]** cho mọi role:
- Không hiện `_id` MongoDB, mã rút gọn từ id (`#6A8494`), khoá enum (`UNEXPECTED_RESTART`, `HIGH`, `ACKNOWLEDGED`) trên giao diện, `title`, `aria-label` hay HTML. Luôn đổi sang nhãn qua từ điển (`type.<ENUM>`, `status.<ENUM>`) hoặc bảng nhãn chung (2.4).
- Không đưa id lên URL khi không cần chia sẻ link: trang chi tiết nhận id qua **history state** (`navigate(path, { state })`) — mẫu `DEVICE_DETAIL_PATH` của trang thiết bị Farm Owner; không có state (mở tab mới) thì quay về danh sách. Mã thiết bị in trên nhãn (`node_001`) là tên người dùng đọc được, được hiện.
- Chuỗi backend/firmware tự ghép (có mã enum, tiếng Anh, `undefined`) không hiện nguyên văn — dựng lại câu từ loại + dữ liệu đã dịch (mẫu khung báo lỗi thiết bị Farm Owner).
- **[Bắt buộc] Chữ phụ (dòng xám, gợi ý, mô tả) phải đúng với dữ liệu thật** — không viết câu chung chung có thể sai: cảnh báo hệ thống tự sinh không ghi "Đã gửi"; chưa có ai xác nhận thì không ghi "đã tiếp nhận"; mô tả ở đầu trang chỉ hiện khi đúng người tạo đã nhập; mỗi ghi chú ghi rõ người viết (Hệ thống · Bạn · Kỹ thuật viên · Thành viên khác — suy từ id người viết).
- Ghi chú: tab Network của trình duyệt vẫn thấy id — đó không phải lỗ hổng; quyền thật do backend chặn (13.8).

**b) Lỗi API gộp theo nhóm — 1 câu chung, không chi tiết từng mã** — **[Bắt buộc]**. Không hiện mã HTTP, mã lỗi backend (`error.code`), câu lỗi nguyên văn của backend, endpoint, stack — tránh lộ cấu trúc hệ thống cho người dò lỗi:

| Nhóm | Mã gộp vào | Câu hiện (VI) | Câu hiện (EN) | Hành vi thêm |
|---|---|---|---|---|
| Phiên / quyền | 401 (sau khi làm mới phiên thất bại), 403 | Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn. | You don't have permission for this action or your session has expired. | 401 `TOKEN_EXPIRED` vẫn tự làm mới phiên trước (`lib/axios.ts`); hết cách thì về `/login`. Mở trang không đủ quyền → `/403` |
| Không tìm thấy | 404, 410 | Không tìm thấy dữ liệu hoặc dữ liệu đã bị xoá. | The data was not found or has been removed. | Trang chi tiết hiện `EmptyState` + nút về danh sách |
| Dữ liệu không hợp lệ / xung đột | 400, 409, 413, 415, 422 | Thông tin chưa hợp lệ hoặc đã thay đổi. Vui lòng kiểm tra lại. | The information is invalid or has changed. Please check and try again. | Lỗi từng ô do **validator phía client** (`validations/`) báo ngay dưới ô, không lấy câu backend |
| Hệ thống / mạng | 429, 5xx, hết thời gian chờ, không có phản hồi | Không kết nối được hệ thống. Vui lòng thử lại sau. | Could not reach the system. Please try again later. | Có nút **Thử lại**; màn realtime chuyển "Tự làm mới" (5.5) |

- Câu của 4 nhóm khai 1 lần trong `constants/error.i18n.ts` (`errorDict`); `lib/apiError.ts` (`getApiErrorGroup`) đổi lỗi → nhóm theo mã HTTP; màn gọi `const apiErrorMessage = useApiErrorMessage()` (`hooks/common/`) rồi `apiErrorMessage(error, t('toast.farmCreateFailed'))` → "Tạo trang trại thất bại. " + câu nhóm.
- Mẫu: trang chi tiết lỗi 404 hiện "Không tìm thấy", nhóm khác hiện "Không mở được" + câu nhóm; khung số liệu (KPI) tải lỗi thì hiện câu nhóm + nút **Thử lại**, không hiện số 0 thay cho số chưa tải được.
- Nợ: `getApiErrorMessage` (`lib/helpers.ts`) vẫn trả câu lỗi nguyên văn của backend, còn ở các màn Admin/Technician/auth và một số màn Farm Owner — đổi khi sửa màn (13.14).

### 13.17. Chiến lược kiểm thử

| Tầng | Công cụ | Bắt buộc khi | Trạng thái |
|---|---|---|---|
| Logic thuần (validator, helper, hàm tính trong `*.ts` của feature, cấu hình chung như `severity.ts`) | vitest, file `*.test.ts` cạnh file nguồn | **[Bắt buộc]** mỗi hàm logic mới hoặc sửa hành vi | Có (7 file) |
| Hook React Query, component có logic (bảng, form, badge dùng chung) | vitest + `@testing-library/react` + `jsdom` | **[Nên]** với component dùng chung ở `common/`, form có validate | Chưa cài |
| Luồng chính end-to-end | Playwright 1.64.1, `e2e/*.spec.ts` (`npm run test:e2e`, job CI `e2e` trên backend đã seed) | **[Nên]** trước mỗi vòng review hội đồng | Đã cài; có luồng đăng nhập từng role (`e2e/login.spec.ts`) |

Luồng e2e tối thiểu (khi cài Playwright): đăng nhập từng role và về đúng trang chủ · Farm Owner xác nhận cảnh báo · Farm Owner can thiệp tay relay có thời hạn · Domain Expert kiểm chứng cảnh báo (khi có màn) · Domain Expert duyệt thay đổi ngưỡng của chủ farm (khi có endpoint) · đổi VI/EN trên 1 màn có từ điển. Thiết lập thiết bị bằng QR (SF-01) kiểm trên mobile.

- Test đặt tên theo hành vi bằng tiếng Việt hoặc tiếng Anh nhất quán trong file (`it('gộp CRITICAL vào Khẩn cấp')`).
- Không gọi backend thật trong unit test; dữ liệu mẫu cho test đặt ngay trong file test (không phải dữ liệu giả hiển thị — mục 7 chỉ áp cho dữ liệu lên giao diện).
- Bug sửa xong thì thêm 1 test tái hiện bug đó nếu nằm ở logic thuần.

---

## Phụ lục A — Nguồn gốc màu v2.1 (thay `#111728`)

| Token | Hex | Nguồn |
|---|---|---|
| `--gray-900` (Charcoal) | `#27231F` | Chỉ định trực tiếp — thay `#111728` (H224°→H30°, loại bỏ ám xanh dương) |
| `--gray-700` (Graphite) | `#4E4A46` | Chỉ định trực tiếp |
| `--gray-500` (Warm Gray) | `#878380` | Chỉ định trực tiếp |
| `--gray-950` (Black) | `#000000` | Chỉ định trực tiếp — dự phòng |
| `--lime-300` (Lime Mist) | `#ECFFA9` | Chỉ định trực tiếp — cập nhật từ `#F0FEB3` |
| `--gray-200` | `#EAEAEA` | Giữ nguyên giá trị "nền chính" đã chốt trước đó, không nội suy lại |
| `--gray-0/50/100/300/400/600/800` | — | Nội suy HSL giữa các neo trên, cùng hue ~28° |

## Phụ lục B — Phụ lục màu v2.0 gốc (bối cảnh trước khi sửa Ink)

| Token | Hex | Nguồn |
|---|---|---|
| `--bg-canvas` | `#EAEAEA` | Chỉ định trực tiếp — "màu nền chính" |
| `--orange-500` | `#ED8F50` | Chỉ định trực tiếp — thay `#D0654C` |
| `--red-500` | `#D53F35` | Chỉ định trực tiếp |
| `--accent-300` | `#D5E688` | Chỉ định trực tiếp — thay `#42926A` |
| Bố cục nền cố định + blob blur, card trắng nổi khi cuộn | — | Tổng hợp phong cách từ ảnh tham khảo dashboard, tái tô hoàn toàn bằng bảng màu SwiftletCare |

## Phụ lục C — Tóm tắt v1.0.0 → v2.0.0

Đổi nền canvas trắng→xám; đổi 4 mã màu chính (D0654C→ED8F50, thêm D53F35, 42926A→D5E688, thêm F0FEB3/nay ECFFA9); logo chữ→logo ảnh; font Inter→Plus Jakarta Sans; thêm hệ nền cố định+blur; icon-box đổi kiểu nền nhạt/icon đậm; đóng băng sidebar/topbar; thêm i18n, popup xác nhận nền mờ, chính sách công khai dữ liệu giả, ma trận chọn chart, đồng bộ bố cục đa role.


## Phụ lục D — Danh mục dùng chung cho mọi role (tra trước khi viết mới)

> **[Bắt buộc]** Trước khi tự viết component, màu, nhãn, định dạng hay hook: tra bảng này. Có sẵn thì import, thiếu thì bổ sung vào đúng file chung rồi ghi thêm 1 dòng ở đây — không viết bản riêng trong thư mục role. Mọi đường dẫn tính từ `frontend/src/`. ⏳ = chưa có trên `develop`, chưa import được.

### D.1. Màu, mức độ, trạng thái, nhãn

| Mục | Đường dẫn | Xuất ra | Mục quy định |
|---|---|---|---|
| Token màu, bo góc, bóng, cỡ chữ | `../tailwind.config.ts` | `charcoal` `graphite` `warmGray` `limeMist` `success` `climateOrange` `safetyOrange` `infoBlue` `statusYellow` `alertRed` · `rounded-xl/2xl/3xl` · `shadow-card/popover/glass` · `text-h1…text-metric` | 2, 2.8, 4.3 |
| Class CSS chung | `index.css` | `.input` · `.label-caption` · `.glass-panel` | 1.1, 2.8, 5.2.1 |
| 4 cấp mức độ — màu | `constants/severity.ts` | `LEVELS` · `SEVERITY_TO_LEVEL` · `LEVEL_BADGE_CLASS` · `LEVEL_BADGE_MUTED_CLASS` · `LEVEL_BADGE_SIZE` · `isAlertFinished` | 2.4 |
| 4 cấp mức độ — nhãn VI/EN | `constants/severity.i18n.ts` | `levelDict` · `severityLabels()` | 2.4 |
| Nhãn mã backend VI/EN | `constants/enumLabels.i18n.ts` | `alertTypeDict` · `alertStatusDict` · `deviceStatusDict` · `roleDict` · `prefixLabels()` | 6.3 |
| Ngưỡng cảm biến | `constants/thresholds.ts` | khoảng hợp lệ ngưỡng Zone | — |
| Giá trị trống | `constants/display.ts` | `NO_VALUE` (`_`) — thông số chưa có dữ liệu | 6.1 |
| Nguyên nhân tại chỗ | `constants/siteCause.ts` | `SITE_CAUSES` · `CAUSE_ALERT_TYPES` (ALERT-FR-018) | — |
| Nhóm role, trang chủ theo role, quyền menu | `constants/roles.ts` | `OPS_ROLES` · `FARM_OWNER_ONLY` · `HARVEST_ROLES` · `ADMIN_ONLY` · `ROLE_HOME` · `MENU_ACCESS` · `canAccessPath` | 12.0, 12.8 |
| Nhãn hành động audit log | `constants/auditActions.ts` | nhãn hành động | — |

### D.2. Component dùng chung

**`components/ui/`** — không biết domain, mọi role dùng (import qua barrel `@/components/ui`, riêng `icons.tsx` import thẳng):

| Nhóm | Component |
|---|---|
| Nền tảng | `Button` · `Card` · `Badge` · `Input` · `Select` · `Textarea` · `Toggle` · `Avatar` · `DatePicker` (ô ngày dd/mm/yyyy + lịch tháng, thay `<input type="date">`) · `icons.tsx` |
| Bảng, danh sách | `DataTable` (bảng chuẩn, `onRowClick`, `mobileCard` cho điện thoại) · `FixedRowsTable` (cố định số dòng) · `Pagination` · `FilterChip` · `SortChips` · `SearchInput` · `ClearFiltersButton` (nút "Hủy lọc") |
| Khung, ô số liệu | `SectionCard` (prop `help` mở `InfoTip`) · `InfoTip` (nút (i) giải thích dài) · `RadialGauge` · `Stepper` (thanh tiến độ) · `StableHeight` (giữ chiều cao khung) |
| Lớp nổi | `Modal` · `ConfirmModal` · `NoteActionModal` (popup nhập lý do) · `Drawer` · `ActionsMenu` · `SelectMenu` · `useFloatingMenu.ts` |
| Trạng thái màn | `EmptyState` (lỗi tải / chưa có farm-nhà-Zone) · `LoadingSkeleton` · `ChartEmptyFrame` (khung biểu đồ khi chưa có dữ liệu, mục 8) · `ComingSoon` (tính năng chưa có API) |

**`components/common/`** — có biết domain, ≥ 2 nơi dùng:

| Component | Dùng để | Mục |
|---|---|---|
| `SeverityBadge` | Badge mức cảnh báo (mỗi mức backend một cấp, xám khi `isMuted`) | 2.4 |
| `TableEmptyState` | Trạng thái rỗng chuẩn của bảng (truyền vào `FixedRowsTable emptyContent`) | 1.1 |
| `StatusDot` | Chấm + chữ trạng thái thiết bị | 2.5 |
| `ScopeFilter` | Khung lọc Trang trại → Nhà → Zone chung các trang Farm Owner (mặc định tất cả trang trại; ô Nhà khoá khi chưa chọn farm, ô Zone chỉ hiện khi đã chọn nhà), lưu khi chuyển trang (`hooks/shared/useScopeFilter`). Trang có bậc trong `scopeLevelOf` thì tự chọn bậc đó và bỏ mục "Tất cả" | — |
| `KpiTile` | Ô chỉ số của hàng KPI mọi role (`tone`, `iconClass`, `badge`, `valueBadge`) | 1.1 |
| `LanguageToggle` | Công tắc VI/EN (header; menu avatar dưới `sm`) | 4.1 |
| `NotificationPopover` · `ProfilePopover` · `Toast` | Khung app: chuông, tài khoản, đăng xuất, thông báo nổi | 5.2.1 |

**Khung app và phân quyền:** `components/layouts/AppShell.tsx` · `AppSidebar.tsx` · `AppHeader.tsx` (dùng chung, 4.1) · `components/auth/RequireRole.tsx` (chặn route).

**Component của Farm Owner được phép dời lên `common/`** khi role thứ hai cần (1.1): `features/farm-owner/farms/FarmFrame.tsx` (khung section) · `features/farm-owner/harvest/HarvestTable.tsx` (mẫu cột bảng).

### D.3. Định dạng, dịch, tiện ích (`lib/`)

| Đường dẫn | Xuất ra | Mục |
|---|---|---|
| `lib/i18n.ts` | `Dictionary<K>` · `translate` · `formatStandardDate` · `formatHourMinute` · `formatDateTime` · `formatTimestampsInText` · `formatNumber` · `formatRelative` | 6, 6.1 |
| `i18n/index.ts` · `i18n/en.ts` · `i18n/en.expert.ts` | Hệ dịch 1 (Admin, Domain Expert, `ui/`): `t` · `tr` · `trChildren` · `translated` · `intlLocale` · `setLang` | 6 |
| `lib/cn.ts` | `cn()` ghép class (tailwind-merge) | 13.7 |
| `lib/deviceCommand.ts` | `restartBlockCode` · `restartBlockReason(node, say)` · `RESTART_SUPPORT_SINCE`: điều kiện khởi động lại từ xa (online, firmware từ 1.4.0), dùng ở trang Thiết bị của Quản trị viên và Kỹ thuật viên; nơi gọi tự dịch mã lý do | 6, 13.16 |
| `lib/deviceLocation.ts` | `nodeLocation()` — "Farm | Nhà | Tầng | Zone" của thiết bị trong `GET /devices/system-status` (Admin) | — |
| `lib/apiError.ts` · `constants/error.i18n.ts` · `hooks/common/useApiErrorMessage.ts` | `getApiErrorGroup` · `errorDict` · `useApiErrorMessage()` — câu lỗi API theo 4 nhóm | 13.16 b |
| `lib/helpers.ts` | `getApiErrorMessage` (nợ 13.16 b) · `formatDate`/`formatDateOnly` (nợ 6.1) · `formatRelativeTime` | — |
| `lib/axios.ts` | instance API + tự làm mới phiên 401 | 13.1 |
| `lib/socket.ts` | socket singleton — chỉ dùng qua hook | 13.4 |
| `lib/qrCode.ts` | `deviceLabelCode` · `parseDeviceLabelCode` (nhãn thiết bị `swiftletcare://claim?d=&k=`) · `zoneCode` (mã tầng) · `qrDataUrl` · `printQrLabels` — cùng định dạng bộ đọc mobile | — |
| `lib/queryClient.ts` | React Query client (30s, retry 1) | 13.2 |
| `lib/navigation.ts` · `lib/chartTheme.ts` | chuyển về đăng nhập · theme Chart.js (bảng `CHART_COLORS` dùng cả cho recharts) | 8 |
| `features/farm-owner/harvest/ChartParts.tsx` | Thành phần biểu đồ shadcn trên recharts: `ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)` — chỉ dùng trong trang Thu hoạch | 8 |

### D.4. Hook, API, store, validator dùng chung

| Nhóm | Đường dẫn | Nội dung |
|---|---|---|
| Hook hạ tầng | `hooks/common/` | `useTranslation` (Hệ 2: `t` `num` `day` `time` `date` `hourMinute` `dateTime` `ago`) · `usePermission` · `useSocket` · `usePaginatedListQuery` · `useBreadcrumb` (`usePageBreadcrumb`, `usePageBack`) · `useNavigationLabel` · `useScrollToTop` · `useCanScrollDown` · `useSyncedState` |
| Hook dữ liệu ≥ 2 role | `hooks/shared/` | `useFarms` · `useAlerts` (`usePendingAlertTotal`: số cảnh báo ACTIVE) · `useAlertNotifications` · `useDevices` (`useSensorNode`, `useSystemNodeStatus`) · `useAudioTracks` · `useOpenZoneTuning` (mở trang tuning đúng Zone — nơi duy nhất sửa ngưỡng và hệ số mờ) |
| API ≥ 2 role | `apis/shared/` | `farms.api` · `alerts.api` · `devices.api` · `audioTracks.api` |
| Store (Zustand) | `stores/` | `authStore` · `languageStore` · `zoneStore` · `toastStore` · `breadcrumbStore` · `pinnedHouseStore` (số cảnh báo lấy từ query, không có store) |
| Validator | `validations/common/` · `validations/farm-owner/` | `threshold.validation` · `fuzzyTuning.validation` · `speakerSchedule.validation` · `farm.validation` (vị trí farm: vĩ độ −90…90, kinh độ −180…180) |

### D.5. Dữ liệu giả

| Đường dẫn | Quy tắc | Mục |
|---|---|---|
| `data/<tên>.data.ts` (tạo khi cần) | Nơi duy nhất chứa dữ liệu giả, chỉ khi prompt yêu cầu; import qua api/hook | 7 |

---

*Hết tài liệu. Mọi thay đổi tiếp theo phải cập nhật mục Changelog (mục 0) kèm số phiên bản mới.*
