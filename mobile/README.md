# SwiftletCare Mobile

> **Phạm vi sau Review 1 (Report 3).** Hội đồng đánh giá theo phiếu đăng ký bản sửa; yêu cầu là Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md)), thiết kế là Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.4). Việc phải làm ở mobile:
>
> - Đồng bộ enum: role `DOMAIN_EXPERT` thay `FARM_OPERATOR`, loại cảnh báo `NOISE_ANOMALY` thay `BIRD_PANIC`; bỏ tùy chọn kênh Zalo/SMS và relay sưởi.
> - Thiết lập thiết bị (MF-10): quét nhãn QR của bộ điều khiển và mã QR tầng bằng `expo-camera`, hướng dẫn cài Wi-Fi qua AP-mode, hiện tiến trình setup (đã đăng ký → online → đã áp cấu hình).
> - Đăng ký FCM token sau khi đăng nhập, huỷ khi đăng xuất, nhận push (ALERT-FR-002); màn hình live stream có khung; Farm Owner đọc kết luận và lịch sử quyết định của chuyên gia.
> - Domain Expert: tối thiểu xem dashboard và báo cáo sức khỏe Zone; thao tác kiểm chứng/tinh chỉnh ưu tiên làm trên web.

Expo Router (React Native) app cho Farm Owner, Domain Expert và Technician. Đây là "Mobile App" trong phiếu đăng ký bản sửa; Report 4 §3.2 khai báo app React Native này (web vẫn là PWA riêng trong `frontend/`).

## Chạy local

```bash
npm ci
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
