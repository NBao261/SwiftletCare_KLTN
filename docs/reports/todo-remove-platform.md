# Todo ưu tiên: bỏ chức năng nền tảng và khớp quyền theo Report 3

Danh sách việc **code** để hệ thống khớp với phạm vi đã chốt ở BM03 dòng 9 và Report 3 (bản sau PR #97): bỏ ticket, SLA, vùng của Technician; Technician là vai trò kỹ thuật thấy thiết bị của mọi farm nhưng không bật/tắt relay; Admin không quản lý farm. Làm lần lượt từ trên xuống, mỗi mục **PR n** là một pull request riêng.

- **Nguồn yêu cầu:** Report 3 §2.3, §2.4 (bảng quyền và ghi chú ²), §3.6 (ALERT-FR-015, 016), §3.10 (FARM-FR-001, 002, 003, 009), §3.12 (FARM-FR-013, AUTH-FR-005c, SYSTEM-FR-003), §8; Report 4 D14, §6.4, §12.
- **Chỗ lệch tương ứng:** `docs/reports/README.md` #2, #15, #25, #41–#46.
- **Đánh dấu:** `[ ]` chưa làm, `[x]` xong. Xong một PR thì sửa dòng "Chỗ lệch" tương ứng trong cùng PR đó (đổi thành "Đã xong ở PR #…").

---

## 0. Chuẩn bị (làm một lần)

- [ ] Merge PR #97 (tài liệu) vào `develop` để mọi người đọc đúng Report 3 mới.
- [ ] Mỗi thành viên đặt tên commit là **tài khoản GitHub của mình** trong repo, trước khi commit lần đầu:
  ```bash
  git config user.name  "<tên tài khoản GitHub>"     # ví dụ NBao261
  git config user.email "<email gắn với tài khoản>"  # ví dụ ncb2601@gmail.com
  git log -1 --format='%an <%ae>'                     # kiểm tra sau commit đầu tiên
  ```
  Không thêm dòng `Co-Authored-By`, link phiên Claude hay chữ ký AI vào commit hoặc PR (`CLAUDE.md`, mục Working with Claude).
- [ ] Tạo nhánh mới từ `develop` cho từng PR: `git switch develop && git pull && git switch -c <type>/<mô-tả-ngắn>`.
- [ ] Chạy test gốc một lần để biết trạng thái trước khi sửa: `cd backend && npm ci && npm test` (kỳ vọng xanh hết).
- [ ] Mỗi PR: commit theo Conventional Commits (`.commitlintrc.json`, dòng body ≤ 100 ký tự); chạy đủ lệnh CI của module trước khi push (`CLAUDE.md`, mục Conventions); điền mẫu PR `.github/pull_request_template.md`.

---

## Trước Review 2 (P0)

### PR 1 — Backend: quyền theo Report 3 §2.4 · đề xuất: Trần Minh Kiệt · xong ở PR #100

Chỉ sửa `requireRole` và kiểm tra trong service, chưa xoá module nào. Nhánh gợi ý `fix/role-matrix-srs3`.

**Route (`backend/src/routes/`):**

| [x] | File : dòng | Route | Hiện tại | Sửa thành | FR |
|---|---|---|---|---|---|
| [x] | `farms.route.ts:16` | `POST /farms` | FARM_OWNER, ADMIN | FARM_OWNER | FARM-FR-001 |
| [x] | `farms.route.ts:18–19` | `PUT`, `DELETE /farms/:id` | FARM_OWNER, ADMIN | FARM_OWNER (xoá: chỉ Primary Owner, kiểm tra ở service) | FARM-FR-001 |
| [x] | `farms.route.ts:21, 23` | thêm/gỡ thành viên | FARM_OWNER, ADMIN | FARM_OWNER (Primary Owner) | AUTH-FR-005 |
| [x] | `farms.route.ts:27, 31` | tạo House, Zone | FARM_OWNER, TECHNICIAN, ADMIN | FARM_OWNER | FARM-FR-002 |
| [x] | `farms.route.ts:35, 37, 39` | ngưỡng Zone, reset, hệ số mờ | + TECHNICIAN, ADMIN | FARM_OWNER, DOMAIN_EXPERT | ENV-FR-006, 020, 021 |
| [x] | `devices.route.ts:27` | `PUT /devices/sensor-nodes/:id/thresholds` | + TECHNICIAN, ADMIN | FARM_OWNER, DOMAIN_EXPERT | ENV-FR-006 |
| [x] | `devices.route.ts:39, 42` | bật/tắt relay, huỷ override | FARM_OWNER, TECHNICIAN, ADMIN | FARM_OWNER | ENV-FR-016 |
| [x] | `devices.route.ts:29` | `PUT /devices/sensor-nodes/:id/speaker-schedule` (lịch loa) | FARM_OWNER, TECHNICIAN, ADMIN | FARM_OWNER | §2.4, BR-07 |
| [x] | `devices.route.ts:44` | `GET /devices/sensor-nodes/:id/relay-overrides` (lịch sử can thiệp tay) | FARM_OWNER, DOMAIN_EXPERT, TECHNICIAN, ADMIN | FARM_OWNER, DOMAIN_EXPERT | §2.4, ENV-FR-019 |
| [x] | `devices.route.ts:23, 92` | đăng ký controller, camera | TECHNICIAN, ADMIN | FARM_OWNER, TECHNICIAN | FARM-FR-003, 004 |
| [x] | `devices.route.ts:61, 65, 70, 71, 85, 90` | dời Zone, gỡ, khôi phục, thay | TECHNICIAN, ADMIN | FARM_OWNER, TECHNICIAN | FARM-FR-007b, 008 |
| [x] | `devices.route.ts:75` | lệnh từ xa (RESTART, đẩy cấu hình, OTA) | TECHNICIAN, ADMIN | TECHNICIAN | FARM-FR-013 |
| [x] | `devices.route.ts:48, 53, 57` | bài loa ru | TECHNICIAN, ADMIN | TECHNICIAN | ENV-FR-013c |
| [x] | `alerts.route.ts:32` | xác nhận cảnh báo | FARM_OWNER, TECHNICIAN | FARM_OWNER | ALERT-FR-009 |

**Service:**
- [x] Farm Owner chỉ đăng ký, dời, gỡ thiết bị ở farm **của mình** (`assertZoneAccess`/`hasFarmAccess`), Zone của farm khác → 403 (FARM-FR-007).
- [x] Không đụng tới `farmAccess.util.ts` ở PR này; vùng (region) để PR 5.

**API spec và test:**
- [x] `docs/api/api-spec.yaml`: sửa phần mô tả role/403 của từng route ở bảng trên.
- [x] Thêm test 403 (mỗi dòng của bảng một case). Có thể gom vào `tests/integration/roleMatrix.test.ts`: TECHNICIAN, ADMIN gọi sửa ngưỡng/hệ số → 403; TECHNICIAN, ADMIN bật relay hoặc sửa lịch loa → 403; TECHNICIAN, ADMIN đọc lịch sử can thiệp tay → 403, DOMAIN_EXPERT đọc → 200; TECHNICIAN xác nhận cảnh báo → 403; ADMIN tạo farm, House, Zone → 403; FARM_OWNER đăng ký thiết bị vào Zone của mình → 201, vào Zone farm khác → 403.
- [x] Sửa các test cũ đang dùng Technician/Admin cho những thao tác này (tìm `grep -rln "TECHNICIAN\|ADMIN" tests/integration`), ví dụ `deviceOnboarding.test.ts`, `audioTracks.test.ts`, `adminApi.test.ts`.
- [x] Chạy: `npm run lint && npm run build:check && npm test`.

**Xong khi:** mọi route khớp bảng §2.4; test 403 xanh; `README.md` "Chỗ lệch" #2, #15, #25 (phần quyền) đánh dấu đã xong.

### PR 2 — Web + mobile: ẩn ticket, khớp nút theo quyền · đề xuất: Len (Farm Owner), Tuấn (Technician), Nhi (Admin) · xong ở PR #101

Chỉ gỡ khỏi menu/route và ẩn nút; chưa xoá file (xoá ở PR 6). Nhánh gợi ý `refactor/hide-platform-ui`.

**Route và menu (`frontend/src/`):**
- [x] `routes/farm-owner.routes.tsx`: bỏ route `FarmOwnerTicketsPage`, `FarmOwnerTicketDetailPage` (dòng ~19–20, 102–115).
- [x] `routes/technician.routes.tsx`: bỏ `tickets`, `tickets/:id`, `maintenance` (dòng ~16–20, 47–82).
- [x] `routes/admin.routes.tsx`: bỏ `system/tickets`, `system/tickets/:id` (dòng ~20–23, 104–115); bỏ route các trang `AdminFarmsPage`, `AdminFarmDetailPage`, `AdminFarmHousePage`.
- [x] `constants/roles.ts`: bỏ `/tickets`, `/maintenance`, `/system/tickets` khỏi `MENU_ACCESS` (dòng ~89–100); bỏ mục menu tương ứng trong `components/layouts/*Layout.tsx`.
- [x] Gỡ link "Tạo yêu cầu hỗ trợ"/"Tạo ticket" ở các màn khác (`DeviceFaultAlertPanel`, `CreateSupportTicketModal`, `FarmRecentTickets`, `TicketTrendsCard` ở dashboard Admin).

**Nút theo quyền:**
- [x] Ẩn nút bật/tắt relay, huỷ override và nút xác nhận cảnh báo với Technician và Admin (Farm Owner mới thấy).
- [x] Gỡ `ThresholdsModal` (sửa ngưỡng/hệ số) khỏi màn Technician.
- [x] Ẩn nút tạo farm/House/Zone với Admin và Technician.
- [ ] Form tạo farm của Farm Owner bỏ ô khu vực (`FarmFormModal`) — chỉ làm sau khi backend PR 5 bỏ bắt buộc `region`, trước đó giữ nguyên ô.
- [x] Trang cài đặt hệ thống Admin (`AdminSystemSettingsPage`): ẩn thẻ SLA (`SlaCard`) và cách gán ticket.

**Mobile (`mobile/`):**
- [x] `app/(tabs)/_layout.tsx`: bỏ tab `tickets`; bỏ link tới `ticket/[ticketId]`.

**Kiểm tra:**
- [x] `cd frontend && npm run lint && npx tsc --noEmit && npx vitest run && npm run build`.
- [x] `cd mobile && npm run lint && npm run typecheck && npx jest --passWithNoTests`.
- [ ] Đăng nhập thử 4 role (`npm run seed` có Farm Owner, Technician; tạo thêm Admin, Domain Expert): không còn thấy chữ "Ticket", "SLA", "Bảo trì định kỳ" ở menu; Technician không thấy nút relay/xác nhận.

**Xong khi:** demo Review 2 không còn màn ticket; `README.md` "Chỗ lệch" #30 cập nhật phần ticket.

---

## Iteration 2 (P0/P1)

### PR 3 — Backend: cảnh báo thay cho ticket (ALERT-FR-015, 016) · đề xuất: Trần Minh Kiệt

Làm trước PR 4 vì `alertEscalation.job.ts` và `relayUsage.service.ts` đang gọi `ticket.service`. Nhánh gợi ý `feat/alert-renotify-maintenance`.

**ALERT-FR-015 — gửi lại cảnh báo chưa ai xác nhận:**
- [ ] `models/alert.model.ts`: thêm `renotified_at?: Date` (đánh dấu đã gửi lại, để chỉ gửi **một lần**).
- [ ] `jobs/alertEscalation.job.ts`: thay `createTicketsFromStaleAlerts()` bằng hàm mới trong `alert.service.ts`, ví dụ `renotifyStaleAlerts(now)`:
  - [ ] chọn cảnh báo `ACTIVE`, `renotified_at` chưa có, mức CRITICAL hoặc HIGH, `type ≠ NODE_OFFLINE`, tạo cách đây ≥ 15 phút;
  - [ ] và cảnh báo `NODE_OFFLINE` `ACTIVE` tạo cách đây ≥ 1 giờ;
  - [ ] gửi qua `notification.service` cho các Farm Owner của farm theo kênh họ chọn (ALERT-FR-005), tôn trọng giờ yên lặng (ALERT-FR-006);
  - [ ] ghi `renotified_at`.
  - Giữ nguyên mốc 15 phút / 1 giờ (Report 3 §4.5) — không đặt số mới.
- [ ] Test `tests/integration/alertRenotify.test.ts`: CRITICAL chưa xác nhận sau 15 phút → gửi lại đúng 1 lần, chạy job lần 2 không gửi nữa; đã xác nhận/đã DISMISSED/đã RESOLVED → không gửi; MEDIUM → không gửi; `NODE_OFFLINE` sau 1 giờ → gửi 1 lần.

**ALERT-FR-016 — `MAINTENANCE_DUE`:**
- [ ] Thêm `'MAINTENANCE_DUE'` vào `AlertType` ở **cả 3 phía trong cùng PR**: `backend/src/types/domain.types.ts`, `frontend/src/types/` (kèm nhãn trong `constants/enumLabels.i18n.ts`), `mobile/types/index.ts`.
- [ ] Mức mặc định LOW (BR-15) trong bảng mức của `alert.service.ts`.
- [ ] `services/relayUsage.service.ts`: thay `createServiceTicketIfDue` (tạo ticket) bằng tạo cảnh báo `MAINTENANCE_DUE` qua `createAlert()`, nêu controller, tải (bơm/quạt) và số giờ/số lần; **không** reset bộ đếm lúc tạo.
- [ ] `alert.service.ts` (xác nhận cảnh báo): khi Farm Owner xác nhận một `MAINTENANCE_DUE` → reset `since_service_*` của tải đó trong `sensor_nodes.relay_usage` và chuyển cảnh báo sang `RESOLVED` (BR-16).
- [ ] Bỏ import `ticket.service`, `visitTime.util` khỏi `relayUsage.service.ts`.
- [ ] Sửa `tests/integration/forecastAndRelayUsage.test.ts`: quá giới hạn → 1 cảnh báo `MAINTENANCE_DUE` (không còn ticket); dưới giới hạn → không có; xác nhận → bộ đếm về 0 và cảnh báo `RESOLVED`.

**Chung:**
- [ ] `npm run db:script` (đổi model alert) và commit `docs/database/init.mongo.js`.
- [ ] `api-spec.yaml`: thêm `MAINTENANCE_DUE` vào enum `AlertType`.
- [ ] Chạy CI của backend, frontend, mobile (PR đụng enum 3 phía).

**Xong khi:** không còn chỗ nào tạo ticket từ cảnh báo; `README.md` "Chỗ lệch" #42, #43 đã xong.

### PR 4 — Backend: gỡ module ticket · đề xuất: Trần Minh Kiệt

PR lớn nhất. Làm sau PR 3. Nhánh gợi ý `refactor/remove-ticket-module`.

**Xoá file (`backend/src/`):**
- [ ] `routes/tickets.route.ts`, `routes/maintenanceSchedules.route.ts`
- [ ] `controllers/tickets.controller.ts`, `controllers/maintenanceSchedules.controller.ts`
- [ ] `services/ticket.service.ts`, `services/ticketChat.service.ts`, `services/maintenanceSchedule.service.ts`
- [ ] `models/ticket.model.ts`, `models/ticketMessage.model.ts`, `models/maintenanceSchedule.model.ts`
- [ ] `jobs/slaBreach.job.ts`, `jobs/ticketQueue.job.ts`, `jobs/maintenanceSchedule.job.ts` (chuyển phần `accumulateRelayUsage()` sang job mới `jobs/relayUsage.job.ts`, mỗi giờ)
- [ ] `utils/sla.util.ts`, `utils/ticket.util.ts`, `utils/visitTime.util.ts` (kiểm tra không còn ai dùng)

**Sửa file đang gọi ticket:**
- [ ] `config/app.config.ts`: bỏ `app.use('/tickets'…)`, `app.use('/maintenance-schedules'…)`.
- [ ] `index.ts`: bỏ `startSlaBreachJob`, `startTicketQueueJob`, `startMaintenanceScheduleJob`; thêm `startRelayUsageJob`.
- [ ] `services/device.service.ts`: bỏ `noteTicketsOfRemovedDevice` và import `Ticket`; bỏ `ticket_id` và đoạn kiểm tra "Technician được gán ticket" ở lệnh từ xa (khoảng dòng 915–924); route `POST /devices/sensor-nodes/:id/commands` bỏ `ticket_id` khỏi body.
- [ ] `services/farm.service.ts`: bỏ `closeTicketsOfDeletedFarm`, `rerouteTicketsOutOfCoverage`.
- [ ] `services/admin.service.ts`: bỏ điều phối lại ticket khi khoá/xoá Technician, bỏ kiểm tra ticket đang mở khi xoá tài khoản; bỏ `PUT /admin/technicians/:id/profile` (AUTH-FR-005c chỉ còn tạo tài khoản và cấp lại mật khẩu tạm).
- [ ] `services/system.service.ts`, `controllers/system.controller.ts`, `routes/system.route.ts`: bỏ `/settings/sla`, `/settings/ticket-routing`; `health-overview` bỏ đếm ticket (SYSTEM-FR-003 chỉ còn số farm, Zone, thiết bị theo trạng thái, tài khoản theo role).
- [ ] `models/systemSetting.model.ts`: bỏ `sla_hours` và cấu hình gán ticket.
- [ ] `socket/index.ts`: bỏ room `ticket:<id>`, `JOIN_TICKET_CHAT`, `SEND_TICKET_MESSAGE`, `TICKET_MESSAGE_NEW`, `TICKET_CHAT_ASSIGNEE_CHANGED`.
- [ ] `services/healthReport.service.ts`: bỏ phần đếm hoặc nhắc ticket (nếu có).
- [ ] `scripts/migrate-retention.script.ts`, `utils/dbScript.util.ts`: bỏ collection ticket khỏi danh sách.
- [ ] `types/domain.types.ts`: bỏ `TicketType`, `TicketPriority`, `TicketStatus`, `SlaConfig` — **cùng PR** bỏ ở `frontend/src/types/` và `mobile/types/index.ts` (hoặc ghi rõ PR 6 làm phía web/mobile; khi đó PR 6 phải merge liền sau).

**Migration (chạy một lần trên staging):**
- [ ] `scripts/migrate-remove-tickets.script.ts` + script `"migrate:remove-tickets"` trong `package.json`: xoá collection `tickets`, `ticketmessages`, `maintenanceschedules`; `$unset` `sla_hours` và cấu hình gán ticket trong `systemsettings`. Chạy hai lần không lỗi (idempotent).
- [ ] Test `tests/integration/migrateRemoveTickets.test.ts`; thêm dòng `npm run migrate:remove-tickets` vào mục Commands của `backend/CLAUDE.md` (luật migration).
- [ ] `.env.example`: bỏ `MAINTENANCE_LEAD_DAYS`.

**Test:**
- [ ] Xoá: `ticketChat`, `ticketHistory`, `ticketKpi`, `ticketListQuery`, `ticketOverride`, `ticketQueue`, `ticketTechnician`, `slaBreach`, `maintenanceSchedule`, `adminOverrideFixes` (nếu chỉ thử admin override ticket).
- [ ] Sửa: `adminApi`, `adminUserLifecycle`, `adminInventoryAndSearch`, `systemOverview`, `passwordAndProfile`, `alertVerdict`, `domainExpert`, `deviceOnboarding`, `sensorAnomaly`, `audioTracks` — bỏ phần tạo hoặc kiểm tra ticket.
- [ ] Giữ độ phủ ≥ 80 % (`npm test` báo lỗi nếu tụt).

**API spec, DB script:**
- [ ] `docs/api/api-spec.yaml`: xoá `/tickets*` (từ khoảng dòng 4156), `/maintenance-schedules*` (khoảng 4060), `/system/settings/sla`, `/system/settings/ticket-routing`, `/admin/technicians/{id}/profile`; xoá schema Ticket, TicketMessage, MaintenanceSchedule, SlaConfig.
- [ ] `npm run db:script`, commit `docs/database/init.mongo.js`.

**Kiểm tra cuối:**
- [ ] `grep -rniE "ticket|sla_|maintenanceSchedule" backend/src` → không còn kết quả (trừ comment lịch sử nếu cố ý giữ).
- [ ] `npm run lint && npm run build:check && npm test`.

**Xong khi:** `README.md` "Chỗ lệch" #41, #45 (phần backend), #46 đã xong.

### PR 5 — Backend: Technician trên mọi farm, bỏ vùng (FARM-FR-009) · đề xuất: Trần Minh Kiệt

Làm sau PR 4 (lúc đó vùng không còn dính ticket). Nhánh gợi ý `refactor/technician-all-farms`.

**Quyền truy cập:**
- [ ] `utils/farmAccess.util.ts`: xoá `isAssignedTechnician`. **Không** cho Technician vào `hasFarmAccess` (hàm này mở cả dữ liệu vận hành). Thêm hàm riêng, ví dụ `hasDeviceAccess(farm, user)`: đúng khi user có `hasFarmAccess` hoặc là `TECHNICIAN`.
- [ ] Dùng `hasDeviceAccess` chỉ ở: danh sách farm (chỉ cấu trúc), House/Zone (đọc), danh sách và chi tiết thiết bị, đăng ký/dời/gỡ/thay, lệnh từ xa, bài loa, cảnh báo **thiết bị** (định nghĩa "Device alert" ở Report 3 §1.3).
- [ ] Rà mọi route dữ liệu vận hành còn cho TECHNICIAN ở `requireRole` (telemetry, analytics, số đếm chim, live stream, harvest, health report, ngưỡng): phải trả 403 với Technician.
- [ ] `socket/index.ts`: Technician không được `JOIN_ZONE`/`JOIN_HOUSE` (đó là telemetry và số đếm trực tiếp); chỉ nhận `DEVICE_STATUS_CHANGE` qua room riêng nếu cần.
- [ ] `services/farm.service.ts`: Technician thấy mọi farm (bỏ lọc `region`), Admin không thấy farm nào.

**Bỏ vùng:**
- [ ] Xoá `utils/regions.util.ts`, `scripts/migrate-regions.script.ts`, script `migrate:regions`, `tests/unit/utils/regions.util.test.ts`, `tests/integration/migrateRegions.test.ts`.
- [ ] `models/user.model.ts`: bỏ `assigned_regions`; `models/farm.model.ts`: bỏ `region`.
- [ ] `routes/farms.route.ts:16`: bỏ validator bắt buộc `region`; `routes/admin.route.ts`: bỏ `PUT /admin/technicians/:id/regions`.
- [ ] Sửa `middlewares/auth.middleware.ts`, `types/express.d.ts`, `types/domain.types.ts`, `controllers/admin.controller.ts`, `controllers/farms.controller.ts`, `services/admin.service.ts`, `services/system.service.ts`, `scripts/seed.script.ts` (bỏ mọi `region`, `assigned_regions`).
- [ ] Migration `migrate:remove-regions` (hoặc gộp vào `migrate:remove-tickets`): `$unset` `users.assigned_regions`, `farms.region`.

**Thông báo cho Farm Owner (FARM-FR-009, ghi chú ² §2.4):**
- [ ] Mỗi lần Technician đăng ký, dời, gỡ, thay thiết bị, gửi lệnh từ xa hay OTA: tạo một thông báo trong app (`notification.service`) cho từng Farm Owner của farm, và một dòng audit (`logAction`) nếu chưa có.
- [ ] Test: Technician dời controller → 1 audit + 1 thông báo cho mỗi Farm Owner; Technician gọi telemetry/analytics/live stream/harvest → 403; Admin gọi `GET /farms/:id` → 403; Technician `GET /farms` thấy farm của mọi chủ.

**API spec:** cập nhật role và bỏ `region` ở schema Farm, User, request tạo farm.

**Xong khi:** `README.md` "Chỗ lệch" #44, #45 đã xong; `grep -rn "region" backend/src` chỉ còn chữ không liên quan (ví dụ "regional" trong comment thời tiết).

### PR 6 — Web + mobile: xoá code ticket, SLA, vùng · đề xuất: Len, Tuấn, Nhi (mỗi người phần role mình), mobile: Kiệt

Làm sau PR 4 và PR 5 (API đã mất). Có thể chia 3 PR nhỏ theo role.

**Farm Owner (Len):**
- [ ] Xoá `pages/farm-owner/FarmOwnerTicketsPage.tsx`, `FarmOwnerTicketDetailPage.tsx`, thư mục `components/features/farm-owner/tickets/` (kèm `tickets.constants.test.ts`).
- [ ] `FarmFormModal`: bỏ ô khu vực; `FarmGroupRow`, `HouseCard`: bỏ hiển thị vùng.
- [ ] Dashboard (`FarmKpiRow`, `dashboardMetrics.ts`), thiết bị (`DeviceDetailCard`, `ZoneComponentLog`, `AttentionDevicesCard`, `DeviceDetailDrawer`): bỏ số ticket, nút tạo ticket.

**Technician (Tuấn):**
- [ ] Xoá `TechnicianTicketsPage.tsx`, `TechnicianTicketDetailPage.tsx`, `TechnicianMaintenancePage.tsx`, `components/features/technician/tickets/`, `components/features/technician/maintenance/`.
- [ ] `TechnicianOnboardingPage`: bỏ bước SAT (`Step6SAT.tsx`) và chỗ gắn ticket; trang này về sau thành màn setup thiết bị chung với Farm Owner (MF-10).
- [ ] `TechnicianFarmsPage`, `TechnicianHouseRow`: bỏ vùng; hiện mọi farm (chỉ cấu trúc và thiết bị).
- [ ] `TechnicianAlertsPage`: chỉ cảnh báo thiết bị, không có nút xác nhận.

**Admin (Nhi):**
- [ ] Xoá `AdminTicketsPage.tsx`, `AdminTicketDetailPage.tsx`, `components/features/admin/tickets/`, `SlaCard.tsx`, `SlaEditModal.tsx`, `TicketTrendsCard.tsx`, `FarmRecentTickets.tsx`.
- [ ] Xoá `AdminFarmsPage.tsx`, `AdminFarmDetailPage.tsx`, `AdminFarmHousePage.tsx`, `components/features/admin/farms/` (Admin không quản lý farm).
- [ ] Người dùng (`CreateUserModal`, `EditUserModal`, `UserDetailModal`, `userColumns`, `UserStats`, `validations/admin/user.validation.ts`, `apis/admin/users.api.ts`, `hooks/admin/useUsers.ts`): bỏ vùng, bỏ sửa hồ sơ Technician.
- [ ] `AdminSystemHealthPage`: chỉ còn số farm, Zone, thiết bị theo trạng thái, tài khoản theo role.

**Dùng chung:**
- [ ] Xoá `apis/shared/tickets.api.ts`, hook ticket, `components/common/TicketStatusBadge.tsx`, `TicketProgressStepper.tsx`, `PriorityBadge.tsx` và `constants/priority.ts` (nếu chỉ ticket dùng), `constants/tickets*`, `constants/sla*`, `constants/ticketStatus.ts`.
- [ ] `constants/enumLabels.i18n.ts`: bỏ nhãn ticket; `types/`: bỏ enum ticket (nếu PR 4 chưa làm), bỏ `region`/`assigned_regions` ở `auth.types.ts`, `farm.types.ts`.
- [ ] `apis/shared/farms.api.ts`, `hooks/shared/useFarms.ts`, `constants/farmStructure.i18n.ts`: bỏ vùng.
- [ ] Socket client: bỏ sự kiện chat ticket.

**Mobile (Kiệt):**
- [ ] Xoá `app/(tabs)/tickets/`, `app/ticket/[ticketId].tsx`, `hooks/useTickets.ts`, `services/api/tickets.ts`; sửa `hooks/index.ts`, `services/api/index.ts`, `constants/api.ts` (`ENDPOINTS`), `types/index.ts`.

**Tài liệu module:** cập nhật `frontend/CLAUDE.md` (cây thư mục, `PriorityBadge`, ticket), `frontend/README.md`, `mobile/CLAUDE.md` (cây `app/`), `CLAUDE.md` gốc (mục Mobile còn ghi tab `tickets`).

**Kiểm tra:**
- [ ] `grep -rniE "ticket|sla|region" frontend/src mobile --include=*.ts --include=*.tsx` → không còn (trừ chữ không liên quan).
- [ ] Lệnh CI của frontend và mobile.

**Xong khi:** `README.md` "Chỗ lệch" #30, #31 (phần ticket) và #41 đã xong.

### PR 7 — Tài liệu sau khi code xong · đề xuất: Nguyễn Chí Bảo

- [ ] `docs/reports/README.md`: đóng #2, #15, #25, #41–#46.
- [ ] Report 4 §12: bỏ dòng "Supporting roles" và phần quyền trong dòng "Permissions"; §6.1 bỏ câu "ticket collections … still in the code"; §6.4 bỏ dòng xoá ticket; §5.3 tên job `relayUsage`.
- [ ] Design Brief G1, Project Tracking (F-07, F-17, DF-2, DF-3), `todo-review2.md`.
- [ ] `CLAUDE.md` gốc mục Module status, `backend/CLAUDE.md` (bảng job, Alert Engine, Ticket visits), `backend/README.md` (dòng TICKET).
- [ ] Sinh lại Report 5 nếu kết quả test đổi: `python3 docs/reports/report5/gen_report5.py <jest.json> docs/reports/report5/template.md docs/reports/report5-test.md`.

---

## Thứ tự và phụ thuộc

```
PR 1 (quyền) ─┐
PR 2 (ẩn UI) ─┴─ trước Review 2
PR 3 (cảnh báo thay ticket) → PR 4 (xoá module ticket) → PR 5 (bỏ vùng, Technician mọi farm) → PR 6 (xoá UI) → PR 7 (tài liệu)
```

- PR 1 và PR 2 làm song song được.
- PR 4 phải sau PR 3: `alertEscalation`, `relayUsage` đang gọi `ticket.service`.
- PR 5 sau PR 4: `ticket.service` đang dùng vùng để gán ticket, xoá ticket trước thì bỏ vùng gọn hơn.
- PR 6 sau PR 4, PR 5: web/mobile gọi API đã bị xoá.
- Đổi enum dùng chung (`AlertType` thêm `MAINTENANCE_DUE`, bỏ `TicketType/Priority/Status`): cả backend, frontend, mobile trong **cùng một PR** (`CLAUDE.md`, Cross-module rules).
- Đổi route: sửa `docs/api/api-spec.yaml` trong **cùng PR**.
