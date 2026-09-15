# SwiftletCare Mobile

Expo Router (React Native) app cho Farm Owner/Technician. **Lưu ý kiến trúc:** SRS §3.2 mô tả "Mobile Web (PWA)" dùng ReactJS/Vite (cùng codebase `frontend/`), trong khi thư mục này là app Expo/React Native riêng biệt. Đây là sai khác giữa SRS và code thực tế — nhóm cần thống nhất lại: hoặc cập nhật SRS để phản ánh app native, hoặc chuyển hướng sang PWA responsive từ `frontend/` và deprecate thư mục này.

## Chạy local

```bash
npm install
npx expo start
```

Cấu hình `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` trong `.env` (xem `.env.example`) trỏ tới backend.

## Cấu trúc

```
app/            Expo Router file-based routing ((auth)/, (tabs)/, farm/, device/,
                zone/, alert/, ticket/, livestream/)
components/     UI theo domain (dashboard, farm, device, alert, analytics, charts)
services/api/   Axios wrapper theo module, mirror frontend/src/services
hooks/          React Query hooks
store/          Zustand (authStore, alertStore)
types/          Mirror backend/src/types/domain.ts (§8.2)
```

## Trạng thái màn hình

Phần lớn màn hình là stub — implement theo `SwiftletCare_TASK_DETAIL_Checklist.md` mục D (sprint tương ứng). Tab `Tickets` là scaffold mới thêm để khớp Module TICKET trong SRS §5.9.
