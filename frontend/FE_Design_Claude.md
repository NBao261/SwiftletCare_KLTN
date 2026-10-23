# FE_Design_Claude.md
### Hệ thống thiết kế Frontend — SwiftletCare Ops Console

> Nguồn sự thật duy nhất (single source of truth) về thiết kế FE của SwiftletCare. Mọi trang, component, màu sắc khi code (kể cả qua Claude Code) phải bám theo file này. Nếu thiếu quy định cho 1 tình huống mới — bổ sung vào đây trước, không tự sáng tạo lệch chuẩn.

**Phiên bản:** 2.9.0 · **Cập nhật:** 23/10/2026 · **Thay thế:** v2.8.0 · **Theo:** Report 3 – SRS 3.0.0 (`docs/reports/report3-srs.md`) và Report 4 – SDD (`docs/reports/report4-sdd.md`)

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
| 1 | **Tên rõ nghĩa, không viết tắt** — file, hàm, biến, prop đều viết đủ chữ: `deviceName` (không `dn`/`devName`), `ticketList` (không `tkList`), `useTranslation` (không `useT`). Ngoại lệ duy nhất: chữ viết tắt đã là thuật ngữ (`id`, `url`, `api`, `sla`, `ota`, `rtsp`). Tham số callback cũng đặt tên đủ: `tickets.map(ticket => …)`, không `t => …`. |
| 2 | **Comment chỉ 1 dòng** dạng `// <tên hoặc tính năng>` đặt trên khối code, chart, button, hàm: `// Bảng nhật ký cảnh báo`, `// Nút tạo ticket`. Không viết khối `/** … */` nhiều dòng, không giải thích lại code làm gì. |
| 3 | **Độ phức tạp ≤ O(n)** cho mỗi lần render/xử lý: tra cứu theo id dùng `Map` dựng 1 lần (`useMemo`), không `array.find` lồng trong `array.map` (O(n²)). Sắp xếp O(n log n) chỉ khi bắt buộc và không lặp mỗi render. Phân trang ở server khi danh sách dài (13.10). |
| 4 | **Logic ở mức Junior đọc được**: mỗi hàm làm 1 việc, ưu tiên `if` tuần tự thay cho ternary lồng nhau, không viết một dòng nhồi nhiều phép biến đổi; tách biến trung gian có tên rõ. |
| 5 | **Cấm tự tạo dữ liệu giả trong code** — xem mục 7. Khi được yêu cầu dữ liệu giả: đặt trong `src/data/<tên>.data.ts` rồi import vào, không viết thẳng mảng/số giả trong component, hook hay api. |
| 6 | **Tự kiểm sau mỗi lần code** — xem 13.13: đọc lại toàn bộ luồng thao tác và code của role vừa sửa (route → page → hook → api → backend), đối chiếu quyền theo 12.0. |

> **Ký hiệu ⏳** trong tài liệu: file/màn đó **chưa có trên `develop`** (đang ở nhánh ghi kèm). Quy tắc gắn ⏳ chỉ bắt buộc từ khi nhánh đó merge — trước đó **không import** các file này, dùng phần đang có trên `develop` được ghi ngay cạnh.

---

## 0. Changelog

### v2.8.0 → v2.9.0 (theo Report 3 – SRS 3.0.0 và Report 4 – SDD)

| # | Thay đổi |
|---|---|
| 1 | **Căn cứ đổi sang Report 3/Report 4** (`docs/reports/`); `SwiftletCare_SRS.md` chỉ còn là ghi chú nội bộ. Chỗ code còn lệch với Report 3 ghi ở `docs/reports/README.md`. |
| 2 | **12.0 viết lại theo Report 3 §2.4:** Farm Owner tự thiết lập thiết bị bằng QR (MF-10), Technician chỉ làm khi có ticket lắp đặt; Technician không sửa ngưỡng/hệ số mờ; Technician chỉ can thiệp tay và xác nhận cảnh báo khi đang giữ ticket; Admin không xác nhận cảnh báo, không can thiệp tay; farm chưa có chuyên gia thì Farm Owner quyết thay (BR-22); chuyên gia duyệt thay đổi của chủ farm (EXPERT-FR-010) và là người duy nhất áp gợi ý hệ số (EXPERT-FR-011); chủ farm xem lịch sử quyết định của chuyên gia (EXPERT-FR-009). |
| 3 | **12.8 nhóm role:** thêm `SETUP_ROLES` (Farm Owner · Technician); kiểm chứng cảnh báo, tham số phát hiện, vòng đếm, lịch đếm chuyển sang `FARM_SIDE_ROLES` (Farm Owner ghi khi farm chưa có chuyên gia); `EXPERT_ONLY` chỉ còn kết luận, duyệt thay đổi, duyệt đề xuất; `HARVEST_ROLES` đích bỏ Admin. |
| 4 | **2.5, 2.6.1:** trạng thái thiết bị theo vòng đời Report 3 §6.6 (`ERROR`/`DEGRADED` không dùng); thêm trạng thái cảnh báo `DISMISSED` (Đã bác bỏ); NH3/CO2 là ngưỡng cảnh báo của Zone; bỏ "Quá lạnh (sưởi)"; mốc 20 giây của nhãn bộ điều khiển và các mốc của điểm cân bằng Zone là hằng số tự chọn của giao diện (Report 3 §4.5). |
| 5 | **6.2 thuật ngữ** thêm nhóm thiết lập thiết bị, kiểm chứng, đồng bộ cấu hình, vòng đếm, lịch đếm; "Bộ điều khiển / Controller" thay chữ PLC; "Loa dẫn dụ / Attractant speaker" theo Report 3. |
| 6 | **Mục 7** cập nhật trạng thái API theo backend hiện tại và thêm các màn Report 3 mới (duyệt thay đổi, đề xuất hệ số, lịch sử chuyên gia, gói bằng chứng, đồng bộ cấu hình, lịch đếm, thiết lập thiết bị). **13.4** đủ sự kiện socket theo Report 4 §7.3. **13.14** thêm nợ theo Report 3. |
| 7 | **MF-11 (Report 3 bản sau):** bảng 12.0 a thêm trạng thái sức khỏe theo ngày, đánh giá ngày, báo cáo ngày/tuần/tháng và tải PDF/CSV; mục 7 và 6.2 thêm các dòng tương ứng. |

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
| 3 | **Mức độ cảnh báo chỉ còn 3 cấp: Khẩn cấp · Cao · Thường** (= P1/P2/P3), dùng chung với ưu tiên ticket. Backend vẫn gửi 4 giá trị (ALERT-FR-001) — giao diện gộp `CRITICAL` vào Khẩn cấp. Cấu hình đích ở `constants/severity.ts` + `constants/severity.i18n.ts` (⏳ chưa có trên develop — nhánh `feat/fe-farmowner-ticket`, chưa merge). Mục 2.4 viết lại, 2.6.1 chỉ trỏ về. |
| 4 | **Thêm 12.0 — Bản đồ role theo SRS** (mỗi role có gì, dùng chung/riêng, ai nắm quyền) và bảng kiểm tra luồng kiểu BA giữa code hiện tại và SRS §4.4. |
| 5 | Sửa chỗ lệch: cây 12.2 (thêm file đang có + `src/data/`), mục 6 (danh sách từ điển), mục 7 (chat ticket đã có API thật), 13.7 (câu màu bị ghép sai), 13.12 (comment 1 dòng), 13.13 (7 file test, tự kiểm), 13.14 (nợ i18n). |

### v2.6.0 → v2.6.1

| # | Thay đổi |
|---|---|
| 1 | **Thêm lớp `src/i18n/` (i18next + react-i18next), chạy song song với hệ từ điển `useTranslation`.** Khoá là chính câu tiếng Việt; bản dịch ở `i18n/en.ts`. Cả 2 hệ đọc chung `languageStore` nên 1 nút VI/EN đổi cả hai. Mục 6 ghi lại trạng thái và quy tắc chọn hệ. |
| 2 | **`components/ui/` được import `@/i18n`** (chỉ để dịch chữ, không biết domain). Sửa 12.2, 12.6, 12.11, 12.12; 12.10 bỏ `i18n/` khỏi ví dụ "lớp mới" vì đã có. |

### v2.5.0 → v2.6.0 (theo SRS v2.0.0, sau Review 1)

> Khi file này mâu thuẫn với Report 3 (`docs/reports/report3-srs.md`, yêu cầu) hoặc Report 4 (`docs/reports/report4-sdd.md`, thiết kế), hai Report thắng và file này phải sửa theo. `SwiftletCare_SRS.md` từ Review 2 chỉ còn là ghi chú nội bộ.

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

SwiftletCare Ops Console là phần mềm vận hành kỹ thuật (giám sát cảm biến, bộ điều khiển ESP32, AI vision, cảnh báo, chuyên gia kiểm chứng, ticket, nhân sự) — ưu tiên **đọc số liệu nhanh, chính xác, đáng tin cậy** hơn trang trí.

1. **Nền xám là sân khấu, nền trắng là diễn viên.** `#EAEAEA` (canvas) không bao giờ là nơi đặt nội dung trực tiếp — mọi text/số liệu/control đều nằm trong 1 khung trắng nổi lên trên.
2. **Không pha màu ngoài hệ thống — tuyệt đối.** Kể cả các sắc xám/đen cũng phải nằm trong đúng 1 hue ấm (~28°) đã chốt ở mục 2 — không dùng lại bất kỳ mã xám/đen "mặc định của framework" (VD `#000`, `#333`, Tailwind `slate/zinc` mặc định) vì các mã đó thường có tông lạnh khác hue hệ thống.
3. **Sidebar/Topbar là vùng đóng băng.** Layout, kích thước giữ nguyên 100% theo code hiện tại. Chỉ 2 việc được phép chạm: (a) logo ảnh (mục 3), (b) token màu ngữ nghĩa đổi giá trị hex — sidebar/topbar tự ăn theo token mới, không cần và không được sửa CSS/kích thước của chính nó.
4. **Không có gì "giả" mà không được gắn nhãn.** Số liệu chưa có API thật phải tự khai báo (mục 7).
5. **Một ngôn ngữ chữ, một hệ bo góc, một hệ shadow, một hệ xám** — dùng xuyên suốt, không phát sinh biến thể lẻ tẻ giữa các trang/role (mục 9).

### 1.1. UI Farm Owner là mẫu chung cho cả hệ thống

**[Bắt buộc]** Mọi màn của Admin, Technician, Domain Expert (và role thêm sau) dựng theo đúng khung, bo góc, khoảng cách, bảng, nút, badge của màn Farm Owner hiện tại. Trước khi làm màn mới cho role khác: mở màn Farm Owner cùng loại (Dashboard, Cấu trúc Farm, Thu hoạch; Ticket `/support` ⏳) và dùng lại component của nó. **Chỉ Landing Page và Mobile (`mobile/`) được thiết kế riêng.**

| Thành phần | Chuẩn (lấy từ code Farm Owner) | Nguồn |
|---|---|---|
| Khung trang | Cột nội dung `max-w-[1400px] mx-auto px-6 lg:px-8`; các khối trong trang xếp `flex flex-col gap-5` (Dashboard, chi tiết) hoặc `gap-6` (danh sách) | `layouts/AppShell.tsx` |
| Bo góc (token thật) | `rounded-xl` 16px · `rounded-2xl` 20px · `rounded-3xl` 28px · `rounded-full` | `tailwind.config.ts` |
| Card | `Card size="md"` = `rounded-2xl p-5`; `Card size="lg"` = `rounded-3xl p-6`; nền trắng + `shadow-card` | `ui/Card.tsx` |
| Khung section | Card lớn, tiêu đề `text-h2 text-charcoal` + mô tả `text-sm text-warmGray`, nút bên phải header, không icon vuông | `features/farm-owner/farms/FarmFrame.tsx` |
| Ô chỉ số (KPI) | `rounded-2xl border border-warmGray/15 bg-white p-4`, nhãn `.label-caption`, icon tròn 28px, số `text-2xl font-extrabold`, dòng phụ 16px | `features/farm-owner/farms/KpiTile.tsx` |
| Bảng | **Chỉ dùng `DataTable`** (hoặc `FixedRowsTable` — bảng danh sách luôn giữ đủ 10 dòng, thiếu thì đệm dòng trống; dữ liệu phân trang ở server thì truyền `serverPagination={{ page, total, onChange }}`): khung `rounded-2xl border-warmGray/15 shadow-card`, header `bg-warmGray/5`, `table-fixed` chia cột theo %, hover dòng `bg-warmGray/5` (chỉ nổi nền, chữ không đổi màu), ô 2 tầng (dòng chính đậm + dòng phụ xám). **Thao tác qua menu ⋯ ở cột cuối (`ActionsMenu`: Xem chi tiết, …) — bấm vào dòng không chuyển trang** | `ui/DataTable.tsx`; mẫu cột: `features/farm-owner/tickets/ticketColumns.tsx` ⏳ |
| Phân trang | `Pagination variant="full"` đặt dưới bảng, nút tròn `h-9` | `ui/Pagination.tsx` |
| Lọc + tìm | Bảng danh sách: `SelectMenu` cho từng điều kiện (Trạng thái kèm số đếm, Mức ưu tiên, Trang trại…) + `ClearFiltersButton tone="danger" count` bên trái — cùng cao `h-9`, ô lọc rộng theo chữ `min-w-[80px] max-w-[220px]` (dài hơn thì cắt "…"), `px-3.5 text-xs font-medium`, cách nhau `gap-2`; `SearchInput` `lg:w-72` bên phải. `FilterChip` chỉ dùng khi ít lựa chọn và cần thấy hết cùng lúc (VD bộ lọc Nhật ký cảnh báo Dashboard) | `ui/SelectMenu.tsx`, `ui/ClearFiltersButton.tsx`, `ui/SearchInput.tsx` |
| Nút | `Button` bo tròn hoàn toàn: `sm` `h-9 px-4`, `md` `h-12 px-5`; nút phụ trong card dùng `CAPSULE_ACTION_CLASS`; nút "Chi tiết" dùng `DETAIL_BUTTON_CLASS` | `ui/Button.tsx`, `farmStructure.constants.ts`, `harvest.constants.ts` |
| Badge | Cỡ `px-2.5 py-0.5 text-[11px]`; mức độ/ưu tiên theo 2.4; trạng thái theo bảng 2.6.1 | Trên develop: `SEVERITY_BADGE_CLASS` (`dashboard/dashboardMetrics.ts`); đích: `SeverityBadge`/`PriorityBadge` ⏳ |
| Khung cảnh báo | Nền cam rất nhạt `bg-orange-50` + viền dày `border-2 border-orange-300`, **không** vạch màu ở cạnh; dòng bên trong nền trắng `bg-white border-orange-100`. Không dùng nền `orange-100` trở lên cho khung — trùng màu badge mức độ Cao làm badge chìm | `features/farm-owner/tickets/DeviceFaultAlertPanel.tsx` ⏳ |
| Ô nhập | Class `.input`: `rounded-xl border-warmGray/25 px-4 py-2.5` | `src/index.css` |
| Popup | `Modal`/`ConfirmModal`/`NoteActionModal`: `rounded-3xl p-6 shadow-popover`, nền mờ theo 5.2. **Popup form nhiều ô** (tạo yêu cầu…): ngang `className="max-w-3xl"`, 2 cột `md:grid-cols-[15rem_1fr]` — trái: lựa chọn loại (thẻ chọn: đang chọn `border-accent-600 bg-limeMist`, icon ô `bg-charcoal text-limeMist`) + ghi chú `bg-warmGray/5`; phải: các ô nhập. Chân popup `border-t`, canh phải: Secondary "Huỷ" + Primary "Gửi…" (không nút full width). Popup xác nhận ngắn vẫn dọc `max-w-sm/md` | `ui/Modal.tsx`, `features/farm-owner/tickets/CreateSupportTicketModal.tsx` ⏳ |
| Trạng thái rỗng/lỗi/tải | **Bảng rỗng:** `FixedRowsTable emptyContent={<TableEmptyState title description? />}` — hình minh hoạ chuẩn (vòng tròn mờ, chồng 3 thẻ giả với thẻ giữa viền `accent-600`, 6 icon lucide thiết bị/kỹ thuật/chim yến quanh) + tiêu đề `text-h3` + mô tả `text-small`, nằm giữa khung bảng. Khối không phải bảng: `EmptyState` (có nút Thử lại khi lỗi). Đang tải: `LoadingSkeleton` đúng chiều cao khối thật | `common/TableEmptyState.tsx` ⏳, `ui/FixedRowsTable.tsx`, `ui/` |

Component Farm Owner nằm trong `features/farm-owner/` (VD `FarmFrame`, `KpiTile`) mà role thứ hai cần dùng → **dời lên `components/common/`** theo 12.3 trong PR đó, không chép thành bản thứ hai. Màu chỉ lấy từ token mục 2; màu riêng Dashboard Farm Owner ở 2.6.1 là màu chuẩn cho trạng thái tương ứng ở mọi role.

---

## 2. Bảng màu hệ thống (Design Tokens — Màu)

### 2.1. Các màu neo (anchor)

| Vai trò | Hex | Ghi chú |
|---|---|---|
| Nền chính toàn app | `#EAEAEA` | Canvas cố định phía sau mọi trang nội dung |
| Cam cảnh báo/quá nhiệt | `#ED8F50` | Giá trị vượt ngưỡng, quá nhiệt (mức độ cảnh báo dùng bảng 2.4) |
| Đỏ cảnh báo/nguy hiểm | `#D53F35` | CRITICAL, badge thông báo |
| Xanh chanh (brand/success) | `#D5E688` | Online, thành công, điểm nhấn |
| Xanh nền bề mặt — **LIME MIST** | `#ECFFA9` | Nền icon-box, chip, highlight nhẹ *(cập nhật chính xác từ `#F0FEB3`)* |
| Trắng — **WHITE** | `#FFFFFF` | Sidebar, khung nổi |
| Xám ấm trung — **WARM GRAY** | `#878380` | Text phụ, icon mờ |
| Xám ấm đậm — **GRAPHITE** | `#4E4A46` | Text đậm phụ, icon neutral đậm |
| Đen ấm — **CHARCOAL** | `#27231F` | **Text chính, bề mặt tối chính** — thay thế hoàn toàn `#111728` |
| Đen tuyệt đối — **BLACK** | `#000000` | Dự phòng cho nhu cầu tương phản tối đa |

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

/* LIME — bề mặt nhạt, neo tại #ECFFA9 (LIME MIST) */
--lime-50:  #FDFFF3; --lime-100: #FAFFE6; --lime-200: #F5FFD0;
--lime-300: #ECFFA9;  /* = LIME MIST — "xanh nền bề mặt" */
--lime-400: #DFFD73; --lime-500: #D2F93A; --lime-600: #BEEC08;
--lime-700: #8FAF08; --lime-800: #677E09; --lime-900: #445407;

/* ACCENT — xanh chanh thương hiệu (online/success/active), neo tại #D5E688 */
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

### 2.4. Mức độ cảnh báo và ưu tiên — 3 cấp dùng chung

**Giao diện chỉ có 3 cấp: Khẩn cấp · Cao · Thường**, trùng 3 mức ưu tiên ticket P1/P2/P3. Backend vẫn lưu cảnh báo theo 4 giá trị `CRITICAL | HIGH | MEDIUM | LOW` (ALERT-FR-001, `alert.model.ts`) — **không đổi backend**, giao diện gộp `CRITICAL` vào Khẩn cấp.

> **Trạng thái: ⏳ đích.** Các file trong bảng dưới **chưa có trên `develop`** — đang ở nhánh `feat/fe-farmowner-ticket` (PR riêng, chưa mở). Trước khi nhánh đó merge:
> - **Không import** các file này (build sẽ lỗi).
> - Mức cảnh báo: dùng `SEVERITY_BADGE_CLASS` + `getSeverityGroup` trong `features/farm-owner/dashboard/dashboardMetrics.ts` (đang 4 mức) như Dashboard hiện tại.
> - Ưu tiên ticket: dùng `PRIORITY_TONE` (`constants/tickets.ts`) và `SLA_PRIORITIES`/`PRIORITY_LABEL` (`constants/sla.ts`) như code hiện có.
>
> Khi nhánh merge: bỏ khối này và ký hiệu ⏳ ở các mục liên quan (1.1, 2.6.1, 6, 7, 12.0, 12.2, 13.16) trong cùng PR đó.

**Nguồn duy nhất (sau khi merge) — chỉ import, không khai lại ở nơi khác:**

| File | Xuất ra | Nội dung |
|---|---|---|
| `src/constants/severity.ts` | `LEVELS`, `SEVERITY_TO_LEVEL`, `LEVEL_BADGE_CLASS`, `LEVEL_BADGE_SIZE` | Thứ tự 3 cấp, bảng đổi mức backend → cấp, màu badge, cỡ badge |
| `src/constants/severity.i18n.ts` | `levelDict` | Nhãn VI/EN của 3 cấp |
| `src/constants/priority.ts` | `PRIORITIES`, `PRIORITY[p]` | Ưu tiên ticket = `LEVELS`; nhãn + màu badge lấy từ 2 file trên, thêm các dạng màu khác (`tint`, `solid`, `dot`, `rowTint`, `headerTint`) |
| `src/components/common/PriorityBadge.tsx` | badge 3 cấp | Props `priority`, `display?` (`label` · `code` · `full`), `count?`, `className?` |
| `src/components/common/SeverityBadge.tsx` | badge mức cảnh báo | Nhận `severity` từ backend, đổi qua `SEVERITY_TO_LEVEL` rồi vẽ bằng `PriorityBadge` — 2 badge cùng 1 đường vẽ |

| Cấp | Mức backend gộp vào | Nhãn VI / EN | Màu badge |
|---|---|---|---|
| P1 | `CRITICAL`, `HIGH` | Khẩn cấp / Urgent | nền `safetyOrange` đặc, chữ trắng |
| P2 | `MEDIUM` | Cao / High | nền `orange-100`, chữ `orange-800` |
| P3 | `LOW` | Thường / Normal | nền `warmGray/15`, chữ `warmGray` |

- **[Bắt buộc — từ khi các file trên có trên develop]** Đếm, lọc, nhóm cảnh báo theo cấp dùng `SEVERITY_TO_LEVEL` (VD bộ lọc Nhật ký cảnh báo Dashboard, ô đếm "Khẩn cấp · 3" ở khung báo lỗi thiết bị). Không tự viết `if (severity === 'CRITICAL' || ...)`.
- **[Bắt buộc — từ khi các file trên có trên develop]** Câu chữ nhắc tên cấp lấy nhãn từ `levelDict` truyền vào làm tham số (VD "Lỗi {urgent} chưa ai xác nhận sau 15 phút…"), không gõ lại "Khẩn cấp".
- Đổi màu/nhãn một cấp → sửa đúng 1 dòng trong `severity.ts`/`severity.i18n.ts`; mọi badge đổi theo.
- **Ticket đã kết thúc** (`CLOSED`, gồm cả huỷ) → badge ưu tiên về xám: `<PriorityBadge isMuted={isTicketFinished(ticket)} />`, màu `LEVEL_BADGE_MUTED_CLASS` (= màu cấp Thường). Chỉ ticket đang mở (Mới, Đang xử lý, Chờ xác nhận hiện trường) mới hiện màu Khẩn cấp/Cao, để không lẫn với việc đang cần làm.
- Backend tự sinh ticket cho cảnh báo `CRITICAL`/`HIGH` chưa xác nhận sau 15 phút (TICKET-FR-002) = toàn bộ cấp Khẩn cấp.

### 2.5. Trạng thái an toàn / thiết bị

| Trạng thái thiết bị (Report 3 §6.6) | Nghĩa | Hex |
|---|---|---|
| `ONLINE` | Đang gửi heartbeat | `--accent-600` `#B5D32C` |
| `PENDING` | Đã đăng ký, chưa có heartbeat đầu tiên (đang thiết lập, MF-10) | `--orange-500` `#ED8F50` |
| `OFFLINE` | Mất heartbeat (bộ điều khiển 30 giây, nút AI 90 giây — BR-10) | `--gray-400` `#A5A3A1` |
| Đã gỡ (`decommissioned_at`) | Không còn hoạt động, lịch sử vẫn xem được | `--gray-400` `#A5A3A1` + chữ "Đã gỡ" |

`ERROR` và `DEGRADED` có trong enum backend nhưng không chỗ nào gán (Report 3 §6.6) — giao diện không dựng màu/nhãn riêng cho hai giá trị này. Màu đỏ `--red-500` `#D53F35` dành cho giá trị vượt ngưỡng và lỗi, không phải trạng thái thiết bị.

### 2.6. Nguyên tắc màu dữ liệu cảm biến (không đổi so với v2.0.0)

Màu **không** gắn với loại cảm biến — gắn với **trạng thái an toàn hiện tại**: an toàn → `accent-600`, gần ngưỡng → `orange-500`, vượt ngưỡng → `red-500`. Loại cảm biến nhận diện bằng icon + label: Nhiệt độ `Thermometer`, Độ ẩm `Droplets`, Ánh sáng `Sun`, CO2 `Wind`, NH3 `FlaskConical`, Âm thanh `Volume2`. Series so sánh/ngữ cảnh trong chart đa-đường dùng thang `gray-300 → gray-700` (giờ đã là xám ấm, không còn ám xanh).

> **Ngoại lệ:** Dashboard Farm Owner đang áp dụng bảng icon và màu ở 2.6.1 (CO2 dùng đám mây, âm thanh dùng sóng âm, vượt ngưỡng dùng cam thay vì đỏ, thêm trạng thái "thiết bị không hoạt động").

### 2.6.1. Dashboard Farm Owner — màu trạng thái đang áp dụng (v2.6.0)

**Màu cam và màu trạng thái dùng trên Dashboard**

| Token Tailwind | Hex | Dùng ở |
|---|---|---|
| `safetyOrange` | `#FF7426` | Khung *Trạng thái nhà yến*: chữ + chấm "Lỗi N thiết bị", dòng ghi chú lỗi. *Nhật ký cảnh báo*: nhãn mức HIGH, giá trị vượt ngưỡng (in đậm) |
| `climateOrange` (= `orange-500`) | `#ED8F50` | Ô cảm biến vượt ngưỡng; relay "Quá nóng"; thanh điểm cân bằng Zone 65–79 (`ZoneBalanceCard`; dải chỉ để hiển thị — xem ghi chú dưới bảng b) |
| `orange-100` / `orange-800` | `#FAE1D1` / `#8B400E` | Nhãn mức MEDIUM ở *Nhật ký cảnh báo* |
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

**c) Trạng thái xử lý cảnh báo** (cột *Trạng thái* ở Nhật ký cảnh báo — `status` từ BE)

| `status` | Nhãn VI / EN | Nền | Chữ | Ý nghĩa |
|---|---|---|---|---|
| `ACTIVE` | Mới / New | `infoBlue/10` | `infoBlue` | Chưa ai xác nhận. Cấp Khẩn cấp để quá 15 phút thì BE tự tạo Ticket |
| `ACKNOWLEDGED` | Tiếp nhận / Received | `limeMist` | charcoal | Đã có người xác nhận — **chưa** có nghĩa là đã sửa |
| `DISMISSED` ⏳ backend | Đã bác bỏ / Dismissed | `warmGray/10` | `graphite` | Chuyên gia (hoặc chủ farm khi farm chưa có chuyên gia) bác bỏ cảnh báo suy luận: không còn hiệu lực, không báo lại; đổi kết luận sang xác nhận thì về trạng thái trước (Report 3 §6.1, EXPERT-FR-003). Hiện người bác bỏ, lúc nào, lý do |
| `RESOLVED` | Đã xử lý / Resolved | `warmGray/15` | `warmGray` | Sự cố đã hết (vượt ngưỡng không lặp lại 5 phút, thiết bị online lại, hoặc thiết bị bị gỡ) |

Mức độ (cột *Mức độ*) và ưu tiên ticket: **theo 2.4**. Trên `develop` hiện tại Nhật ký cảnh báo vẫn dùng `SEVERITY_BADGE_CLASS` 4 mức và bộ lọc "Critical · High/Med · Normal" (`dashboardMetrics.ts`); bản đích ⏳ hiển thị 3 cấp qua `SeverityBadge`/`PriorityBadge`, bộ lọc "Tất cả · Khẩn cấp · Cao · Thường".

**Dạng màu khác của ưu tiên** ⏳ (`PRIORITY[p]` trong `priority.ts`, cùng họ màu với badge của cấp đó) — dùng khi cần chấm, ô đặc, nền dòng:

```tsx
import PriorityBadge from '@/components/common/PriorityBadge';
import { PRIORITIES, PRIORITY } from '@/constants/priority';

<PriorityBadge priority={ticket.priority} />                // "Khẩn cấp" — cột bảng
<PriorityBadge priority={ticket.priority} display="code" /> // "P1" — cột hẹp
<PriorityBadge priority={ticket.priority} display="full" /> // "P1 · Khẩn cấp" — header chi tiết
<PriorityBadge priority="P1" count={3} />                   // "Khẩn cấp · 3" — ô đếm
<span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY[ticket.priority].dot)} />
```

- **Sẽ dùng khi nhánh `feat/fe-farmowner-ticket` merge:** Farm Owner (Dashboard, Ticket `/support`, khung báo lỗi thiết bị). Hiện **chưa màn nào trên develop dùng**.
- **Chuyển sau khi merge:** Admin/Technician còn bảng cũ — người phụ trách role đó tự chuyển, không sửa hộ:

| Tên cũ (vị trí) | Thay bằng |
|---|---|
| `PRIORITY_TONE` + `<Badge tone=…>` (`constants/tickets.ts`) | `<PriorityBadge display="code" \| "full">` |
| `PRIORITY_ICON_CLASS` (`constants/tickets.ts`) | `PRIORITY[p].tint` |
| `SLA_PRIORITIES`, `PRIORITY_LABEL` (`constants/sla.ts`, Admin đang dùng — nhãn dịch qua `translated()`, cùng chữ với `levelDict`) | `PRIORITIES`, `PRIORITY[p].label` |
| `PRIORITY_ROW` (`admin/tickets/PriorityLegend.tsx`) | `PRIORITY[p].rowTint` + `PRIORITY[p].solid` |
| `PRIORITY_DOT_CLS`, `PRIORITY_ORDER` (`technician/tickets/ticketListTypes.ts`) | `PRIORITY[p].dot`, `PRIORITIES.indexOf(p)` |
| `HEADER_TINT` (`TechnicianTicketDetailPage.tsx`) | `PRIORITY[p].headerTint` |

**d) Trạng thái bộ điều khiển** (thanh *Giám sát vận hành SCADA*; code cũ ghi "PLC")

| Trạng thái | Điều kiện | Nhãn VI / EN | Nền | Chữ |
|---|---|---|---|---|
| Online | Bản đo mới nhất cách hiện tại ≤ 20 giây | PLC: Online | `limeMist` (Badge `positive`) | charcoal |
| Mất kết nối | Có bản đo nhưng cũ hơn 20 giây | PLC: Mất kết nối / Disconnected | `alertRed/15` (Badge `critical`) | `alertRed` |
| Đang chờ kết nối | Chưa có bản đo nào | PLC: Đang chờ kết nối / Awaiting connection | `statusYellow/70` | charcoal |

Chấm tròn đầu thanh: `success` khi Online, `warmGray` khi không. Nhãn rộng cố định 190px để đổi trạng thái không làm thanh nhảy.

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
| `text-caption` | 11px/16px | 600, spacing 0.04em | Nhãn nhóm nav (sidebar) |
| `.label-caption` (class trong `index.css`) | 12px/16px | 600, `--gray-500` | Nhãn section, nhãn ô form, tiêu đề cột bảng, nhãn trước nhóm nút ("Sắp xếp:") |
| `text-metric` | 32px/38px | 700, tabular-nums | Số liệu lớn |
| `text-mock-notice` | 11px/16px | 500, italic | `--gray-500` — dòng "FAKE data" |

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

### 2.10. Trạng thái ticket và thanh tiến độ — cấu hình dùng chung ⏳

**[Bắt buộc]** Mọi role hiển thị trạng thái ticket và thanh các bước xử lý **chỉ import** từ các file dưới, không tự khai màu, nhãn, thứ tự hay danh sách bước:

| File | Xuất ra | Dùng để |
|---|---|---|
| `constants/ticketStatus.ts` | `TICKET_STATUS_ORDER` · `ticketDisplayStatus()` · `TICKET_STATUS_BADGE_CLASS` · `TICKET_STATUS_BADGE_SIZE` · `buildTicketProgressSteps()` · `findStepIndex()` | Thứ tự 4 trạng thái, trạng thái hiển thị (thêm `CANCELLED` = CLOSED kèm `cancelled_at`), màu badge, dựng thanh tiến độ |
| `constants/enumLabels.i18n.ts` | `ticketStatusDict` · `ticketDisplayStatusDict` | Nhãn VI/EN (Mới · Đã tiếp nhận · Đang xử lý · Hoàn tất · Đã huỷ) |
| `components/common/TicketStatusBadge.tsx` | `<TicketStatusBadge ticket={ticket} />` | Badge trạng thái — tự xử lý huỷ |
| `components/common/TicketProgressStepper.tsx` | `<TicketProgressStepper status extraSteps? currentKey? />` | **Thanh tiến độ ticket chuẩn — dùng cái này**, đã bật sẵn bước đang làm nền đậm + đoạn nối có hiệu ứng; mọi role dùng là đồng bộ |
| `components/ui/Stepper.tsx` | `<Stepper steps current completed activeTone />` | Vẽ thanh tiến độ; `activeTone="strong"` = bước đang làm nền `accent-800` chữ trắng (tương phản 5.3:1, mẫu Farm Owner), mặc định `soft` = `limeMist`; `showNextProgress` = đoạn nối tới bước kế tiếp kéo dài từ bước hiện tại tới bước sau rồi mờ đi, lặp lại (`animate-step-progress`, `scaleX` + `opacity`; tắt khi giảm chuyển động) |

| Trạng thái backend | Bước hiển thị VI / EN | Nghĩa (đối chiếu `ticket.service.ts`) | Màu |
|---|---|---|---|
| `NEW` | Mới / New | Ticket vừa tạo, kỹ thuật viên chưa nhận việc | `bg-infoBlue/10 text-infoBlue` |
| `IN_PROGRESS` | Đã tiếp nhận / Accepted | Kỹ thuật viên đã nhận việc (ghi `responded_at`), đang kiểm tra/xử lý | `bg-limeMist text-charcoal` |
| `AWAITING_FIELD_CONFIRMATION` | Đang xử lý / In progress | Kỹ thuật viên đang xác nhận kết quả (chỉ có ở ticket có buổi đến hiện trường) | `bg-statusYellow/70 text-charcoal` |
| `CLOSED` | Hoàn tất / Completed | Kỹ thuật viên xác nhận hoàn thành (`closed_at`) | `bg-warmGray/15 text-warmGray` |
| `CLOSED` + `cancelled_at` | Đã huỷ / Cancelled | Ticket bị huỷ | `bg-warmGray/15 text-warmGray` |

Ticket xử lý xong từ xa đi thẳng `IN_PROGRESS → CLOSED` (bỏ qua bước 3) — thanh tiến độ vẫn tô xong cả 4 bước khi Hoàn tất. Nghiệm thu SAT (TICKET-FR-010) là thao tác của kỹ thuật viên, **không hiện** ở màn chủ nhà yến.

**Thêm bước riêng cho 1 role/trang** — truyền `extraSteps` vào `TicketProgressStepper`, bước được chèn ngay sau `afterKey`; 4 bước gốc và kiểu hiển thị không đổi:

```tsx
import TicketProgressStepper from '@/components/common/TicketProgressStepper';

// Thanh tiến độ ticket của Technician: thêm bước "Đến hiện trường" sau "Đang xử lý"
<TicketProgressStepper
  status={ticket.status}
  extraSteps={[{ afterKey: 'IN_PROGRESS', step: { key: 'VISIT', label: t('step.visit') } }]}
  currentKey={ticket.scheduled_visit_at && ticket.status === 'IN_PROGRESS' ? 'VISIT' : ticket.status}
/>
```

- Key bước riêng viết HOA, không trùng 4 trạng thái; nhãn lấy từ từ điển của màn.
- Ticket huỷ không vẽ thanh tiến độ (hiện khung "Đã huỷ") — mẫu `TicketProgressCard` của Farm Owner.
- **[Bắt buộc]** Thanh tiến độ **ticket** dùng `TicketProgressStepper`, không gọi `Stepper` rồi tự truyền tuỳ chọn. `Stepper` trơn chỉ dùng cho luồng không phải ticket (VD màn lắp đặt thiết bị).
- **Đang dùng:** Farm Owner (bảng `/support`, trang chi tiết, `TicketProgressCard`). **Chưa chuyển:** Technician (`technician/tickets/StatusStepper.tsx`, `STATUS_BADGE_CLS` trong `ticketListTypes.ts`), Admin (`admin/tickets/TicketStatusSteps.tsx`, `STATUS_BADGE_CLASS` trong `admin/tickets/tickets.constants.ts`) — người phụ trách role đó chuyển sang (13.14), không sửa hộ.

---

## 3. Logo

2 file ảnh, đầu sidebar: `[Logo_SCare_Icon.png]  [Logo_SCare_Text.png]`

- Container: `display:flex; align-items:center; gap:10px;` — giữ nguyên khối padding sidebar hiện có.
- Icon: 40×40px, `object-fit:contain`. Nếu file là icon phẳng chưa có nền → giữ khung lót `background: var(--gray-900)` (Charcoal, **không còn `#111728`**) bo góc `--radius-md` hiện có của sidebar; nếu ảnh đã tự có nền → đặt trực tiếp, bỏ khung lót.
- Text: `height:24px; object-fit:contain; width:auto`.
- Asset tại `/public/brand/`, dùng `<img alt="SwiftletCare">`, không dùng `background-image`.

---

## 4. Bố cục (Layout)

### 4.1. Sidebar & Topbar — đóng băng

Layout/kích thước giữ nguyên 100%. Chỉ đổi: (1) logo (mục 3), (2) giá trị hex của token màu mà sidebar/topbar đang tham chiếu (avatar, nav active pill, dot trạng thái... vốn đang dùng biến `--gray-900`/`--success`/`--danger` — nay các biến này tự mang giá trị mới, sidebar không cần sửa code).

### 4.2. Content Canvas System — nền cố định 1 màu phẳng

Không còn khối blur trang trí. Nền cố định là **1 màu phẳng duy nhất `#EAEAEA`**, không hoa văn, không blob màu. Vẫn giữ nguyên cơ chế 2 lớp (nền không cuộn / nội dung cuộn riêng) — chỉ đơn giản hoá phần thị giác của lớp nền:

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

Radius `--radius-md`, height 40px.

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

Chữ trên kính trắng: chính `text-charcoal`, phụ `text-warmGray`, mục đang trỏ/đang chọn `bg-charcoal/5`, vạch ngăn `border-charcoal/10` hoặc `bg-charcoal/10`, mục nguy hiểm (Xóa) `text-alertRed`. Nền của từng mục dùng màu có độ trong (`/5`, `/10`, `limeMist/50`) thay cho nền đặc (`bg-white`, `bg-gray-100`) để không che mất lớp kính.

Popup thông báo: tin chưa đọc nền `bg-charcoal/5` + chấm cam, tin đã đọc trong suốt + `opacity-80`, tin đang xổ chi tiết nền `bg-limeMist/50` với nút mũi tên đen.

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

Màn nhận dữ liệu qua socket (Dashboard, cảnh báo, chat ticket, trạng thái thiết bị) phải cho người dùng biết dữ liệu đang **trực tiếp** hay **tự làm mới**, dựa trên cờ `live` của `hooks/shared/useTicketChat.ts` (khung chat ticket Farm Owner dùng mẫu này ⏳):

| Trạng thái | Chấm | Chữ VI / EN |
|---|---|---|
| Socket đang kết nối | `bg-success` | Trực tiếp / Live |
| Mất socket, đang hỏi lại định kỳ | `bg-warmGray/40` | Tự làm mới / Auto-refresh |

- Đặt ở góc phải header của khối dữ liệu, `text-small font-semibold`, chấm `h-1.5 w-1.5 rounded-full`.
- Khối có mốc thời gian dữ liệu thì thêm "Đồng bộ {ago}" như thanh SCADA (2.6.1 d).
- **[Bắt buộc]** Mất socket thì hook tự chuyển sang hỏi lại định kỳ (như `useTicketChat`), không để màn đứng im mà vẫn ghi "Trực tiếp".

---

## 6. i18n — Đa ngôn ngữ (VI/EN)

**Trạng thái: hai hệ dịch chạy song song, chưa phủ toàn app.** Nút VI/EN ở `AppHeader` ghi vào `stores/languageStore.ts`; cả hai hệ dưới đây đọc chung store này nên một nút đổi cả hai. Màn chưa dùng hệ nào vẫn tiếng Việt như cũ.

**Hệ 1 — `src/i18n/` (i18next + react-i18next), khoá là câu tiếng Việt.** `t('Danh sách trang trại')` → VI trả nguyên câu, EN tra `i18n/en.ts`, thiếu bản dịch thì vẫn hiện tiếng Việt (không lỗi). Biến dạng `t('Còn {{n}} ngày', { n: 3 })`. Các helper trong `i18n/index.ts`: `t` (gọi được cả ngoài component — column builder, helper định dạng), `tr`/`trChildren` (dịch prop chữ/children của component dùng chung, bỏ qua ReactNode), `translated(labels)` (bọc bảng nhãn constants để đọc ra bản dịch hiện tại), `intlLocale()`, `setLang()`. `AppShell` remount vùng nội dung theo `key = ngôn ngữ` để mọi chỗ gọi `t` ra đúng ngôn ngữ. **Không** tính nhãn bằng `t` ở cấp module (hằng số top-level) — giá trị đóng băng theo ngôn ngữ lúc nạp; dùng `translated(...)`, getter, hoặc dựng trong component. Đang dùng ở các màn Admin và các component `ui/`. Thêm câu mới = thêm 1 dòng vào `en.ts`.

**Hệ 2 — từ điển theo module.** Hạ tầng tối thiểu: `lib/i18n.ts` (`Dictionary<K>` — `en` bắt buộc đủ đúng key của `vi`, thiếu là lỗi biên dịch; `translate`, định dạng số/ngày/"x giây trước" theo locale) + `hooks/common/useTranslation.ts` (`const { t, num, day, time, date, hourMinute, dateTime, ago } = useTranslation(dict)`). Từ điển mỗi module đặt ở `constants/<module>.i18n.ts`; hiện có `farmStructure.i18n.ts` (màn Cấu trúc Farm), `dashboard.i18n.ts` (Dashboard) của Farm Owner, `navigation.i18n.ts` (nhãn sidebar/dock/tiêu đề trang — tra qua `hooks/common/useNavigationLabel.ts`) và `shell.i18n.ts` (popup thông báo, tài khoản, đăng xuất, nút ngôn ngữ). ⏳ Nhánh `feat/fe-farmowner-ticket` thêm `support.i18n.ts` (Ticket `/support`), `severity.i18n.ts` (`levelDict`, 2.4) và hàm `dateTime` cho `useTranslation`. Tên file/hook viết đầy đủ, không viết tắt (VD `useTranslation`, không `useT`). Đơn vị đo (°C/%/ppm/lux/dB) không dịch. Màn chưa có từ điển: khi review **không** bắt buộc `t('...')`; viết tiếng Việt có dấu, giữ thuật ngữ ("Zone", "Farm", "Ticket") nhất quán với màn đã có. Đang dùng ở các màn Farm Owner, màn Trang trại của Technician và khung app (sidebar, popup thông báo/tài khoản).

**Chọn hệ nào:** sửa màn đang dùng hệ nào thì giữ hệ đó, không trộn hai hệ trong một file. Màn mới theo hệ mà role đó đang dùng (Admin → Hệ 1; Farm Owner, Technician → Hệ 2). Gộp về một hệ (chuyển các `*.i18n.ts` thành namespace i18next) là PR riêng — xem nợ 13.14. Bảng thuật ngữ 6.2 áp cho cả hai hệ.

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
| Không có giá trị | `—` trong bảng và văn bản; riêng ô cảm biến Dashboard dùng `_` (2.6.1) | — |

- **[Bắt buộc]** Dùng hàm định dạng chung, không tự `toLocaleString` rải trong component:
  - `lib/i18n.ts` ⏳: `formatStandardDate` (DD/MM/YYYY) · `formatHourMinute` (HH:mm) · `formatDateTime` (DD/MM/YYYY, HH:mm) · `formatTimestampsInText` (đổi mốc ISO trong chuỗi backend, VD ghi chú "hạn 2026-09-17T15:34:00.721Z" → "17/09/2026, 22:34"). Gọi được cả ngoài component (column builder).
  - Trong component: `useTranslation` → `date`, `hourMinute`, `dateTime`, `num`, `ago`.
  - Ghi chú/nhật ký do backend tự sinh: qua `readableNoteText` (mẫu Ticket Farm Owner) — đổi mốc ISO và bỏ mã yêu cầu SRS (`(TICKET-FR-002)`) trước khi hiện.
- Nợ: `formatDate`/`formatDateOnly` (`lib/helpers.ts`) có giây hoặc không đệm số 0; `day` và `time` của `useTranslation` đang theo định dạng của ngôn ngữ (EN ra `M/D/YYYY`, có giây) — màn mới dùng `date`/`hourMinute`/`dateTime`; màn cũ đổi khi sửa (13.14).

### 6.2. Bảng thuật ngữ VI / EN

Mọi từ điển dùng đúng các cặp dưới đây; thuật ngữ mới thêm vào bảng trước khi dùng:

| VI | EN | Ghi chú |
|---|---|---|
| Trang trại / Farm | Farm | Giữ "Farm" trong câu ngắn |
| Nhà yến | House | |
| Zone | Zone | Không dịch |
| Thiết bị | Device | |
| Cảm biến | Sensor | |
| Cảnh báo | Alert | |
| Xác nhận (cảnh báo) | Acknowledge | Trạng thái: Mới / New · Tiếp nhận / Received · Đã bác bỏ / Dismissed · Đã xử lý / Resolved |
| Kiểm chứng · Xác nhận đúng · Bác bỏ (cảnh báo suy luận) | Verdict · Confirm · Reject | Việc của chuyên gia (EXPERT-FR-003), khác "Xác nhận (cảnh báo)" của chủ farm |
| Cảnh báo suy luận | Inferred alert | `NOISE_ANOMALY`, `SENSOR_ANOMALY`, `FORECAST_BREACH`, `LOW_RETURN_RATE` |
| Trạng thái sức khỏe theo ngày: Tốt · Cần theo dõi · Cần xử lý · Không đủ dữ liệu | Daily health status: Good · Watch · Action needed · Insufficient data | MF-11, BR-29; là chỉ báo, không phải chẩn đoán |
| Chỉ số sức khỏe: Bình thường · Lệch nhẹ · Lệch rõ | Health indicator: Normal · Slight · Clear | BR-28 |
| Đánh giá ngày (của người nuôi) | Daily rating | EXPERT-FR-012 |
| Bằng chứng | Evidence | Số đo, số đếm chim, cảnh báo thiết bị quanh 1 cảnh báo suy luận (ALERT-FR-014) |
| Mức độ · Ưu tiên | Level · Priority | 3 cấp: Khẩn cấp / Urgent · Cao / High · Thường / Normal (2.4) |
| Yêu cầu (hỗ trợ) | Ticket | **Bản VI màn chủ nhà yến** gọi ticket là "yêu cầu" — bản EN vẫn là **Ticket** (không dịch thành "Request") (menu "Yêu cầu hỗ trợ", "Danh sách yêu cầu", "Tạo yêu cầu", "Huỷ yêu cầu"); màn Technician/Admin vẫn dùng "Ticket" |
| Kỹ thuật viên | Technician | |
| Chủ nhà yến | Farm Owner | |
| Chuyên gia | Domain Expert | |
| Quản trị viên | Administrator | |
| Ngưỡng | Threshold | |
| Hệ số logic mờ | Fuzzy coefficient | |
| Duyệt thay đổi · Giữ · Hoàn tác | Review · Accept · Revert | Chuyên gia duyệt thay đổi ngưỡng/hệ số của chủ farm (EXPERT-FR-010) |
| Đề xuất hệ số · Duyệt · Từ chối | Proposal · Approve · Reject | Gợi ý hệ số chủ farm gửi chuyên gia (EXPERT-FR-011) |
| Tham số phát hiện | Detection parameter | EXPERT-FR-008 |
| Đồng bộ cấu hình · Đã áp dụng · Đang chờ · Lệch cấu hình | Configuration sync · Applied · Pending · Mismatch | ENV-FR-027 |
| Bộ điều khiển | Controller | Bộ ESP32 ở mỗi Zone; không dùng chữ "PLC" ở màn mới |
| Nút AI | AI node | Máy chạy đếm chim cho camera cửa ra vào của nhà yến |
| Thiết lập thiết bị | Device setup | MF-10 |
| Nhãn thiết bị · Mã kích hoạt | Device label · Activation key | Nhãn QR trên thiết bị (FARM-FR-010) |
| Mã QR tầng | Floor code | QR dán ở mỗi tầng, chọn Zone khi thiết lập (FARM-FR-011) |
| Kho thiết bị | Device stock | Admin thêm thiết bị, in nhãn |
| Can thiệp tay | Manual override | |
| Phun sương · Thông gió | Misting · Ventilation | |
| Loa dẫn dụ (loa ru) | Attractant speaker | Thuật ngữ của Report 3; chữ EN "Lullaby" cũ đổi khi sửa màn |
| Đếm chim · Tỷ lệ chim về | Bird count · Return rate | |
| Vòng đếm · Lịch đếm (theo mùa, tạm thời) | Counting ring · Counting schedule (seasonal, temporary) | VISION-FR-018, 019 |
| Thu hoạch | Harvest | |
| Lịch hẹn | Appointment | |
| Nghiệm thu hiện trường | Field sign-off (SAT) | |

### 6.3. Quy ước key i18n

- **Hệ 1** (`src/i18n/`): khoá là chính câu tiếng Việt, biến dạng `{{n}}` — không đặt key kiểu `list.title`.
- **Hệ 2** (`*.i18n.ts`): key dạng `<khu-vực>.<tên>` camelCase, khu vực là khối trên màn: `list.title`, `kpi.openSub`, `fault.create`, `form.errFarm`. Giá trị enum từ backend ghép thẳng: `status.NEW`, `type.SENSOR_FAULT`.
- **[Bắt buộc]** Không ghép câu bằng cộng chuỗi (`t('a') + ' ' + n + t('b')`) — dùng tham số: `'kpi.openSub': '{n} ticket chờ tiếp nhận'`.
- **[Bắt buộc]** Bản `en` đủ đúng key của `vi` (kiểu `Dictionary<K>` đã bắt lỗi biên dịch); không để chuỗi tiếng Việt trong bản `en`.
- Nhãn dùng chung nhiều màn (3 cấp mức độ, tên menu) chỉ khai ở 1 từ điển chung (`navigation.i18n.ts`; `severity.i18n.ts` ⏳) rồi import, không khai lại ở từ điển màn.
- **[Bắt buộc] Nhãn của mã backend chỉ khai 1 lần** ở `constants/enumLabels.i18n.ts` ⏳: `alertTypeDict` (thêm `CONFIG_MISMATCH` khi backend có), `alertStatusDict` (thêm `DISMISSED` khi backend có), `ticketTypeDict`, `ticketStatusDict`, `deviceStatusDict`, `roleDict` (VI/EN). Mức độ ở `severity.i18n.ts` (`levelDict`; `severityLabels()` quy key 4 mức backend về 3 cấp). Từ điển màn cần key riêng (`status.NEW`, `alert.NODE_OFFLINE`) thì lấy lại bằng `...prefixLabels('status.', ticketStatusDict.vi)` — không gõ lại nhãn. Đang áp: `dashboard.i18n.ts`, `farmStructure.i18n.ts`, `shell.i18n.ts` (popup thông báo mọi role), `support.i18n.ts`.
- Nội dung do người dùng hoặc backend sinh ra (ghi chú, tin nhắn, tên farm) không dịch, hiện nguyên văn.

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

Đối chiếu Report 3, danh sách chỗ lệch ở `docs/reports/README.md` và backend thật trước khi bỏ nhãn. Bảng chi tiết:

| Màn hình | FR liên quan | Trạng thái | Cần nhãn? |
|---|---|---|---|
| AI Giám sát đàn — đếm chim, return rate | VISION-FR-006/008/009/010/011 | 🟡 chờ dữ liệu thật từ Edge AI | **Có** |
| Phân tích tương quan môi trường ↔ return rate | ANALYTICS-FR-002/003 | 🟡 chờ dữ liệu VISION thật | **Có** |
| ~~Cảnh báo thiên địch từ camera~~ | THREAT-FR-001/002/003 | ❌ Ngoài phạm vi (Report 3 §8) — không làm màn này | — |
| Chat trực tiếp trong Ticket | TICKET-FR-014→017 | ✅ API thật (`/tickets/:id/messages` + socket, `useTicketChat`) | Không |
| Ticket của Farm Owner `/support` (tạo, theo dõi, huỷ, đánh giá, khung thiết bị đang báo lỗi) | TICKET-FR-001/011/014..016 | ⏳ Đang làm ở nhánh `feat/fe-farmowner-ticket`, dùng API thật (`/tickets`, `/alerts`, `/devices/sensor-nodes`); trên develop Farm Owner vẫn vào `/tickets` | Không |
| Giám sát đàn chim `/vision` | VISION-FR-008..011 | 🟡 API thật nhưng chưa có dữ liệu (AI chưa triển khai) → khung trống | Không (không có số liệu giả) |
| Reset ngưỡng Zone về mặc định | ENV-FR-020 | ✅ Đã code (v1.18.0) | Không |
| Audit Log toàn hệ thống (Admin) | SYSTEM-FR-001 | ✅ Đã code (`GET /system/audit-logs`) | Không |
| Cấu hình ngưỡng mặc định hệ thống (Admin) | SYSTEM-FR-002 | ✅ Đã code (`GET/PUT /system/settings/default-thresholds`) | Không |
| Tổng quan sức khỏe hệ thống (Admin) | SYSTEM-FR-003 | ✅ Đã code (`GET /system/health-overview`) | Không |
| ~~Đăng bán/Truy xuất nguồn gốc (Marketplace)~~ | MARKET-FR-006..013 | ❌ Ngoài phạm vi (Report 3 §8) — gỡ các trang này; chỉ giữ ghi nhận thu hoạch (MARKET-FR-001..005) | — |
| Thông báo ngoài ứng dụng: Telegram bot và push FCM, cả hai (Report 3; Zalo/SMS ngoài phạm vi) | ALERT-FR-002/013 | 🟡 backend gửi Telegram thật, FCM mới ghi log | Có (màn cấu hình kênh) |
| Báo cáo sức khỏe Zone, kiểm chứng cảnh báo, kết luận của chuyên gia, tham số phát hiện | EXPERT-FR-003..006, 008 | 🟡 Backend có API (`/health-reports`, `PUT /alerts/:id/verdict`, `GET /alerts/verdict-stats`, `PUT /farms/zones/:zoneId/detection-tuning`); màn FE chưa làm | Không — dùng API thật |
| Lịch sử can thiệp tay, tỷ lệ thời gian tự động | ENV-FR-019, ANALYTICS-FR-011 | 🟡 Backend có API (`/devices/sensor-nodes/:id/relay-overrides`, `/analytics/autonomy`); màn FE chưa làm | Không — dùng API thật |
| Live stream có khung trên từng con chim | VISION-FR-013/014 | 🟡 Backend cấp token (`/devices/camera-nodes/:id/stream-token`), nút AI chưa phát video → khung trống | Không (không có hình giả) |
| Vẽ vòng đếm của camera | VISION-FR-018 | 🟡 Backend có API (`PUT /devices/camera-nodes/:id/counting-ring`); màn FE chưa làm | Không |
| Thiết lập thiết bị bằng QR (quét nhãn, quét mã tầng, tiến trình), in nhãn ở kho thiết bị, in mã QR tầng | FARM-FR-003…012 (MF-10) | 🟡 Backend có đăng ký/dời/gỡ nhưng mới cho Technician/Admin; tiến trình "đã áp cấu hình" cần ENV-FR-027 | Không — làm phần đã có API, phần chưa có dùng `ComingSoon` |
| Duyệt thay đổi của chủ farm, đề xuất hệ số, lịch sử quyết định của chuyên gia | EXPERT-FR-009, 010, 011 | ⬜ Chưa có endpoint (`docs/reports/README.md` #18, #21) | `ComingSoon` |
| Trạng thái `DISMISSED`, gói bằng chứng của cảnh báo suy luận | EXPERT-FR-003, ALERT-FR-014 | ⬜ Chưa có ở backend (#19, #23) | `ComingSoon` cho phần bằng chứng |
| Đồng bộ cấu hình theo bộ điều khiển | ENV-FR-027 | ⬜ Chưa có (#22) | `ComingSoon` |
| Lịch đếm theo mùa / tạm thời, phiên không đầy đủ | VISION-FR-019, 020 | ⬜ Chưa có (#20, #24) | `ComingSoon` |
| Trạng thái sức khỏe nhà yến theo ngày (lý do, thời tiết), màn đánh giá ngày (hỏi đánh giá của người dùng trước rồi mới hiện trạng thái — BR-31), báo cáo ngày/tuần/tháng, tải PDF (`jspdf`) và CSV | ANALYTICS-FR-012, 013, EXPERT-FR-005, 012, 013 (MF-11) | ⬜ Chưa có endpoint (#32–36) | `ComingSoon` |
| Cấu trúc Farm — người phụ trách nhà, lịch thu dự kiến, khuyến nghị AI, KTV lắp đặt/firmware mới nhất của thiết bị | FARM-FR-* (phần mở rộng UI) | ⬜ Chưa có endpoint — `apis/farm-owner/farmMock.api.ts` trả RỖNG, UI hiện khung trống | Không (không có số liệu giả); farm/house/zone/thiết bị/số đo/cảnh báo/thu hoạch là API thật |
| Dashboard Farm Owner — độ ổn định các nhà yến (theo trạng thái thiết bị), 6 chỉ số, relay + chế độ AUTO/MANUAL, nhật ký cảnh báo của zone | ENV-FR-004/005, ALERT-FR-007 | ✅ API thật (`/analytics/env/summary`, telemetry + socket, `/devices/sensor-nodes`, `/alerts`) | Không |
| Dashboard Farm Owner — đếm chim (7/14/30/90 ngày), tỉ lệ chim về theo Zone | VISION-FR-008/009/010, ANALYTICS-FR-002 | 🟡 API thật nhưng chưa có dữ liệu (AI Vision chưa triển khai) → khung trống, không số giả | Không (không có số liệu giả) |
| Dashboard Farm Owner — gợi ý thuật toán AI | — | ⬜ Chưa có endpoint, `farmMock.api.ts` trả rỗng → khung trống | Không |

*Giới hạn:* bảng này cập nhật theo backend ngày 23/10/2026 (v2.9.0). Nguồn sự thật là backend thật cùng danh sách chỗ lệch trong `docs/reports/README.md` (cột "Trạng thái Backend" của `SwiftletCare_SRS.md` §5 không còn được cập nhật) — lệch nhau thì tin hai nguồn đó và sửa bảng này.

---

## 8. Biểu đồ — Ma trận chọn loại theo mục tiêu dữ liệu

| Nhóm biểu đồ | Loại dữ liệu | Áp dụng SwiftletCare |
|---|---|---|
| Line/Area | Chuỗi thời gian | Nhiệt độ/độ ẩm/khí/dB theo 1h–30d, return rate theo ngày |
| Bar/Column | So sánh danh mục | So sánh đa-Zone, ticket theo Technician, sản lượng theo đợt |
| Donut/Pie/Treemap | Tỷ trọng/cơ cấu | Tỷ lệ cảnh báo theo mức độ, tỷ lệ thiết bị Online/Offline, cơ cấu tài khoản theo role |
| Histogram/Box Plot | Phân phối/mật độ | Phân phối nhiệt độ 30 ngày (phát hiện outlier), phân phối thời gian xử lý ticket vs SLA |
| Gauge/Bullet | 1 giá trị realtime vs ngưỡng | NH3/CO2/nhiệt độ/độ ẩm hiện tại vs `zones.thresholds`, đếm ngược Manual Override |

Trước khi dựng chart: tự hỏi *"chuỗi thời gian, danh mục, tỷ trọng, phân phối, hay giá trị-so-ngưỡng?"* — câu trả lời quyết định nhóm chart.

---

## 9. Đồng bộ bố cục đa vai trò

| Loại màn hình | Component dùng chung | Áp dụng |
|---|---|---|
| Bảng dữ liệu | `<DataTable />` (`components/ui/`) | Mọi role |
| Popup xác nhận | `<ConfirmModal />` (`components/ui/`) | Toàn bộ 4 role đăng nhập |
| Nhật ký/lịch sử | `<Timeline />` — **chưa tồn tại** | Admin Audit Log, Ticket notes, threshold_history |
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

**4 actor người dùng** (Report 3 §2.3). Luồng chính: Farm Owner + Domain Expert, gồm cả thiết lập thiết bị bằng QR (MF-10). Luồng phụ (giữ chạy, không mở rộng): Technician + Administrator. Buyer, Sales Staff, Farm Operator đã bỏ. Phía Farm có 3 mức: **Primary Owner** (người tạo farm) · **đồng sở hữu** (Farm Owner được mời) · **Domain Expert** (được mời, chỉ đọc + kiểm chứng + tinh chỉnh). UI của mọi role theo mẫu Farm Owner (1.1).

**a) Ai nắm quyền gì** (R = thực hiện, A = quyết định cuối/can thiệp, I = chỉ xem/được báo, – = không có)

| Nhóm chức năng | Farm Owner | Domain Expert | Technician | Admin |
|---|:---:|:---:|:---:|:---:|
| Dashboard môi trường, Analytics, đếm chim, live stream | R | I (chỉ đọc) | – | – |
| Báo cáo sức khỏe Zone | R | R | – | – |
| Lịch sử quyết định của chuyên gia (EXPERT-FR-009) | R (xem, được báo từng quyết định) | R | – | – |
| Trạng thái sức khỏe nhà yến theo ngày, đánh giá ngày từ quan sát của mình (MF-11) | R | R | – | – |
| Báo cáo ngày/tuần/tháng, tải PDF/CSV | R | R | – | – |
| Mức của chỉ số sức khỏe theo nhà yến (BR-28) | I (R khi farm chưa có chuyên gia) | R | – | – |
| Duyệt thay đổi ngưỡng/hệ số của chủ farm (EXPERT-FR-010) | I | R | – | – |
| Thông báo ngoài ứng dụng (Telegram, push) | R | – (chỉ trong ứng dụng) | – | – |
| Xác nhận (acknowledge) cảnh báo | R | – | R (chỉ cảnh báo gắn ticket mình đang giữ) | – |
| Kiểm chứng cảnh báo suy luận, viết kết luận | I (đọc kết luận; kiểm chứng thay khi farm chưa có chuyên gia, BR-22) | R | – | – |
| Can thiệp tay relay có thời hạn | R | – | R (chỉ khi đang giữ ticket mở của farm) | – |
| Ngưỡng Zone, reset mặc định | R | R | – | I |
| Hệ số logic mờ | R (áp gợi ý chỉ khi farm chưa có chuyên gia) | R (duyệt thay đổi của chủ farm, áp gợi ý) | – | I |
| Tham số phát hiện, vòng đếm, lịch đếm theo mùa | I (R khi farm chưa có chuyên gia, BR-22) | R | – | I |
| Ticket: tạo · xử lý · can thiệp | R (tạo, chat, huỷ, đánh giá) | – | R (xử lý, chat) | A (mọi ticket) |
| Đăng ký thiết bị bằng nhãn QR, gán Zone bằng mã QR tầng, dời, gỡ (MF-10) | R | – | R (khi có ticket lắp đặt) | – |
| Lệnh từ xa, OTA, file loa | – (chỉ xem) | – | R | I |
| Kho thiết bị: thêm, in nhãn QR, cấp lại/thu hồi khoá | – | – | – | R |
| Cấu trúc Farm (Farm/House/Zone) | R (farm mình) | I | R (trong `assigned_regions`) | A (toàn bộ) |
| Xoá farm, đổi `region`, mời/gỡ thành viên | R (chỉ Primary Owner) | – | – | R (xoá farm, đổi `region`) |
| Ghi nhận thu hoạch | R | I | – | – |
| Tài khoản, cấu hình mặc định, SLA, audit log, sức khỏe hệ thống | I | I | I | R/A |
| Chọn bài loa ru / nghe thử | R | – | – | – |

Nguồn: Report 3 §2.4. Farm chưa có chuyên gia (BR-22): Farm Owner làm thay các việc R của Domain Expert ở bảng trên, trừ viết kết luận và duyệt thay đổi của chính mình.

**b) Cây màn theo role** — màn nào dùng chung, màn nào riêng

```
Farm Owner (luồng chính — UI MẪU)
├── Riêng:     /dashboard · /analytics · /vision · /harvests (ghi) · /support + /support/chi-tiet (⏳)
├── Đích (Report 3): đọc kết luận + lịch sử quyết định của chuyên gia · gửi đề xuất hệ số cho chuyên gia
├── Thiết lập thiết bị (MF-10, mobile là chính; web là đích): quét nhãn, quét mã tầng, tiến trình setup, in mã tầng
├── Dùng chung với Domain Expert (Domain Expert chỉ đọc, ẩn nút ghi bằng usePermission):
│              /dashboard · /analytics · /vision · /stream/:id · /harvests (xem) · báo cáo sức khỏe Zone (đích)
├── Dùng chung với Technician (trang thuộc technician/, mở bằng OPS_ROLES):
│              /devices (relay, lịch loa) · /alerts (xác nhận) · /farms (cấu trúc)
└── Chung mọi role: /settings · chuông thông báo · đổi ngôn ngữ

Domain Expert (luồng chính — CHƯA CÓ CODE FE; backend có một phần, xem mục 7)
├── Riêng (đích, bucket domain-expert/): kiểm chứng cảnh báo (kèm bằng chứng) · viết kết luận · duyệt thay đổi của chủ farm
│              · duyệt đề xuất hệ số · tham số phát hiện · vòng đếm · lịch đếm theo mùa
└── Đọc chung trang Farm Owner: dashboard · analytics · vision · live stream · thu hoạch · cấu trúc farm (chỉ xem)
    KHÔNG BAO GIỜ: relay, lịch loa, ticket, ghi thu hoạch, acknowledge cảnh báo, sửa/xoá farm, mời thành viên

Technician (luồng phụ)
├── Riêng:     /tickets + /tickets/:id (xử lý, SAT) · /ota · /maintenance
├── Cùng bước với Farm Owner khi có ticket lắp đặt: /onboarding (MF-10)
├── Dùng chung với Farm Owner: /devices · /alerts · /farms (lọc theo assigned_regions)
└── KHÔNG xem Dashboard/Analytics môi trường (Report 3 FARM-FR-009)

Administrator (luồng phụ)
├── Riêng:     /system/health · /system/devices · /system/farms(…) · /system/tickets(…) · /users
│              /account-requests · /system/settings · /system/audit-log
├── Dùng chung: /alerts
└── KHÔNG xem Dashboard/Analytics môi trường; can thiệp ticket qua /system/tickets

Riêng ngoài hệ thống role: Landing Page (công khai) · Mobile app (mobile/) — thiết kế riêng, không theo 1.1
```

**c) Kiểm tra luồng (BA) — code hiện tại so với Report 3 §2.4** — cập nhật mỗi khi sửa route/quyền

| # | Chỗ | Code hiện tại | Report 3 | Việc cần làm |
|---|---|---|---|---|
| 1 | Domain Expert | Chưa có role `DOMAIN_EXPERT`, layout, route; còn `SALES_STAFF` | Luồng chính | Thêm role theo checklist 12.10; gỡ Sales Staff (13.14) |
| 2 | `/dashboard`, `/analytics`, `/vision` | `FARM_OWNER_ONLY` | Farm Owner + Domain Expert (chỉ đọc) | Đổi sang `FARM_SIDE_ROLES` khi thêm Domain Expert |
| 3 | `/stream/:id` | `OPS_ROLES` (có Technician, Admin) | Chỉ Farm Owner + Domain Expert | Thu hẹp quyền route |
| 4 | `/harvests` | `HARVEST_ROLES` (Farm Owner + Admin) | Farm Owner R, Domain Expert I, Admin – | Bỏ Admin, thêm Domain Expert chỉ xem |
| 5 | `/ota`, `/maintenance` | `OPS_ROLES` (Farm Owner vào được) | Chỉ Technician (Admin I) | Tạo nhóm quyền riêng cho Technician |
| 5b | `/onboarding` | Màn nhập tay Device ID + khoá của Technician | Farm Owner + Technician, quét nhãn QR và mã QR tầng (MF-10, FARM-FR-003…012) | Thêm quét QR (`html5-qrcode`) và tiến trình setup; mobile là nơi làm chính |
| 6 | `/tickets` (màn Technician) | `OPS_ROLES` — Farm Owner đang dùng màn này; `/support` riêng của Farm Owner ⏳ | Farm Owner chỉ tạo/theo dõi | Khi `/support` merge: bỏ Farm Owner khỏi `/tickets` |
| 7 | `/alerts` | `OPS_ROLES`, ai cũng có nút xác nhận | Farm Owner; Technician chỉ cảnh báo gắn ticket mình giữ; Admin không | Ẩn nút xác nhận với Admin, và với Technician khi cảnh báo không gắn ticket của họ |
| 8 | `/marketplace`, `/marketplace/:id` | Còn route công khai | Ngoài phạm vi (Report 3 §8) | Gỡ (13.14) |
| 9 | Sửa ngưỡng / hệ số mờ ở màn Technician (`ThresholdsModal`) | Technician sửa được | Chỉ Farm Owner + Domain Expert của farm (ENV-FR-006, 021) | Gỡ chỗ sửa khỏi màn Technician |
| 10 | Kho thiết bị (Admin) | Trả khoá một lần, chưa in nhãn | Admin in nhãn QR ngay khi thêm (FARM-FR-010); màn Zone in mã QR tầng (FARM-FR-011) | Sinh QR ở client bằng `qrcode`, định dạng ở Report 4 §5.4 |

Backend vẫn là chốt chặn thật (13.8) — bảng này chỉ nói giao diện đang lệch với Report 3. Mỗi dòng sửa trong PR của role sở hữu màn đó.

### 12.1. Nguyên tắc

1. **Mỗi lớp quan tâm chia theo role ở cấp thư mục con.** `apis/`, `hooks/`, `components/features/`, `pages/`, `routes/`, `validations/` đều có các bucket `admin/` · `farm-owner/` · `domain-expert/` · `technician/` · `auth/` · `shared/` · `common/`. `domain-expert/` chứa các màn do chuyên gia sở hữu (kiểm chứng cảnh báo, viết kết luận, duyệt thay đổi của chủ farm, duyệt đề xuất hệ số, tham số phát hiện, vòng đếm, lịch đếm — farm chưa có chuyên gia thì Farm Owner mở cùng trang, BR-22); màn chuyên gia chỉ xem (dashboard, analytics, live stream, thu hoạch) là trang Farm Owner mở với nhóm role rộng hơn, không nhân bản sang `domain-expert/`. Không gom theo feature, không để file rải rác cạnh trang dùng nó.
2. **Vào `shared/` chỉ khi từ 2 role trở lên thật sự dùng.** Một role dùng thì về thư mục role đó, dù file trông "chung chung" tới đâu. Đây là luật chống `shared/` phình thành bãi rác.
3. **Thư mục cho biết role SỞ HỮU nghiệp vụ, không phải danh sách quyền.** `TechnicianDevicesPage` vẫn được Farm Owner và Admin mở. Quyền thật nằm ở `allow={...}` trong `routes/<role>.routes.tsx` — muốn biết ai vào được trang nào thì đọc `routes/`, không suy từ tên file.
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
│   └── shared/                farms.api · alerts.api · devices.api · tickets.api
│                              audioTracks.api (⚠ chỉ Technician dùng — nợ, xem 13.14)
│
├── components/
│   ├── auth/                  RequireRole
│   ├── ui/                    Design system — KHÔNG biết domain (chỉ phụ thuộc lib/cn + i18n)
│   │                          primitive: Button Card Badge Input Select Textarea Toggle Modal
│   │                          tổ hợp:    DataTable Pagination FilterChip EmptyState
│   │                                     LoadingSkeleton StarRating ActionsMenu SelectMenu
│   │                                     ConfirmModal NoteActionModal ComingSoon
│   │                          + icons.tsx · useFloatingMenu.ts · index.ts (barrel duy nhất)
│   ├── common/                CÓ biết domain và dùng ở >= 2 nơi. Cố ý giữ nhỏ.
│   │                          ZoneSwitcher · NotificationPopover · Toast · ZonePicker · StatusDot
│   │                          DateTimePicker · LogoutConfirmModal · ProfilePopover · (⏳ SeverityBadge · PriorityBadge)
│   ├── features/              Component riêng của từng tính năng
│   │   ├── admin/             users/ · system/ · tickets/
│   │   ├── farm-owner/        dashboard/ · analytics/ · farms/ · harvest/ · vision/ · (⏳ tickets/)
│   │   ├── domain-expert/     (đích) alert-verdicts/ · health-reports/ · detection-tuning/ · change-reviews/
│   │   │                      · coefficient-proposals/ · counting-ring/ · counting-schedule/
│   │   └── technician/        devices/ · alerts/
│   └── layouts/               Đúng 7 file — 4 của role, 3 dùng chung
│                              AdminLayout · FarmOwnerLayout · DomainExpertLayout · TechnicianLayout
│                              AppShell · AppSidebar · AppHeader
│
├── pages/                     CHỈ chứa *Page.tsx
│   ├── admin/                 AdminUsersPage · AdminAccountRequestsPage · AdminSystemHealthPage
│   │                          AdminSystemSettingsPage · AdminAuditLogPage
│   ├── farm-owner/            FarmOwnerDashboardPage · FarmOwnerAnalyticsPage · FarmOwnerFarmsPage
│   │                          FarmOwnerFarmHousesPage · FarmOwnerFarmZonesPage
│   │                          FarmOwnerFarmZoneDetailPage · FarmOwnerHarvestPage · FarmOwnerLiveStreamPage
│   │                          FarmOwnerVisionPage · (⏳ FarmOwnerTicketsPage · FarmOwnerTicketDetailPage)
│   │                          (đích) FarmOwnerDeviceSetupPage — MF-10, Technician mở cùng trang khi có ticket lắp đặt
│   ├── domain-expert/         (đích) DomainExpert<ChứcNăng>Page — kiểm chứng cảnh báo, báo cáo
│   │                          sức khỏe Zone, duyệt thay đổi, duyệt đề xuất hệ số, tham số phát hiện,
│   │                          vòng đếm, lịch đếm
│   ├── technician/            TechnicianDevicesPage · TechnicianAlertsPage
│   │                          TechnicianTicketsPage · TechnicianTicketDetailPage
│   ├── auth/                  LoginPage · RegisterPage · ForgotPasswordPage · InvitationPage
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
│   ├── shared/                useFarms · useAlerts · useDevices · useTickets
│   │                          useAlertNotifications (listener socket AppShell mount)
│   │                          useAudioTracks (⚠ chỉ Technician dùng — nợ, xem 13.14)
│   └── common/                Hạ tầng không gắn role:
│                              usePermission · useSocket · usePaginatedListQuery · useBreadcrumb
│
├── validations/               Hàm kiểm tra form, thuần logic
│   ├── admin/                 user.validation.ts
│   ├── technician/            audioTrack.validation.ts
│   └── common/                threshold.validation.ts · speakerSchedule.validation.ts
│
├── types/                     Chia theo MODULE backend, không theo role (xem 12.7)
│                              auth · farm · device · telemetry · alert · ticket
│                              harvest · vision · system · socket · common
│                              + index.ts (barrel, giữ `@/types` chạy như cũ)
│
├── constants/                 roles (nhóm role + getRoleHomePath + canAccessPath)
│                              thresholds · tickets · auditActions · sla
│                              <module>.i18n.ts (dashboard · farmStructure · navigation · shell)
│                              (⏳ severity + severity.i18n + priority — 3 cấp dùng chung, 2.4 · support.i18n)
│
├── stores/                    Zustand: authStore · alertStore · toastStore
│                              zoneStore · breadcrumbStore · languageStore · pinnedHouseStore
│                              logoutConfirmStore · readAlertStore
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
- `pages/` **không có** thư mục `shared/` hay `public/`. Trang nhiều role dùng chung đặt ở thư mục role sở hữu nghiệp vụ chính (Thiết bị/Cảnh báo/Ticket → `technician/`; Trang trại/Dashboard/Analytics/Thu hoạch/Camera và **thiết lập thiết bị bằng QR (MF-10)** → `farm-owner/`; kiểm chứng/kết luận/duyệt thay đổi/đề xuất hệ số/tham số phát hiện/vòng đếm/lịch đếm → `domain-expert/`).
- Trang không thuộc nghiệp vụ role nào để thẳng ở gốc `pages/`; màn đăng nhập/đăng ký/nhận lời mời ở `pages/auth/`.
- **Trong `pages/` không được có gì ngoài `*Page.tsx`.** Modal, tab, cột bảng, hằng số riêng của trang đều nằm ở `components/features/<role>/<area>/`.

### 12.5. `layouts/` — mỗi role một layout, menu viết trong file

- 4 file `<Role>Layout.tsx` **khai mảng `menuSections` đầy đủ ngay đầu file**, mỗi mục là `{ label, path, icon }` viết literal — không tra từ bảng nav dùng chung. Mở `AdminLayout.tsx` là thấy trọn menu của Admin.
- `dockItems` khai thêm khi dock mobile cần chọn tay (Admin có 10 mục nên phải chọn); các role khác dùng `firstDockItems(menuSections)` lấy 4 mục đầu.
- `AppShell` giữ toàn bộ khung (sidebar + header + nội dung + Toast) và mount listener socket cảnh báo. `AppSidebar` thuần trình bày, render cùng menu ở 2 breakpoint (rail `w-64` desktop + dock nổi mobile). `AppHeader` giữ breadcrumb + zone + chuông + ngôn ngữ.
- `RoleLayout` trong `App.tsx` chọn layout theo `user.role` **lúc chạy**, vì URL của SwiftletCare không có tiền tố role (`/devices` dùng chung 3 role) nên không gắn layout theo nhánh route được.
- **Thêm/bớt mục menu của một role: sửa đúng file layout của role đó, không đụng chỗ nào khác.** Nếu mục đó cũng cần chặn `returnTo` sau đăng nhập thì thêm một dòng vào bảng `MENU_ACCESS` trong `constants/roles.ts`.

### 12.6. Ba tầng component — phân biệt `ui/` · `common/` · `features/`

| Tầng | Biết domain? | Số nơi dùng | Ví dụ |
|---|---|---|---|
| `ui/` | Không | bất kỳ | `Button` · `DataTable` · `EmptyState` · `ConfirmModal` |
| `common/` | Có | >= 2 | `ZoneSwitcher` · `ZonePicker` · `StatusDot` |
| `features/<role>/<area>/` | Có | 1 | `ThresholdsModal` · `SensorCard` · `CreateUserModal` |

`ui/` là design system **tự chứa**: chỉ phụ thuộc `@/lib/cn` và `@/i18n` (dịch nhãn mặc định/prop chữ — không mang kiến thức domain). Không file nào trong `ui/` được import barrel `@/components/ui` của chính nó — import thẳng module anh em để tránh vòng lặp.

### 12.7. Ngoại lệ đã thống nhất — đừng "sửa lại cho đúng"

| Chỗ | Vì sao lệch quy tắc chung |
|---|---|
| `types/` chia theo **module backend**, không theo role | Type là shape thực thể mirror model Mongoose. `Zone`, `Alert`, `Ticket` được 3 role đọc, không có chủ sở hữu duy nhất. Ép vào thư mục role thì hoặc phải nhân bản, hoặc 80% type dồn vào `types/shared/`. |
| `components/features/admin/tickets/AdminOverrideModals.tsx` nằm ở `admin/` nhưng bị trang Technician import | Là UI riêng của Admin, gated bằng `usePermission('ADMIN')` trong `TechnicianTicketDetailPage`. Khi một component là **năng lực của role này render trong màn của role khác**, quyền sở hữu thắng nơi import. |
| `constants/roles.ts` giữ bảng `MENU_ACCESS` tách rời menu trong layout | Không thể đọc ngược menu từ file layout: `useAuth` cần `canAccessPath`, mà layout lại render `AppHeader` gọi `useAuth` → import vòng, lỗi lúc chạy. |
| `apis/shared/` + `hooks/shared/` còn tồn tại (11 file, gồm 2 file `audioTracks` đang nằm sai chỗ — xem 13.14) | Đã kiểm bằng đồ thị import: `farms`/`alerts` được cả 4 role chạm tới vì chính khung app render `ZoneSwitcher` + `NotificationPopover`; `devices`/`tickets` dùng bởi admin + technician. **Không có `components/features/shared/`.** |

### 12.8. Checklist khi thêm một màn hình mới

1. Màn này thuộc nghiệp vụ role nào? → tạo `pages/<role>/<Role><ChứcNăng>Page.tsx`, tên hàm trùng tên file.
2. Khai route trong `routes/<role>.routes.tsx`, bọc `<RequireRole allow={...}>` bằng nhóm role lấy từ `constants/roles.ts`, chọn theo bảng phân quyền Report 3 §2.4:

   | Nhóm | Gồm | Dùng cho | Trạng thái |
   |---|---|---|---|
   | `OPS_ROLES` | Farm Owner · Technician · Admin | Thiết bị/relay, xác nhận cảnh báo, ticket. Admin chỉ xem: không can thiệp tay, không xác nhận cảnh báo; Technician chỉ làm hai việc đó khi đang giữ ticket của farm — ẩn nút bằng `usePermission` | Có |
   | `SETUP_ROLES` | Farm Owner · Technician | Thiết lập thiết bị bằng QR, dời/gỡ thiết bị, in mã QR tầng (MF-10) | Tạo khi làm màn MF-10 |
   | `FARM_SIDE_ROLES` | Farm Owner · Domain Expert | Dashboard, analytics, live stream, báo cáo sức khỏe Zone, ngưỡng và hệ số mờ theo Zone, lịch sử quyết định của chuyên gia; kiểm chứng cảnh báo, tham số phát hiện, vòng đếm, lịch đếm (Farm Owner chỉ ghi khi farm chưa có chuyên gia — BR-22) | Tạo khi thêm `DOMAIN_EXPERT` |
   | `EXPERT_ONLY` | Domain Expert | Viết kết luận, duyệt thay đổi của chủ farm, duyệt đề xuất hệ số | Tạo khi thêm `DOMAIN_EXPERT` |
   | `FARM_OWNER_ONLY` | Farm Owner | Thành viên, cài đặt farm | Có |
   | `HARVEST_ROLES` | Farm Owner (ghi) · Domain Expert (xem) | Ghi nhận thu hoạch. Code hiện là Farm Owner · Admin — bỏ Admin, thêm chuyên gia khi thêm `DOMAIN_EXPERT` (12.0 c dòng 4) | Có (đích khác) |
   | `ADMIN_ONLY` | Admin | Quản trị hệ thống, kho thiết bị và in nhãn | Có |

   Domain Expert **không bao giờ** thuộc nhóm có hành động ghi vận hành (relay, ticket, ghi thu hoạch, acknowledge cảnh báo). Trang dùng chung có nút ghi (VD Thu hoạch mà chuyên gia chỉ xem) thì thêm chuyên gia vào `allow` và ẩn nút bằng `usePermission` (13.8).
3. Cần lên sidebar? → thêm `{ label, path, icon }` vào `menuSections` trong `<Role>Layout.tsx`, và thêm dòng vào `MENU_ACCESS` (`constants/roles.ts`).
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
| `components/layouts/` | `[Role]Layout.tsx` cho layout của role · `App[Phần].tsx` cho khung dùng chung | `AdminLayout.tsx` · `AppSidebar.tsx` · `AppHeader.tsx` |
| `components/ui/` · `components/common/` | `[TênFeature].tsx` — **không** tiền tố role | `DataTable.tsx` · `ConfirmModal.tsx` · `ZoneSwitcher.tsx` |
| `hooks/<bucket>/` | `use[Resource].ts` — camelCase, **bắt buộc** bắt đầu bằng `use` | `useUsers.ts` · `useFarms.ts` · `usePermission.ts` |
| `apis/<bucket>/` | `<resource>.api.ts` | `users.api.ts` · `farms.api.ts` |
| `types/` | `<module>.types.ts` | `auth.types.ts` · `device.types.ts` |
| `validations/<bucket>/` | `<resource>.validation.ts` | `user.validation.ts` · `threshold.validation.ts` |
| `routes/` | `<role>.routes.tsx` | `admin.routes.tsx` · `farm-owner.routes.tsx` |
| `stores/` | `<tên>Store.ts` — camelCase | `authStore.ts` · `alertStore.ts` |
| `constants/` · `lib/` · `providers/` | camelCase, tên nói đúng nội dung | `auditActions.ts` · `chartTheme.ts` · `AppProviders.tsx` |
| Thư mục | **kebab-case** cho tên role nhiều từ | `farm-owner/` · `domain-expert/` |

**Hằng số riêng của một feature** đi kèm component trong cùng thư mục, đặt `<area>.constants.ts`: `users.constants.ts`, `harvest.constants.ts`. Hằng số dùng chung toàn app thì về `constants/`.

### 12.10. Khi nào được tạo thư mục mới, và tạo ở đâu

Không tự sinh thư mục tuỳ ý. Chỉ 4 trường hợp dưới đây được tạo mới:

| Tình huống | Tạo ở đâu | Điều kiện |
|---|---|---|
| Thêm một **nhóm màn hình mới** cho role đã có | `components/features/<role>/<area-mới>/` | `<area>` đặt theo danh từ nghiệp vụ số nhiều, kebab-case nếu nhiều từ: `harvest/`, `account-requests/` |
| Thêm **role mới** vào hệ thống | Đồng thời 5 chỗ: `pages/<role>/` · `routes/<role>.routes.tsx` · `components/layouts/<Role>Layout.tsx` · `apis/<role>/` và `hooks/<role>/` (chỉ khi có endpoint riêng) | Phải cập nhật luôn `Role` trong `types/common.types.ts`, `ROLE_LABEL` + `ROLE_HOME` + `MENU_ACCESS` trong `constants/roles.ts`, và nhánh `switch` trong `RoleLayout` (`App.tsx`) |
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

- **[Bắt buộc]** Store chỉ giữ trạng thái **thuần client** dùng ở nhiều màn: `authStore`, `zoneStore` (zone đang chọn), `alertStore` (cảnh báo realtime), `toastStore`, `breadcrumbStore`. Thêm store mới phải trả lời được "vì sao không phải React Query / state cục bộ".
- **[Nên]** Đọc store bằng selector (`useToastStore(s => s.push)`), không lấy cả object để tránh re-render thừa.

### 13.4. Realtime — Socket.io

- **[Bắt buộc]** Component/page **không** import `@/lib/socket`. Kết nối và đăng ký sự kiện đi qua hook (`useSocket`, `useTelemetry`, `useAlertNotifications`).
- **[Bắt buộc]** Mọi `on*`/`joinZone` trong `useEffect` phải huỷ ở cleanup (`off`/`leaveZone`) — thiếu cleanup là rò listener mỗi lần đổi zone.
- **[Bắt buộc]** Tên sự kiện và payload khớp backend và Report 4 §7.3: phòng `zone:<id>` (`JOIN_ZONE`), `house:<id>` (`JOIN_HOUSE` — số đếm chim, camera, cảnh báo của nhà yến), `ticket:<id>` (`JOIN_TICKET_CHAT`), phòng riêng `user:<id>`; sự kiện `TELEMETRY_UPDATE`, `RELAY_UPDATE`, `DEVICE_STATUS_CHANGE`, `ALERT_NEW`, `BIRD_COUNT_UPDATE`, `NOTIFICATION_NEW`, `TICKET_MESSAGE_NEW`, `TICKET_CHAT_ASSIGNEE_CHANGED`; type trong `types/socket.types.ts`.

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
- **[Bắt buộc]** Enum (`Role`, `DeviceStatus`, `AlertSeverity/Type/Status`, `TicketType/Priority/Status`…) phải đồng bộ với `backend/src/types/domain.types.ts`. Đổi/thêm giá trị enum thì sửa **cả hai phía trong cùng PR** hoặc PR phải ghi rõ PR backend đi kèm.
- **[Bắt buộc]** `eslint-disable` chỉ được dùng từng dòng (`-next-line`), đúng 1 rule, kèm comment giải thích vì sao (như `ActionsMenu.tsx`, `useBreadcrumb.ts`). Cấm `eslint-disable` cả file.

### 13.7. Style

- **[Bắt buộc]** Màu chỉ lấy từ token trong `tailwind.config.ts`: thang `gray` / `lime` / `accent` / `orange` / `red` và alias `charcoal` · `graphite` · `warmGray` · `limeMist` · `success` · `climateOrange` · `safetyOrange` (`#FF7426`, lỗi thiết bị ở widget Trạng thái nhà yến) · `infoBlue` (`#4A89EB`, nhãn trạng thái cảnh báo "Mới") · `statusYellow` (`#FFE033`, nhãn "PLC: Đang chờ kết nối") · `alertRed` · `stone` · `white`. **Không** viết hex/`rgb()` trong `className` hay `style` (kể cả arbitrary value `bg-[#...]` — code hiện 0 chỗ), không dùng palette mặc định của Tailwind (`slate`, `zinc`, `neutral`, `blue`, `green`…). Lưu ý `stone` đã bị ghi đè = `#EAEAEA` (canvas), không phải thang stone của Tailwind.
- **[Nên]** Chữ dùng thang `text-h1` · `text-h2` · `text-h3` · `text-body` · `text-small` · `text-caption` · `text-metric` (mục 2.8) thay cho `text-sm`/`text-2xl` mặc định. Code cũ còn ~230 chỗ dùng size mặc định (13.14) nên chưa bắt buộc; file mới tạo thì nên dùng thang này ngay từ đầu.
- **[Bắt buộc]** Modal/popup dùng `Modal` / `ConfirmModal` / `NoteActionModal` trong `components/ui/`, không tự dựng overlay (overlay tự dựng rất dễ dùng `bg-black/…` — trái 5.2).
- **[Bắt buộc]** Không sửa layout/kích thước sidebar, topbar (4.1).
- **[Nên]** Dùng `cn()` (`lib/cn`) để ghép class điều kiện thay vì nối chuỗi template.

### 13.8. Phân quyền

- **[Bắt buộc]** Trang mới được chặn bằng `<RequireRole allow={...}>` trong `routes/<role>.routes.tsx`, nhóm role lấy từ `constants/roles.ts` — không viết mảng role literal tại chỗ.
- **[Bắt buộc]** Ẩn/disable nút theo quyền dùng `usePermission(...)`, không rải `user.role === '...'` trong component (so sánh role của **dòng dữ liệu** để hiển thị — như cột role trong bảng user — thì được).
- **[Bắt buộc]** Ẩn UI **không phải** là bảo mật. Hành động nhạy cảm phải được backend chặn; PR thêm nút mới cho role nào thì endpoint tương ứng phải cho phép đúng role đó (đối chiếu `requireRole` phía backend / spec).
- **[Bắt buộc]** Thêm mục menu: sửa `menuSections` trong `<Role>Layout.tsx` **và** thêm dòng `MENU_ACCESS` trong `constants/roles.ts` (12.5).

### 13.9. Dữ liệu giả & tính năng chưa có

- **[Bắt buộc]** Tính năng chưa có API thật: dùng `ComingSoon` (`components/ui/`), hoặc hiển thị số liệu giả **kèm** dòng thông báo theo 5.4 và bảng mục 7. Không đưa số liệu hardcode lên như thật.
- **[Bắt buộc]** Không để lại dữ liệu mock/hardcode ở màn **đã** có API thật (mục 7 ghi "Không cần nhãn").

### 13.10. Routing & hiệu năng

- **[Bắt buộc]** Trang mới được `lazy()` trong file `routes/` của role (code-splitting; hiện mọi trang đều lazy, kể cả `SettingsPage` trong `App.tsx`). Không import tĩnh trang vào `App.tsx` hay file route.
- **[Bắt buộc]** Không import thư viện nặng (`chart.js`, `react-chartjs-2`, `date-fns`, `video.js`) vào file nằm trong bundle chính: `App.tsx`, `components/layouts/`, `components/common/`, `components/ui/`, `stores/`, `lib/` (trừ `lib/chartTheme.ts`).
- **[Nên]** Danh sách dài dùng phân trang server (`usePaginatedListQuery` + `Pagination`), không tải hết rồi cắt ở client.

### 13.11. Accessibility tối thiểu

- **[Bắt buộc]** Hành động bấm được là `<button>` (hoặc `Button`), điều hướng là `<Link>`/`NavLink` — không `div onClick` cho hành động (wrapper chỉ để `stopPropagation`, như trong `SensorAlertLogTable`, thì được).
- **[Bắt buộc]** Nút chỉ có icon phải có `aria-label` tiếng Việt.
- **[Bắt buộc]** Input trong form có label gắn đúng (`Input`/`Select`/`Textarea` của `ui/` đã hỗ trợ `label`).
- **[Nên]** Trạng thái không chỉ truyền bằng màu — kèm chữ hoặc icon (mục 2.6 đã yêu cầu icon + label cho cảm biến).

### 13.12. Vệ sinh code

- **[Bắt buộc]** Không để `console.log`/`console.debug` (hiện 0 chỗ), không để code bị comment-out, không để import/biến thừa (ESLint `no-unused-vars` sẽ báo).
- **[Bắt buộc]** Mọi import dùng alias `@/` (12.1).
- **[Bắt buộc]** Comment chỉ **1 dòng** dạng `// <tên hoặc tính năng>` trên khối code/chart/button/hàm (`// Bảng nhật ký cảnh báo`, `// Nút tạo ticket`). Không khối `/** … */` nhiều dòng, không giải thích lại code. Áp cho code mới/sửa; comment cũ dọn khi sửa file.
- **[Bắt buộc]** Tên file, hàm, biến viết đủ chữ, không viết tắt (phần đầu tài liệu, quy tắc bổ sung #1).
- **[Bắt buộc]** Mỗi lần render/xử lý ≤ O(n): tra cứu theo id bằng `Map` dựng 1 lần trong `useMemo`, không `find` lồng trong `map`; logic viết tuần tự, dễ đọc ở mức Junior.

### 13.13. Trước khi mở PR

- **[Bắt buộc]** Các lệnh sau pass trong `frontend/`: `npm run lint` (không lỗi; warning không chặn) · `npx tsc --noEmit` · `npx vitest run` · `npm run build`. CI (`.github/workflows/ci.yml`, job Frontend) chạy lại đúng các lệnh này trên mỗi PR sửa `frontend/`; PR có job đỏ thì chưa merge.
- **[Bắt buộc]** PR điền đủ `.github/pull_request_template.md`; commit theo `.commitlintrc.json` (scope FE thường dùng: `web`, `pwa`).
- **[Bắt buộc] Tên nhánh** `<type>/<module>-<role>-<tính-năng>`, toàn chữ thường, nối bằng gạch ngang, tách từ develop và mở PR vào `develop`:
  - `type` lấy từ `type-enum` của commitlint: `feat` · `fix` · `refactor` · `perf` · `test` · `docs` · `chore` · `style`.
  - `module`: `fe` (frontend) · `be` (backend) · `fw` (firmware) · `mobile` · `ai`.
  - `role` viết liền: `farmowner` · `expert` · `technician` · `admin`; tính năng chung nhiều role thì bỏ phần role.
  - Ví dụ: `feat/fe-farmowner-ticket`, `fix/fe-technician-ota-upload`, `refactor/fe-shared-level-badge`. Không dùng `feature/…`, không đặt tên cá nhân hay ngày tháng.
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
| `apis/shared/audioTracks.api.ts` + `hooks/shared/useAudioTracks.ts` | Chỉ Technician dùng (`features/technician/devices/AudioTracksModal`) → sai 12.1 nguyên tắc 2 | Dời về `apis/technician/` + `hooks/technician/` |
| `pages/technician/TechnicianDevicesPage.tsx` | Gọi `queryClient.invalidateQueries` ngay trong page (13.2 [Nên]) | Chuyển vào `onSuccess` của mutation trong `useDevices` |
| Mục 6 i18n | Hai hệ dịch song song (`src/i18n/` cho Admin + `ui/`; `useTranslation` + `*.i18n.ts` cho Farm Owner, Technician farms, khung app); nhiều màn vẫn hardcode tiếng Việt | PR riêng gộp về một hệ, sau đó 13.x mới yêu cầu `t('...')` |
| `StatCard` cục bộ trong `AdminSystemHealthPage` | Mục 9 muốn dùng chung | Tách ra khi màn thứ hai cần |
| Chưa có `ErrorBoundary` (0 chỗ) | 13.5 | Thêm `ui/ErrorBoundary.tsx`, bọc `<Outlet />` trong `AppShell` |
| `getApiErrorMessage` trả câu lỗi nguyên văn của backend — Ticket Farm Owner đã chuyển ⏳, các màn còn lại vẫn dùng | 13.16 b | Màn khi sửa đổi sang `useApiErrorMessage()` (`hooks/common/`); hết chỗ gọi thì xoá `getApiErrorMessage` |
| Chưa có Prettier, husky, lint-staged; ESLint thiếu rule ở 13.15 | 13.15 | 1 PR cài công cụ + 1 commit format toàn bộ |
| `formatDate`/`formatDateOnly` (`lib/helpers.ts`), `day`/`time` của `useTranslation` lệch chuẩn 6.1 | 6.1 | Chuyển sang `formatStandardDate`/`formatHourMinute`/`formatDateTime` khi sửa màn |
| Trạng thái ticket và thanh tiến độ tự khai ở Technician (`StatusStepper`, `STATUS_BADGE_CLS`) và Admin (`TicketStatusSteps`, `STATUS_BADGE_CLASS`) | 2.10 | Dùng `TicketStatusBadge` + `TicketProgressStepper` |
| Màn Admin/Technician còn hiện mã rút gọn từ id (VD `#{ticket._id.slice(-6)}`) | 13.16 a | Người phụ trách role đó gỡ khi sửa màn |
| Nhãn mã backend khai riêng/viết cứng ngoài `enumLabels.i18n.ts`: `TICKET_TYPE_LABEL`, `STATUS_LABEL` (`constants/tickets.ts`, chỉ VI), `STATUS_LABEL` (`common/StatusDot.tsx`), `ROLE_LABEL` (`constants/roles.ts`), "Technician" cứng trong `technician/tickets/TicketChat.tsx`, chữ trạng thái trong `StatusStepper`, `UpdateStatusModal`, `TicketToolbar`, `admin/tickets/TicketStatusSteps`, bản dịch trùng trong `src/i18n/en.ts` | 6.3 | Người phụ trách role đó chuyển sang đọc `enumLabels.i18n.ts` khi sửa màn |
| ~230 chỗ `text-xs`/`text-sm`/`text-lg`/`text-2xl`… | Lệch thang chữ 2.8 (13.7 [Nên]) | Đổi dần khi sửa file đó |
| `pages/sales-staff/` · `routes/sales-staff.routes.tsx` · `SalesStaffLayout` · role `SALES_STAFF` trong `types/common.types.ts`, `types/ticket.types.ts`, `INVITE_ROLE_LABEL` | Role đã bỏ từ SRS v1.23.0 | Gỡ trong PR thêm `DOMAIN_EXPERT` (Report 3 §2.3) |
| `MarketplacePage` · `ListingDetailPage` · route công khai marketplace · `useMarketplace` · `marketplace.api` · `features/farm-owner/harvest/` phần đăng bán (`CreateListingModal`, `ListingPanel`, `ListingsTab`, `TraceCodeRow`) | Ngoài phạm vi (Report 3 §8) | Gỡ; backend đã không còn `/marketplace/*`; trang Thu hoạch chỉ còn ghi nhận |
| Chưa có role `DOMAIN_EXPERT`, `DomainExpertLayout`, `FARM_SIDE_ROLES`/`EXPERT_ONLY` | Mục 12 mô tả trạng thái đích | PR thêm role theo checklist "Thêm role mới" ở 12.10 |
| Nhãn `BIRD_PANIC`, relay sưởi ("Quá lạnh"), tùy chọn kênh Zalo/SMS trên giao diện | Ngoài phạm vi / đổi tên (Report 3 §8) | Đổi sang `NOISE_ANOMALY`, gỡ sưởi và Zalo/SMS |
| `features/technician/devices/ThresholdsModal` cho Technician sửa ngưỡng và hệ số mờ | Report 3 §2.4: chỉ Farm Owner + Domain Expert của farm (12.0 c dòng 9) | Gỡ chỗ sửa khỏi màn Technician; dời thành `ThresholdConfigCard` dùng chung (mục 9) |
| Nút can thiệp tay và xác nhận cảnh báo hiện cho Admin, và cho Technician không giữ ticket | Report 3 §2.4, ENV-FR-016, ALERT-FR-009 (12.0 c dòng 7) | Ẩn bằng `usePermission`; backend chặn khi làm xong `docs/reports/README.md` #2 |
| `/onboarding` chỉ là màn Technician nhập tay Device ID + khoá | MF-10 (12.0 c dòng 5b) | Làm `FarmOwnerDeviceSetupPage` quét QR, mở cho `SETUP_ROLES` |
| Chữ "PLC" trên Dashboard; mốc 20 giây và mốc điểm cân bằng Zone tự chọn; câu "Camera AI đếm chim, Raspberry Pi" ở `BirdTab`, `CorrelationCard` | 6.2, 2.6.1; Report 3: nút AI là PC/máy chủ, không phải Raspberry Pi | Đổi chữ thành "Bộ điều khiển", "nút AI" khi sửa màn; mốc giữ đúng giá trị ghi ở Report 3 §4.5 |

PR đụng vào file trong bảng thì **nên** trả nợ luôn; bắt buộc chỉ khi PR làm nợ nặng thêm (VD thêm consumer thứ hai vẫn chỉ của Technician vào `shared/`, hoặc thêm màn/tính năng mới cho Sales Staff, Marketplace, sưởi, Zalo/SMS — các phần này chỉ được gỡ, không được mở rộng).


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
- Không hiện `_id` MongoDB, mã rút gọn từ id (`#6A8494`), khoá enum (`POWER_OUTAGE`, `HIGH`, `AWAITING_FIELD_CONFIRMATION`) trên giao diện, `title`, `aria-label` hay HTML. Luôn đổi sang nhãn qua từ điển (`type.<ENUM>`, `status.<ENUM>`) hoặc bảng nhãn chung (2.4).
- Không đưa id lên URL khi không cần chia sẻ link: trang chi tiết nhận id qua **history state** (`navigate(path, { state: { ticketId } })`) — mẫu `SUPPORT_DETAIL_PATH` của Ticket Farm Owner ⏳; không có state (mở tab mới) thì quay về danh sách. Mã thiết bị in trên nhãn (`node_001`) là tên người dùng đọc được, được hiện.
- Chuỗi backend/firmware tự ghép (có mã enum, tiếng Anh, `undefined`) không hiện nguyên văn — dựng lại câu từ loại + dữ liệu đã dịch (mẫu khung báo lỗi thiết bị Farm Owner ⏳).
- **[Bắt buộc] Chữ phụ (dòng xám, gợi ý, mô tả) phải đúng với dữ liệu thật** — không viết câu chung chung có thể sai: ticket hệ thống tự sinh không ghi "Đã gửi"; chưa có kỹ thuật viên thì không ghi "chờ kỹ thuật viên tiếp nhận"; mô tả ở đầu trang chỉ hiện khi đúng người tạo đã nhập; mỗi ghi chú nhật ký ghi rõ người viết (Hệ thống · Bạn · Kỹ thuật viên · Thành viên khác — suy từ `author_id`). Mẫu: `progressHintKey`, `ticketDescription`, `noteAuthor` của Ticket Farm Owner ⏳.
- Ghi chú: tab Network của trình duyệt vẫn thấy id — đó không phải lỗ hổng; quyền thật do backend chặn (13.8).

**b) Lỗi API gộp theo nhóm — 1 câu chung, không chi tiết từng mã** — **[Bắt buộc]**. Không hiện mã HTTP, mã lỗi backend (`error.code`), câu lỗi nguyên văn của backend, endpoint, stack — tránh lộ cấu trúc hệ thống cho người dò lỗi:

| Nhóm | Mã gộp vào | Câu hiện (VI) | Câu hiện (EN) | Hành vi thêm |
|---|---|---|---|---|
| Phiên / quyền | 401 (sau khi làm mới phiên thất bại), 403 | Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn. | You don't have permission for this action or your session has expired. | 401 `TOKEN_EXPIRED` vẫn tự làm mới phiên trước (`lib/axios.ts`); hết cách thì về `/login`. Mở trang không đủ quyền → `/403` |
| Không tìm thấy | 404, 410 | Không tìm thấy dữ liệu hoặc dữ liệu đã bị xoá. | The data was not found or has been removed. | Trang chi tiết hiện `EmptyState` + nút về danh sách |
| Dữ liệu không hợp lệ / xung đột | 400, 409, 413, 415, 422 | Thông tin chưa hợp lệ hoặc đã thay đổi. Vui lòng kiểm tra lại. | The information is invalid or has changed. Please check and try again. | Lỗi từng ô do **validator phía client** (`validations/`) báo ngay dưới ô, không lấy câu backend |
| Hệ thống / mạng | 429, 5xx, hết thời gian chờ, không có phản hồi | Không kết nối được hệ thống. Vui lòng thử lại sau. | Could not reach the system. Please try again later. | Có nút **Thử lại**; màn realtime chuyển "Tự làm mới" (5.5) |

- Câu của 4 nhóm khai 1 lần trong `constants/error.i18n.ts` (`errorDict`) ⏳; `lib/apiError.ts` (`getApiErrorGroup`) đổi lỗi → nhóm theo mã HTTP ⏳; màn gọi `const apiErrorMessage = useApiErrorMessage()` (`hooks/common/`) ⏳ rồi `apiErrorMessage(error, t('form.sendFailed'))` → "Gửi yêu cầu thất bại. " + câu nhóm.
- Mẫu ⏳ ở Ticket Farm Owner: trang chi tiết lỗi 404 hiện "Không tìm thấy", nhóm khác hiện "Không mở được" + câu nhóm; khung số liệu (KPI) tải lỗi thì hiện câu nhóm + nút **Thử lại**, không hiện số 0 thay cho số chưa tải được.
- Nợ: `getApiErrorMessage` (`lib/helpers.ts`) vẫn trả câu lỗi nguyên văn của backend, còn ở các màn Admin/Technician/auth và một số màn Farm Owner — đổi khi sửa màn (13.14).

### 13.17. Chiến lược kiểm thử

| Tầng | Công cụ | Bắt buộc khi | Trạng thái |
|---|---|---|---|
| Logic thuần (validator, helper, hàm tính trong `*.ts` của feature, cấu hình chung như `severity.ts` ⏳) | vitest, file `*.test.ts` cạnh file nguồn | **[Bắt buộc]** mỗi hàm logic mới hoặc sửa hành vi | Có (7 file) |
| Hook React Query, component có logic (bảng, form, badge dùng chung) | vitest + `@testing-library/react` + `jsdom` | **[Nên]** với component dùng chung ở `common/`, form có validate | Chưa cài |
| Luồng chính end-to-end | Playwright | **[Nên]** trước mỗi vòng review hội đồng | Chưa cài |

Luồng e2e tối thiểu (khi cài Playwright): đăng nhập từng role và về đúng trang chủ · Farm Owner tạo ticket từ khung thiết bị đang báo lỗi · Farm Owner xác nhận cảnh báo · Farm Owner can thiệp tay relay có thời hạn · Domain Expert kiểm chứng cảnh báo (khi có màn) · Domain Expert duyệt thay đổi ngưỡng của chủ farm (khi có endpoint) · đổi VI/EN trên 1 màn có từ điển. Thiết lập thiết bị bằng QR (MF-10) kiểm trên mobile.

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

> **[Bắt buộc]** Trước khi tự viết component, màu, nhãn, định dạng hay hook: tra bảng này. Có sẵn thì import, thiếu thì bổ sung vào đúng file chung rồi ghi thêm 1 dòng ở đây — không viết bản riêng trong thư mục role. Mọi đường dẫn tính từ `frontend/src/`. ⏳ = chưa có trên `develop` (nhánh `feat/fe-farmowner-ticket`), chưa import được tới khi nhánh đó merge.

### D.1. Màu, mức độ, trạng thái, nhãn

| Mục | Đường dẫn | Xuất ra | Mục quy định |
|---|---|---|---|
| Token màu, bo góc, bóng, cỡ chữ | `../tailwind.config.ts` | `charcoal` `graphite` `warmGray` `limeMist` `success` `climateOrange` `safetyOrange` `infoBlue` `statusYellow` `alertRed` · `rounded-xl/2xl/3xl` · `shadow-card/popover/glass` · `text-h1…text-metric` | 2, 2.8, 4.3 |
| Class CSS chung | `index.css` | `.input` · `.label-caption` · `.glass-panel` | 1.1, 2.8, 5.2.1 |
| 3 cấp mức độ — màu ⏳ | `constants/severity.ts` | `LEVELS` · `SEVERITY_TO_LEVEL` · `LEVEL_BADGE_CLASS` · `LEVEL_BADGE_MUTED_CLASS` · `LEVEL_BADGE_SIZE` | 2.4 |
| 3 cấp mức độ — nhãn VI/EN ⏳ | `constants/severity.i18n.ts` | `levelDict` · `severityLabels()` | 2.4 |
| Ưu tiên ticket P1/P2/P3 ⏳ | `constants/priority.ts` | `PRIORITIES` · `PRIORITY[p]` (`tint` `solid` `dot` `rowTint` `headerTint`) | 2.4, 2.6.1 |
| Nhãn mã backend VI/EN ⏳ | `constants/enumLabels.i18n.ts` | `alertTypeDict` · `alertStatusDict` · `ticketTypeDict` · `ticketStatusDict` · `ticketDisplayStatusDict` · `deviceStatusDict` · `roleDict` · `prefixLabels()` | 6.3 |
| Trạng thái ticket + thanh tiến độ ⏳ | `constants/ticketStatus.ts` | `TICKET_STATUS_ORDER` · `ticketDisplayStatus()` · `TICKET_STATUS_BADGE_CLASS` · `TICKET_STATUS_BADGE_SIZE` · `buildTicketProgressSteps()` · `findStepIndex()` | 2.10 |
| Hạn SLA mặc định | `constants/sla.ts` | `FACTORY_DEFAULT_SLA` · `validateSla` · `SLA_PRIORITIES` · `PRIORITY_LABEL` (tên cũ) | 2.4 |
| Ngưỡng cảm biến | `constants/thresholds.ts` | khoảng hợp lệ ngưỡng Zone | — |
| Nhóm role, trang chủ theo role, quyền menu | `constants/roles.ts` | `OPS_ROLES` · `FARM_OWNER_ONLY` · `HARVEST_ROLES` · `ADMIN_ONLY` · `ROLE_HOME` · `MENU_ACCESS` · `canAccessPath` | 12.0, 12.8 |
| Nhãn hành động audit log | `constants/auditActions.ts` | nhãn hành động | — |
| Nhãn ticket cũ (chỉ VI) | `constants/tickets.ts` | `TICKET_TYPE_LABEL` · `STATUS_LABEL` · `STATUS_TONE` · `PRIORITY_TONE` · `PRIORITY_ICON_CLASS` | nợ — thay bằng `enumLabels`/`ticketStatus`/`priority` |

### D.2. Component dùng chung

**`components/ui/`** — không biết domain, mọi role dùng (import qua barrel `@/components/ui`, riêng `icons.tsx` import thẳng):

| Nhóm | Component |
|---|---|
| Nền tảng | `Button` · `Card` · `Badge` · `Input` · `Select` · `Textarea` · `Toggle` · `Avatar` · `icons.tsx` |
| Bảng, danh sách | `DataTable` (bảng chuẩn, `onRowClick`) · `FixedRowsTable` (cố định số dòng) · `Pagination` · `PaginationBar` · `FilterChip` · `SortChips` · `SearchInput` · `ClearFiltersButton` (nút "Hủy lọc") |
| Khung, ô số liệu | `SectionCard` · `StatTile` · `RadialGauge` · `Stepper` (thanh tiến độ) · `StableHeight` (giữ chiều cao khung) |
| Lớp nổi | `Modal` · `ConfirmModal` · `NoteActionModal` (popup nhập lý do) · `Drawer` · `ActionsMenu` · `SelectMenu` · `useFloatingMenu.ts` |
| Trạng thái màn | `EmptyState` · `LoadingSkeleton` · `ComingSoon` (tính năng chưa có API) · `DemoBanner` · `StarRating` |

**`components/common/`** — có biết domain, ≥ 2 nơi dùng:

| Component | Dùng để | Mục |
|---|---|---|
| `PriorityBadge` ⏳ | Badge 3 cấp (ưu tiên, ô đếm `count`, xám khi `isMuted`) | 2.4 |
| `SeverityBadge` ⏳ | Badge mức cảnh báo (đổi 4 mức backend → 3 cấp) | 2.4 |
| `TicketStatusBadge` ⏳ | Badge trạng thái ticket (tự xử lý Đã huỷ) | 2.10 |
| `TableEmptyState` ⏳ | Trạng thái rỗng chuẩn của bảng (truyền vào `FixedRowsTable emptyContent`) | 1.1 |
| `TicketProgressStepper` ⏳ | Thanh tiến độ ticket chuẩn (bước đậm + hiệu ứng đoạn nối, thêm bước riêng qua `extraSteps`) | 2.10 |
| `StatusDot` | Chấm + chữ trạng thái thiết bị | 2.5 |
| `DateTimePicker` | Chọn ngày giờ hẹn | — |
| `ZoneSwitcher` · `ZonePicker` | Chọn Zone | — |
| `NotificationPopover` · `ProfilePopover` · `LogoutConfirmModal` · `Toast` | Khung app: chuông, tài khoản, đăng xuất, thông báo nổi | 5.2.1 |

**Khung app và phân quyền:** `components/layouts/AppShell.tsx` · `AppSidebar.tsx` · `AppHeader.tsx` (dùng chung, đóng băng 4.1) · `components/auth/RequireRole.tsx` (chặn route).

**Component của Farm Owner được phép dời lên `common/`** khi role thứ hai cần (1.1): `features/farm-owner/farms/FarmFrame.tsx` (khung section) · `features/farm-owner/farms/KpiTile.tsx` (ô KPI) · `features/farm-owner/tickets/ticketColumns.tsx` (mẫu cột bảng ticket ⏳).

### D.3. Định dạng, dịch, tiện ích (`lib/`)

| Đường dẫn | Xuất ra | Mục |
|---|---|---|
| `lib/i18n.ts` | `Dictionary<K>` · `translate` · `formatStandardDate` ⏳ · `formatHourMinute` ⏳ · `formatDateTime` ⏳ · `formatTimestampsInText` ⏳ · `formatNumber` · `formatRelative` | 6, 6.1 |
| `i18n/index.ts` · `i18n/en.ts` (có trên `develop`) | Hệ dịch 1 (Admin, `ui/`): `t` · `tr` · `trChildren` · `translated` · `intlLocale` · `setLang` | 6 |
| `lib/cn.ts` | `cn()` ghép class (tailwind-merge) | 13.7 |
| `lib/apiError.ts` ⏳ · `constants/error.i18n.ts` ⏳ · `hooks/common/useApiErrorMessage.ts` ⏳ | `getApiErrorGroup` · `errorDict` · `useApiErrorMessage()` — câu lỗi API theo 4 nhóm | 13.16 b |
| `lib/helpers.ts` | `getApiErrorMessage` (nợ 13.16 b) · `formatDate`/`formatDateOnly` (nợ 6.1) · `formatRelativeTime` · `toLocalDateTimeInput` | — |
| `lib/axios.ts` | instance API + tự làm mới phiên 401 | 13.1 |
| `lib/socket.ts` | socket singleton — chỉ dùng qua hook | 13.4 |
| `lib/queryClient.ts` | React Query client (30s, retry 1) | 13.2 |
| `lib/navigation.ts` · `lib/chartTheme.ts` | chuyển về đăng nhập · theme Chart.js | 8 |

### D.4. Hook, API, store, validator dùng chung

| Nhóm | Đường dẫn | Nội dung |
|---|---|---|
| Hook hạ tầng | `hooks/common/` | `useTranslation` (Hệ 2: `t` `num` `day` `time` `date`⏳ `hourMinute`⏳ `dateTime`⏳ `ago`) · `usePermission` · `useSocket` · `usePaginatedListQuery` · `useBreadcrumb` (`usePageBreadcrumb`, `usePageBack`) · `useNavigationLabel` · `useScrollToTop` · `useCanScrollDown` · `useSyncedState` |
| Hook dữ liệu ≥ 2 role | `hooks/shared/` | `useFarms` · `useAlerts` · `useAlertNotifications` · `useReadAlerts` · `useDevices` · `useTickets` · `useTicketChat` (cờ `live`, 5.5) · `useMaintenanceSchedules` · `useAudioTracks` (nợ: chỉ Technician) |
| API ≥ 2 role | `apis/shared/` | `farms.api` · `alerts.api` · `devices.api` · `tickets.api` · `maintenanceSchedules.api` · `audioTracks.api` (nợ) |
| Store (Zustand) | `stores/` | `authStore` · `languageStore` · `zoneStore` · `alertStore` · `readAlertStore` · `toastStore` · `breadcrumbStore` · `pinnedHouseStore` · `logoutConfirmStore` |
| Validator | `validations/common/` | `threshold.validation` · `fuzzyTuning.validation` · `schedule.validation` (giờ hẹn 7:00–18:00) · `speakerSchedule.validation` |

### D.5. Dữ liệu giả

| Đường dẫn | Quy tắc | Mục |
|---|---|---|
| `data/<tên>.data.ts` (tạo khi cần) | Nơi duy nhất chứa dữ liệu giả, chỉ khi prompt yêu cầu; import qua api/hook | 7 |
| `apis/farm-owner/farmMock.api.ts` | Trả **rỗng** cho phần backend chưa có endpoint | 7 |

---

*Hết tài liệu. Mọi thay đổi tiếp theo phải cập nhật mục Changelog (mục 0) kèm số phiên bản mới.*
