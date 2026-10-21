# Hồ sơ Review 2 — Report 1–5

Thư mục này chứa bản tiếng Anh của các Report nộp ở Review 2, theo "Hướng dẫn chuẩn bị Review 2" (SWP490, v1.0, 10/2026). Mỗi Report được xuất ra PDF theo mẫu Report của môn, tên file `SWP490_<Mã đề tài>_R2_Report<n>.pdf`.

| File | Report | Trạng thái |
| --- | --- | --- |
| `report3-srs.md` | Report 3 – SRS | Bản nháp 3.0.0, cần điền các chỗ `[TEAM: …]` |
| `report4-sdd.md` | Report 4 – SDD (kiến trúc, ERD, state machine, activity diagram, khai báo công nghệ) | Chưa có |
| `report5-test.md` | Report 5 – Test plan và test case | Chưa có |

## Report 3 – SRS: cách dùng

- File này **chỉ chứa yêu cầu**: actor, tiêu chí chấp nhận, NFR (chỉ số, ngưỡng, cách đo), vòng đời thực thể, truy vết tới phiếu đăng ký. Phần thiết kế (schema, API, MQTT, kiến trúc, môi trường) thuộc Report 4; tiến độ thuộc Project Tracking.
- Mã FR giữ nguyên như `SwiftletCare_SRS.md` để code, test và commit đang trỏ tới vẫn đúng.
- Phạm vi bám theo phiếu đăng ký **bản đề xuất chốt**, với giả định BM03 gồm các thay đổi: phiếu ghi "YOLO" không kèm phiên bản (phiên bản cụ thể khai báo trong Report 4); phát hiện thiên địch chuyển hẳn sang Out of scope; kênh ngoài ứng dụng cam kết **cả** push (FCM) và Telegram bot.
- Độ ưu tiên: `M` = thuộc luồng chính, là ứng viên cho tính năng bắt buộc của Defense 1.1; `S` = luồng phụ (ticket, tài khoản, lắp đặt), giữ chạy được nhưng không đề xuất làm tính năng bắt buộc, để số test case cam kết tập trung vào hệ thống tự động.

### Chỗ nhóm phải điền trước khi gắn tag `review-2`

1. Header: mã đề tài, GVHD, ngày, phiên bản phiếu.
2. NFR-08 (tỷ lệ tự động, % trong ngưỡng), NFR-09 (độ chính xác đếm chim, số clip), NFR-11 (MAE dự báo), NFR-12 (chi phí theo BOM hiện hành). Không có căn cứ thì đặt mức nhóm chắc chắn đo được, và ghi căn cứ vào `docs/evidence-register.md`.
3. Ngày ở bảng Revision History.

### Chỗ lệch phát hiện khi viết (nên xử lý hoặc đưa vào Known Gaps của Design Brief)

| # | Chỗ lệch | Ghi chú |
| --- | --- | --- |
| 1 | THREAT-FR-009: SRS cũ ghi mất heartbeat > 60 s; code đánh dấu OFFLINE sau 30 s (job quét mỗi 10 s) | SRS mới ghi theo code (BR-10) |
| 2 | Technician chỉ can thiệp tay khi đang được giao một ticket mở của farm đó, chỉ xác nhận cảnh báo gắn với ticket của mình; Admin không được cả hai (ENV-FR-016, ALERT-FR-009); route hiện cho cả `TECHNICIAN`, `ADMIN` (can thiệp tay) và `TECHNICIAN` không điều kiện (xác nhận) | Kiểm tra ticket được giao ở service; báo Farm Owner khi Technician can thiệp tay |
| 3 | `DeviceStatus` có `DEGRADED`, `ERROR` nhưng không chỗ nào trong code gán hai trạng thái này | Bỏ khỏi enum hoặc thêm luồng gán; state machine ở mục 6.6 chưa có hai trạng thái này |
| 4 | `HarvestStatus` có `ARCHIVED` nhưng code không gán | Tương tự mục 3 |
| 5 | Tạo mẻ thu hoạch không kiểm tra số tổ/khối lượng > 0 và ngày không ở tương lai | MARKET-FR-001 hiện ghi theo code; nên thêm validate rồi siết tiêu chí |
| 6 | `PREDATOR_DETECTED` còn trong `AlertType` và `TicketType` dù đã ra ngoài phạm vi | Chỉ được gỡ, không mở rộng |
| 7 | Đếm chim: **backend đã xong** (nhận số đếm, bản ghi theo House, số đếm 5 phút, `LOW_RETURN_RATE`, heartbeat nút AI, token live stream, vòng đếm). Còn thiếu: nút AI chạy thật (`stream.py` chưa gửi heartbeat nên backend chưa gửi lại vòng đếm khi nút AI kết nối lại, chưa đo FPS), màn xem live/vẽ vòng/số đếm ở web và mobile, VISION-FR-016 đánh giá độ chính xác | VISION-FR-001…005, 007, 012…014, 016, 018 (phần giao diện), THREAT-FR-010 (đo FPS) |
| 8 | ENV-FR-023 công tắc bypass chưa làm (phần cứng) | |
| 9 | Giao diện Domain Expert (web/mobile) chưa có; backend EXPERT-FR đã xong | |
| 10 | `docs/hardware/BOM.md` đã lỗi thời (5.410.000 VNĐ, linh kiện cũ) trong khi SRS cũ ghi COST-NFR-001 ≤ 10.105.000 VNĐ | Cập nhật BOM trước khi điền NFR-12 |
| 11 | `docs/evidence-register.md` chưa điền nguồn | BR-01 ghi "nguồn từ tài liệu" nhưng chưa có minh chứng |
| 12 | ALERT-FR-002 (FCM) giờ là bắt buộc nhưng backend mới chỉ ghi log, mobile chưa đăng ký FCM token | Cần nối Firebase thật ở backend và đăng ký/huỷ token ở `mobile/` |
| 13 | Hạn can thiệp tay tính theo **thiết bị**, không theo từng relay (cả backend `override_expiry` lẫn firmware `overrideExpiryMs`): bật tay relay thứ hai làm hạn của relay thứ nhất chạy lại từ đầu, huỷ sớm thì mọi relay về AUTO | SRS mới ghi đúng hành vi này thành BR-20; nếu nhóm muốn hạn riêng từng relay thì phải sửa cả hai phía |
| 14 | `CLAUDE.md` mục AI pipeline vẫn ghi `counting.py` đếm qua vạch (line-crossing), code đã đổi sang vòng đếm | Sửa một dòng trong `CLAUDE.md` |
| 15 | Sửa và reset ngưỡng Zone, sửa hệ số mờ: SRS mới chỉ cho Farm Owner và Domain Expert của farm (ENV-FR-006, 020, 021); các route `PUT /farms/zones/:zoneId/thresholds`, `.../thresholds/reset`, `PUT /farms/zones/:zoneId/fuzzy-tuning` và `PUT /devices/sensor-nodes/:id/thresholds` còn cho `TECHNICIAN`, `ADMIN`; web Technician còn `ThresholdsModal` | Sửa `requireRole`, `api-spec.yaml`, test; gỡ chỗ sửa ngưỡng ở giao diện Technician |
| 16 | Admin đổi ngưỡng mặc định chưa phải ghi nguồn (ENV-FR-007); chưa có thông báo cho chuyên gia khi mặc định đổi (ENV-FR-026, Optional) | Thêm trường nguồn vào `PUT /system/settings/default-thresholds` |
| 17 | Farm chưa có chuyên gia thì Farm Owner quyết thay (BR-22): route kết luận cảnh báo, tham số phát hiện, mức giảm tỷ lệ chim về và vòng đếm hiện chỉ cho `DOMAIN_EXPERT`; thông báo cảnh báo suy luận chưa chuyển cho Farm Owner khi farm không có chuyên gia | Thêm kiểm tra "farm có Domain Expert chưa" ở service, kèm test |
| 18 | EXPERT-FR-009: hiện chỉ kết luận của chuyên gia mới báo Farm Owner; sửa ngưỡng, hệ số mờ, tham số phát hiện, mức giảm tỷ lệ chim về, vòng đếm và kết luận cảnh báo chưa báo gì; lịch sử nằm rải rác theo từng loại (`threshold_history`, `fuzzy_tuning_history`, …), chưa có một danh sách chung | Gọi `notifyUser` cho các Farm Owner ở từng service; thêm endpoint lịch sử hoạt động của chuyên gia (có thể đọc từ `audit_logs` lọc theo farm và role `DOMAIN_EXPERT`) |
| 19 | Trạng thái `DISMISSED` khi bác bỏ (EXPERT-FR-003, mục 6.1): code hiện không đổi trạng thái khi có kết luận, ghi chú không bắt buộc, chưa lưu trạng thái trước khi bác bỏ, báo cáo sức khỏe chưa tách cảnh báo đã bác bỏ | Thêm `DISMISSED` vào `AlertStatus` ở backend, `frontend/src/types/`, `mobile/types/` cùng một PR; gộp trùng và tự đóng tính cả `DISMISSED`; lưu trạng thái trước để khôi phục khi đổi sang `CONFIRMED`; bắt buộc ghi chú khi `REJECTED` |
| 20 | Lịch đếm theo mùa (VISION-FR-019): khung giờ phiên đang cố định trong `ai-pipeline/config/config.yaml`, job so tỷ lệ cố định 19:15; phiên đang do pipeline cộng dồn chứ không tính từ số đếm 5 phút | Lưu lịch theo House; backend tính phiên từ `bird_count_buckets` theo khung của ngày; job chạy theo giờ kết thúc phiên chiều |
| 21 | EXPERT-FR-010 (chuyên gia xem lại thay đổi của Farm Owner) và EXPERT-FR-011 (chỉ chuyên gia áp gợi ý hệ số): chưa có | Thêm thực thể review item và proposal (state machine mục 6.10, 6.11), route accept/revert/approve/reject, thông báo hai chiều; route áp gợi ý hiện ai có quyền sửa hệ số cũng dùng được |
| 22 | ENV-FR-027 đồng bộ cấu hình: chưa có version cấu hình, heartbeat chưa báo version, chưa có loại cảnh báo `CONFIG_MISMATCH` | Firmware gửi version trong heartbeat; backend tăng version mỗi lần đổi, gửi lại khi lệch; thêm `CONFIG_MISMATCH` vào `AlertType` ở backend, frontend, mobile; mốc 3 heartbeat (BR-24) ghi vào danh sách giả định của SRS cũ §0.5 |
| 23 | ALERT-FR-014 gói bằng chứng: dữ liệu đã có (telemetry, số đếm 5 phút, cảnh báo) nhưng chưa có endpoint gom theo cảnh báo | Thêm endpoint đọc bằng chứng của một cảnh báo suy luận |
| 24 | VISION-FR-020 phiên không đầy đủ: job so tỷ lệ chim về chưa xét nút AI offline trong phiên | Đánh dấu phiên theo cảnh báo `EDGE_AI_DEGRADED` mở trong khung giờ; loại ngày không đầy đủ khỏi so sánh và nền |

### Trước khi chạy prompt tự rà soát (BM02)

Repo không nên có hai tài liệu cùng được gọi là SRS. Khi Report 3 đã chốt, chuyển `SwiftletCare_SRS.md` sang `docs/archive/` (hoặc ghi rõ ở đầu file là ghi chú nội bộ) và cập nhật các chỗ `CLAUDE.md` đang trỏ tới nó.
