# Chủ nhà yến quyết, chuyên gia duyệt (21/11/2026)

Khi soát giao diện của Farm Owner, nhóm thấy trên farm có Domain Expert rất nhiều trang chuyên môn chỉ cho xem: chủ không chỉnh được tham số phát hiện, vòng đếm, lịch đếm, mức chỉ số sức khoẻ, luật thời tiết, hồ sơ cấu hình hay luật khuyến nghị (BR-22 cũ: "từ khi có chuyên gia, các quyết định này là của chuyên gia"). Chủ nhà yến là người chịu trách nhiệm với trang trại của mình, chuyên gia là người tư vấn. Vì vậy **nhóm chốt ngày 21/11/2026 (Bảo, trưởng nhóm)** đổi BR-22 theo ba nhóm quyết định dưới đây. Đây là gap **G-31** trong `project-tracking.md` §6.

Đơn đăng ký v3 (Flow 5) đã ghi đúng hướng này: thay đổi của Farm Owner với ngưỡng, hệ số điều khiển, tham số phát hiện, vòng đếm và lịch đếm "applied at once and opening a review item that the Domain Expert accepts, adjusts or reverts"; gợi ý hệ số của hệ thống "applied only when the Domain Expert approves it"; luật bù thời tiết là "approved by the Domain Expert". Report 3 4.2.14 chặt hơn đơn, nên chỉ Report 3 phải sửa cho khớp đơn. Không cần dòng BM03.

## 1. Ba nhóm quyết định

| Nhóm | Quyết định | Farm có chuyên gia | Farm chưa có chuyên gia |
|---|---|---|---|
| **A. Chủ làm ngay, chuyên gia duyệt sau** | Ngưỡng, hệ số mờ (EXPERT-FR-010, đã có) · 5 tham số phát hiện của Zone (EXPERT-FR-008) · mức giảm tỷ lệ chim về của nhà · mức chỉ số sức khoẻ của nhà và xem ngày lệch (EXPERT-FR-022) · vòng đếm camera (VISION-FR-018) · lịch đếm (VISION-FR-019) | Áp ngay, mở mục duyệt `PENDING_REVIEW`, báo chuyên gia trong ứng dụng; chuyên gia giữ, hoàn tác hoặc chỉnh lại (§6.10) | Như cũ: chủ áp, không có mục duyệt |
| **B. Chủ đề xuất, chuyên gia duyệt rồi mới có hiệu lực** | Luật bù thời tiết (ENV-FR-030, BR-38) · hồ sơ cấu hình (EXPERT-FR-014) · luật khuyến nghị (EXPERT-FR-016) · gợi ý hệ số của hệ thống (EXPERT-FR-011, đã có) | Chủ soạn và gửi; chỉ có hiệu lực khi chuyên gia duyệt; chuyên gia từ chối phải ghi lý do; chủ được báo kết quả | Chủ đặt luật thời tiết, bật luật khuyến nghị và áp gợi ý trực tiếp; hồ sơ cấu hình vẫn cần chuyên gia duyệt (như hiện nay) |
| **C. Chỉ chuyên gia** | Kết luận cảnh báo suy luận (EXPERT-FR-003) · kết luận báo cáo sức khoẻ và mùa vụ | Chủ xem và có nút **"Nhắc chuyên gia"** (mỗi việc nhắc được một lần) | Kết luận cảnh báo: chủ làm (BR-22); kết luận báo cáo, mùa vụ: không ai viết (như cũ) |

Lý do giữ nhóm B và C:

- **Luật thời tiết** tự đổi lượng phun sương khi không có người (BR-38 ghi rõ luật phải được chuyên gia duyệt). **Hồ sơ cấu hình** và **luật khuyến nghị** áp cho nhiều nhà, sai thì lan rộng. **Gợi ý hệ số** do máy tính ra, cần người có chuyên môn kiểm; chủ vẫn tự gõ hệ số được (nhóm A).
- **Kết luận cảnh báo suy luận** (MF-04) có giá trị vì người kết luận độc lập với người vận hành: chủ bác bỏ thì cảnh báo thành `DISMISSED` và rời danh sách đang có hiệu lực, tức là sự cố bị che, và tỷ lệ xác nhận dùng để hiệu chỉnh phát hiện bị lệch. Chủ vẫn xử lý sự cố bình thường (xác nhận, phiếu việc). **Kết luận báo cáo** là ý kiến chuyên môn.

## 2. Backend (Bảo)

| ID | File | Việc | Xong khi |
|---|---|---|---|
| B-01 | `models/parameterReview.model.ts` | Nhóm mới: `detection`, `return_rate_drop`, `health_levels`, `counting_ring`, `counting_schedule`. Thêm `target_id` (Zone, nhà hoặc camera của nhóm), `house_id`, `camera_node_id`; `zone_id` chỉ bắt buộc với nhóm theo Zone. Chỉ mục duy nhất `{ target_id, group }` khi `PENDING_REVIEW` thay cho `{ zone_id, group }` | Mỗi đối tượng và nhóm chỉ có một mục đang chờ |
| B-02 | `scripts/migrate-review-targets.script.ts`, `package.json` | `npm run migrate:review-targets`: điền `target_id`, `house_id` cho mục cũ, xoá chỉ mục cũ `zone_id_1_group_1` | Chạy hai lần không lỗi |
| B-03 | `services/parameterReview.service.ts` | `trackParameterChange` nhận đối tượng `{ farm, zone? , house?, camera? , name }`; nhãn nhóm mới trong thông báo cho chuyên gia | Chủ đổi nhóm A trên farm có chuyên gia thì mở mục và báo chuyên gia |
| B-04 | `services/farm.service.ts` (tham số phát hiện, mức giảm tỷ lệ chim về, mức chỉ số sức khoẻ), `countingSchedule.service.ts`, `device.service.ts` (vòng đếm), `healthDay.service.ts` (ngày lệch) | Bỏ `assertExpertDecision` (route đã giới hạn vai trò; vòng đếm vẫn cho thợ của nhà); gọi `trackParameterChange` sau khi lưu; thêm tuỳ chọn `fromReview` để lần hoàn tác không báo trùng và không vào lịch sử hai lần (`decided_in`) | Chủ trên farm có chuyên gia: 200, có mục duyệt |
| B-05 | `services/expertReview.service.ts` | Hoàn tác theo nhóm: áp lại `old_values` bằng chính hàm cập nhật của nhóm với vai trò chuyên gia; vòng đếm không có vòng cũ thì 409 (chuyên gia chỉnh lại thay vì hoàn tác) | Hoàn tác trả đúng giá trị cũ và gửi lại thiết bị |
| B-06 | `models/house.model.ts`, `services/weatherCompensation.service.ts`, `routes/farms.route.ts` | Luật thời tiết: chủ trên farm có chuyên gia gửi bộ luật → lưu `weather_rules_proposal` (một đề xuất mỗi nhà, gửi lại thì thay), báo chuyên gia; `POST …/weather-rules/proposal/approve` áp và báo chủ; `…/reject` cần lý do | Luật chỉ chạy sau khi duyệt |
| B-07 | `routes/profiles.route.ts`, `services/configProfile.service.ts` | Chủ tạo và sửa hồ sơ `DRAFT`; tạo xong báo chuyên gia; duyệt và lưu trữ vẫn chỉ chuyên gia | Chủ tạo được bản nháp, không duyệt được |
| B-08 | `routes/recommendations.route.ts`, `services/recommendation.service.ts` | Chủ viết luật: farm có chuyên gia thì luật lưu tắt (`active: false`, `proposed_by`) và báo chuyên gia; chuyên gia bật là duyệt. Farm chưa có chuyên gia thì chủ bật được | Luật của chủ không chạy khi chưa được bật |
| B-09 | `routes/expertActivity.route.ts`, service mới `expertReminder` | `POST /expert-activity/reminders { kind: alert \| health_report \| harvest_cycle, id }`: chủ nhắc chuyên gia việc nhóm C còn chờ; mỗi việc nhắc một lần (`expert_reminded_at`), farm không có chuyên gia → 409 | Chuyên gia nhận một thông báo |
| B-10 | `services/expertActivity.service.ts` | Bỏ `BR22_ACTIONS` khỏi luật "chỉ khi chưa có chuyên gia" của nhóm A; lịch sử vẫn liệt kê quyết định của chuyên gia và mục duyệt | Như EXPERT-FR-009 mới |
| B-11 | `docs/api/api-spec.yaml` | Bỏ 403 của chủ ở nhóm A; route đề xuất luật thời tiết, nhắc chuyên gia; `ParameterReview` có nhóm và trường mới | Spec khớp code |
| B-12 | `tests/integration/*` | Sửa các test đang kiểm "chủ 403 khi có chuyên gia" của nhóm A; test mới cho mục duyệt từng nhóm, hoàn tác, đề xuất luật thời tiết, luật khuyến nghị của chủ, nhắc chuyên gia. Giữ tên test mà `report5/tc.py` trỏ tới, đổi thì sửa `tc.py` | `npm test` xanh |

## 3. Web

Trang chuyên gia `/domain-expert/*` là phần của Tuấn; Bảo sửa theo yêu cầu của nhóm và nhờ Tuấn xem PR.

| ID | Trang | Việc |
|---|---|---|
| W-01 | `hooks/domain-expert/expertDecisionRights.ts` | Thêm `ownerWithReview` (chủ trên farm có chuyên gia, nhóm A) và `ownerProposes` (nhóm B); `canDecide` chỉ còn cho nhóm C |
| W-02 | Tham số phát hiện, mức giảm tỷ lệ chim về, vòng đếm, lịch đếm, mức chỉ số sức khoẻ và ngày lệch | Chủ sửa được; dòng nhắc "Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại" |
| W-03 | Luật thời tiết | Chủ trên farm có chuyên gia: nút "Gửi chuyên gia duyệt", hiện đề xuất đang chờ; chuyên gia thấy đề xuất, duyệt hoặc từ chối có lý do |
| W-04 | Hồ sơ cấu hình, luật khuyến nghị | Chủ tạo bản nháp hoặc luật (tắt); nhãn "Chờ chuyên gia duyệt" |
| W-05 | Kiểm chứng cảnh báo, báo cáo sức khoẻ, mùa vụ | Nút "Nhắc chuyên gia" cho chủ khi việc còn chờ |
| W-06 | Mục duyệt | Nhóm mới hiện đúng tên (Zone, nhà, camera) và giá trị cũ → mới |

## 4. Tài liệu

- **Report 3 → 4.2.15:** BR-22 viết lại theo ba nhóm; bảng §2.4; EXPERT-FR-003 (nhắc), 008, 009, 010 (mở rộng nhóm), 014, 016, 022; VISION-FR-018, 019; ENV-FR-030; §6.10 (nhóm mới) và trạng thái đề xuất luật thời tiết; changelog.
- **Report 4 → 2.2.19**, `api-spec.yaml`, Design Brief (kịch bản DS liên quan), `project-tracking.md` (G-31), Report 5 (`tc.py`) nếu tên test đổi.

## 5. Thứ tự PR

| PR | Nhánh | Nội dung |
|---|---|---|
| 1 | `feat/owner-decides-expert-reviews` | File này, tài liệu, backend, test, api-spec |
| 2 | `feat/web-owner-decides` | Web W-01…W-06 |
| — | Len (mobile) | Mobile đọc thêm các nhóm mục duyệt và loại thông báo mới; chỉ đọc, không chặn PR 1, 2 |
