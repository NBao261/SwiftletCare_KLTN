# SwiftletCare Frontend (Web Dashboard / PWA)

React 18 + Vite + TailwindCSS + React Router v6 + Socket.io-client. Yêu cầu: Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md), phân quyền §2.4); thiết kế: Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.4). Hai Report thắng `SwiftletCare_SRS.md` khi lệch nhau.

> **Phạm vi sau Review 1 (Report 3).** Hội đồng đánh giá theo phiếu đăng ký bản sửa. Việc phải sửa ở web (chỗ lệch theo FR ở `docs/reports/README.md`, quyền theo màn ở `FE_Design_Claude.md` §12.0):
>
> - Role `DOMAIN_EXPERT` đã có màn từ PR #91 (`/expert/*`): bỏ dữ liệu giả dự phòng (`services/expert/expertFallback.service.ts`, `data/mocks/`), chuyển về bucket `domain-expert/`, `DomainExpertLayout`, `apis/` theo FE_Design §12.
> - Farm Owner: lịch sử can thiệp tay, thẻ tỷ lệ thời gian tự động, đọc kết luận và lịch sử quyết định của chuyên gia (EXPERT-FR-009), live stream có khung và số đếm trực tiếp.
> - Technician/Admin: Admin không có nút can thiệp tay hay xác nhận cảnh báo; Technician cũng không có hai nút đó (Report 3 §2.4). Ticket, SLA, vùng của Technician và màn quản lý farm của Admin đã ra ngoài phạm vi (Report 3 §8) và đã gỡ khỏi code.
> - Domain Expert: màn chỉnh tham số phát hiện của Zone (EXPERT-FR-008), đặt cạnh tỷ lệ cảnh báo được xác nhận, duyệt thay đổi ngưỡng/hệ số của chủ farm (EXPERT-FR-010), duyệt đề xuất hệ số (EXPERT-FR-011), vòng đếm và lịch đếm theo mùa; Farm Owner chỉ xem, trừ khi farm chưa có chuyên gia (BR-22).
> - Thiết lập thiết bị (MF-10): Farm Owner quét nhãn QR và mã QR tầng, xem tiến trình setup; Admin in nhãn QR khi thêm thiết bị vào kho; màn Zone in mã QR tầng. Gỡ chỗ sửa ngưỡng/hệ số khỏi màn Technician.
> - Gỡ trường `heating` còn sót trong `RelayStates` (màn đã chỉ hiện 3 relay); NH3/CO2 ghi rõ là ngưỡng cảnh báo của Zone (không điều khiển quạt); nhãn `NOISE_ANOMALY` thay `BIRD_PANIC`, hiển thị kèm số đếm chim.

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
    layouts/   Đích 7 file — 4 của role, 3 dùng chung:
                 AdminLayout · FarmOwnerLayout
                 DomainExpertLayout (chưa có) · TechnicianLayout
                   -> menu viết đầy đủ ngay đầu mỗi file
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
                 auth/        LoginPage, RegisterPage, ForgotPasswordPage,
                              InvitationPage (chưa đăng nhập, không gắn role)
                 domain-expert/ (đích) màn chuyên gia: kiểm chứng cảnh báo,
                              kết luận, duyệt thay đổi, tham số phát hiện…
                              (code hiện có nằm ở expert/, PR #91)
               2 trang không thuộc role nào nằm thẳng ở pages/:
                 SettingsPage (mọi role), ForbiddenPage
  routes/      1 file cho mỗi thư mục pages/<role>/: <role>.routes.tsx
  stores/      Zustand (authStore, alertStore, toastStore, zoneStore, breadcrumbStore)
  types/       Tách theo module backend (auth, farm, device, telemetry, alert,
               harvest, vision, system, socket, common) + index.ts barrel.
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

Quy ước: tên thư mục con (`admin/`, `farm-owner/`, `shared/`...) cho biết role SỞ HỮU
nghiệp vụ (`shared/` = từ 2 role trở lên dùng); ai vào được là `RequireRole allow={...}`
của route, chọn theo bảng phân quyền Report 3 §2.4 (`FE_Design_Claude.md` 12.0, 12.8).
Nhóm role khai báo một chỗ ở `constants/roles.ts` để bảng route và sidebar không lệch nhau. Mọi import
dùng alias `@/`, không dùng đường dẫn tương đối.

## Trạng thái trang

Trạng thái từng màn (API thật, chờ dữ liệu, chưa có endpoint) ở `FE_Design_Claude.md` mục 7; màn còn thiếu so với Report 3 ở `docs/reports/README.md` (#9, #28, #30). `Marketplace` ngoài phạm vi — chỉ được gỡ.

## Lệnh hữu ích

```bash
npm run build
npm run preview
npm run lint
```
