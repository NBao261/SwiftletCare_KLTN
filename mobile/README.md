# SwiftletCare Mobile

> **Phạm vi v2.0.0 (sau Review 1).** Hội đồng đánh giá theo phiếu đăng ký bản sửa; `SwiftletCare_SRS.md` mục 0 là căn cứ. Việc phải sửa ở mobile (chi tiết ở SRS mục 0.5):
>
> - Đồng bộ enum: role `DOMAIN_EXPERT` thay `FARM_OPERATOR`, loại cảnh báo `NOISE_ANOMALY` thay `BIRD_PANIC`; bỏ tùy chọn kênh Zalo/SMS và relay sưởi.
> - Đăng ký FCM token và nhận push; màn hình live stream có khung; Farm Owner đọc kết luận của chuyên gia.
> - Domain Expert: tối thiểu xem dashboard và báo cáo sức khỏe Zone; thao tác kiểm chứng/tinh chỉnh ưu tiên làm trên web.

Expo Router (React Native) app cho Farm Owner, Domain Expert và Technician. Đây là "Mobile App" trong phiếu đăng ký bản sửa; SRS v2.0.0 mục 3.2 và 7.6 đã ghi nhận app React Native này (web vẫn là PWA riêng trong `frontend/`).

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

Phần lớn màn hình là stub — implement theo `docs/task-checklist.md` mục D (sprint tương ứng). Tab `Tickets` là scaffold mới thêm để khớp Module TICKET trong SRS §5.9.
