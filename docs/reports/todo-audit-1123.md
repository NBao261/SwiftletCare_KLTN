# Rà soát màn hình và endpoint của Farm Technician và Domain Expert (23/11/2026)

Rà trên `develop` tại `0f6dc6d2` (sau #230), theo Report 3 4.2.20 §2.4 (bảng quyền) và Report 4 2.2.25 §5.4 (màn hình theo nền tảng). Tiếp nối `todo-audit-1121.md` (G-32): việc nào đã có ở đó thì chỉ ghi số hiệu cũ.

- **Endpoint:** liệt kê tự động mọi route backend mở cho `FARM_TECHNICIAN` và `DOMAIN_EXPERT` (gồm guard đặt bằng biến, hằng số nhóm role và `router.use`), rồi tìm chỗ gọi trong `frontend/src` và `mobile/src`.
- **Giao diện:** chạy backend (Atlas) và web, đăng nhập `expert@swiftletcare.dev` và `tech@swiftletcare.dev`, đi qua mọi mục menu của hai role bằng Playwright ở 1440 × 900 (11 trang chuyên môn, 11 trang vận hành chỉ đọc của chuyên gia, 4 trang của kỹ thuật viên).

Phân công như `todo-audit-1121.md`: **backend và web do Bảo làm, mobile do Len làm**; trang `/domain-expert/*` và màn chuyên gia trên mobile là phần của Tuấn (Bảo sửa web và nhờ Tuấn xem PR); backend của kỹ thuật viên do Kiệt.

## 1. Kết quả

**Endpoint.** Web gọi đủ 112 route của Domain Expert. Farm Technician có 85 route (gồm route mọi người đăng nhập); web gọi đủ phần Report 4 §5.4 giao cho web (cảnh báo với xác nhận và nguyên nhân tại chỗ, thiết bị với khởi động lại và danh sách bài loa chỉ đọc, nhà được giao với ca trực, thông báo, cài đặt). Mobile thiếu phần nhỏ, ghi ở §2.

**Chức năng thiếu:**

| # | Vấn đề | Yêu cầu | Module |
|---|---|---|---|
| 1 | "Hàng đợi việc" chỉ liệt kê cảnh báo chờ kết luận; ba ô còn lại (thay đổi chờ duyệt, ngày lệch, báo cáo chờ kết luận) chỉ có số. Thiếu các việc chờ chuyên gia: đề xuất luật thời tiết, hồ sơ nháp chờ duyệt, luật khuyến nghị do Farm Owner viết, mùa vụ chờ kết luận, lời nhắc của Farm Owner. Phạm vi lẫn lộn: cảnh báo lọc theo Zone, báo cáo theo nhà, mục duyệt theo trại. Ô "Thay đổi chờ duyệt" ghi "ngưỡng & hệ số mờ" dù có 7 nhóm | Report 4 §5.4 (work queue), BR-22, EXPERT-FR-010, 015, 017, 022 | web |
| 2 | Thẻ duyệt lịch đếm hiện tên trường `default_windows` và "đã đổi"; bỏ khung riêng thì thẻ không hiện thay đổi | VISION-FR-019, FE_Design §6.4 | web (lỗi của #230) · **Xong** (#231) |
| 3 | Kỹ thuật viên trên mobile không xem được ca trực của mình (`GET …/roster` chưa gọi) | Report 3 §2.4 "read own roster" | mobile |
| 4 | Kỹ thuật viên trên mobile không xem khuyến nghị: app gọi `GET /recommendations?farmId` (403) thay vì theo `houseId` | Report 3 §2.4 (đọc khuyến nghị) | mobile |
| 5 | Màn vòng đếm mobile mới vẽ một vòng | VISION-FR-018 (Report 3 4.2.18) | mobile (đã ở G-16) |
| 6 | Hàng đợi mobile của chuyên gia chưa đủ 7 nhóm duyệt, bộ lọc Zone giấu mục của nhà và camera; trang Tài khoản của chuyên gia còn bản cơ bản | EXPERT-FR-010, Report 4 §5.4 | mobile (Tuấn) |
| 7 | `/alerts/{id}/evidence` và `/analytics/control/suggestion` chưa mở cho kỹ thuật viên ở nhà được giao | Report 3 §2.4 (đọc ngưỡng, hệ số) | backend (Kiệt, đã ghi ở `mobile/CLAUDE.md`) |

**Bố cục, trải nghiệm (web):**

| # | Trang | Vấn đề |
|---|---|---|
| 8 | Mọi trang chuyên gia | Thanh Trại / Nhà / Zone hiện cả trên trang không lọc theo Zone (hàng đợi, luật khuyến nghị, hồ sơ, lịch sử), ba ô đều mang chấm "!" cam |
| 9 | Trang có tab | Tiêu đề `h1` là tên nhóm ("Tham số điều khiển") thay vì tab đang mở (W-16 còn dở) |
| 10 | Vòng đếm | Khung video rộng hết trang, cao ~600 px; không có luồng thì là khối đen lớn, nút vẽ bị đẩy xuống dưới màn hình |
| 11 | Ngưỡng & hệ số mờ | Zone đang sửa chỉ là một dòng chữ nhỏ "Áp cho Zone …"; dòng "Kết luận trong kỳ · Mặc định (0/0)" khó hiểu |
| 12 | Báo cáo & kết luận | Chữ xám "Viết kết luận gửi Chủ nhà yến" nằm cạnh các tab, trông như một tab bị khoá |
| 13 | Bù thời tiết | Trống thì ghi "Thêm luật đầu tiên bên dưới" nhưng nút ở trên; không ghi luật của nhà nào |
| 14 | Thu hoạch (chuyên gia chỉ đọc) | Trống thì bảo "Bấm 'Ghi đợt thu hoạch'", chuyên gia không có nút đó |
| 15 | Công việc | Hai tầng tab lồng nhau (Bảo trì định kỳ → Cần bảo trì / Kế hoạch) |
| 16 | Nhà được giao (kỹ thuật viên) | Hai thẻ "Thiết bị online" và "Mất kết nối" nói cùng một việc (W-15 chưa làm) |

**Dữ liệu (#17):** Atlas còn dữ liệu của test E2E ("E2E hồ sơ …", "E2E luật tỷ lệ chim về"), hiện trên trang hồ sơ và luật khuyến nghị.

## 2. Quyết định

- **Kỹ thuật viên trên web giữ phạm vi Report 4 §5.4** (cảnh báo, thiết bị, nhà được giao, thông báo, cài đặt); phiếu công việc, chấm ngày, ghi thu hoạch, điều khiển tay ở mobile. Vì mobile chưa chạy trên máy thật (G-16), làm PR 6 sớm và thử trên điện thoại trước buổi demo. **Đổi ngày 23/11/2026:** web có đủ mọi việc của kỹ thuật viên (G-33, `todo-web-all-roles-1123.md`), nên quyết định này không còn áp dụng.

## 3. Thứ tự PR

| PR | Nhánh | Người | Nội dung | Phụ thuộc |
|---|---|---|---|---|
| 1 | `fix/web-review-default-windows` | Bảo | #2 và file này · **Xong** | — |
| 2 | `feat/web-expert-queue` | Bảo (Tuấn xem) | #1: hàng đợi theo trại, mỗi loại việc một nhóm có danh sách và nút mở trang xử lý | PR 1 |
| 3 | `fix/web-expert-layout` | Bảo (Tuấn xem) | #8…#15 | PR 2 |
| 4 | `fix/web-technician-farms` | Bảo | #16 (W-15) | — |
| 5 | mobile chuyên gia | Tuấn | #6 | — |
| 6 | mobile kỹ thuật viên | Len | #3, #4, #5 và M-15, M-16 của `todo-audit-1121.md` | — |
| 7 | backend kỹ thuật viên | Kiệt | #7 | — |
| 8 | `chore/e2e-data-cleanup` | Bảo | #17: xoá dữ liệu E2E trên Atlas, chặn chạy E2E khi `MONGODB_URI` trỏ lên Atlas | — |

Mỗi PR đánh dấu dòng của mình ở bảng §1 là xong và cập nhật `project-tracking.md` §6 khi đóng một gap.
