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
  pages/       1 thư mục / route (Dashboard, Farms, Devices, Alerts, Analytics,
               Tickets, Harvest, Marketplace, Settings, Auth)
  components/  common/ (dùng chung nhiều trang), layout/ (Sidebar, TopBar, MainLayout)
  hooks/       React Query hooks bọc services/api
  services/    api.ts (Axios + interceptor refresh token), socket.ts
  store/       Zustand (authStore, alertStore)
  types/       Mirror backend/src/types/domain.ts (§8.2)
```

## Trạng thái trang

Phần lớn trang là stub "Coming soon" — implement theo `SwiftletCare_TASK_DETAIL_Checklist.md` mục D (sprint tương ứng). `Tickets`, `Harvest`, `Marketplace` là scaffold mới thêm để khớp Module TICKET/MARKET trong SRS.

## Lệnh hữu ích

```bash
npm run build
npm run preview
npm run lint
```
