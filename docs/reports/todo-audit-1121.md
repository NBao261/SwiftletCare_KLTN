# Rà soát backend, web, mobile theo Report 3 4.2.15 và Report 4 2.2.20 (21/11/2026)

Rà trên `develop` tại `4ad70245` (sau #214 và #198). Cách rà: đối chiếu từng FR, BR và bảng quyền §2.4 của Report 3 với route, service và màn hình; so tự động route backend với `docs/api/api-spec.yaml` (khớp 185/185); liệt kê endpoint trong spec mà web hoặc mobile chưa gọi. Đây là gap **G-32** trong `project-tracking.md` §6.

Phân công: **backend và web do Bảo làm, mobile do Len làm** (theo `todo-review2.md` §0.2). Trang `/domain-expert/*` là phần của Tuấn: Bảo sửa và nhờ Tuấn xem PR. Việc mobile nào cần backend chưa merge thì chờ (cột "Chờ").

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
| 9 | Code thừa trên mobile: `constants/mockApi.ts` và `MockDataBadge` không còn ai dùng (Report 4 §5.4: không dữ liệu mẫu); khối "Mốc cảnh báo tỷ lệ về tổ thấp theo ngày" không có trong yêu cầu | Report 4 §5.4; BR-16 | mobile | Chưa |
| 10 | Tài liệu tự mâu thuẫn (Report 4 §5.4 về bản đồ, VISION-FR-012/013 về Farm Technician, §6.1 về người xác nhận, `CLAUDE.md` gốc mô tả mobile đã cũ) | — | docs | Chưa |

## 2. Quyết định (Bảo chốt ngày 21/11/2026)

Đã ghi vào Report 3 4.2.16 và Report 4 2.2.21 trong PR của file này.

| ID | Câu hỏi | Quyết định |
|---|---|---|
| Q-01 | Xoá nhà hoặc Zone khi còn thiết bị đang dùng? | Không cho: 409 `HAS_ACTIVE_DEVICES`, chủ phải gỡ thiết bị trước (FARM-FR-008). Xoá mềm (`is_deleted`), lịch sử giữ nguyên. Xoá nhà thì xoá luôn các Zone của nó |
| Q-02 | Ai được xoá nhà, Zone? | Farm Owner (như FARM-FR-002), không bắt Primary Owner. Domain Expert, Farm Technician, Admin: 403 |
| Q-03 | Sửa số tầng của nhà xuống thấp hơn tầng của một Zone? | Từ chối 400, giống quy tắc tạo Zone |
| Q-04 | ALERT-FR-018 hay BR-44 đúng? | Giữ ALERT-FR-018: thêm cột "Nguyên nhân tại chỗ" (số lần theo từng loại) vào BR-44, không dùng để sắp xếp, không tính điểm |
| Q-05 | Farm Technician có chọn kênh ngoài ứng dụng không? | Có (§2.4 ✓), nhưng không đặt giờ im lặng. Domain Expert và Admin: không chọn kênh, không đặt giờ im lặng (403) |

Các quy tắc 409 và 400 ở Q-01, Q-03 đã vào tiêu chí chấp nhận của FARM-FR-002. Q-05 không đổi tài liệu: §2.4, ALERT-FR-005, 006 đã ghi như vậy, chỉ code chưa theo.

## 3. Backend (Bảo)

| ID | File | Việc | Xong khi |
|---|---|---|---|
| B-01 | `models/houseZone.model.ts` | House và Zone thêm `is_deleted` (mặc định `false`), `deleted_at`, `deleted_by`; chỉ mục tên duy nhất chỉ tính bản chưa xoá | Tạo lại nhà trùng tên với nhà đã xoá được |
| B-02 | `routes/farms.route.ts`, `controllers/farms.controller.ts`, `services/farm.service.ts` | `PUT /farms/houses/{houseId}` (`name`, `floors`, `description`) và `PUT /farms/zones/{zoneId}` (`name`, `floor`): chỉ `FARM_OWNER`; tên ≤ 50 ký tự (422), trùng tên 409 `DUPLICATE_NAME`, `floors` 1–10 và không thấp hơn tầng cao nhất của các Zone (400, Q-03), `floor` của Zone không vượt số tầng của nhà (400); ghi audit cũ → mới | Test 200, 400, 403, 409, 422 |
| B-03 | cùng file | `DELETE /farms/houses/{houseId}`, `DELETE /farms/zones/{zoneId}`: chỉ `FARM_OWNER`; còn bộ điều khiển hoặc camera chưa `DECOMMISSIONED` thì 409 `HAS_ACTIVE_DEVICES` (Q-01); xoá mềm; đóng cảnh báo đang mở (như `softDeleteFarm`), huỷ Work Order đang mở có lý do, đưa kế hoạch bảo trì của nhà về `RETIRED`, bỏ thợ khỏi nhà; ghi audit | Telemetry, lượt đếm, báo cáo, thu hoạch cũ vẫn đọc được |
| B-04 | `utils/farmAccess.util.ts` và các nơi gọi `House.find`, `Zone.find` (22 file) | Bỏ nhà, Zone đã xoá khỏi: `listHouses`, `listZones`, `listActiveHouseIds`, các job (`returnRate`, `healthAssessment`, `houseHealthReport`, `weatherCompensation`, `maintenanceDue`, `relayUsage`, `cameraConfig`, recommendation), tổng quan và so sánh nhà; đăng ký hoặc chuyển thiết bị vào Zone đã xoá: 404; mã tầng của Zone đã xoá: 404 (FARM-FR-011) | Sau khi xoá, không job nào chạy trên nhà đó |
| B-05 | `services/houseComparison.service.ts`, `controllers/farms.controller.ts` | `GET /farms/{id}/comparison` thêm `site_causes: Record<SiteCause, number>` mỗi nhà trong kỳ: đếm `alerts.site_cause.cause` và `workOrders.cause`, mỗi cảnh báo chỉ một lần (lấy nguyên nhân của Work Order nếu có, không thì của cảnh báo); không có trong `COMPARISON_SORT_KEYS` (Q-04) | Test seed: 2 `NOZZLE`, 1 `PUMP` ra đúng số |
| B-06 | `services/auth.service.ts` (`updateNotificationPreferences`) | Theo Q-05: `DOMAIN_EXPERT`, `ADMIN` gọi thì 403; `FARM_TECHNICIAN` gửi `quiet_hours` thì 403, kênh vẫn đổi được. `notification.service` chỉ áp giờ im lặng cho Farm Owner. Script `npm run migrate:quiet-hours-owner-only` xoá `quiet_hours` đã lưu của người không phải Farm Owner | Test từng role |
| B-07 | `docs/api/api-spec.yaml` | 4 route mới (B-02, B-03) với 400, 403, 404, 409, 422; `site_causes` trong `HouseComparisonRow`; 403 của B-06 trên `PUT /auth/notification-preferences` | `cmp` route ↔ spec vẫn khớp (189/189) |
| B-08 | `tests/integration/farmStructure.test.ts` (mới), `houseComparison.test.ts`, `auth.test.ts` | Test cho B-02…B-06; giữ tên test mà `report5/tc.py` đang trỏ | `npm test` xanh |
| B-09 | `npm run db:script` | Sinh lại `docs/database/init.mongo.js` sau B-01 | Script có trường mới |

## 4. Web (Bảo)

| ID | Trang / file | Việc | Chờ |
|---|---|---|---|
| W-01…W-06 | Theo `todo-owner-expert-1121.md` §3 | Farm Owner sửa nhóm A có dòng "Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại"; gửi đề xuất luật thời tiết, hồ sơ nháp, luật khuyến nghị (tắt); nút "Nhắc chuyên gia"; mục duyệt hiện đúng nhóm mới | Backend G-31 (đã xong) |
| W-07 | `types/expert/reviews.types.ts`, `types/notification.types.ts` | `ParameterReviewGroup` đủ 7 nhóm như `PARAMETER_GROUPS`; `NotificationRefKind` đủ 12 loại; bấm thông báo `weather_rules`, `config_profile`, `recommendation_rule`, `harvest_cycle` mở đúng trang | — |
| W-08 | `components/features/domain-expert/reviews/ParameterReviewCard.tsx`, `constants/enumLabels.i18n.ts` | Nhãn VI/EN cho 5 nhóm mới; tên đối tượng (Zone, nhà hoặc camera) và giá trị cũ → mới; vòng đếm hiện số điểm và chiều bay thay vì toạ độ thô | W-07 |
| W-09 | Trang cấu trúc farm (`FarmOwnerFarmZonesPage`, `FarmOwnerFarmZoneDetailPage`) | Nút "Sửa" và "Xoá" cho nhà và Zone, chỉ Farm Owner (`usePermission('FARM_OWNER')`); popup sửa dùng lại validator của form tạo (tên ≤ 50, số tầng 1–10); xoá có xác nhận nói rõ lịch sử được giữ; lỗi 409 `HAS_ACTIVE_DEVICES` hiện "Gỡ các thiết bị của nhà trước khi xoá" và nút sang trang thiết bị | B-02, B-03 |
| W-10 | Tab so sánh nhà trên `/overview` | Cột "Nguyên nhân tại chỗ": các loại có số > 0, nhãn từ `constants/siteCause.ts`; trống thì `_` | B-05 |
| W-11 | `pages/SettingsPage.tsx` | Kiểm lại: giờ im lặng chỉ hiện cho Farm Owner (đã có `isFarmOwner`), Domain Expert không thấy mục kênh; lỗi 403 hiện theo `useApiErrorMessage` | B-06 |
| W-12 | Test | Vitest cho map nhóm duyệt và loại thông báo; E2E `ds-*` nếu kịch bản có xoá nhà; `lint`, `tsc --noEmit`, `vitest run`, `build` | — |

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
| M-12 | `constants/mockApi.ts`, `components/common/MockDataBadge.tsx`, `components/analytics/BirdTab.tsx` | Xoá hai file mock không còn ai dùng và biến `EXPO_PUBLIC_USE_MOCK_API`; bỏ khối "Mốc cảnh báo tỷ lệ về tổ thấp theo ngày" (BR-16 gộp các ngày liền nhau vào một cảnh báo là đúng) | — |
| M-14 | `mobile/CLAUDE.md` | Cập nhật mục "Where mobile stands": BR-31 không còn chấm mù (bỏ "ask the user's own status first… the API itself hides the status"); Domain Expert đã có tab queue, verdicts, tuning (bỏ "placeholder tab"); `FARM_TECHNICIAN` đã merge (bỏ "not merged into `develop` yet"); Known debt theo §5 của file này | M-01 |
| M-13 | Test, chạy thật | Jest cho `healthDay.utils` (M-01), map nhóm duyệt và loại thông báo; `npm run lint`, `typecheck`, `test`; chạy trên điện thoại thật và chụp màn hình các màn đã merge (G-16) | — |

## 6. Tài liệu (Bảo)

D-01…D-04 làm xong trong PR của file này; D-05 đi cùng PR có test mới.

| ID | File | Việc |
|---|---|---|
| D-01 | `report3-srs.md` → 4.2.16 | FARM-FR-002: tiêu chí sửa, xoá mềm, 409 khi còn thiết bị, 400 về số tầng (Q-01…Q-03); §2.4 dòng tạo, sửa, xoá nhà và Zone; BR-44 thêm "nguyên nhân tại chỗ" (Q-04); VISION-FR-012, 013 thêm Farm Technician (nhà được giao) cho khớp §2.4 và code; §6.1 `ACTIVE → ACKNOWLEDGED` thêm Farm Technician; changelog |
| D-02 | `report4-sdd.md` → 2.2.21 | §5.4 dòng "no map library is added" sửa theo bản đồ Leaflet, OpenStreetMap và Photon của 2.2.20; §7.1 `/farms` thêm sửa, xoá nhà và Zone; §6.1 (ERD) và §6.2 thêm `is_deleted`, `deleted_at`, `deleted_by` của House, Zone |
| D-03 | `CLAUDE.md` gốc | Trạng thái từng module theo code hiện nay: mobile đã gọi API thật, có FCM và quét QR, hết Zalo/SMS; backend khớp spec, còn G-32; firmware 2.3.1 chưa chạy trên board (DF-4); bỏ danh sách việc backend đã xong từ lâu. `mobile/CLAUDE.md` là của Len (M-14) |
| D-04 | `project-tracking.md` §6, §7 | Thêm dòng G-32 trỏ file này (ghi rõ phần mobile của G-31 là M-02…M-06, việc mobile còn mở của G-16 là M-08, M-09) và một dòng changelog; dòng G-16, G-31 do PR đóng chúng cập nhật |
| D-05 | Report 5 (`report5/tc.py`) | Ca kiểm thử cho sửa, xoá nhà và Zone (supporting SF, không cam kết) nếu thêm test có tên mới |

## 7. Thứ tự PR

| PR | Nhánh | Người | Nội dung | Phụ thuộc |
|---|---|---|---|---|
| 1 | `docs/audit-1121-plan` | Bảo | File này, D-01…D-04 | — |
| 2 | `feat/g32-house-zone-edit-delete` | Bảo | B-01…B-04, B-07…B-09 phần nhà, Zone | PR 1 |
| 3 | `feat/g32-site-causes-quiet-hours` | Bảo | B-05, B-06 kèm spec và test | PR 1 |
| 4 | `feat/web-owner-decides` | Bảo | W-01…W-08 (G-31 và enum) | — |
| 5 | `feat/web-g32-farm-structure` | Bảo | W-09…W-12 | PR 2, 3 |
| 6 | `fix/mobile-br31-enums` | Len | M-01, M-02, M-03, M-12, M-14, M-13 (phần test) | — |
| 7 | `feat/mobile-owner-decides` | Len | M-04…M-07 | — |
| 8 | `feat/mobile-harvest-photo-weather` | Len | M-08, M-09 | — |
| 9 | `feat/mobile-g32-structure-settings` | Len | M-10, M-11 | PR 2, 3 |

PR 6 nên đi trước vì M-01 sửa một quy tắc nghiệp vụ đang sai trên mọi màn sức khoẻ, còn M-02, M-03 sửa lệch enum giữa các module. Mỗi PR cập nhật dòng gap của mình trong `project-tracking.md` §6 và điền đúng mẫu PR.

## 8. Ngoài phạm vi file này (vẫn mở, đã có trong tracking)

Chạy firmware 2.0.0 trên board để đóng **DF-4 (High, chặn Defense 1.1)**; board rev B2 cho G-13, G-22; dự án Firebase và lần gửi thật (G-10, NFR-02); SMTP trên staging (G-02); model v2 và NFR-09 (G-12); field run ≥ 14 ngày, phỏng vấn chuyên gia (G-19); thuê VPS và đo lại NFR-03, NFR-15 (G-17, G-27).
