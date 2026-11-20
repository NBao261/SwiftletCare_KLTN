# Kế hoạch sắp xếp lại bố cục web (20/11/2026)

Soát giao diện web theo từng role trên dữ liệu `npm run seed` + `npm run seed:demo`: chụp mọi màn trong menu ở 1440×900 và 390×844, rồi đo từng trang theo tiêu chí của **taste-skill 2.5.1** (`references/system.md`, `cards.md`, `layout-v4.md`) và skill **dataviz** của Anthropic (biểu đồ, ô số). Kết luận: **chức năng đủ theo Report 3, nhưng bố cục rối**. Menu quá dài, trang lặp tiêu đề và đoạn giải thích, có ba kiểu chọn phạm vi, chữ quá nhỏ, nhiều nút tô đậm cạnh tranh nhau. Màn đầu tiên lại không cho thấy điều quan trọng nhất của đề tài: **môi trường trong từng nhà yến đang ra sao và bộ điều khiển có đang tự chạy không**.

File này chỉ đổi **bố cục, điều hướng và cách trình bày**: không thêm, không bỏ chức năng nào của Report 3 §2.4, không đổi API, không đổi quyền. Route cũ vẫn mở được, deep link và E2E không gãy.

## 0. Phân công và thứ tự

| Người | Phần | Nhánh | Mục trong file |
|---|---|---|---|
| **Bảo** | Farm Owner + phần dùng chung: sidebar, header, trang Cài đặt, `components/ui/`, `common/` | `refactor/web-farm-owner-layout` | §4 (chung, §4.1 khung, §4.2 Cài đặt), §5 |
| **Tuấn** | Domain Expert + Farm Technician | `refactor/web-expert-technician-layout` | §6, §7 |
| **Nhi** | Admin | `refactor/fe-admin-menu`, `refactor/fe-admin-pages`, `refactor/fe-admin-ota` (§8.1) | §8 |

1. **PR nền (đã làm, Bảo):** nhánh `refactor/web-technician-admin-layout`. Gồm mục menu có tab (`SectionTabs`), quy tắc bảng mới (`FixedRowsTable`, `DataTable minRows`, bỏ STT), menu Technician/Admin, trang OTA, toàn bộ thuật ngữ tiếng Việt (FE_Design §6.2, §6.4, `src/i18n/wording.test.ts`), FE_Design 2.15.0. **Merge PR này trước, ba nhánh trên tạo từ `develop` sau khi merge.**
2. **Bảo làm §4 (phần chung) trước**, một PR nhỏ: các thay đổi ở `components/ui/` và khung trang ảnh hưởng mọi role. Tuấn và Nhi bắt đầu được ngay những mục không đụng §4; mục có ghi "sau C-xx" thì chờ PR đó merge.
3. Mỗi người một PR cho phần của mình (hoặc 2–3 PR nhỏ), theo checklist §9.

**Ảnh chụp:** lưu trên máy của Bảo (`D:\SwiftletCare\ui-audit\`, `before\`, `after\`). Không commit ảnh; mỗi PR tự chụp trước/sau ở 1440 và 390 (FE_Design §13.13).

**Đo lại:** script đo theo taste-skill `docs/reports/tools/audit_taste.js` (Phụ lục A). Chạy với Playwright MCP sau khi sửa; trang xong khi đạt cột "Mục tiêu" của §2.2.

Ưu tiên: **P0** làm người xem hiểu sai hoặc không tìm được chức năng chính; **P1** rối, lặp, không thống nhất; **P2** dọn dẹp.

## 1. Kết quả soát

### 1.1 Số màn và số mục menu

| Role | Mục menu | Màn đã soát | Nhận xét chính |
|---|---|---|---|
| Farm Owner | **22** (Vận hành 8, Quản lý 4, Chuyên môn 9, Khác 1) | 22 + 5 màn chi tiết | Menu phải cuộn mới thấy hết; nhóm "Chuyên môn" bị che dưới mép |
| Domain Expert | **23** (Chuyên môn 11, Vận hành chỉ đọc 11, Khác 1) | 23 | Hai nhóm dài như nhau, khó thấy đâu là việc của mình |
| Farm Technician | 4 → 3 (Cài đặt vào menu avatar) | 4 | Gọn |
| Admin | 10 → 8 (gộp tab, Cài đặt vào menu avatar) | 10 | Gọn nhất; 5 nhóm cho 9 mục |

### 1.2 Vấn đề chung

| ID | Vấn đề | Ở đâu | Ưu tiên | Trạng thái |
|---|---|---|---|---|
| A-01 | **Tổng quan không cho thấy môi trường.** Nhiệt độ, độ ẩm, NH3 và chế độ tự động/tay chỉ có ở trang Zone, sâu 3 bậc. Điều khiển tay (`/dashboard/scada`) không có trong menu. Đây là MF-01, luồng đầu tiên của đề tài | `/dashboard` | P0 | FO-01 |
| A-02 | **Ảnh trang trí chiếm 40 % màn đầu** của Tổng quan (`pageHeroStore`), trái FE_Design §4.2 (nền phẳng). Trên điện thoại ảnh đè lên ô chọn phạm vi | `/dashboard` | P0 | FO-01 |
| A-03 | **Số liệu mâu thuẫn trên một màn:** "Thiết bị online 0/6" cạnh "4/8 · Ổn định" | `/dashboard` | P0 | FO-01 (Technician đã sửa) |
| A-04 | **Ba kiểu chọn phạm vi:** 3 ô trên header (Farm Owner), dải `ExpertScadaBanner` (chuyên gia), card "Vị trí:" (Technician) | header, `routes/domain-expert.routes.tsx` | P1 | Technician đã sửa; DE-01 |
| A-05 | **Phạm vi "Tất cả trang trại" làm trang trống** ("Chọn một trang trại"); nút xám không nói vì sao | `/overview`, `/recommendations`, `/work-orders`, `/health` | P0 | C-05 |
| A-06 | **Zone tự chọn là Zone rỗng** (D · Tầng 1); số trên menu đếm cả trang trại, trang đếm một Zone | `/domain-expert/*` | P0 | C-05, DE-03 |
| A-07 | **Tiêu đề lặp:** header ghi "Cảnh báo", card ngay dưới lại ghi "Cảnh báo" | ~20 trang | P1 | Technician/Admin đã sửa; FO, DE còn |
| A-08 | **Đoạn giải thích nghiệp vụ trên mọi card** | hầu hết card | P1 | FO, DE |
| A-09 | **Hai dải trên đầu mọi trang chuyên gia** khi Farm Owner xem | `/domain-expert/*` | P1 | DE-01, DE-02 |
| A-10 | **Bảng đệm 10 dòng trống, cột STT** | mọi bảng | P1 | Đã sửa ở PR nền |
| A-11 | **Thuật ngữ lẫn lộn, tên kỹ thuật** | mọi trang | P1 | Đã sửa ở PR nền (FE_Design §6.2, §6.4) |
| A-12 | Số đệm "00" ở ô KPI; nhãn "+16.1% so với hôm qua" xuống 2 dòng | `/domain-expert/alert-verdicts`, `/vision` | P2 | DE-03, FO-05 |
| A-13 | **Điện thoại 390:** tiêu đề bị cắt, bảng cuộn ngang, ô KPI lẻ | mọi trang | P1 | C-09, từng role |
| A-14 | Trang Trang trại gọi API trùng (`houses`, `zones` mỗi thứ 2 lần, `env/compare` 7 lần) | `/farms` | P1 | FO-10 |

### 1.3 Đo theo taste-skill (20/11/2026, 1440×900 và 390×844)

| Tiêu chí taste-skill | Mã kiểm | Kết quả đo | Trang nặng nhất |
|---|---|---|---|
| Trang có đúng 1 tiêu đề h1 | heading-order | **0 h1 trên 59/60 trang** (tên trang ở header là `<span>`) | mọi trang |
| Không chữ nào dưới 13px | text-contrast | 115 chỗ `text-[10px]`/`text-[11px]`, `.label-caption` 12px (mọi tiêu đề cột), `text-caption` 11px | Ngưỡng & hệ số mờ: 57 phần tử; Thu hoạch: 54; Tổng quan: 49; Kho thiết bị: 30 |
| Chữ đọc ≥ 16px, không đoạn xám ≤ 14px | text-contrast | Mô tả card 14px xám dài 60–120 ký tự | Phân tích: 4 đoạn; Lịch đếm, Luật khuyến nghị: 3 |
| Một nút tô đậm cho việc chính mỗi màn | button-styles | Chip lọc đang chọn, chip sắp xếp và nút chính **cùng màu charcoal** → 5–8 khối đen cạnh tranh | Phân tích: 8; Cài đặt: 6; Nhà được giao: 6; Ngưỡng: 5 |
| Vùng bấm ≥ 44px (điện thoại) | tap-size | Nút `sm` cao 36px, chip 28–32px, nút +/- 32px | Ngưỡng & hệ số mờ: 42 vùng bấm < 36px; Phân tích: 18 |
| Một thang chữ cho tiêu đề | heading-scale | h2 lúc 20px, lúc 16px, lúc 12px; Hàng đợi việc dùng h2 12px (nhỏ hơn chữ thường) | Hàng đợi việc, Ngưỡng |
| Một hệ bo góc | card-family | 3–4 bán kính khác nhau trên một trang | Hàng đợi việc: 4 |
| Tối đa 2 lớp hộp | nesting | Đạt (2), nhưng Card > card KPI > pill; dải SCADA là hộp trong khung | — |
| Không cuộn ngang ở 390 | off-viewport | OTA: **44 phần tử tràn**; Thu hoạch: 22; Sức khoẻ: 2; bảng cuộn ngang ở hầu hết trang danh sách | OTA, Thu hoạch |
| Không ảnh trang trí | photo-weight | Tổng quan: 2 ảnh lớn (ảnh nền nhà yến) | `/dashboard` |
| Hàng thẻ cao đều, không hụt | section-air | Tổng quan: hàng KPI thứ 2 có 2 ô + 1 chỗ trống, ô "Thiết bị các nhà yến" cao 2 hàng bị cắt chữ; Cài đặt: 1 hàng lệch | `/dashboard`, `/settings` |
| Không chữ in hoa giãn | tracking | Đã sửa ở PR nền (test chặn `uppercase`) | — |

### 1.4 Biểu đồ và ô số (skill dataviz)

| ID | Vấn đề | Sửa | Ai |
|---|---|---|---|
| CH-01 | Đường "Vào tổ / Xuất đàn" vẽ cong mượt nên bịa đỉnh ~2.130 giữa hai điểm 2.110 | Đường thẳng nối điểm (Chart.js `tension: 0`) hoặc `cubicInterpolationMode: 'monotone'`; hiện điểm | Bảo (FO-05) |
| CH-02 | "Phân bổ theo loại tổ": donut 1 loại = 100 % + dòng "Tổng 100 %"; 3 sắc xanh gần giống nhau | Thanh tỷ lệ một hàng + số kg từng loại; nhãn trực tiếp, chạy `validate_palette.js` | Bảo (FO-09) |
| CH-03 | So sánh Zone vẽ nhiệt độ TB bằng cột từ 0 °C | Chấm trên dải ngưỡng an toàn của Zone (bullet), hoặc chỉ bảng | Bảo (FO-06) |
| CH-04 | Ô KPI không cùng cỡ, hàng hụt | Một hàng 4 ô bằng nhau (`KpiTile`) | Bảo (FO-01) |
| CH-05 | "+0 % so với hôm qua" tô xanh như tăng tốt | 0 % màu trung tính; tăng/giảm kèm mũi tên, không chỉ màu | Bảo (FO-05) |
| CH-06 | Ô KPI "00" (đệm số 0) | Số thường, không đệm | Tuấn (DE-03) |

## 2. Nguyên tắc bố cục (áp cho cả 4 role)

### 2.1 Quy tắc

1. **Đúng tên đề tài:** màn đầu của Farm Owner trả lời trong 5 giây: *nhà nào cần chú ý, môi trường từng nhà ra sao, bộ điều khiển đang tự động hay tay, có việc gì chờ tôi*. Đơn vị chính là **nhà yến**.
2. **Không ảnh trang trí, không dải trang trí.** Nền phẳng `bg-stone` (FE_Design §4.2). Bỏ `pageHeroStore` và `usePageHero`.
3. **Menu ≤ 12 mục mỗi role, không cuộn ở 1440×900.** Trang cùng một câu hỏi gộp thành một mục menu + tab (`MenuItem.tabs`, đã có).
4. **Một thanh phạm vi** (`ScopeFilter` trên header) cho mọi trang có dữ liệu trang trại. Trang khai báo cần tới bậc nào; thiếu thì tự chọn bậc có dữ liệu.
5. **Một tiêu đề một trang:** tên trang ở header là `<h1>`; card chỉ có tiêu đề `<h2>` khi trang có từ 2 card; mô tả ≤ 1 dòng, giải thích dài vào icon (i).
6. **Một nút tô đậm cho việc chính mỗi màn** (taste-skill system.md "Radius and buttons"). Chip lọc, chip sắp xếp và tab đang chọn dùng kiểu "pill trắng trên nền xám" như `SectionTabs`, không tô đen.
7. **Chữ:** không chữ nào dưới 13px; chữ đọc (mô tả, dòng phụ trong thẻ) 14–16px màu `charcoal`/`graphite`, xám `warmGray` chỉ cho nhãn, ngày, đơn vị.
8. **Hai lớp hộp tối đa:** trang > card > (ô KPI hoặc bảng). Không hộp trong ô KPI, không card lồng card để chứa chữ.
9. **Hàng thẻ cao đều và đầy:** 4 ô một hàng (`grid-cols-2 lg:grid-cols-4`), không hàng hụt, không ô cao gấp đôi.
10. **Số khớp nhau:** mọi số "online/ổn định/cần xử lý" trên một màn lấy từ cùng một nguồn; số trên menu cùng phạm vi với trang.
11. **Nút khoá phải nói lý do** (tooltip `title` + dòng phụ).
12. **Điện thoại 390:** không cuộn ngang; bảng thành danh sách thẻ; vùng bấm ≥ 44px; nút chính rộng hết hàng.
13. **Chữ tiếng Việt** theo FE_Design §6.2, §6.4 (test `wording.test.ts` đã chặn).

### 2.2 Mục tiêu đo (Phụ lục A) cho mỗi trang

| Chỉ số | Hiện tại (tệ nhất) | Mục tiêu |
|---|---|---|
| `h1` | 0 | 1 |
| `tiny` (phần tử chữ < 13px) | 57 | 0 |
| `greyPara` (đoạn ≤ 14px dài > 60 ký tự) | 4 | 0 |
| `darkButtons` (khối nền tối có thể bấm) | 8 | ≤ 1 (nút chính) |
| `smallTargets` (< 36px ở 1440) | 42 | ≤ 4 (icon trong bảng) |
| `headingSizes` | 3 cỡ | h2 20px · h3 16px |
| `radii` | 4 | ≤ 2 (card 20/28, ô 16) |
| `spill` ở 390 | 44 | 0 |
| `bigImages` | 2 | 0 |

## 3. Menu mới theo role

### 3.1 Farm Owner: 22 → 10 mục (Bảo)

| Nhóm | Mục menu | Tab (route có sẵn) |
|---|---|---|
| Theo dõi | **Tổng quan** | Tình trạng các nhà (`/dashboard`) · So sánh nhà (`/overview`) · Điều khiển tay (`/dashboard/scada`) |
| | Cảnh báo | `/alerts` |
| | Đàn chim | `/vision` |
| | Sức khoẻ & báo cáo | `/health` (đã có 3 tab trong trang) |
| | Phân tích | `/analytics` (đã có 3 tab) |
| Vận hành | **Công việc** | Phiếu công việc (`/work-orders`) · Bảo trì định kỳ (`/maintenance`) · Khuyến nghị (`/recommendations`) |
| | Thiết bị | `/devices` (nút "Thêm thiết bị" → `/devices/onboarding`) |
| | Trang trại | `/farms` |
| | Thu hoạch | `/harvests` |
| Chuyên môn | **Chuyên môn** | Kiểm chứng cảnh báo · Ngưỡng & hệ số mờ · Duyệt & đề xuất · Hồ sơ cấu hình · Bù thời tiết · Lịch đếm · Vòng đếm · Luật khuyến nghị · Lịch sử (9 route `/domain-expert/*`) |

Badge: Cảnh báo (số `ACTIVE`), Công việc (phiếu chờ duyệt), Chuyên môn (cảnh báo chờ kết luận, chỉ khi trang trại chưa có chuyên gia, BR-22).

### 3.2 Domain Expert: 23 → 7 + 8 (nhóm chỉ đọc thu gọn) (Tuấn)

| Nhóm | Mục menu | Tab |
|---|---|---|
| Chuyên môn | Hàng đợi việc | `/domain-expert/queue` |
| | Kiểm chứng cảnh báo | `/domain-expert/alert-verdicts` |
| | **Tham số điều khiển** | Ngưỡng & hệ số mờ (`tuning`) · Duyệt & đề xuất (`reviews`) · Hồ sơ cấu hình (`profiles`) · Bù thời tiết (`weather-rules`) |
| | **Đếm chim** | Lịch đếm (`counting-schedule`) · Vòng đếm (`counting-ring`) |
| | Luật khuyến nghị | `recommendation-rules` |
| | Báo cáo & kết luận | `reports` |
| | Lịch sử quyết định | `history` |
| Vận hành (chỉ đọc), **thu gọn mặc định** | Tổng quan · Đàn chim · Sức khoẻ · Phân tích · Thiết bị · Công việc · Trang trại · Thu hoạch | như 3.1, ẩn tab "Điều khiển tay" |

### 3.3 Farm Technician: 3 mục — **phần lớn đã làm ở PR nền**

Cảnh báo (trang chủ) · Thiết bị & Cảm biến · Nhà được giao. Còn lại (Tuấn): bỏ nhóm "Khác", Cài đặt vào menu avatar (SH-03).

### 3.4 Admin: 10 → 8 mục, 3 nhóm — **một phần đã làm ở PR nền**

Người dùng = tab Tài khoản (`/users`) + Yêu cầu xoá tài khoản (`/account-requests`); menu "Cập nhật firmware" thay "OTA Firmware".

Còn lại (Nhi): gom 5 nhóm thành 3, bỏ chữ "Console", Cài đặt vào menu avatar (SH-03):

| Nhóm | Mục |
|---|---|
| Theo dõi | Tổng quan hệ thống (`/system/health`) · Cảnh báo (`/alerts`) |
| Thiết bị | Danh sách thiết bị (`/devices`) · Kho thiết bị (`/system/device-stock`) · Cập nhật firmware (`/ota`) |
| Hệ thống | Người dùng (tab Tài khoản · Yêu cầu xoá) · Cấu hình mặc định (`/system/settings`) · Nhật ký hệ thống (`/system/audit-log`) |

## 4. Phần chung — Bảo làm trước (một PR)

| ID | Việc | File | Cách làm | Xong khi |
|---|---|---|---|---|
| C-01 | **Tên trang là `<h1>`** | `components/layouts/AppHeader.tsx` | Phần tử gốc breadcrumb (`isRoot`) đổi `<span>` → `<h1>`, giữ class. Tiêu đề card trong `SectionCard`, `FarmFrame` vẫn `h2` | Đo `h1 = 1` mọi trang |
| C-02 | **Không chữ dưới 13px** | `src/index.css` (`.label-caption` 12 → 13px), `tailwind.config.ts` (`caption` 11 → 13px, bỏ `letterSpacing`), thay `text-[10px]`/`text-[11px]` → `text-small` (13px) ở 116 chỗ (`grep -rn "text-\[1[01]px\]" src`); **`text-xs` (12px, 451 chỗ) cũng dưới 13px**: đổi token `xs` trong `tailwind.config.ts` thành 13px thay vì sửa từng chỗ | Đổi token trước, rồi thay class; badge cũng 13px (không còn ngoại lệ 12px) | Đo `tiny = 0` (trừ chữ trong `Badge`) |
| C-03 | **Chip đang chọn không tô đen** | `components/ui/FilterChip.tsx`, `SortChips.tsx`, tab trong trang Sức khoẻ, Bảo trì, Phân tích | Kiểu đang chọn = `bg-white text-charcoal shadow-card` trên nền `bg-warmGray/10` (giống `SectionTabs`); chưa chọn giữ `text-warmGray` | Đo `darkButtons ≤ 1` ở Phân tích, Thu hoạch |
| C-04 | **Vùng bấm trên điện thoại ≥ 44px** | `ui/Button.tsx` (`sm`: `h-9 max-sm:h-11`), `ui/SelectMenu.tsx`, `ui/FilterChip.tsx`, `ui/SearchInput.tsx` | Chỉ tăng ở `max-sm`, desktop giữ 36px cho bảng dày | Đo `smallTargets` ở 390 ≤ 4 |
| C-05 | **Phạm vi tự chọn có dữ liệu** | `hooks/shared/useScopeFilter.ts`, `stores/zoneStore.ts`, `constants/roles.ts` (`scopeLevel` mỗi route) | Thêm `SCOPE_LEVEL: Record<path, 'none' \| 'farm' \| 'house' \| 'zone'>`; khi trang cần farm mà scope rỗng: chọn farm duy nhất hoặc farm mở gần nhất; cần zone: chọn Zone đầu tiên có bộ điều khiển online, rồi Zone có thiết bị. Nút khoá vì thiếu phạm vi hiện `title` "Chọn một trang trại để …" | Không còn "Chọn một trang trại" khi chỉ có 1 trang trại; trang chuyên gia không mở vào Zone rỗng |
| C-06 | **Bỏ ảnh nền** | `stores/pageHeroStore.ts`, `components/layouts/AppShell.tsx`, `AppHeader` (`isOverHero`), `FarmOwnerDashboardPage` | Xoá store, prop `isOverHero`, khối `<img>` trong `AppShell`; xoá ảnh trong `public/` nếu không trang nào dùng | Đo `bigImages = 0` |
| C-07 | **Mô tả card ngắn, chữ đọc được** | `ui/SectionCard.tsx`, `features/farm-owner/farms/FarmFrame.tsx` | Mô tả `text-body` (14px) `text-graphite`, chuỗi `line-clamp-1`; prop `help` (`ui/InfoTip`, nút (i)) cho giải thích dài. Lưu ý: `greyPara` đếm chữ **≤ 14px** dài > 60 ký tự, kể cả phần bị `line-clamp` ẩn, nên mô tả 14px dài vẫn bị đếm: mỗi trang phải rút mô tả ≤ 60 ký tự hoặc chuyển vào `help` | Đo `greyPara = 0` sau khi từng trang rút mô tả (§5–§8) |
| C-08 | **Nhóm menu thu gọn được** | `components/layouts/AppSidebar.tsx` | `MenuSection.collapsible?: boolean` (mặc định mở); nút mũi tên cạnh tiêu đề nhóm, nhớ trạng thái trong `localStorage` (try/catch); nhóm chứa trang đang mở luôn mở | Tuấn dùng ở DE-01 |
| C-09 | **Bảng thành thẻ ở điện thoại** | `ui/DataTable.tsx` | Prop `mobileCard?: (row) => ReactNode`; dưới `sm` vẽ danh sách thẻ thay bảng; cột chính in đậm, 2–3 cột phụ thành dòng xám, menu ⋯ góc phải | Đo `spill = 0`, `hScroll = 0` ở 390 với bảng có `mobileCard` |
| C-10 | **KPI dùng chung** | `features/farm-owner/farms/KpiTile.tsx` → `components/common/KpiTile.tsx` | Dời lên `common/` (FE_Design §1.1), gộp `ui/StatTile` vào một component; một chiều cao, số `text-2xl`, nhãn 13px, dòng phụ 13px | Mọi hàng KPI của 4 role dùng chung |
| C-11 | **Trang Cài đặt theo role** | `pages/SettingsPage.tsx` | Theo §4.2 (ST-01…ST-05) | Bảng §4.2 đúng cho cả 4 role; `darkButtons ≤ 1`, `unevenRows = 0` |
| C-12 | Ghi luật vào FE_Design | `frontend/FE_Design_Claude.md` §1, §1.1, §2.8, §4.1, §5.1, §12.5 | Ghi C-01…C-10, SH-01…SH-08 và ST-01…ST-05 thành luật; §4.1 "Sidebar & Topbar — đóng băng" viết lại theo §4.1 của file này (bỏ khối chào, một chỗ đăng xuất, menu avatar mọi khổ màn); lên 2.16.0 | Bảng "đúng theo role" của §4.1, §4.2 chép vào FE_Design |

### 4.1 Khung: sidebar và header (Bảo, file dùng chung; nội dung menu của từng role ở §3)

**Hiện tại (đo 20/11/2026):**

| Chỗ | Vấn đề | Đúng/thừa/thiếu |
|---|---|---|
| Sidebar, đầu | Khối "Xin chào, <tên> · Vai trò: …" cao ~110px, lặp tên và vai trò đã có ở avatar trên header; đẩy menu xuống nên Farm Owner, chuyên gia phải cuộn | Thừa |
| Sidebar, cuối | Nút "Đăng xuất" ở sidebar, lại có trong menu avatar và nút riêng trên header điện thoại: 3 chỗ | Thừa |
| Sidebar, nhóm "Khác" | Một nhóm chỉ có "Cài đặt", trong khi menu avatar cũng có "Cài đặt" | Thừa |
| Sidebar Admin | 5 nhóm cho 9 mục (Vận hành 1 mục, Console thiết bị 3, Quản lý 1, Hệ thống 3, Khác 1); chữ "Console" tiếng Anh | Rối |
| Header, tên trang | `<span>`, không phải `h1` (0/60 trang có h1) | Thiếu |
| Header, điện thoại | Ô chữ "S" đen giả logo; tên trang bị cắt ("Tổng qu…"); avatar ẩn dưới `lg` nên **Farm Owner, chuyên gia, Admin không vào được Cài đặt và Quyền riêng tư trên điện thoại** (không nằm trong dock); thay vào đó là nút đăng xuất trần | Thiếu + thừa |
| Header, VI/EN | Công tắc rộng 88px kèm popup khi rê chuột ghi lại "Ngôn ngữ: Tiếng Việt" | Thừa (popup) |
| Header, thanh phạm vi | 3 ô (~440px) chung hàng với tên trang, VI/EN, chuông, avatar; ở 1024px chen chúc | Rối |
| Chuông | Tab đang chọn tô đen (trái C-03); nội dung đúng theo role: chuyên gia chỉ có tab Thông báo (không vào `/alerts`) | Đúng, sửa kiểu tab |

**Sửa:**

| ID | Việc | File | Cách làm |
|---|---|---|---|
| SH-01 | Bỏ khối chào trong sidebar | `components/layouts/AppSidebar.tsx` | Xoá khối tên + vai trò; logo nằm sát nhóm menu đầu. Tên, email, vai trò chỉ ở menu avatar |
| SH-02 | Một chỗ đăng xuất | `AppSidebar.tsx`, `AppHeader.tsx`, `common/ProfilePopover.tsx` | Bỏ nút đăng xuất ở cuối sidebar và nút đăng xuất riêng trên header điện thoại. Menu avatar (Cài đặt · Quyền riêng tư · Đăng xuất) là nơi duy nhất, **hiện ở mọi khổ màn** (bỏ `hidden lg:block`) |
| SH-03 | Bỏ nhóm "Khác" (làm cho cả 4 role trong PR §4; FT-05, DE-11, AD-09 chỉ còn kiểm) | 4 file `<Role>Layout.tsx` | "Cài đặt" chỉ ở menu avatar; dock điện thoại không cần mục Cài đặt vì avatar luôn hiện. Giữ route và `MENU_ACCESS` của `/settings` |
| SH-04 | Tên trang là `h1` | `AppHeader.tsx` | Trùng C-01 |
| SH-05 | Header điện thoại | `AppHeader.tsx` | Bỏ ô chữ "S"; tên trang `text-xl` dưới `sm`, không cắt (xuống dòng tối đa 2 dòng); bên phải: chuông + avatar; VI/EN vào menu avatar dưới `sm` |
| SH-06 | VI/EN gọn | `AppHeader.tsx` (`LanguageToggle`) | Giữ công tắc 2 nấc, bỏ popup rê chuột; cao 36px như ô phạm vi |
| SH-07 | Thanh phạm vi xuống hàng dưới `xl` | `AppHeader.tsx`, `HeaderActions`, `common/ScopeFilter.tsx` | Từ 1280px: cùng hàng với tên trang; dưới 1280px: hàng riêng ngay dưới header, cùng lề trái với nội dung |
| SH-08 | Tab trong chuông | `common/NotificationPopover.tsx` | Kiểu tab theo C-03 (pill trắng trên nền xám); giữ logic tab theo role |
| SH-09 | Nhóm menu thu gọn | `AppSidebar.tsx` | Trùng C-08 |

**Header và sidebar đúng theo role** (sau khi sửa; ✓ có, — không có):

| Thành phần | Farm Owner | Domain Expert | Farm Technician | Admin |
|---|---|---|---|---|
| Tên trang `h1` + breadcrumb trang chi tiết | ✓ | ✓ | ✓ | ✓ |
| Thanh phạm vi Trang trại → Nhà → Zone | trang có dữ liệu trang trại | trang có dữ liệu trang trại (thay dải `ExpertScadaBanner`, DE-01) | Thiết bị, Nhà được giao | — (Admin không xem số liệu trang trại, Report 3 §2.4) |
| VI/EN | ✓ | ✓ | ✓ | ✓ |
| Chuông · tab Cảnh báo (ALERT-FR-007) | ✓ | — (chuyên gia không vào `/alerts`) | ✓ (nhà được giao) | ✓ (cảnh báo thiết bị, FARM-FR-009) |
| Chuông · tab Thông báo (EXPERT-FR-007) | ✓ | ✓ | ✓ | ✓ |
| Menu avatar: tên, email, vai trò · Cài đặt · Quyền riêng tư · Đăng xuất | ✓ mọi khổ màn | ✓ | ✓ | ✓ |
| Badge trên menu | Cảnh báo, Công việc, Chuyên môn (khi chưa có chuyên gia) | Kiểm chứng cảnh báo | Cảnh báo | Cảnh báo, Yêu cầu xoá tài khoản (số yêu cầu chờ) |
| Dock điện thoại (4 mục đầu) | Tổng quan · Cảnh báo · Đàn chim · Sức khoẻ | Hàng đợi · Kiểm chứng · Tham số · Đếm chim | Cảnh báo · Thiết bị · Nhà được giao | Tổng quan · Thiết bị · Cảnh báo · Người dùng |

### 4.2 Trang Cài đặt theo role (Bảo, `pages/SettingsPage.tsx`)

**Hiện tại:** mọi role trừ Admin thấy cùng một bộ: khối "Push notification" chung + bảng kênh theo mức + giờ im lặng + nút "Lưu cài đặt" tô đen, cột phải là Bảo mật, Telegram, Dữ liệu tài khoản (nút đỏ tô đặc). Admin chỉ có cột trái nên nửa phải trống. Số điện thoại trống hiện "--" (phải là `_`, FE_Design 6.1); ô giờ hiện "10:00 PM" (phải 24 giờ "22:00"); nhãn vai trò 11px; "Push notification" tiếng Anh.

**Đối chiếu Report 3:**
- ALERT-FR-005: chọn kênh ngoài ứng dụng theo loại/mức. Áp cho Farm Owner, Farm Technician. EXPERT-FR-007 nói **không bao giờ gửi cảnh báo vận hành ra ngoài ứng dụng cho chuyên gia**, và backend chỉ báo chuyên gia trong ứng dụng, nên chuyên gia không có bảng kênh. (ALERT-FR-005, SF-04 đã sửa ở PR #201: tác nhân chỉ còn Farm Owner, Farm Technician.)
- ALERT-FR-006: giờ im lặng **chỉ của Farm Owner**.
- ALERT-FR-013 + MF-02: Telegram cho Farm Owner và Farm Technician của nhà.
- AUTH-FR-009: đổi mật khẩu cho mọi người. AUTH-FR-012: yêu cầu xoá tài khoản cho mọi người.

**Cài đặt đúng theo role** (✓ có, — không có):

| Khối | Farm Owner | Farm Technician | Domain Expert | Admin |
|---|---|---|---|---|
| Hồ sơ: tên, vai trò, email, số điện thoại (chỉ xem; trống thì `_`) | ✓ | ✓ | ✓ | ✓ |
| Kênh cảnh báo theo mức: bảng 3 hàng (Khẩn cấp · Cao · Thường) × cột Thông báo đẩy · Telegram | ✓ | ✓ | — | — |
| Giờ im lặng (24 giờ) | ✓ | — | — | — |
| Telegram: liên kết / gỡ liên kết | ✓ | ✓ | — | — |
| Dòng "Thông báo chuyên môn hiện trong hộp thông báo của ứng dụng" | — | — | ✓ | — |
| Bảo mật: gửi mã, đổi mật khẩu | ✓ | ✓ | ✓ | ✓ |
| Quyền riêng tư (link tới `/settings/privacy`) | ✓ | ✓ | ✓ | ✓ |
| Yêu cầu xoá tài khoản | ✓ | ✓ | ✓ | ✓ |

**Sửa:**

| ID | Việc | Cách làm |
|---|---|---|
| ST-01 | Một cột | `max-w-3xl`, các khối xếp dọc theo thứ tự bảng trên; hết nửa phải trống ở Admin và hàng lệch ở các role khác (`unevenRows = 0`) |
| ST-02 | Bỏ khối "Push notification" chung | Bảng kênh theo mức là chỗ duy nhất bật/tắt thông báo đẩy (khối chung trùng việc với cột "Thông báo đẩy"); đổi chữ "Push" → "Thông báo đẩy" (FE_Design §6.2). **Còn mở (backend, Bảo/Kiệt):** `notification.service.ts` vẫn dùng cờ `push` chung cho thông báo không phải cảnh báo, giao diện không còn đổi được cờ này; ai đã tắt nó ở bản cũ sẽ không nhận push loại đó. Backend nên bỏ cờ chung hoặc coi như bật; web lưu kênh không gửi cờ chung |
| ST-03 | Ẩn theo role | Dùng `usePermission`: bảng kênh + Telegram cho `FARM_OWNER`, `FARM_TECHNICIAN`; giờ im lặng chỉ `FARM_OWNER`; chuyên gia chỉ thấy dòng chú thích. Không gửi trường của khối bị ẩn khi lưu |
| ST-04 | Một nút chính | Mỗi khối có nút lưu riêng là nút phụ; chỉ khi khối có thay đổi chưa lưu thì nút đó thành nút chính. "Yêu cầu xoá tài khoản" là nút phụ viền đỏ, popup xác nhận giữ nguyên |
| ST-05 | Giờ 24h, `_`, chữ | Ô giờ dùng `TimePicker` của `ui/` (24 giờ) thay `<input type="time">`; số điện thoại trống `NO_VALUE`; nhãn vai trò 13px (C-02) |

## 5. Farm Owner — Bảo

**Trạng thái (20/11/2026, nhánh `refactor/fe-farm-owner-layout`):** đã làm FO-00…FO-05, FO-07…FO-14, trừ một phần FO-10 (lưới Zone ở chi tiết nhà chưa co theo số Zone). Dock điện thoại thêm mục "Thêm" (sau 4 mục) mở các mục còn lại theo nhóm, có badge, cho mọi role. FO-06: chip Zone giữ dạng chip (đã thành pill trắng theo C-03), chưa làm ô chọn nhiều Zone; biểu đồ cột thay bằng bảng (CH-03). FO-01 thêm giai đoạn và trạng thái hôm nay vào thẻ nhà để giữ đủ ANALYTICS-FR-015, nên trang So sánh nhà bỏ tab con "Các nhà".

| ID | Trang | Hiện tại | Sửa | Ưu tiên |
|---|---|---|---|---|
| FO-00 | Menu | 22 mục, phải cuộn | Theo §3.1 (`FarmOwnerLayout.tsx`, `MENU_ACCESS`, `navigation.i18n.ts`, `roles.test.ts`) | P1 |
| FO-01 | **Tổng quan** `/dashboard` | Ảnh nền 40 % màn đầu; dải "Tình trạng vận hành"; 6 ô KPI lệch (2 hàng, 1 ô cao gấp đôi, chữ bị cắt); bảng "Cảnh báo mới nhất" lặp trang Cảnh báo; không có nhiệt độ, độ ẩm | Bố cục mới (§5.1): hàng KPI 4 ô · lưới thẻ nhà · "Việc cần làm" (≤ 5 dòng). Bỏ ảnh (C-06), bỏ dải, bỏ bảng cảnh báo, bỏ ô "Zone", "Nhà yến", "Sản lượng tháng này". Thẻ nhà dùng `GET /farms/{id}/overview` + `GET /telemetry/zones/{id}/latest` + socket `zone:`; không cần endpoint mới | P0 |
| FO-02 | Điều khiển tay `/dashboard/scada` | Không có trong menu; mỗi bộ điều khiển một khung cao 300px, 3 nút "Bật 30 phút" tô xám | Thành tab của Tổng quan; mỗi Zone một hàng: tên Zone · chế độ · 3 công tắc (phun sương, thông gió, loa) với thời hạn; thiết bị mất kết nối gộp thành 1 dòng "Không gửi được lệnh: bộ điều khiển mất kết nối" | P1 |
| FO-03 | Cảnh báo `/alerts` | Đã bỏ tiêu đề lặp, STT, dòng trống (PR nền) | Thêm `mobileCard` (C-09): mức · tên cảnh báo · vị trí · lúc | P2 |
| FO-04 | Thiết bị `/devices` + chi tiết | Tiêu đề card "Thiết bị theo nhà yến" lặp; chi tiết thiết bị: 4 KPI + 1 đoạn hướng dẫn dài + card thiết bị nhiều cột "_" | Bỏ tiêu đề card; mô tả 1 dòng; chi tiết: bỏ đoạn hướng dẫn (đưa vào (i)), ẩn hàng chỉ toàn "_" (Wi-Fi, IP khi thiết bị chưa kết nối lần nào) | P1 |
| FO-05 | Đàn chim `/vision` | Nhãn "+16.1% so với hôm qua" xuống 2 dòng; đường cong bịa đỉnh; thiếu khung luồng camera trực tiếp ở trang chính khi chọn tất cả | Nhãn so sánh thành dòng phụ dưới số (không pill); CH-01, CH-05; khi đã chọn nhà có camera: khung video đứng đầu trang | P1 |
| FO-06 | Phân tích `/analytics` | 8 khối tô đen (chip khoảng thời gian, chip chỉ số, chip Zone); 6 chip Zone tên dài; cột nhiệt độ từ 0 | C-03; ô chọn Zone thành `SelectMenu` nhiều lựa chọn; CH-03 | P1 |
| FO-07 | Sức khoẻ `/health` | Nút "Mức chỉ số", "Tải CSV" xám không lý do; cột "Trạng thái" toàn chữ nghiêng "Đánh giá để xem"; tràn ở 390 | C-05 + lý do khoá; cột trạng thái hiện "Ẩn tới khi bạn đánh giá" một lần ở đầu cột thay vì mỗi dòng; `mobileCard` | P1 |
| FO-08 | **Công việc** (Phiếu · Bảo trì · Khuyến nghị) | 3 mục menu riêng; "Tạo phiếu công việc" xám không lý do; Khuyến nghị trống "Chọn một trang trại" | Gộp tab (§3.1); C-05; bỏ tiêu đề card lặp; Bảo trì bỏ tab-trong-tab nếu chỉ còn 2 tab thì giữ | P1 |
| FO-09 | Thu hoạch `/harvests` | 54 phần tử chữ < 13px; 22 phần tử tràn ở 390; donut 100 %; card "Tổng quan thu hoạch" lồng 3 card | 3 KPI thành hàng `KpiTile` không khung bao; CH-02; bảng đợt thu và chu kỳ có `mobileCard`; biểu đồ tháng giữ | P1 |
| FO-10 | Trang trại `/farms`, nhà, Zone | Gọi API trùng (A-14); chi tiết nhà: card "Danh sách Zone" cao bằng cột phải, 1 Zone bỏ trống 70 %; mỗi hàng trang trại 4 nút (Thêm nhà, Áp hồ sơ, Sửa, Xoá) | Dùng `useScopeFilter`/cache chung, `env/compare` gọi 1 lần sau khi đủ Zone; lưới Zone co theo số Zone; hàng trang trại giữ "Thêm nhà", còn lại vào menu ⋯ | P1 |
| FO-11 | So sánh nhà `/overview` | Trống "Chọn một trang trại" | Thành tab của Tổng quan; C-05 tự chọn trang trại | P1 |
| FO-12 | Trang chuyên gia khi Farm Owner xem | 2 dải trên đầu (A-09) | Phần dải là của Tuấn (DE-01, DE-02); Bảo chỉ đổi menu thành 1 mục "Chuyên môn" có tab | P1 |
| FO-13 | Điện thoại 390 | Tiêu đề "Tổng qu…"; ô phạm vi đè ảnh; KPI lẻ 1 ô | C-06, C-09; header dưới `sm` chỉ hiện tên trang (không logo "S"), thanh phạm vi xuống dòng dưới header | P1 |
| FO-14 | Menu và khung | Như §4.1 | Sau SH-01…SH-08: kiểm bảng §4.1 cột Farm Owner; dock: Tổng quan · Cảnh báo · Đàn chim · Sức khoẻ | P1 |

### 5.1 Bố cục Tổng quan mới (FO-01)

```
Tổng quan            [Trang trại ▾][Nhà ▾][Zone ▾]   VI/EN  🔔  avatar
[Tình trạng các nhà | So sánh nhà | Điều khiển tay]

[Nhà cần chú ý 2] [Cảnh báo chờ xác nhận 3] [Thiết bị mất kết nối 1] [Phiếu chờ duyệt 1]

Tình trạng các nhà yến                                       Cập nhật 00:31 ●
┌ A · Nhà điều khiển      ● Cần xử lý ┐ ┌ B · Nhà đếm chim    ● Theo dõi ┐ ┌ C · …
│ Tầng 1  27,2 °C · 86 % · NH3 12 ppm │ │ Tầng 1  _                     │
│ Tự động · 1/1 bộ điều khiển online  │ │ Điều khiển tay · còn 12 phút   │
│ Chim về 95 % · 2 cảnh báo · 1 phiếu │ │ …                              │
└─────────────────────────────────────┘ └────────────────────────────────┘

Việc cần làm                                                     Xem tất cả →
• Xác nhận cảnh báo "Phun sương không hiệu quả" · B · Tầng 1
• Duyệt phiếu "Sửa chữa: phun sương không tăng ẩm"
• Đánh giá ngày 19/11 cho 5 nhà
```

- Lưới thẻ nhà `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, mỗi thẻ cao bằng nhau; số đo tô màu theo ngưỡng Zone (token 2.6.1) **kèm** icon, không chỉ màu.
- "Ổn định" chỉ khi bộ điều khiển online và số đo trong ngưỡng (A-03).
- Bấm thẻ → chi tiết nhà. Phạm vi "Tất cả trang trại": thẻ nhóm theo trang trại, tiêu đề nhóm h2.

## 6. Domain Expert — Tuấn

| ID | Trang | Hiện tại | Sửa | Ưu tiên |
|---|---|---|---|---|
| DE-00 | Menu | 23 mục, 2 nhóm dài như nhau | Theo §3.2 (`DomainExpertLayout.tsx`, `MENU_ACCESS`, `navigation.i18n.ts`); nhóm "Vận hành (chỉ đọc)" `collapsible` (sau C-08) | P1 |
| DE-01 | Dải `ExpertScadaBanner` trên mọi trang `/domain-expert/*` | Dải "Trực tiếp · Giám sát vận hành · 100% Tự động · 0 Cảnh báo tồn · 0 Báo cáo tồn · breadcrumb Zone" | Bỏ khỏi `routes/domain-expert.routes.tsx`. Chọn phạm vi dùng `ScopeFilter` trên header (như Farm Owner, `HeaderActions`); 3 chỉ số chuyển vào Hàng đợi việc (DE-02). Xoá `ExpertScadaBanner*`, `ZoneSelectorDropdown` nếu không còn dùng | P1 |
| DE-02 | Hàng đợi việc `/domain-expert/queue` | Minh hoạ lớn chiếm nửa màn khi rỗng; 3 thẻ "nhiệm vụ thường trực" lặp menu; h2 12px; 4 bán kính | Hàng KPI 4 ô (`KpiTile`): Cảnh báo chờ kết luận · Thay đổi chờ duyệt · Ngày lệch · Báo cáo chờ kết luận; dưới là danh sách việc (bảng 1 cột, mỗi dòng: loại · tên · nhà/Zone · lúc · nút "Mở"). Rỗng: `EmptyState` 1 dòng. Bỏ 3 thẻ | P1 |
| DE-03 | Kiểm chứng cảnh báo `/domain-expert/alert-verdicts` | Xem theo 1 Zone (A-06); 4 ô KPI "00"; dòng chú thích + link "Chỉnh tham số phát hiện" giữa card | Mặc định cả trang trại, Zone là bộ lọc trong card; KPI số thường (CH-06); sửa test E2E `ds-07-08-alert-verdict.spec.ts` (test zone A/B) theo bộ lọc mới — giữ nguyên tên test | P0 |
| DE-04 | **Tham số điều khiển** (Ngưỡng · Duyệt · Hồ sơ · Bù thời tiết) | 4 mục menu; trang Ngưỡng: 4 khối, 4 nút Lưu, 42 vùng bấm < 36px, 57 chữ < 13px, khối "Mức giảm tỷ lệ chim về" áp cho cả nhà mà không nói | Gộp tab (§3.2). Trang Ngưỡng: dòng phạm vi đầu trang "Áp cho Zone A · Tầng 1" và khối 4 ghi "Áp cho cả nhà A"; một thanh lưu dính đáy khi có thay đổi ("3 thay đổi · Huỷ · Lưu"), vẫn gọi đúng API từng khối; ô số dùng `<input type="number">` + bước, nút +/- 44px ở điện thoại; "Phạm vi · Mặc định" vào tooltip | P1 |
| DE-05 | Bù thời tiết | Form "Thêm luật mới" luôn mở dưới danh sách | Form vào `Modal` mở từ nút "Thêm luật" (nút chính duy nhất) | P2 |
| DE-06 | Duyệt & đề xuất | 2 tab trong card + bộ lọc + "Huỷ lọc" cùng hàng; trống thì khung viền đứt to | Tab của trang dùng kiểu `SectionTabs`; rỗng 1 dòng | P2 |
| DE-07 | **Đếm chim** (Lịch đếm · Vòng đếm) | 2 mục menu; Lịch đếm: 3 khối (Hôm nay, Hồ sơ theo mùa, Khung tạm) + Lịch sử | Gộp tab; Lịch đếm: khối "Hôm nay" thành 1 dòng trên đầu; Hồ sơ theo mùa và Khung tạm thành 2 bảng có nút "Thêm" ở tiêu đề | P1 |
| DE-08 | Báo cáo & kết luận | 3 tab + mô tả dài + minh hoạ lớn khi rỗng | Mô tả 1 dòng; rỗng 1 dòng; tab kiểu `SectionTabs` | P2 |
| DE-09 | Luật khuyến nghị, Lịch sử | Mô tả dài; thẻ luật có nút "Sửa" xám | Mô tả 1 dòng; nút "Sửa" là nút phụ, nút chính duy nhất "Thêm luật" | P2 |
| DE-10 | Badge "Chỉ xem" | Dải `ExpertDecisionNotice` trên đầu 9 trang khi Farm Owner xem | Badge nhỏ "Chỉ xem" cạnh tab đang mở, câu giải thích trong (i) | P1 |
| DE-11 | Menu và khung | Nhóm "Khác"; dock điện thoại là 4 mục đầu cũ | Bỏ nhóm "Khác" (SH-03); dock: Hàng đợi · Kiểm chứng · Tham số · Đếm chim; kiểm bảng §4.1 cột Domain Expert | P2 |

## 7. Farm Technician — Tuấn

Phần lớn đã làm ở PR nền (menu, trang chủ Cảnh báo, `ScopeFilter`, KPI không lồng, "Xem thiết bị" lọc sẵn nhà, chữ). Còn lại:

| ID | Trang | Hiện tại | Sửa | Ưu tiên |
|---|---|---|---|---|
| FT-01 | Thiết bị `/devices` | 29 chữ < 13px; hàng thiết bị có dòng phụ "Trại yến Demo A2 · C · Nh…" bị cắt; vạch cam bên trái mỗi hàng (trái FE_Design §1.1 "không vạch màu ở cạnh") | Sau C-02; vị trí hiện "Nhà · Zone" (trang trại đã có ở phạm vi); bỏ vạch cạnh, trạng thái dùng `StatusDot` + badge | P1 |
| FT-02 | Nhà được giao `/farms` | 6 nút "Xem thiết bị" tô đen (mỗi hàng một nút chính); 7 cỡ chữ | Nút trong hàng là nút phụ (viền), không nút chính nào trên trang; thống nhất cỡ chữ theo C-02 | P1 |
| FT-03 | Cảnh báo `/alerts` | Dùng chung trang Farm Owner | Theo FO-03 (`mobileCard`) | P2 |
| FT-04 | Điện thoại 390 | Hàng thiết bị 3 cột chật | Hàng thiết bị xếp dọc: mã + trạng thái · tín hiệu · nút khởi động lại 44px | P1 |
| FT-05 | Menu và khung | Nhóm "Khác" chỉ có Cài đặt | Bỏ nhóm (SH-03, sau PR §4.1); kiểm bảng "Header và sidebar đúng theo role" cột Farm Technician | P2 |

## 8. Admin — Nhi

Đã làm ở PR nền: menu tab Người dùng, trang OTA vào card + cột tiếng Việt + vị trí theo tên, bỏ STT, bảng không đệm dòng, thuật ngữ. Đã có sẵn từ #205, #206 (dùng lại, không viết mới): `DataTable`/`FixedRowsTable` prop `mobileCard` (C-09), `common/KpiTile` (C-10), `ui/InfoTip` và prop `help` của `SectionCard` (C-07), `ui/Drawer` (có `side="bottom"`, trả focus khi đóng), `ActionsMenuItem.hint` (lý do mục bị khoá), `hooks/common/useMenuBadges` (badge theo đường dẫn), mục "Thêm" của dock điện thoại (tự có khi menu dài hơn 4 mục).

**Số đo hiện tại (Phụ lục A, sau #206):** mọi trang Admin `h1 = 1`, `tiny = 0`. Còn: `/ota` `spill = 35` ở 390; `hScroll = 1` ở Tổng quan hệ thống, Thiết bị, Cảnh báo, Người dùng, Kho, Nhật ký; `darkButtons = 1` ở Kho, Cấu hình mặc định (nút chính, đạt).

### 8.1 Thứ tự PR

| PR | Nhánh | Mục | Phụ thuộc |
|---|---|---|---|
| 1 | `refactor/fe-admin-menu` | AD-09 (menu, dock, badge) | Không |
| 2 | `refactor/fe-admin-pages` | AD-02, AD-03, AD-04, AD-05, AD-06, AD-08 | Không (có thể song song PR 1) |
| 3 | `refactor/fe-admin-ota` | AD-01 | Không |

Mỗi PR chạy checklist §9; ảnh trước/sau 1440 và 390 kéo vào mô tả PR (review của #205, #206 chặn khi thiếu ảnh). Tên nhánh theo FE_Design 13.13: `<type>/fe-admin-<việc>`.

### 8.2 PR 1 — Menu và badge (AD-09)

| Bước | File | Cách làm | Xong khi |
|---|---|---|---|
| 1 | `components/layouts/AdminLayout.tsx` | 3 nhóm theo §3.4: **Theo dõi** (Tổng quan hệ thống `/system/health` · Cảnh báo `/alerts`) · **Thiết bị** (Danh sách thiết bị `/devices` · Kho thiết bị `/system/device-stock` · Cập nhật firmware `/ota`) · **Hệ thống** (Người dùng = `usersItem` có tab · Cấu hình mặc định `/system/settings` · Nhật ký hệ thống `/system/audit-log`). Bỏ chữ "Console". `dockItems` giữ: Tổng quan hệ thống · Danh sách thiết bị · Cảnh báo · Người dùng; mục "Thêm" tự hiện cho 4 mục còn lại | Sidebar 8 mục, 3 nhóm; dock 4 mục + "Thêm" |
| 2 | `constants/navigation.i18n.ts`, `i18n/en.ts` | Nhãn nhóm "Theo dõi", "Thiết bị", "Hệ thống" đã có. Hôm nay "Console thiết bị" và "Quản lý" chỉ còn ở `AdminLayout.tsx` (dòng 29, 37); sau bước 1 xoá khoá của cả hai ở `navigation.i18n.ts` (bản vi và en) và khoá `'Quản lý'` ở `i18n/en.ts:16`. Comment "Console thiết bị" ở `constants/roles.ts`, `roles.test.ts` đổi thành "Thiết bị". Giữ "Vận hành" (Farm Owner, Kỹ thuật viên còn dùng) | `grep -rn "'Quản lý'" src` và `grep -rn "Console thiết bị" src` không còn kết quả (`tsc` không bắt khoá thừa) |
| 3 | `hooks/admin/useAccountRequests.ts` | Thêm `usePendingDeletionCount(enabled)`: `adminApi.listDeleteRequests({ limit: 1 })` lấy `meta.total`, `refetchInterval: 120_000` kèm comment lý do (13.2, như các badge khác). Khoá query bắt đầu bằng `'admin-delete-requests'` (VD `['admin-delete-requests', 'count']`) để `useCompleteDeleteRequest`, `useRejectDeleteRequest` (đang invalidate theo tiền tố đó) làm số tự giảm sau khi xử lý | Có test hoặc ít nhất không gọi khi `enabled = false` |
| 4 | `hooks/common/useMenuBadges.ts` (file chung, của Bảo) | Khoảng 4 dòng: `import { usePendingDeletionCount } from '@/hooks/admin/useAccountRequests'`, `const isAdmin = role === 'ADMIN'`, `const pendingDeletion = usePendingDeletionCount(isAdmin)` và mục `'/users': isAdmin ? pendingDeletion : 0`. Báo Bảo trong mô tả PR vì file dùng chung 4 role | Badge "Người dùng" hiện số yêu cầu xoá chờ xử lý; role khác không gọi API |
| 5 | `constants/roles.ts` | Không đổi `MENU_ACCESS` (đường dẫn giữ nguyên); chạy `roles.test.ts` | Test xanh |

### 8.3 PR 2 — Các trang (AD-02…AD-08)

| ID | File | Cách làm | Xong khi |
|---|---|---|---|
| AD-02 | `components/features/admin/dashboard/RecentActivityCard.tsx`, `pages/admin/AdminSystemHealthPage.tsx` | Nhật ký gần đây: bỏ `AuditLogFilters` và `Pagination`, chỉ 5 dòng mới nhất (`useAuditLogList({ page: 1, limit: 5 })`), giữ link "Xem tất cả" → `/system/audit-log`. Ô KPI "Cảnh báo CRITICAL" đổi nhãn thành "Cảnh báo khẩn cấp" (FE_Design 6.4 mục 6: không chữ enum) | Trang không còn bộ lọc, phân trang; `wording.test.ts` xanh |
| AD-03 | `pages/admin/AdminUsersPage.tsx`, `components/features/admin/users/UserStats.tsx`, `e2e/admin-accounts.spec.ts` | Bỏ tab pill "Nhân viên hệ thống / Người dùng" trong card; thay bằng `SelectMenu` "Vai trò" trong hàng bộ lọc: Tất cả · Quản trị viên · Chủ nhà yến · Kỹ thuật viên · Chuyên gia (mặc định Tất cả, `roles` = mọi vai trò). Nút "Tạo chủ nhà yến" luôn hiện, là nút chính duy nhất. Card một mình trên trang nên bỏ `title`, mô tả 1 dòng. `UserStats`: bỏ `Card` bao và tiêu đề "Thống kê tài khoản", thành hàng 4 ô `grid grid-cols-2 lg:grid-cols-4` (Tổng tài khoản, dòng phụ "N đã khoá" · Chủ nhà yến · Kỹ thuật viên · Chuyên gia), bỏ `className="shadow-none"`. **E2E:** xoá dòng `page.getByRole('tab', { name: 'Người dùng' }).click()` trong test "tạo tài khoản Farm Owner…"; **không đổi tên test** (Report 5) | Không còn 2 hàng tab; E2E xanh; `unevenRows = 0` |
| AD-04 | `pages/admin/AdminDeviceStockPage.tsx` | Nút "+ Thêm thiết bị" → `<Button><PlusIcon size={14} weight="bold" aria-hidden />Thêm thiết bị</Button>` (Phosphor, như nút "Tạo phiếu" ở Công việc). Mô tả card ≤ 1 dòng: "Thiết bị đã nhập kho và trạng thái nhãn", câu "In nhãn ngay khi thêm" chuyển vào `help` | Không còn ký tự "+" trong nhãn nút |
| AD-05 | `components/features/admin/devices/DeviceStats.tsx` | 4 ô: Tổng thiết bị · Online · Mất kết nối · Chờ kết nối; bỏ "Cần xử lý" (trùng nghĩa Mất kết nối). Hàng `grid-cols-2 lg:grid-cols-4`. Trang `/devices` của Admin còn card "Danh sách thiết bị" + hàng KPI: KPI không phải card nên card bỏ `title` (chỉ một card) | 4 ô một hàng, không ô thừa |
| AD-06 | `components/features/admin/audit-log/AuditLogStats.tsx`, `pages/admin/AdminAuditLogPage.tsx` | 4 ô: Tổng nhật ký · Nhật ký 7 ngày qua · Đăng nhập thất bại · Thay đổi tài khoản 7 ngày (gộp "Lượt khoá tài khoản" và "Nhân viên mới"). Card "Danh sách nhật ký" bỏ `title` (một card), mô tả 1 dòng. Bảng giữ STT (thứ tự có nghĩa, FE_Design 1.1) | 4 ô; không tiêu đề lặp |
| AD-07 | `pages/admin/AdminSystemSettingsPage.tsx` | Không đổi | — |
| AD-08 | `pages/admin/AdminUsersPage.tsx`, `AdminDeviceStockPage.tsx`, `AdminDevicesPage.tsx`, `AdminAuditLogPage.tsx`, `AdminAccountRequestsPage.tsx`, `RecentActivityCard.tsx` | Mỗi `DataTable` thêm `mobileCard`: cột chính in đậm (tên tài khoản / mã thiết bị / hành động), 2–3 cột phụ thành dòng `text-small text-warmGray`, menu ⋯ góc phải lấy lại từ cột Thao tác (`columns[columns.length - 1].render(row, 0)`), wrapper menu chặn cả `onClick` lẫn `onKeyDown` (mẫu: `features/farm-owner/work-orders/WorkOrderTable.tsx`, `alerts/AlertTable.tsx`). Thiết bị giả lập giữ `SimulatedBadge` trên thẻ (SYSTEM-FR-004). Bảng nằm trong khung chiều cao cố định thì chỉ cố định từ `sm:` (bài học ở `HarvestTable`) | `hScroll = 0`, `spill = 0` ở 390 cho cả 6 trang |

Mô tả card (C-07): mỗi `SectionCard` chỉ một dòng ≤ 60 ký tự; câu dài (VD trang Yêu cầu xoá tài khoản: "Quyền sở hữu trang trại chuyển cho…") vào prop `help`. Đo `greyPara = 0`.

### 8.4 PR 3 — Cập nhật firmware (AD-01)

| Bước | File | Cách làm | Xong khi |
|---|---|---|---|
| 1 | `components/features/admin/ota/DeviceTable.tsx` → `otaColumns.tsx` | Thay bảng tự viết bằng `DataTable` (`columns` khai trong `otaColumns.tsx` như `deviceColumns.tsx`), `onRowClick` mở ngăn gửi; giữ trạng thái chọn (dòng đang chọn nền `bg-charcoal/5` qua cột đầu) và nhãn đang cập nhật / lỗi lần trước. Xoá `DeviceTable.tsx` | Không còn `<table>` tự viết |
| 2 | `pages/admin/AdminOtaPage.tsx` | `OTASidePanel` vào `Drawer` (`side` mặc định phải), mở khi chọn thiết bị, đóng thì bỏ chọn; bỏ cột `w-80` cố định cạnh bảng. `OTAConfirmModal` giữ nguyên | Màn 390 không còn cột ngăn tràn |
| 3 | cùng file | `mobileCard`: mã thiết bị · vị trí · phiên bản hiện tại · trạng thái online; nút "Cập nhật" khoá khi không online vẫn có `title` và dòng phụ "Chỉ thiết bị đang online" ở đầu danh sách (đã có) | `spill = 0`, `hScroll = 0` ở 390 |
| 4 | — | Mô tả card một dòng ("Cập nhật firmware từ xa cho bộ điều khiển"), câu "Chỉ thiết bị đang online…" vào `help` | `greyPara = 0` |

### 8.5 Kiểm theo role Admin

Đăng nhập `admin@swiftletcare.dev`, đối chiếu bảng "đúng theo role" §4.1 cột Quản trị viên (không thanh phạm vi, chuông có tab Cảnh báo thiết bị và Thông báo, menu avatar đủ 3 mục) và §4.2 (Cài đặt chỉ Hồ sơ · Bảo mật · Quyền riêng tư · Yêu cầu xoá tài khoản). Chạy Phụ lục A với `ROLE = 'admin'`: 8 mục menu đạt cột "Mục tiêu" §2.2.

## 9. Checklist mỗi PR

- [ ] Ảnh trước/sau ở 1440×900 và 390×844 của mọi trang đã sửa, dán vào mô tả PR
- [ ] Chạy script Phụ lục A cho role của mình: các trang đã sửa đạt cột "Mục tiêu" §2.2 (ghi bảng số trước/sau vào PR)
- [ ] `npm run lint` · `npx tsc --noEmit` · `npx tsc -p tsconfig.e2e.json` · `npx vitest run` (gồm `wording.test.ts`) · `npm run build`
- [ ] E2E trong CI xanh; đổi chữ trên màn thì sửa chỗ tìm theo chữ trong `e2e/`, **không đổi tên test** (Report 5)
- [ ] Không thêm route, API, quyền; route cũ vẫn mở được
- [ ] Đổi menu thì sửa cùng lúc layout, `MENU_ACCESS`, `navigation.i18n.ts`, chạy `roles.test.ts`
- [ ] Đăng nhập bằng role của mình, đối chiếu header, sidebar, dock, menu avatar và trang Cài đặt với hai bảng "đúng theo role" ở §4.1, §4.2: không thiếu mục nào, không có mục thừa
- [ ] Ghi vào FE_Design nếu đổi luật dùng chung (chỉ Bảo, PR C-12)

## 10. Không làm trong đợt này

- Không thêm, bỏ hay đổi quyền chức năng nào (Report 3 §2.4); không đổi API.
- Không đổi route đang có; không đổi URL mang `_id` của trang nhà/Zone (ghi nợ FE_Design §13.16).
- Không đổi bảng màu, font, logo (FE_Design §2, §3).
- Không đụng `mobile/`.

## 11. Còn lại sau §4, §5 (20/11/2026)

§4 đã merge ở #205, §5 ở #206. Việc còn lại:

| Người | Việc | Ghi chú |
|---|---|---|
| Bảo (web) | FO-06: ô chọn nhiều Zone ở so sánh Zone (Phân tích) | `SelectMenu` chưa có chế độ chọn nhiều; chip đã là pill trắng nên không còn khối tô đen |
| Bảo (web) | FO-10: lưới Zone ở chi tiết nhà co theo số Zone | Nhà 1 Zone còn trống 70 % khung |
| Bảo | **BR-31 bỏ đánh giá mù**, nhóm chốt ngày 20/11/2026 (Bảo, trưởng nhóm, quyết định trong buổi làm việc): người đánh giá xem trạng thái của hệ thống rồi xác nhận hoặc sửa; trạng thái luôn hiển thị ở mọi kênh. PR #208 sửa Report 3 4.2.14 (BR-31, EXPERT-FR-012, NFR-14, §6.18), Report 4 2.2.18, `api-spec.yaml`, backend bỏ che, web bỏ ẩn, và đóng G-30 trong `project-tracking.md` §6 | Mobile (Len) còn phải bỏ phần ẩn trạng thái trước khi đánh giá |
| Bảo, Kiệt (backend) | `PUT /auth/notification-preferences` nhận mọi role và giờ im lặng áp cho mọi người, trong khi ALERT-FR-005 chỉ cho Chủ nhà yến, Kỹ thuật viên và ALERT-FR-006 chỉ cho Chủ nhà yến | Giao diện đã ẩn theo role (ST-03); backend nên chặn hoặc bỏ qua trường không thuộc role |
| Bảo, Kiệt (backend) | Cờ `push` chung (ST-02) | Giao diện không còn đổi được; backend bỏ cờ hoặc coi như bật |
| Bảo | ALERT-FR-007: không phải đổi yêu cầu mà là Report 3 tự lệch. Bảng quyền §2.4, dòng "Receive alerts": Chủ nhà yến nhận cảnh báo leo thang và khẩn cấp, Kỹ thuật viên nhận trước ở nhà được giao, chuyên gia chỉ nhận cảnh báo suy luận để xác nhận hoặc bác ở hàng chờ Kiểm chứng (EXPERT-FR-003); dòng "Acknowledge alerts" chỉ có Chủ nhà yến và Kỹ thuật viên. Riêng dòng ALERT-FR-007 ghi "Farm Owner, Domain Expert" và thiếu Kỹ thuật viên. Code đã theo §2.4 (`ALERT_ROLES` không có chuyên gia) | Đã sửa trong PR #208: actor của ALERT-FR-007 thành Farm Owner, Farm Technician (assigned houses); code giữ nguyên |
| Tuấn | §6, §7 | Các mục đã dùng được component chung của #205, #206 |
| Nhi | §8 | Plan chi tiết ở §8.1…§8.5 |

## Phụ lục A. Script đo theo taste-skill

`docs/reports/tools/audit_taste.js`. Chép vào `.playwright-mcp/` (thư mục Playwright MCP được đọc), sửa dòng `const ROLE = …` thành `'owner'`, `'expert'`, `'technician'` hoặc `'admin'`, rồi chạy bằng Playwright MCP `browser_run_code_unsafe` với `filename`. Cần backend đã `npm run seed` + `npm run seed:demo` và `npm run dev` ở `frontend/` (backend chạy với `RATE_LIMIT_MAX` cao, VD `RATE_LIMIT_MAX=100000 npm run dev`, vì script mở nhiều trang liền nhau). Kết quả là JSON mỗi trang trong menu:

| Trường | Ý nghĩa (mã kiểm taste-skill) |
|---|---|
| `h1` | số thẻ h1 trên trang (heading-order) |
| `tiny` | phần tử chữ < 13px (text-contrast) |
| `greyPara` | đoạn ≤ 14px dài > 60 ký tự (text-contrast) |
| `darkButtons` | nút/link nền tối (button-styles: một nút chính mỗi màn) |
| `smallTargets` | vùng bấm cao < 36px (tap-size) |
| `headingSizes`, `fontSizes`, `radii` | số cỡ tiêu đề, cỡ chữ, bán kính khác nhau (heading-scale, card-family) |
| `boxDepth` | số lớp hộp lồng nhau quanh chữ (nesting) |
| `unevenRows` | hàng lưới có ô lệch chiều cao > 24px (section-air) |
| `bigImages` | ảnh rộng > 400px (photo-weight) |
| `spill`, `hScroll` | phần tử tràn mép / vùng cuộn ngang ở 390px (off-viewport) |
