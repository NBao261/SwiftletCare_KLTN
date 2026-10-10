# SwiftletCare Frontend (Web Dashboard / PWA)

React 18 + Vite + TailwindCSS + React Router v6 + Socket.io-client. Xem `SwiftletCare_SRS.md` §3.2, §9.3.

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
               ZonePicker). Cố ý giữ nhỏ.
    features/  Component riêng của từng tính năng: <role>/<area>/
               (không có features/shared — mỗi component thuộc đúng 1 role)
    layouts/   Đúng 7 file — 4 của role, 3 dùng chung:
                 AdminLayout · FarmOwnerLayout
                 FarmOperatorLayout · TechnicianLayout
                   -> menu viết đầy đủ ngay đầu mỗi file
                 AppShell    khung chung (sidebar + header + nội dung)
                 AppSidebar  sidebar desktop + dock mobile
                 AppHeader   breadcrumb + zone + chuông + ngôn ngữ
  constants/   roles (nhóm role + getRoleHomePath + canAccessPath),
               thresholds, tickets, auditActions
  validations/ Hàm kiểm tra form, thuần logic: admin/ (theo role) và
               common/ (luật không gắn role)
  providers/   AppProviders.tsx — gom mọi provider bọc cây React
  hooks/       React Query hooks bọc apis/, chia theo role + common/ (hạ tầng)
  lib/         axios, queryClient, socket, cn, helpers, navigation, chartTheme
  pages/       CHỈ chứa *Page.tsx. Mỗi trang nằm trong thư mục của role SỞ HỮU
               nghiệp vụ đó, tên file mang luôn tên role:
                 admin/       AdminUsersPage, AdminSystemHealthPage...
                 farm-owner/  FarmOwnerDashboardPage, FarmOwnerHarvestPage...
                 technician/  TechnicianDevicesPage, TechnicianTicketsPage...
                 auth/        LoginPage, RegisterPage, ForgotPasswordPage,
                              InvitationPage (chưa đăng nhập, không gắn role)
               4 trang không thuộc role nào nằm thẳng ở pages/:
                 SettingsPage (mọi role), MarketplacePage,
                 ListingDetailPage, ForbiddenPage
  routes/      1 file cho mỗi thư mục pages/<role>/: <role>.routes.tsx
  stores/      Zustand (authStore, alertStore, toastStore, zoneStore, breadcrumbStore)
  types/       Tách theo module backend (auth, farm, device, telemetry, alert,
               ticket, harvest, vision, system, socket, common) + index.ts barrel.
               Kiểu là shape thực thể mirror model backend, dùng chung nhiều
               role nên chia theo module chứ không theo role như các lớp khác.
```

Muốn thêm/bớt mục menu của một role: mở đúng `components/layouts/<Role>Layout.tsx`
và sửa mảng `menuSections` ngay đầu file — mỗi mục là `{ label, path, icon }` viết
đủ tại chỗ, không tra bảng chung. `AppSidebar` chỉ nhận danh sách qua prop nên
không phải đụng tới. Nếu mục đó cũng cần chặn `returnTo` sau login thì thêm một
dòng vào bảng `MENU_ACCESS` trong `constants/roles.ts`.

Lưu ý quan trọng: thư mục chứa trang cho biết role SỞ HỮU nghiệp vụ, KHÔNG phải
"chỉ role đó vào được". Ví dụ `TechnicianDevicesPage` vẫn được Farm Owner và Admin
mở — danh sách quyền thật nằm ở `allow={...}` trong `routes/technician.routes.tsx`.
Muốn biết chính xác ai vào được trang nào thì đọc `routes/`, không đoán qua tên file.

Quy ước đặt component: không biết domain (không import @/types, @/hooks, @/apis,
@/stores) thì vào `ui/` bất kể mấy nơi dùng; biết domain mà chỉ 1 tính năng dùng thì
vào `features/`; biết domain và >= 2 tính năng dùng mới vào `common/`.

Quy ước: tên thư mục con (`admin/`, `farm-owner/`, `shared/`...) cho biết ROLE NÀO
vào được, khớp đúng `RequireRole allow={...}` của route dùng nó. Nhóm role khai báo
một chỗ ở `constants/roles.ts` để bảng route và sidebar không lệch nhau. Mọi import
dùng alias `@/`, không dùng đường dẫn tương đối.

## Trạng thái trang

Phần lớn trang là stub "Coming soon" — implement theo `SwiftletCare_TASK_DETAIL_Checklist.md` mục D (sprint tương ứng). `Tickets`, `Harvest`, `Marketplace` là scaffold mới thêm để khớp Module TICKET/MARKET trong SRS.

## Lệnh hữu ích

```bash
npm run build
npm run preview
npm run lint
```
