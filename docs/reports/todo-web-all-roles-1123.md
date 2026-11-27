# Web đủ mọi chức năng của mọi role (23/11/2026)

**Quyết định (Bảo, 23/11/2026):** web có đủ mọi việc Report 3 §2.4 cho từng role làm, không để việc nào chỉ có trên mobile. Mobile giữ các tiện ích tại nhà yến (quét QR bằng camera, chụp ảnh tại chỗ, push). Report 4 §5.4 đổi theo (2.2.26). Gap **G-33** trong `project-tracking.md` §6.

Rà trên `develop` tại `0f6dc6d2`: 189 route backend, web gọi 185. Bốn route web chưa gọi: `POST /alerts/{id}/onsite-check` (thiếu thật, W-T5), `GET /analytics/bird-count/daily` (web dùng `trends`, đủ), `POST`/`DELETE /notifications/push-tokens` (token FCM của điện thoại, xem §3). Phần thiếu nằm ở **quyền vào trang**: web chỉ cho Farm Technician vào `/alerts`, `/devices`, `/farms`.

## 1. Đối chiếu theo role

**Farm Owner, Domain Expert, Administrator:** mọi dòng của §2.4 đã có trang web (tự rà ngày 23/11 trên `develop` tại `0f6dc6d2`; bảng chi tiết ở `todo-audit-1123.md`, vào repo cùng #231). Còn: quét QR khi lắp thiết bị trên web (Farm Owner) đang nhập tay hoặc dán chữ, xem §3.

**Farm Technician** (chỉ nhà được giao; backend đã giới hạn dữ liệu theo nhà):

| # | Việc (Report 3 §2.4) | Trang web | Hiện nay | Cần làm | API (backend đã mở cho thợ) |
|---|---|---|---|---|---|
| T-01 | Xem dashboard thời gian thực | `/dashboard` | chặn | mở; không gọi tổng quan trại (`/farms/{id}/overview` 403) | telemetry, analytics |
| T-02 | Xem phân tích, lịch sử điều khiển tay, tỷ lệ tự động | `/analytics` | chặn | mở; ẩn gợi ý hệ số (`/analytics/control/suggestion` 403) | `/analytics/*` |
| T-03 | Xem số chim, live stream | `/vision` | chặn | mở | `bird-count/*`, `stream-token` |
| T-04 | Vẽ, sửa, xoá vòng đếm của camera nhà được giao | `/domain-expert/counting-ring` | chặn | mở riêng trang này cho thợ | `PUT …/counting-ring` |
| T-05 | Xem trạng thái ngày, báo cáo; chấm ngày; tải PDF, CSV | `/health` | chặn | mở; ẩn mức chỉ số và ngày lệch (403) | `/health-reports/*` |
| T-06 | Làm phiếu công việc: bắt đầu, checklist, báo xong kèm nguyên nhân, ghi chú, tối đa 5 ảnh | `/work-orders` | chặn | mở; lọc "Giao cho tôi"; ẩn tạo, duyệt, huỷ, giao lại, chỉ số (403) | `start`, `checklist`, `done` (multipart) |
| T-07 | Xem kế hoạch bảo trì | `/maintenance` | chặn | mở chỉ đọc | `/maintenance/plans`, `/due` |
| T-08 | Xem khuyến nghị | `/recommendations` | chặn | mở chỉ đọc; gọi theo `houseId` (theo `farmId` là 403) | `GET /recommendations?houseId` |
| T-09 | Ghi thu hoạch (bản nháp), sửa, xoá bản nháp của mình | `/harvests` | chặn | mở; ẩn xác nhận | `POST/PUT/DELETE /harvests` |
| T-10 | Điều khiển tay relay, trả về tự động | `/dashboard/scada` | chặn (chỉ Farm Owner) | mở cho thợ ở nhà được giao | `…/relay`, `…/relay-override` |
| T-11 | Xem chi tiết thiết bị, lịch loa (đọc), khởi động lại | `/devices/detail` | chặn | mở; ẩn chuyển, thay, gỡ, sửa lịch loa | `sensor-nodes/{id}`, `commands` |
| T-12 | Xem ngưỡng, hệ số mờ, tham số phát hiện, lịch đếm, luật bù thời tiết (chỉ đọc) | `/domain-expert/tuning`, `counting-schedule`, `weather-rules` | chặn | mở chỉ đọc | `GET` của từng nhóm |
| T-13 | Trả lời yêu cầu kiểm tra tại chỗ của cảnh báo suy luận | `/alerts` | thiếu | thêm nút và khung trả lời | `POST /alerts/{id}/onsite-check` |
| T-14 | Xem giai đoạn của nhà (đọc) | `/farms` | có | — | — |
| T-15 | Xem ca trực của mình | `/farms` | có | — | `GET …/roster` |

Menu của thợ (`menuCatalog.ts`, `ROLE_PLAN`): Tổng quan (Tình trạng, Điều khiển tay), Cảnh báo, Công việc (Phiếu, Bảo trì), Sức khoẻ, Đàn chim (Đếm chim, Vòng đếm), Thu hoạch, Thiết bị, Nhà được giao. Chỉ đọc thì không đưa vào menu (`hide`: Phân tích, Khuyến nghị, Tham số điều khiển, Luật phun sương theo thời tiết, Lịch đếm); các trang đó vẫn mở được bằng đường dẫn và `MENU_ACCESS` không đổi (quyết định 27/11/2026, #277). `MENU_ACCESS`, `RequireRole` và các nhóm role trong `constants/roles.ts` đổi theo; nút nào backend trả 403 cho thợ thì không hiện (`usePermission`).

## 2. Thứ tự PR (Bảo)

| PR | Nhánh | Nội dung | Phụ thuộc |
|---|---|---|---|
| W-0 | `docs/web-all-roles-plan` | File này, Report 4 §5.4 (2.2.26), `frontend/CLAUDE.md`, G-33 | — |
| W-1 | `feat/web-technician-work` | T-06, T-07, T-08, menu "Công việc" của thợ | W-0 |
| W-2 | `feat/web-technician-health-harvest` | T-05, T-09 | W-0 |
| W-3 | `feat/web-technician-monitoring` | T-01, T-02, T-03, T-04, T-10, T-11 | W-0 |
| W-4 | `feat/web-technician-parameters-onsite` | T-12, T-13 | W-0 |

Mỗi PR: lint, `tsc --noEmit`, `vitest run`, `build`; thử bằng `tech@swiftletcare.dev` trên web thật, chụp màn hình; E2E `technician-flow.spec.ts` mở rộng cho việc mới; đánh dấu dòng T-xx là xong.

## 3. Không làm trên web (có lý do)

- **Push FCM** (`/notifications/push-tokens`): là token của điện thoại; web đã có hộp thông báo trong app (socket) và Telegram. Web push cần cấu hình Firebase cho web (chưa có dự án Firebase, G-10).
- **Quét QR bằng camera khi lắp thiết bị:** web nhận chữ trong QR (dán) hoặc mã thiết bị và khoá gõ tay (FARM-FR-010), đủ để lắp. Có thể thêm quét bằng webcam qua `BarcodeDetector` của trình duyệt sau, nếu cần cho demo.
