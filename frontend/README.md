# SwiftletCare Frontend (Web Dashboard / PWA)

React 18 + Vite + TailwindCSS + React Router v6 + Socket.io-client. Yêu cầu: Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md), phân quyền §2.4); thiết kế: Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.4).

> **Phạm vi hiện tại.** Web theo Report 3 cho cả 4 role (Farm Owner, Farm Technician, Domain Expert, Administrator). Chỗ còn lệch ghi ở `docs/reports/project-tracking.md` §6 (đợt soát gần nhất: G-28, G-29); quyền theo màn ở `FE_Design_Claude.md` §12.0; bản đồ code hiện tại ở `CLAUDE.md`. Màn chuyên gia nằm ở `/domain-expert/*` (bucket `domain-expert/`, `DomainExpertLayout`), mở cho Farm Owner trừ Hàng đợi việc và Báo cáo & kết luận (BR-22). Lắp thiết bị (SF-01) ở `/devices/onboarding` của Farm Owner; quét QR chỉ ở mobile.

## Chạy local

```bash
npm install
npm run dev      # http://localhost:5173, cần backend chạy ở :3000
```

## Cấu trúc

```
src/
  apis/        Endpoint HTTP chia theo role: admin/ auth/ farm-owner/ shared/
               (1 file <resource>.api.ts mỗi tài nguyên). Vào shared/ chỉ khi
               >= 2 role thật sự dùng; 1 role dùng thì về folder role đó.
  components/
    auth/      RequireRole
    ui/        Design system, KHÔNG biết domain (chỉ phụ thuộc lib/cn):
               primitive (Button, Input, Modal, Badge, Card, Select...) +
               widget tổ hợp (DataTable, Pagination, EmptyState,
               LoadingSkeleton, ConfirmModal, ActionsMenu...). index.ts là
               barrel duy nhất trong src/; icons import riêng.
    common/    Widget CÓ biết domain và dùng ở >= 2 tính năng (StatusDot,
               ScopeFilter). Cố ý giữ nhỏ.
    features/  Component riêng của từng tính năng: <role>/<area>/
               (không có features/shared — mỗi component thuộc đúng 1 role)
    layouts/   menuCatalog.ts  danh mục menu chung cho cả 4 role
                   (4 nhóm Theo dõi · Vận hành · Chuyên môn · Hệ thống,
                   ROLE_PLAN chọn nhóm, mục chỉ đọc, dock của từng role)
                 AppShell    khung chung (sidebar + header + nội dung)
                 AppSidebar  sidebar desktop + dock mobile
                 AppHeader   breadcrumb + zone + chuông + ngôn ngữ
  constants/   roles (nhóm role + getRoleHomePath + canAccessPath),
               thresholds, auditActions
  validations/ Hàm kiểm tra form, thuần logic: admin/ (theo role) và
               common/ (luật không gắn role)
  providers/   AppProviders.tsx — gom mọi provider bọc cây React
  hooks/       React Query hooks bọc apis/, chia theo role + common/ (hạ tầng)
  lib/         axios, queryClient, socket, cn, helpers, navigation, chartTheme
  pages/       CHỈ chứa *Page.tsx. Mỗi trang nằm trong thư mục của role SỞ HỮU
               nghiệp vụ đó, tên file mang luôn tên role:
                 admin/       AdminUsersPage, AdminSystemHealthPage...
                 farm-owner/  FarmOwnerDashboardPage, FarmOwnerHarvestPage...
                 technician/  TechnicianDevicesPage, TechnicianFarmsPage...
                 auth/        LoginPage, ForgotPasswordPage, InvitationPage
                              (chưa đăng nhập, không gắn role; không có đăng ký
                              công khai — tạo tài khoản trên trang lời mời)
                 domain-expert/ màn quyết định của chuyên gia: thẩm định cảnh báo,
                              ngưỡng và hệ số, duyệt thay đổi, báo cáo và kết luận…
               trang không thuộc role nào nằm thẳng ở pages/:
                 SettingsPage, SettingsPrivacyPage (mọi role), PrivacyPage, ForbiddenPage
  routes/      1 file cho mỗi thư mục pages/<role>/: <role>.routes.tsx
  stores/      Zustand (authStore, toastStore, zoneStore, breadcrumbStore, languageStore…)
  types/       Tách theo module backend (auth, farm, device, telemetry, alert,
               harvest, vision, system, socket, common) + index.ts barrel.
               Kiểu là shape thực thể mirror model backend, dùng chung nhiều
               role nên chia theo module chứ không theo role như các lớp khác.
```

Muốn thêm/bớt mục menu: sửa danh mục trong `components/layouts/menuCatalog.ts`
(một trang một tên, icon và nhóm tab cho mọi role; `ROLE_PLAN` chọn nhóm và dock của
từng role), thêm một dòng `MENU_ACCESS` trong `constants/roles.ts` cho những role mở
được trang đó, và nhãn tiếng Anh trong `constants/navigation.i18n.ts`. Role nào không
có trong `MENU_ACCESS` của trang thì mục tự ẩn. `AppSidebar` chỉ nhận danh sách qua
prop nên không phải đụng tới. Quy tắc đầy đủ: `FE_Design_Claude.md` 12.5.

Lưu ý quan trọng: thư mục chứa trang cho biết role SỞ HỮU nghiệp vụ, KHÔNG phải
"chỉ role đó vào được". Ví dụ `TechnicianDevicesPage` vẫn được Farm Owner và Admin
mở — danh sách quyền thật nằm ở `allow={...}` trong `routes/technician.routes.tsx`.
Muốn biết chính xác ai vào được trang nào thì đọc `routes/`, không đoán qua tên file.

Quy ước đặt component: không biết domain (không import @/types, @/hooks, @/apis,
@/stores) thì vào `ui/` bất kể mấy nơi dùng; biết domain mà chỉ 1 tính năng dùng thì
vào `features/`; biết domain và >= 2 tính năng dùng mới vào `common/`.

Quy ước: tên thư mục con (`admin/`, `farm-owner/`, `shared/`...) cho biết role SỞ HỮU
nghiệp vụ (`shared/` = từ 2 role trở lên dùng); ai vào được là `RequireRole allow={...}`
của route, chọn theo bảng phân quyền Report 3 §2.4 (`FE_Design_Claude.md` 12.0, 12.8).
Nhóm role khai báo một chỗ ở `constants/roles.ts` để bảng route và sidebar không lệch nhau. Mọi import
dùng alias `@/`, không dùng đường dẫn tương đối.

## Trạng thái trang

Trạng thái từng màn (API thật, chờ dữ liệu, chưa có endpoint) ở `FE_Design_Claude.md` mục 7; màn còn thiếu so với Report 3 ở `docs/reports/project-tracking.md` §6 (G-09, G-15, G-16). `Marketplace` ngoài phạm vi — chỉ được gỡ.

## Lệnh hữu ích

```bash
npm run build
npm run preview
npm run lint
```
