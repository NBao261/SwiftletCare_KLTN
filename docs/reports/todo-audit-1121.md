# Rà soát backend, web, mobile theo Report 3 4.2.15 và Report 4 2.2.20 (21/11/2026)

Rà trên `develop` tại `4ad70245` (sau #214 và #198), hai lượt. Đây là gap **G-32** trong `project-tracking.md` §6.

- **Lượt 1, theo yêu cầu:** đối chiếu từng FR, BR và bảng quyền §2.4 của Report 3 với route, service và màn hình; so tự động route backend với `docs/api/api-spec.yaml` (khớp 185/185); liệt kê endpoint trong spec mà web hoặc mobile chưa gọi.
- **Lượt 2, luồng nghiệp vụ, code thừa và UI/UX:** đọc các luật trong service (mức cảnh báo, định tuyến, Work Order tự mở, kiểm tra tại chỗ, đổi mật khẩu lần đầu); tìm file không ai import; chạy backend (MongoDB Atlas, không có broker) và web với dữ liệu seed, đi qua mọi mục menu của 4 role bằng Playwright ở 1440 × 900 và 390 × 844 (lỗi HTTP, lỗi console, enum thô, chữ `undefined`/`NaN`, tràn ngang) và chụp các màn chính. Kết quả chung: không có lỗi HTTP hay console, không lộ enum thô, không tràn ngang ở 390 px. Mobile chỉ rà tĩnh, chưa chạy trên máy (M-13).

Phân công: **backend, web và firmware do Bảo làm, mobile do Len làm** (theo `todo-review2.md` §0.2). Trang `/domain-expert/*` là phần của Tuấn: Bảo sửa và nhờ Tuấn xem PR. Việc mobile nào cần backend chưa merge thì chờ (cột "Chờ").

## 1. Những gì còn thiếu hoặc lệch

| # | Vấn đề | Yêu cầu | Module | Đã có trong tracking? |
|---|---|---|---|---|
| 1 | Không sửa hoặc xoá được nhà và Zone: backend, spec chỉ có tạo và đọc; mobile để nút "Sắp có" | FARM-FR-002, 011 | backend, web, mobile, spec | Chưa |
| 2 | Nguyên nhân tìm thấy tại chỗ không được đếm theo loại trong so sánh nhà; BR-44 cũng không liệt kê cột này | ALERT-FR-018, BR-44 | backend, web, Report 3 | Chưa |
| 3 | Mobile vẫn che trạng thái ngày đến khi người dùng chấm (BR-31 cũ) | BR-31 (4.2.14), EXPERT-FR-012 | mobile | Chỉ ở changelog 20/11, không có dòng gap |
| 4 | Enum nhóm mục duyệt: backend 7 nhóm, web và mobile chỉ `thresholds`, `fuzzy` | EXPERT-FR-010, §6.10; luật shared enum | web, mobile | Chưa (G-31 chỉ ghi "mobile đọc nhóm mới") |
| 5 | Enum `Notification.ref.kind`: backend 12 loại, web và mobile 8 (thiếu `weather_rules`, `config_profile`, `recommendation_rule`, `harvest_cycle`) | EXPERT-FR-007, 009 | web, mobile | Chưa |
| 6 | Farm Owner trên farm có chuyên gia vẫn bị khoá ở nhóm A và B của BR-22 (tham số phát hiện, mức giảm tỷ lệ chim về, lịch đếm, vòng đếm, luật thời tiết, hồ sơ, luật khuyến nghị); chưa gọi `weather-rules/proposal…` và `/expert-activity/reminders` | BR-22 (4.2.15) | web, mobile | G-31 (web: `todo-owner-expert-1121.md` §3) |
| 7 | Mọi role đặt được giờ im lặng và kênh ngoài ứng dụng; §2.4 chỉ cho Farm Owner đặt giờ im lặng, Domain Expert và Admin không chọn kênh | ALERT-FR-005, 006; §2.4 ghi chú ⁴ | backend, mobile | Chưa |
| 8 | Mobile chưa có ảnh thu hoạch, thời tiết ngoài trời cạnh số liệu trong nhà, nút khôi phục mặc định của tham số phát hiện và mức giảm tỷ lệ chim về | G-14, ANALYTICS-FR-013, EXPERT-FR-008 | mobile | G-16 (một phần) |
| 9 | Code thừa trên mobile: `constants/mockApi.ts`, `components/common/MockDataBadge.tsx`, `components/layout/PlaceholderScreen.tsx` không còn ai import (Report 4 §5.4: không dữ liệu mẫu); khối "Mốc cảnh báo tỷ lệ về tổ thấp theo ngày" không có trong yêu cầu | Report 4 §5.4; BR-16 | mobile | Chưa |
| 10 | Tài liệu tự mâu thuẫn (Report 4 §5.4 về bản đồ, VISION-FR-012/013 về Farm Technician, §6.1 về người xác nhận, `CLAUDE.md` gốc mô tả mobile đã cũ) | — | docs | Chưa (sửa trong PR 1) |
| 11 | **Mức cảnh báo do thiết bị gửi đè lên BR-15.** `createAlert` lấy `severity` của tin MQTT nếu có (chỉ hạ các loại suy luận xuống MEDIUM). Firmware gửi `SPEAKER_FAILURE` là `CRITICAL` (BR-15: HIGH), nên cảnh báo này tới Farm Owner ngay cùng lúc với thợ, vượt giờ im lặng và được gửi lại sau 15 phút như một sự cố nghiêm trọng nhất | ALERT-FR-001, 006, 017, BR-15, BR-40 | backend, firmware | Chưa |
| 12 | Trang cảnh báo web chỉ lọc theo trạng thái và cấp; không lọc theo trang trại, nhà, Zone, loại cảnh báo hay kết luận chuyên gia, và không có bộ lọc phạm vi ở đầu trang như các trang khác | ALERT-FR-007 | web | Chưa |
| 13 | `GET /alerts` chỉ nhận một mức; web lọc cấp "Khẩn cấp" (CRITICAL + HIGH) bằng hai lần gọi rồi ghép, nên phân trang sai từ trang 6 trở đi (trần 100 dòng mỗi lần gọi) | ALERT-FR-007 | web | Chưa (hết khi hiện bốn cấp, Q-07) |
| 14 | Web và mobile gộp CRITICAL và HIGH thành một cấp "Khẩn cấp" và gọi MEDIUM là "Cao": người dùng không phân biệt được cảnh báo CRITICAL (tới cả chủ ngay, vượt giờ im lặng) với HIGH, trong khi màn cài đặt thông báo chọn kênh theo đủ 4 mức | ALERT-FR-001, 005, 006, BR-15 | web, mobile, FE_Design 2.4 | Chưa |
| 15 | Kỹ thuật viên trên web: thẻ "Nhà cần xử lý" ghi "Không có cảnh báo" trong khi danh sách cảnh báo của chính người đó có 3 cảnh báo đang mở (số đếm lấy từ cấu trúc nhà, không từ `GET /alerts?open=true`); các câu trên trang viết cứng tiếng Việt nên không đổi khi bấm EN | ALERT-FR-007; FE_Design §6 | web | Chưa |
| 16 | Cùng một trang mang tên khác nhau theo role: "Đàn chim" / "Giám sát đàn chim", "Sức khoẻ & báo cáo" / "Sức khoẻ nhà yến", "Thiết bị" / "Thiết bị & Cảm biến", "Công việc" / "Phiếu công việc", "Thu hoạch" / "Thống kê sản lượng", "So sánh nhà" / "Tổng quan trang trại"; Farm Owner vào tab nào của "Chuyên môn" tiêu đề cũng là "Chuyên môn" | FE_Design §6.2 | web | Chưa |
| 17 | Trang Đàn chim: số chim ra, chim về, tỷ lệ về hiện hai lần trên cùng màn (dưới khung camera và ở ba thẻ bên phải), nhãn bị cắt ("Chim ra hôm nay (sán…"); hiện tên mô hình kỹ thuật ("vyolov8n-swiftlet…") và chữ "AI Vision" cho chủ nhà yến; trục biểu đồ số lượt có số lẻ 0,2 … 1,0 khi chưa có dữ liệu | VISION-FR-012; FE_Design §6.4 | web | Chưa |
| 18 | Số liệu dễ hiểu sai: dải trên các trang chuyên gia ghi "100% Tự động" khi mọi thiết bị đang mất kết nối; thẻ kiểm chứng in "00"; câu phụ "Hệ thống suy luận chính xác", "Nhiễu hoặc dao động tự nhiên" kết luận thay chuyên gia; hàng đợi chuyên gia dùng chữ "Cần ký duyệt", "Đã ban hành", "3 phân hệ quản lý" | ANALYTICS-FR-011, EXPERT-FR-003, 006; FE_Design §6.4 | web | Chưa |
| 19 | Phân tích, tab Môi trường: khi đang chọn "Tất cả Zone" chỉ thấy bảng so sánh, không có biểu đồ theo thời gian và không có lời nhắc chọn một Zone | ANALYTICS-FR-001 | web | Chưa |
| 20 | Mobile: Farm Technician không có tab "Công việc"; Work Order và bảo trì chỉ mở được từ thẻ ở Trang chủ, trong khi Report 4 §5.4 coi mobile là công cụ chính của thợ (cảnh báo, Work Order, checklist, bảo trì) | OPS-FR-002, 007, 008; Report 4 §5.4 | mobile | Chưa |
| 21 | Backend tạo cảnh báo theo kiểu tìm rồi tạo, không nguyên tử: hai tin cùng sự cố tới cùng lúc có thể ra hai cảnh báo (code đã ghi `ponytail:`) | ALERT-FR-008 | backend | Chưa |
| 22 | Đường đọc báo cáo sức khoẻ theo Zone cũ (`healthReport.service.ts`, `zoneHealthReport.model.ts`, nhánh dự phòng trong `houseHealthReport.service.ts`) vẫn còn dù job đã bỏ từ 18/11; Report 4 §6.4 ghi đã có migration chuyển báo cáo Zone sang báo cáo nhà, nhưng `package.json` không có script nào như vậy | EXPERT-FR-005, BR-36; Report 4 §6.4 | backend | Chưa |
| 23 | Report 4 §5.3 liệt kê job `healthAssessment`, `healthReport`, `runHours` không có trong code (code chạy trong `returnRate`, `houseHealthReport`, `relayUsage`) và thiếu job `cameraConfig` | Report 4 §5.3 | docs | Chưa |

## 2. Quyết định

### 2.1 Đã chốt (Bảo, 21/11/2026)

Đã ghi vào Report 3 4.2.16 và Report 4 2.2.21 trong PR của file này.

| ID | Câu hỏi | Quyết định |
|---|---|---|
| Q-01 | Xoá nhà hoặc Zone khi còn thiết bị đang dùng? | Không cho: 409 `HAS_ACTIVE_DEVICES`, chủ phải gỡ thiết bị trước (FARM-FR-008). Xoá mềm (`is_deleted`), lịch sử giữ nguyên. Xoá nhà thì xoá luôn các Zone của nó |
| Q-02 | Ai được xoá nhà, Zone? | Farm Owner (như FARM-FR-002), không bắt Primary Owner. Domain Expert, Farm Technician, Admin: 403 |
| Q-03 | Sửa số tầng của nhà xuống thấp hơn tầng của một Zone? | Từ chối 400, giống quy tắc tạo Zone |
| Q-04 | ALERT-FR-018 hay BR-44 đúng? | Giữ ALERT-FR-018: thêm cột "Nguyên nhân tại chỗ" (số lần theo từng loại) vào BR-44, không dùng để sắp xếp, không tính điểm |
| Q-05 | Farm Technician có chọn kênh ngoài ứng dụng không? | Có (§2.4 ✓), nhưng không đặt giờ im lặng. Domain Expert và Admin: không chọn kênh, không đặt giờ im lặng (403) |

Các quy tắc 409 và 400 ở Q-01, Q-03 đã vào tiêu chí chấp nhận của FARM-FR-002. Q-05 không đổi tài liệu: §2.4, ALERT-FR-005, 006 đã ghi như vậy, chỉ code chưa theo.

### 2.2 Chốt sau lượt rà thứ hai (Bảo, 21/11/2026)

Chọn theo luồng nghiệp vụ của Report 3; không đổi yêu cầu nào của Report 3. Tài liệu thiết kế đi cùng PR code (D-06, D-07).

| ID | Câu hỏi | Quyết định | Lý do theo nghiệp vụ |
|---|---|---|---|
| Q-06 | Mức cảnh báo có lấy theo tin của thiết bị không? (#11) | **Không.** Backend là nơi duy nhất đặt mức: luôn `DEFAULT_SEVERITY[type]` theo BR-15, bỏ qua `severity` trong tin MQTT. Firmware vẫn gửi trường này (tương thích ngược, dễ đọc log) nhưng gửi đúng BR-15 | ALERT-FR-001 ghi mỗi loại có đúng một mức. Mức quyết định ai nhận và khi nào: CRITICAL tới cả Farm Owner ngay (ALERT-FR-017), vượt giờ im lặng (ALERT-FR-006), CRITICAL và HIGH được gửi lại sau 15 phút (ALERT-FR-015). Một thiết bị không được tự nâng tầm quan trọng của cảnh báo của chính nó; đổi mức của một loại chỉ cần cập nhật backend, không phải nạp lại firmware cho mọi bộ điều khiển |
| Q-07 | Hiện mấy cấp cảnh báo trên web và mobile? (#14) | **Bốn cấp đúng BR-15**: "Khẩn cấp" (CRITICAL), "Cao" (HIGH), "Trung bình" (MEDIUM), "Thấp" (LOW), mỗi cấp một màu theo token; bộ lọc, dải đếm và badge đều theo bốn cấp. FE_Design 2.4 và `MOBILE_GUIDE.md` sửa theo | Mỗi cấp có hành vi riêng mà người dùng cần thấy: CRITICAL tới cả chủ và thợ ngay, vượt giờ im lặng; HIGH tới thợ trước, lên chủ sau 15 phút; MEDIUM không gửi lại; LOW là thông tin (dự báo, đến hạn bảo trì, tỷ lệ về). Màn cài đặt thông báo đã chọn kênh theo đủ bốn mức (ALERT-FR-005), nên danh sách phải nói cùng ngôn ngữ đó. Lý do gộp ba cấp lúc trước là dùng chung với ưu tiên ticket, mà ticket đã bị bỏ (BM03 dòng 9) |
| Q-08 | Xử lý báo cáo sức khoẻ theo Zone cũ thế nào? (#22) | **Chuyển rồi mới xoá.** Viết migration mà Report 4 §6.4 đã thiết kế nhưng code chưa có: `npm run migrate:zone-reports` gộp mỗi báo cáo tuần của Zone vào báo cáo nhà `WEEKLY` cùng kỳ, thành một phần theo Zone, giữ nguyên kết luận chuyên gia (người viết, thời gian, lần sửa); chạy lại không nhân đôi. Sau đó xoá service, model, nhánh dự phòng và collection khỏi database script | BR-36 giữ báo cáo sức khoẻ suốt đời cài đặt, và kết luận là việc của người (EXPERT-FR-006), nên không được xoá dữ liệu cũ. Một đường đọc duy nhất (báo cáo nhà, EXPERT-FR-005) thì màn hình, PDF và quyền đọc chỉ phải đúng ở một chỗ |

Hệ quả: với bốn cấp, mỗi lựa chọn trong bộ lọc là đúng một mức, nên `GET /alerts` không cần nhận danh sách mức nữa (B-11 bỏ); web chỉ cần bỏ nhánh gọi nhiều lần rồi ghép (W-13).

## 3. Backend và firmware (Bảo)

| ID | File | Việc | Xong khi |
|---|---|---|---|
| B-01 | `models/houseZone.model.ts` | House và Zone thêm `is_deleted` (mặc định `false`), `deleted_at`, `deleted_by`; chỉ mục tên duy nhất chỉ tính bản chưa xoá | Tạo lại nhà trùng tên với nhà đã xoá được. **Xong** trên `feat/g32-house-zone-edit-delete`: dùng `applySoftDeleteScope` như Farm, thêm hook `distinct` |
| B-02 | `routes/farms.route.ts`, `controllers/farms.controller.ts`, `services/farm.service.ts` | `PUT /farms/houses/{houseId}` (`name`, `floors`, `description`) và `PUT /farms/zones/{zoneId}` (`name`, `floor`): chỉ `FARM_OWNER`; tên ≤ 50 ký tự (422), trùng tên 409 `DUPLICATE_NAME`, `floors` 1–10 và không thấp hơn tầng cao nhất của các Zone (400, Q-03), `floor` của Zone không vượt số tầng của nhà (400); ghi audit cũ → mới | Test 200, 400, 403, 409, 422. **Xong** trên `feat/g32-house-zone-edit-delete` |
| B-03 | cùng file | `DELETE /farms/houses/{houseId}`, `DELETE /farms/zones/{zoneId}`: chỉ `FARM_OWNER`; còn bộ điều khiển hoặc camera chưa `DECOMMISSIONED` thì 409 `HAS_ACTIVE_DEVICES` (Q-01); xoá mềm; đóng cảnh báo đang mở (như `softDeleteFarm`), huỷ Work Order đang mở có lý do, đưa kế hoạch bảo trì của nhà về `RETIRED`, bỏ thợ khỏi nhà; ghi audit | Telemetry, lượt đếm, báo cáo, thu hoạch cũ vẫn còn trong cơ sở dữ liệu. **Xong** trên `feat/g32-house-zone-edit-delete` (thợ vẫn gắn trong bản ghi nhà nhưng nhà đã ẩn nên không còn tới được) |
| B-04 | `utils/farmAccess.util.ts` và các nơi gọi `House.find`, `Zone.find` (22 file) | Bỏ nhà, Zone đã xoá khỏi: `listHouses`, `listZones`, `listActiveHouseIds`, các job (`returnRate`, `houseHealthReport`, `weatherCompensation`, `maintenanceDue`, `relayUsage`, `cameraConfig`, recommendation), tổng quan và so sánh nhà; đăng ký hoặc chuyển thiết bị vào Zone đã xoá: 404; mã tầng của Zone đã xoá: 404 (FARM-FR-011) | Sau khi xoá, không job nào chạy trên nhà đó. **Xong** trên `feat/g32-house-zone-edit-delete`: hook xoá mềm của model lo mọi truy vấn, không phải sửa từng file |
| B-05 | `services/houseComparison.service.ts`, `controllers/farms.controller.ts` | `GET /farms/{id}/comparison` thêm `site_causes: Record<SiteCause, number>` mỗi nhà trong kỳ: đếm `alerts.site_cause.cause` và `workOrders.cause`, mỗi cảnh báo chỉ một lần (lấy nguyên nhân của Work Order nếu có, không thì của cảnh báo); không có trong `COMPARISON_SORT_KEYS` (Q-04) | Test seed: 2 `NOZZLE`, 1 `PUMP` ra đúng số |
| B-06 | `services/auth.service.ts` (`updateNotificationPreferences`) | Theo Q-05: `DOMAIN_EXPERT`, `ADMIN` gọi thì 403; `FARM_TECHNICIAN` gửi `quiet_hours` thì 403, kênh vẫn đổi được. `notification.service` chỉ áp giờ im lặng cho Farm Owner. Script `npm run migrate:quiet-hours-owner-only` xoá `quiet_hours` đã lưu của người không phải Farm Owner | Test từng role |
| B-07 | `docs/api/api-spec.yaml` | 4 route mới (B-02, B-03) với 400, 403, 404, 409, 422; `site_causes` trong `HouseComparisonRow`; 403 của B-06 trên `PUT /auth/notification-preferences`; mô tả `severity` trong tin `alert` của thiết bị chỉ để tham khảo (Q-06) | Route ↔ spec vẫn khớp (189/189) |
| B-08 | `tests/integration/farmStructure.test.ts` (mới), `houseComparison.test.ts`, `auth.test.ts`, `alert*.test.ts`, `houseHealthReport.test.ts` | Test cho B-02…B-06, B-10, B-12, B-13; giữ tên test mà `report5/tc.py` đang trỏ | `npm test` xanh |
| B-09 | `npm run db:script` | Sinh lại `docs/database/init.mongo.js` sau B-01 và B-12 | Script có trường và chỉ mục mới |
| B-10 | `services/alert.service.ts` (`createAlert` và hàm nhận cảnh báo thiết bị, dòng truyền `severity: message.severity`) | Theo Q-06: mức luôn là `DEFAULT_SEVERITY[type]`; bỏ trường `severity` khỏi `CreateAlertInput` và khỏi dòng nhận tin MQTT (không job nào cần mức khác BR-15); bỏ `NEVER_ESCALATE` vì không còn cần. Script `npm run migrate:alert-severity` đặt lại mức của cảnh báo đang mở theo BR-15 | Tin `SPEAKER_FAILURE` gửi `CRITICAL` vẫn lưu `HIGH`; test cho mọi loại của BR-15 |
| B-11 | — | **Bỏ** theo Q-07: bộ lọc bốn cấp gửi đúng một mức, `GET /alerts` giữ nguyên | — |
| B-12 | `models/alert.model.ts`, `services/alert.service.ts` | Chống tạo trùng (ALERT-FR-008): thêm `incident_key` (loại + farm + nhà + Zone + thiết bị + `details.load` với `ACTUATOR_FAULT`) và chỉ mục duy nhất một phần trên `incident_key` khi `status` thuộc `ACTIVE`, `ACKNOWLEDGED`, `DISMISSED`; `createAlert` bắt lỗi trùng khoá rồi cộng `occurrence_count` vào bản đã có; script điền `incident_key` cho cảnh báo đang mở. Bỏ dòng `ponytail:` | Test hai `createAlert` song song chỉ ra một cảnh báo |
| B-13 | `scripts/migrate-zone-reports.script.ts` (mới), `package.json`, rồi `services/healthReport.service.ts`, `models/zoneHealthReport.model.ts`, `services/houseHealthReport.service.ts`, `controllers/healthReports.controller.ts`, `utils/dbScript.util.ts` | Theo Q-08: `npm run migrate:zone-reports` gộp mỗi báo cáo tuần của Zone vào báo cáo nhà `WEEKLY` cùng nhà và cùng kỳ (tạo nếu chưa có), thêm phần của Zone đó, chép kết luận chuyên gia (`by`, `at`, `edited_at`) nếu báo cáo nhà chưa có kết luận, còn nếu đã có thì nối vào phần của Zone; ghi `migrated_from` để chạy lại không nhân đôi; in số báo cáo đã chuyển. Chạy trên mọi cơ sở dữ liệu đang dùng, rồi mới xoá service, model, nhánh dự phòng trong `setConclusion` và đọc báo cáo, và collection khỏi database script | Chạy hai lần ra cùng kết quả; test có báo cáo Zone kèm kết luận chuyển đúng sang báo cáo nhà; không còn import `ZoneHealthReport` |
| F-01 | `firmware/src/main.cpp`, `firmware/src/config/Config.h` | Gửi mức đúng BR-15 (`SPEAKER_FAILURE` → `HIGH`); kiểm lại mọi `reportOnRise`; tăng `FIRMWARE_VERSION` lên 2.3.2 kèm ghi chú | `pio test -e native` xanh; không còn loại nào gửi mức khác BR-15 |

## 4. Web (Bảo)

| ID | Trang / file | Việc | Chờ |
|---|---|---|---|
| W-01…W-06 | Theo `todo-owner-expert-1121.md` §3 | Farm Owner sửa nhóm A có dòng "Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại"; gửi đề xuất luật thời tiết, hồ sơ nháp, luật khuyến nghị (tắt); nút "Nhắc chuyên gia"; mục duyệt hiện đúng nhóm mới | Backend G-31 (đã xong) |
| W-07 | `types/expert/reviews.types.ts`, `types/notification.types.ts` | `ParameterReviewGroup` đủ 7 nhóm như `PARAMETER_GROUPS`; `NotificationRefKind` đủ 12 loại; bấm thông báo `weather_rules`, `config_profile`, `recommendation_rule`, `harvest_cycle` mở đúng trang | — |
| W-08 | `components/features/domain-expert/reviews/ParameterReviewCard.tsx`, `constants/enumLabels.i18n.ts` | Nhãn VI/EN cho 5 nhóm mới; tên đối tượng (Zone, nhà hoặc camera) và giá trị cũ → mới; vòng đếm hiện số điểm và chiều bay thay vì toạ độ thô | W-07 |
| W-09 | Trang cấu trúc farm (`FarmOwnerFarmZonesPage`, `FarmOwnerFarmZoneDetailPage`) | Nút "Sửa" và "Xoá" cho nhà và Zone, chỉ Farm Owner (`usePermission('FARM_OWNER')`); popup sửa dùng lại validator của form tạo (tên ≤ 50, số tầng 1–10); xoá có xác nhận nói rõ lịch sử được giữ; lỗi 409 `HAS_ACTIVE_DEVICES` hiện "Gỡ các thiết bị của nhà trước khi xoá" và nút sang trang thiết bị | B-02, B-03 |
| W-10 | Tab so sánh nhà trên `/overview` | Cột "Nguyên nhân tại chỗ": các loại có số > 0, nhãn từ `constants/siteCause.ts`; trống thì `_` | B-05 |
| W-11 | `pages/SettingsPage.tsx` | Kiểm lại: giờ im lặng chỉ hiện cho Farm Owner (đã có `isFarmOwner`), Domain Expert không thấy mục kênh; lỗi 403 hiện theo `useApiErrorMessage` | B-06 |
| W-12 | Test | Vitest cho map nhóm duyệt, loại thông báo, cấp cảnh báo và tên trang theo role; E2E `ds-*` nếu kịch bản có xoá nhà; `lint`, `tsc --noEmit`, `vitest run`, `build` | — |
| W-13 | `pages/farm-owner/FarmOwnerAlertsPage.tsx`, `hooks/shared/useAlerts.ts` | ALERT-FR-007: thêm `ScopeFilter` (trang trại → nhà → Zone) ở đầu trang như các trang khác, bộ lọc loại cảnh báo và kết luận chuyên gia (chỉ hiện khi chọn loại suy luận hoặc "mọi loại"); bỏ nhánh gọi nhiều lần rồi ghép trong `listAlerts` (dòng `ponytail:`), mỗi bộ lọc mức gửi đúng một `severity` | W-14 |
| W-14 | `constants/severity.ts`, `severity.i18n.ts`, `common/SeverityBadge`, mọi chỗ dùng `SEVERITY_TO_LEVEL` | Theo Q-07: bỏ lớp `P1/P2/P3`, dùng thẳng bốn mức của backend; nhãn "Khẩn cấp", "Cao", "Trung bình", "Thấp" (EN: Critical, High, Medium, Low); màu: CRITICAL nền `safetyOrange` đặc chữ trắng, HIGH nền cam nhạt chữ cam đậm, MEDIUM nền vàng nhạt, LOW nền `warmGray`; dải tóm tắt, bộ lọc, chuông và popup thông báo đều theo bốn mức, cùng thứ tự với màn cài đặt thông báo | — |
| W-15 | `pages/technician/TechnicianFarmsPage.tsx` | Thẻ "Nhà cần xử lý" và câu phụ lấy số cảnh báo đang mở từ `GET /alerts?open=true` (như badge chuông), không từ cấu trúc nhà; hai thẻ "Thiết bị online" và "Mất kết nối" nói cùng một việc nên gộp thành một thẻ (online / tổng, câu phụ số mất kết nối); đưa mọi câu trên trang vào từ điển `farmStructure.i18n.ts` để đổi được EN | — |
| W-16 | `components/layouts/*Layout.tsx`, `constants/navigation.i18n.ts`, `AppHeader` | Một tên cho mỗi trang ở mọi role theo bảng thuật ngữ FE_Design §6.2 (đề xuất: "Đàn chim", "Sức khoẻ & báo cáo", "Thiết bị", "Công việc", "Thu hoạch", "So sánh nhà"); tiêu đề `h1` là tên tab đang mở, không phải tên nhóm ("Chuyên môn") | — |
| W-17 | `pages/farm-owner/FarmOwnerVisionPage.tsx` và thẻ camera | Bỏ hàng số dưới khung camera (đã có ở ba thẻ bên phải), giữ trạng thái camera và lần kết nối cuối; bỏ tên mô hình và chữ "AI Vision" khỏi màn của chủ (tên mô hình để ở chi tiết thiết bị); nhãn không bị cắt; trục số lượt chỉ có số nguyên | — |
| W-18 | Dải trạng thái đầu các trang chuyên gia (`ExpertScadaBanner`), `DomainExpertAlertVerdictsPage`, `DomainExpertQueuePage` | "Tự động" hiện `_` khi không có dữ liệu trong khoảng xem hoặc mọi thiết bị mất kết nối (ANALYTICS-FR-011 cần dữ liệu); số không đệm "00"; câu phụ trung tính ("Đã xác nhận", "Đã bác bỏ"), không kết luận thay chuyên gia; "Cần ký duyệt", "Đã ban hành", "3 phân hệ quản lý" đổi thành "Chờ kết luận", "Đã kết luận" và bỏ câu đếm phân hệ | — |
| W-19 | `pages/farm-owner/FarmOwnerAnalyticsPage.tsx` (tab Môi trường) | Khi chọn "Tất cả Zone": hiện lời nhắc "Chọn một Zone để xem biểu đồ" ngay dưới bảng so sánh, hoặc tự chọn Zone đầu tiên như các trang có `scopeLevelOf` | — |
| W-20 | `DomainExpertZoneTuningPage` và các thẻ tham số | Bỏ chữ kỹ thuật trên màn ("Cần firmware 1.2.0 trở lên", tên trường) theo FE_Design §6.4; giải thích ngắn theo việc chủ nhà yến cần biết | — |

Ảnh chụp màn hình các trang đổi gắn vào PR (FE_Design 13.13).

## 5. Mobile (Len)

| ID | Màn / file | Việc | Chờ |
|---|---|---|---|
| M-01 | `utils/healthDay.utils.ts` (`isHealthDayHidden`), `components/health/HealthDayRow.tsx`, `HealthDayDetail.tsx`, `components/home/HouseStatusCard.tsx`, màn chấm ngày | Bỏ che trạng thái (Report 3 4.2.14, BR-31): mọi người được xem ngày đều thấy trạng thái, lý do và đánh giá của người khác, đã chấm hay chưa. Màn chấm hiện trạng thái và lý do của hệ thống trước, hỏi "Xác nhận" hoặc "Sửa lại" theo hướng dẫn BR-37; chấm xong không sửa được, chỉ thêm ghi chú. Sửa chú thích trong `types/notification.types.ts` ("không kèm trạng thái") | — |
| M-02 | `types/expert.types.ts`, `types/account.types.ts` | Nhóm mục duyệt đủ 7 giá trị như backend (`thresholds`, `fuzzy`, `detection`, `return_rate_drop`, `health_levels`, `counting_schedule`, `counting_ring`); màn duyệt của chuyên gia hiện tên Zone, nhà hoặc camera và giá trị cũ → mới cho từng nhóm | — |
| M-03 | `types/notification.types.ts`, nơi mở thông báo | `ref.kind` thêm `weather_rules`, `config_profile`, `recommendation_rule`, `harvest_cycle`; loại nào mobile không có màn thì mở danh sách thông báo, không lỗi | — |
| M-04 | Cài đặt nhà và Zone (`components/farm/settings/*`) | G-31 nhóm A: Farm Owner trên farm có chuyên gia sửa được tham số phát hiện, mức giảm tỷ lệ chim về, mức chỉ số sức khoẻ, lịch đếm, vòng đếm, kèm dòng "Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại". Đọc quyền từ `can_edit` hoặc `has_active_expert` của backend, không tự suy ra | — |
| M-05 | `components/farm/settings/WeatherRulesSection.tsx` | G-31 nhóm B: Farm Owner trên farm có chuyên gia soạn bộ luật và "Gửi chuyên gia duyệt" (`POST /farms/houses/{houseId}/weather-rules/proposal`), thấy đề xuất đang chờ; chuyên gia thấy đề xuất, "Duyệt" (`…/proposal/approve`) hoặc "Từ chối" có lý do bắt buộc (`…/proposal/reject`) | — |
| M-06 | Chi tiết cảnh báo suy luận, báo cáo sức khoẻ | G-31 nhóm C: Farm Owner thấy nút "Nhắc chuyên gia" khi việc còn chờ (`POST /expert-activity/reminders`, `kind: alert \| health_report`); nhắc rồi thì nút chuyển "Đã nhắc"; 409 (farm không có chuyên gia) thì ẩn nút | — |
| M-07 | Cài đặt chuyên môn của Zone và nhà | Nút "Khôi phục mặc định" cho tham số phát hiện (`PUT /farms/zones/{zoneId}/detection-tuning/reset`) và mức giảm tỷ lệ chim về (`PUT /farms/houses/{houseId}/bird-count-tuning/reset`), có xác nhận (EXPERT-FR-008) | — |
| M-08 | `harvests/` + `HarvestRunSheet` | Ảnh thu hoạch (G-14): dùng lại `components/common/PhotoCaptureField.tsx`; sau khi lưu đợt thì `PUT /harvests/{id}/photo` (JPEG, PNG, WebP, ≤ 5 MB); hiện ảnh trong chi tiết đợt | — |
| M-09 | Biểu đồ môi trường (tab Phân tích) | ANALYTICS-FR-013: vẽ nhiệt độ và độ ẩm ngoài trời từ `GET /analytics/env/summary` (nét đứt) và lượng mưa của khoảng xem; thiếu dữ liệu thì để trống, không vẽ 0; ghi nguồn "Dữ liệu thời tiết: Open-Meteo" (CC BY 4.0) như web | — |
| M-10 | `components/alert/NotificationSettingsSheet.tsx` | Theo Q-05: giờ im lặng chỉ hiện cho Farm Owner; Farm Technician chỉ chọn kênh; Domain Expert không mở được sheet này | B-06 |
| M-11 | `components/farm/settings/HouseInfoSection.tsx`, `ZoneInfoSection.tsx` | Thay "Sắp có" bằng "Đổi tên", "Xoá" cho nhà và Zone (chỉ Farm Owner), có xác nhận; 409 `HAS_ACTIVE_DEVICES` báo "Gỡ các thiết bị trước khi xoá" | B-02, B-03 |
| M-12 | `constants/mockApi.ts`, `components/common/MockDataBadge.tsx`, `components/layout/PlaceholderScreen.tsx`, `components/analytics/BirdTab.tsx` | Xoá ba file không còn ai import và biến `EXPO_PUBLIC_USE_MOCK_API`; bỏ khối "Mốc cảnh báo tỷ lệ về tổ thấp theo ngày" (BR-16 gộp các ngày liền nhau vào một cảnh báo là đúng) | — |
| M-13 | Test, chạy thật | Jest cho `healthDay.utils` (M-01), map nhóm duyệt, loại thông báo và cấp cảnh báo; `npm run lint`, `typecheck`, `test`; chạy trên điện thoại thật với dữ liệu seed, đi qua mọi tab của 3 role và chụp màn hình (G-16); soát giao diện như web: nhãn bị cắt, số liệu lặp, chữ kỹ thuật, trạng thái trống | — |
| M-14 | `mobile/CLAUDE.md` | Cập nhật mục "Where mobile stands": BR-31 không còn chấm mù (bỏ "ask the user's own status first… the API itself hides the status"); Domain Expert đã có tab queue, verdicts, tuning (bỏ "placeholder tab"); `FARM_TECHNICIAN` đã merge (bỏ "not merged into `develop` yet"); Known debt theo §5 của file này | M-01 |
| M-15 | `constants/roleTabs.ts`, `app/(tabs)/` | Farm Technician: thay tab "Phân tích" bằng tab "Công việc" (Work Order được giao, bảo trì đến hạn, checklist), vì đây là việc hằng ngày của thợ; phân tích của nhà vẫn mở từ trang nhà. Farm Owner giữ nguyên | — |
| M-16 | `utils/alertList.utils.ts`, `utils/alert.utils.ts`, badge cấp cảnh báo, `MOBILE_GUIDE.md` | Theo Q-07: bốn cấp giống web (W-14): bỏ gộp CRITICAL với HIGH trong dải đếm và bộ lọc, nhãn và màu như web | — |

## 6. Tài liệu (Bảo)

D-01…D-04 làm xong trong PR của file này; D-05 đi cùng PR có test mới; D-06, D-07 đi cùng PR code liên quan.

| ID | File | Việc |
|---|---|---|
| D-01 | `report3-srs.md` → 4.2.16 | FARM-FR-002: tiêu chí sửa, xoá mềm, 409 khi còn thiết bị, 400 về số tầng (Q-01…Q-03); §2.4 dòng tạo, sửa, xoá nhà và Zone; BR-44 thêm "nguyên nhân tại chỗ" (Q-04); VISION-FR-012, 013 thêm Farm Technician (nhà được giao) cho khớp §2.4 và code; §6.1 `ACTIVE → ACKNOWLEDGED` thêm Farm Technician; changelog |
| D-02 | `report4-sdd.md` → 2.2.21 | §5.4 dòng "no map library is added" sửa theo bản đồ Leaflet, OpenStreetMap và Photon của 2.2.20; §7.1 `/farms` thêm sửa, xoá nhà và Zone; §6.1 (ERD) và §6.2 thêm `is_deleted`, `deleted_at`, `deleted_by` của House, Zone |
| D-03 | `CLAUDE.md` gốc | Trạng thái từng module theo code hiện nay: mobile đã gọi API thật, có FCM và quét QR, hết Zalo/SMS; backend khớp spec, còn G-32; firmware 2.3.1 chưa chạy trên board (DF-4); bỏ danh sách việc backend đã xong từ lâu. `mobile/CLAUDE.md` là của Len (M-14) |
| D-04 | `project-tracking.md` §6, §7 | Thêm dòng G-32 trỏ file này (ghi rõ phần mobile của G-31 là M-02…M-06, việc mobile còn mở của G-16 là M-08, M-09) và một dòng changelog; dòng G-16, G-31 do PR đóng chúng cập nhật |
| D-05 | Report 5 (`report5/tc.py`) | Ca kiểm thử cho sửa, xoá nhà và Zone (supporting SF, không cam kết) và cho mức cảnh báo theo BR-15 (B-10) nếu thêm test có tên mới |
| D-06 | `report4-sdd.md` §5.3 | Bảng job theo code: `returnRate` chạy cả đánh giá ngày và báo cáo ngày, `houseHealthReport` (tuần, tháng), `relayUsage` (giờ chạy), thêm `cameraConfig` (gửi khung phiên cho nút AI lúc 00:05); bỏ `healthReport.service` cũ khỏi bảng service sau B-13; §6.4 dòng `zonehealthreports` ghi tên script `migrate:zone-reports` (Q-08); §7.2 ghi `severity` trong tin `alert` chỉ để tham khảo, backend lấy mức theo BR-15 (Q-06) |
| D-07 | `frontend/FE_Design_Claude.md` 2.4, §6.2, Phụ lục D | 2.4 viết lại thành "Mức độ cảnh báo, bốn cấp" theo Q-07 (bảng mức → nhãn → màu, bỏ `SeverityLevel`, bỏ câu "dùng chung với ưu tiên ticket"); bảng thuật ngữ thêm tên trang thống nhất của W-16; Phụ lục D đổi dòng "3 cấp mức độ" |

## 7. Thứ tự PR

| PR | Nhánh | Người | Nội dung | Phụ thuộc |
|---|---|---|---|---|
| 1 | `docs/audit-1121-plan` | Bảo | File này, D-01…D-04 | — |
| 2 | `fix/g32-alert-severity` | Bảo | Q-06: B-10, B-12, F-01, D-06 phần §7.2, test | PR 1 |
| 3 | `feat/g32-house-zone-edit-delete` | Bảo | B-01…B-04, B-07…B-09 phần nhà, Zone | PR 1 |
| 4 | `feat/g32-site-causes-quiet-hours` | Bảo | B-05, B-06, B-13, D-06 phần còn lại | PR 1 |
| 5 | `feat/web-owner-decides` | Bảo | W-01…W-08 (G-31 và enum) | — |
| 6 | `fix/web-g32-alerts-ui` | Bảo | W-13…W-20, D-07 | PR 2 |
| 7 | `feat/web-g32-farm-structure` | Bảo | W-09…W-12 | PR 3, 4 |
| 8 | `fix/mobile-br31-enums` | Len | M-01, M-02, M-03, M-12, M-14, M-13 (phần test) | — |
| 9 | `feat/mobile-owner-decides` | Len | M-04…M-07 | — |
| 10 | `feat/mobile-technician-work` | Len | M-15, M-16 | — |
| 11 | `feat/mobile-harvest-photo-weather` | Len | M-08, M-09 | — |
| 12 | `feat/mobile-g32-structure-settings` | Len | M-10, M-11 | PR 3, 4 |

Thứ tự ưu tiên: PR 2 (cảnh báo đang tới sai người, sai mức) và PR 8 (quy tắc BR-31 đang sai trên mọi màn sức khoẻ của mobile, lệch enum giữa các module) trước; sau đó PR 5 và PR 9 (G-31); phần còn lại theo cột phụ thuộc. Mỗi PR cập nhật dòng gap của mình trong `project-tracking.md` §6 và điền đúng mẫu PR.

## 8. Ngoài phạm vi file này (vẫn mở, đã có trong tracking)

Chạy firmware 2.0.0 trên board để đóng **DF-4 (High, chặn Defense 1.1)**; board rev B2 cho G-13, G-22; dự án Firebase và lần gửi thật (G-10, NFR-02); SMTP trên staging (G-02); model v2 và NFR-09 (G-12); field run ≥ 14 ngày, phỏng vấn chuyên gia (G-19); thuê VPS và đo lại NFR-03, NFR-15 (G-17, G-27).
