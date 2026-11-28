# Kế hoạch G-34 — Kỹ thuật viên thiết lập, dời và gỡ thiết bị (26/11/2026)

Quyết định của nhóm ngày 26/11/2026 (BM03 dòng 21, Report 3 4.2.26, Report 4 2.2.33): ngoài Chủ nhà yến, **Kỹ thuật viên của nhà** cũng đăng ký, dời và gỡ thiết bị ở **các nhà được giao**, bằng cùng hai lần quét QR. Phần tài liệu đã sửa (PR này); phần code làm theo các bước dưới đây.

Không đổi: in mã QR tầng (FARM-FR-011), tạo/sửa/xoá nhà và tầng (FARM-FR-002) vẫn chỉ của Chủ nhà yến; địa chỉ camera (FARM-FR-004b) từ 28/11/2026 cũng do Kỹ thuật viên của nhà được giao nhập (BM03 dòng 22, Report 3 4.2.35); Quản trị viên vẫn gửi lệnh từ xa và OTA.

## Quy tắc chung (backend)

- Kỹ thuật viên chỉ làm trên thiết bị và tầng thuộc nhà được giao (AUTH-FR-013); nhà khác → 403.
- Đăng ký: tầng đích phải thuộc nhà được giao.
- Dời: thiết bị hiện tại và tầng đích đều phải thuộc nhà được giao.
- Gỡ, khôi phục trong 24 giờ: thiết bị thuộc nhà được giao. Danh sách thiết bị đã gỡ chỉ hiện thiết bị của nhà được giao.
- Mọi thao tác của kỹ thuật viên: ghi audit và báo trong ứng dụng cho các Chủ nhà yến của trang trại.
- Thiết bị `PENDING` quá 15 phút báo người đã đăng ký (đã có, FARM-FR-012).

## Các bước

| PR | Việc | Nơi sửa |
| --- | --- | --- |
| T-1 | Backend: mở `requireRole` cho `FARM_TECHNICIAN` ở `POST /devices/sensor-nodes/register`, `POST /devices/camera-nodes/register`, `PUT /devices/sensor-nodes/{id}/reassign-zone`, các `decommission` và `restore`; kiểm tra nhà được giao ở `device.service.ts`; thông báo cho Chủ nhà yến; cập nhật `docs/api/api-spec.yaml`; test tích hợp (đúng nhà, sai nhà, dời giữa hai nhà, gỡ rồi khôi phục) | `backend/src/routes/devices.route.ts`, `backend/src/services/device.service.ts` |
| T-2 | Web: cho Kỹ thuật viên vào `/devices/onboarding` và nút dời / gỡ / khôi phục ở trang Thiết bị, chỉ thấy tầng của nhà được giao; mục nhập địa chỉ camera làm sau, 28/11/2026 (xem trên) | `frontend/src/pages/farm-owner/FarmOwnerDeviceSetupPage.tsx`, `frontend/src/components/features/technician/devices/`, `menuCatalog.ts`, e2e |
| T-3 | Mobile: tab hoặc màn thiết lập thiết bị (quét QR nhãn và tầng) cho Kỹ thuật viên | `mobile/src/constants/roleTabs.ts`, `mobile/src/app/` |
| T-4 | Cập nhật `CLAUDE.md` gốc và của từng module (câu "never sets up devices"), `docs/reports/report5` (ca kiểm thử TC-F18, TC-F19 thêm vai Kỹ thuật viên), gỡ dòng G-34 khỏi §6 khi xong | `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `docs/reports/report5/tc.py` |

## Việc cần báo trước khi merge

Thay đổi nghiệp vụ so với bản đã chốt với giảng viên hướng dẫn ngày 09/11/2026 (BM03 dòng 13): báo giảng viên và nhóm; các file Word (đơn đăng ký v3, BM03, Report 3, Report 4) sinh lại bằng `docs/reports/tools/`.
