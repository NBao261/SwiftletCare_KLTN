# Việc cần làm — phần scope cuối (sau `todo-review2.md`)

Cập nhật 09/11/2026, theo scope cuối đã chốt với giảng viên hướng dẫn sau Review 2 (phiếu v3 bản cuối, BM03 1.3, SRS 4.2.0, SDD 2.2.0, Report 5 1.5.0, BM04).

File này hướng dẫn **phần làm mới** để hệ thống đủ như hồ sơ đã nộp: Farm Technician, Work Order, bảo trì phòng ngừa, bù phun sương theo thời tiết, profile cấu hình, luật khuyến nghị, tổng quan trại, chu kỳ thu hoạch và bộ giả lập (gap G-20…G-27), cùng hai việc mới của MF-04 và MF-06 (EXPERT-FR-021, 022).

**Khi nào bắt đầu:** ai xong các bước của mình trong `todo-review2.md` (G-01…G-19) thì làm tiếp ở đây, theo thứ tự ở mục 2. Không cần chờ cả nhóm xong.

**Mốc thời gian:** Iteration 2 kết thúc 02/12/2026; Iteration 3 kết thúc 23/12/2026, ngay trước Defense 1.1.

**Đã cam kết trong BM04** (đây là căn cứ chấm Defense 1.1 và Viva):
- 8/8 workflow chạy đầu cuối trên staging;
- 16 kịch bản demo DS-01…16: 100 % kịch bản chính và ít nhất 80 % kịch bản ngoại lệ phải đạt;
- 170 test case, ít nhất 90 % pass, và ít nhất 85 test chạy tự động trong CI;
- không còn lỗi Critical hay High nào mở.

Vì vậy mọi gap trong file này đều cần cho demo; mức ưu tiên chỉ quyết định thứ tự làm.

## 0. Cách làm

Giữ nguyên các quy tắc của `todo-review2.md` §0.2. Nhắc lại những quy tắc hay quên:

1. **Một gap một nhánh** (`feat/g21-work-orders`…). Gap nhiều người làm thì dùng chung một nhánh; mỗi người chỉ sửa file thuộc phần mình.
2. **Spec trước, code sau.**
   - Người viết backend của gap viết route vào `docs/api/api-spec.yaml` trong commit đầu của nhánh.
   - Người làm giao diện ghi endpoint mình cần vào mô tả PR, rồi duyệt spec.
   - Kiệt là chủ file spec nên duyệt mọi thay đổi trong đó; Bảo tự viết phần MQTT.
   - Trong lúc chờ backend, giao diện dùng dữ liệu giả đúng theo spec.
3. **Code backend chỉ do Bảo và Kiệt viết.** Len, Tuấn, Nhi làm màn hình, test E2E, số đo NFR và đề xuất API.
4. **Đóng một gap thì trong cùng PR phải:**
   - sửa đúng dòng gap ở `project-tracking.md` §6 và trạng thái tính năng ở §3;
   - trong `report5/tc.py`, đổi nguồn test của các case liên quan từ `todo-auto` sang test thật (file và tên test);
   - nếu thêm model hoặc collection thì chạy `npm run db:script` trong `backend/`;
   - hằng số mới phải có trong Report 3 §4.5, vị trí trong code ghi ở Report 4 §5.5.

   **Không** tự sinh lại `report5-test.md` hay file Word; Bảo sinh lại trước mỗi mốc.
5. **Code theo SRS/SDD, không sửa tài liệu cho khớp code.** Chỗ nào tài liệu sai hoặc không làm được thì báo Bảo để sửa tài liệu trong một PR riêng.
6. **Viết test cùng PR với tính năng.** Mỗi gap dưới đây ghi rõ test case nào của Report 5 phải viết, và các test này phải pass trong CI của PR.

## 1. Tổng quan phần làm mới

| Gap | Nội dung | Yêu cầu (Report 3) | Thiết kế (Report 4) | Workflow, demo | Người làm | Hạn |
|---|---|---|---|---|---|---|
| **G-20** | Farm Technician thay role `TECHNICIAN` cũ; gán kỹ thuật viên vào nhà; lịch trực | AUTH-FR-004, 005, 013, 014 (O); FARM-FR-009, 013 | D14; `house.service` | Mọi workflow có Farm Technician | Kiệt (backend); Len (đăng nhập technician trên mobile); Nhi (màn gán nhà); Tuấn (console thiết bị của Admin) | 02/12 |
| **G-21** | Định tuyến và leo thang cảnh báo; Work Order đóng bằng dữ liệu; kiểm tra tại chỗ cảnh báo suy luận; MTTA/MTTR | ALERT-FR-005, 015, 017, 018; OPS-FR-001…004, 009; EXPERT-FR-021; BR-39…41 | D17; SM-19; AD-02, AD-04 | WF-02 (DS-03, 04); WF-04 (DS-07) | Kiệt (backend); Len (mobile technician); Nhi (duyệt trên web); Tuấn (bằng chứng trên màn chuyên gia) | 02/12 |
| **G-22** | Bảo trì phòng ngừa: kế hoạch, giờ chạy, checklist, hiệu chuẩn | OPS-FR-005…008; ALERT-FR-016; BR-45 | SM-20; AD-07 | WF-07 (DS-13, 14) | Kiệt (backend); Len (mobile); Nhi (web) | 23/12 |
| **G-23** | Bù phun sương theo thời tiết | ENV-FR-028…030; BR-38 | D18; DF-12; SM-24; topic `compensation` | WF-01 (DS-01) | Bảo (firmware, backend); Tuấn (màn luật) | 02/12 |
| **G-24** | Giai đoạn nhà; profile cấu hình; luật khuyến nghị và đo hiệu quả | FARM-FR-014; EXPERT-FR-014…019; BR-42, 46 | D19; SM-21, 23; AD-05, AD-08 | WF-05 (DS-09, 10); WF-08 (DS-15, 16) | Bảo (backend); Tuấn (web chuyên gia); Nhi (áp profile, đặt giai đoạn nhà, quyết định khuyến nghị trên web Owner) | 23/12 |
| **G-25** | Tổng quan trại; so sánh nhà; ước tính điện năng; xu hướng đàn; lượng mưa trên cảnh báo tỷ lệ về | ANALYTICS-FR-002, 015…017; VISION-FR-011; BR-44, 45 | AD-06 | WF-06 (DS-11) | Bảo (backend); Nhi (web) | 23/12 |
| **G-26** | Chu kỳ thu hoạch và kết luận mùa vụ (luồng phụ SF-06) | HARVEST-FR-001…007; EXPERT-FR-020; BR-43 | SM-22; AD-09 | SF-06 (TC-F30) | Bảo (backend); Nhi (web); Len (nhập trên mobile); Tuấn (kết luận mùa vụ) | 23/12 |
| **G-27** | Bộ giả lập thiết bị | SYSTEM-FR-004; NFR-03, NFR-15 | D20 | Demo nhiều nhà; đo NFR-15 | Bảo | 02/12 |
| **G-11 (phần mới)** | Kỹ thuật viên chấm hằng ngày, Farm Owner chấm ngày có mặt; chuyên gia xem các ngày lệch và chỉnh mức | EXPERT-FR-012, 022; BR-31 | SM-17, 18; AD-06 | WF-06 (DS-11) | Kiệt (backend); Len (chấm trên mobile); Tuấn (màn ngày lệch); Nhi (chấm trên web) | 02/12 |

## 2. Thứ tự và phụ thuộc

Gap sau chỉ bắt đầu khi phần nó cần đã merge vào `develop`:

```
G-20 (role, gán nhà) ──► G-21 (định tuyến, Work Order, kiểm tra tại chỗ) ──► G-22 (bảo trì)
                                         │
G-11 (trạng thái ngày, job thời tiết) ───┼──► G-24 (luật khuyến nghị chạy sau đánh giá ngày)
                                         ├──► G-25 (tổng quan, so sánh: cần trạng thái ngày và MTTR)
                                         └──► G-26 (chu kỳ: tỷ lệ ngày GOOD)
G-07 (topic theo thiết bị) + job thời tiết của G-11 ──► G-23 (bù thời tiết)
G-08 (phiên bản cấu hình) ──► G-24 phần áp profile (mỗi zone một phiên bản mới)
G-13 (đo dòng) ──► phần điện năng của G-25 (thiếu G-13 thì hiện "not available", không chặn)
G-27 (giả lập): không phụ thuộc gì, làm sớm nhất để có dữ liệu nhiều nhà
```

**Lịch đề xuất:**

| Tuần | Kiệt | Bảo | Len | Nhi | Tuấn |
|---|---|---|---|---|---|
| 1 (10–16/11) | Spec G-20, G-21 → backend G-20 | G-27 giả lập; G-07 (từ `todo-review2.md`) | Đăng nhập technician, danh sách nhà được gán (G-20) | Màn gán kỹ thuật viên (G-20) | Console thiết bị của Admin (G-20) |
| 2 (17–23/11) | Backend G-21 | G-23 firmware + backend | Màn cảnh báo + Work Order của technician (G-21) | Duyệt Work Order trên web (G-21) | Màn luật thời tiết (G-23); bằng chứng kiểm tra tại chỗ (G-21) |
| 3 (24/11–02/12) | Phần mới của G-11 (chấm điểm, ngày lệch) | Spec G-24, G-25, G-26 | Chấm điểm ngày trên mobile (G-11) | Chấm điểm trên web (G-11) | Màn ngày lệch (G-11) |
| 4 (03–09/12) | Backend G-22 | Backend G-24 | Checklist, ghi bảo trì (G-22) | Kế hoạch bảo trì (G-22); áp profile, giai đoạn nhà (G-24) | Profile, luật khuyến nghị (G-24) |
| 5 (10–16/12) | Seed cho DS của workflow mình; sửa lỗi | Backend G-25, G-26 | Nhập thu hoạch (G-26) | Tổng quan, so sánh nhà, quyết định khuyến nghị (G-24, G-25), chu kỳ thu hoạch (G-26) | Trang hiệu quả luật (G-24); kết luận mùa vụ (G-26) |
| 6 (17–23/12) | Tổng duyệt demo trên staging, đo NFR, viết nốt test | (như cột trái) | (như cột trái) | (như cột trái) | (như cột trái) |

## 3. Từng gap — các bước

### G-20 — Farm Technician (Kiệt, Len, Nhi, Tuấn) — hạn 02/12

**Backend (Kiệt):**
- [x] Spec: thêm phần kỹ thuật viên và lịch trực của nhà vào `/farms` (`houses.technicians`, roster); đổi enum `Role`, bỏ `TECHNICIAN` và thêm `FARM_TECHNICIAN`. *Xong trừ lịch trực (a6fbf9c): `houses.technicians`, API gán/bỏ gán, enum; roster thêm khi làm lịch trực.* *(Lịch trực: `a86b9d0`, `GET/PUT /farms/houses/{houseId}/roster`, ca theo tuần do Farm Owner nhập giờ.)*
- [x] Đổi enum ở `backend/src/types/domain.types.ts`, `frontend/src/types/` và `mobile/src/types/` cùng một PR (shared enums). Viết `migrate:*` để chuyển dữ liệu cũ. *Backend và `migrate:farm-technician` xong (f9d9522); web xong (`f9364593`, `4621428f` — Tuấn, Nhi); mobile xong (`384ace40` — Len), cả ba cùng PR #146.*
- [x] Quyền: Farm Technician là thành viên farm, chỉ thao tác trên nhà được gán. Thao tác ở nhà khác trả 403 (AUTH-FR-013). Gán một người không phải Farm Technician của farm trả 409. Mỗi nhà có tối đa một technician chính. *(f9d9522) `canAccessHouse` trong `farmAccess.util`; gỡ thợ khỏi farm thì bỏ luôn các lần gán; thợ chưa nhận cảnh báo cho tới G-21.* *(12/11, sau review #146: thợ xem được cảnh báo của nhà được giao (`GET /alerts`, `GET /alerts/{id}`), nhận thông báo và xác nhận vẫn chờ G-21; Domain Expert không xem lịch trực, `GET /farms/{id}/houses` chỉ trả cả lịch cho Farm Owner, thợ chỉ thấy ca của mình — Report 3 §2.4.)*
- [x] Technician được bật tắt tay, restart controller, vẽ vòng đếm, nhập thu hoạch và chấm điểm ngày ở nhà được gán. Không được sửa tham số, lắp thiết bị hay mời thành viên (Report 3 §2.4). *Relay, restart, vòng đếm, xem dashboard và live stream xong (f9d9522); nhập thu hoạch chờ trạng thái DRAFT của HARVEST-FR-006 (G-26), chấm điểm ngày ở G-11.* *(11/11: nhập thu hoạch `fb2db1d` — lô của thợ là `DRAFT`, Farm Owner xác nhận bằng `POST /harvests/{id}/confirm`, thợ chỉ sửa/xoá lô `DRAFT` của mình; chấm điểm ngày **chuyển sang G-11** (mục "Người chấm" của G-11 phần mới), làm khi #126 và #146 đã merge vì cần code G-11.)*
- [x] Lệnh từ xa (RESTART, đẩy cấu hình, OTA) chuyển hẳn sang console của Administrator (FARM-FR-009, 013); mọi lệnh đều ghi audit và báo cho Farm Owner. *(f9d9522) Farm Owner và thợ của nhà vẫn RESTART được (Report 3 §2.4); lệnh của Farm Owner không tự báo chính họ.*
- [x] Lịch trực (AUTH-FR-014, mức O): làm sau cùng. Nhà không có lịch trực thì dùng technician chính. *(Backend: Kiệt, 11/11, `8288724`: lịch tuần theo nhà, thợ chính/thợ phụ, giờ VN, ca qua nửa đêm; chỉ thợ đang được giao, ca cùng vai không chồng giờ; thợ chỉ xem ca của mình; bỏ gán thì mất ca; `roster.util#technicianOnDuty` cho G-21 gửi cảnh báo. Màn lịch trực trên web: Nhi.)*
- [x] Bỏ `technicianAccess` cũ và route `/ota` của Technician cũ; cập nhật `roleMatrix.test.ts`. *Backend xong (f9d9522): `technicianAccess.test.ts` viết lại theo nhà được gán, `roleMatrix.test.ts` theo role mới, bỏ `/admin/technicians`; web xong (`f9364593`, `4621428f` — Tuấn, Nhi): route `/ota` chuyển sang `ADMIN_ONLY`, cập nhật `roles.test.ts`.*

**Giao diện:**
- [ ] Len: đăng nhập bằng tài khoản technician; tab theo `roleTabs.ts`; danh sách các nhà được gán.
- [x] Nhi: màn gán technician vào nhà trên web Owner. Màn lịch trực để sau cùng, cùng lúc với phần backend. *(Gán xong: Nhi, 11/11, nhánh `feat/g20-farm-technician` — tab "Thành viên farm" của trang nhà có mục "Kỹ thuật viên": công tắc "Giao nhà này" và ô "Thợ chính" lưu ngay qua `PUT/DELETE /farms/houses/{houseId}/technicians/{userId}`, Farm Owner nào cũng giao được, chuyên gia chỉ xem; mời Farm Technician vào farm (`INVITE_ROLES`); mục "Chủ nhà yến" không còn lẫn kỹ thuật viên. Lịch trực xong 11/11: nhóm "Lịch trực" trong tab "Thành viên farm" — bảng ca (thợ, loại ca chính/phụ, ngày, giờ, ca qua đêm), thêm/sửa/xoá ca gửi lại cả lịch qua `PUT …/roster`, kiểm trước như backend (≥ 1 ngày, giờ khác nhau, ca cùng loại không chồng giờ, `roster.validation.test.ts`); chỉ Farm Owner thấy nhóm này, chuyên gia và thợ không xem lịch trực (Report 3 §2.4). Tab Thành viên farm chia 4 nhóm bằng chip, bảng cố định 5 dòng, ô tìm theo tên/email.)*
- [x] Tuấn: màn Technician cũ chuyển thành console thiết bị của Administrator (danh sách thiết bị, cảnh báo thiết bị, RESTART, OTA). *(Tuấn, 10/11, nhánh `feat/g20-farm-technician`, commits `f9364593` + `a527ace2`, cùng `4621428f`: đổi enum `TECHNICIAN` → `FARM_TECHNICIAN` trên web, thêm nhóm Console Thiết bị (`/devices`, `/alerts`, `/ota`) vào `AdminLayout`, khóa `PUSH_CONFIG` và `/ota` cho `ADMIN`, giữ `RESTART` cho `ADMIN`/`FARM_OWNER`/`FARM_TECHNICIAN`, chuyển `AudioTracksModal` sang `FARM_OWNER`, gỡ tạo tài khoản Technician ở Admin; 214/214 tests pass)*

**Xong khi:** `roleMatrix.test.ts` pass với role mới, technician nhà A nhận 403 ở nhà B, và không còn chuỗi `TECHNICIAN` nào ngoài `FARM_TECHNICIAN` và phần migration.

### G-21 — Định tuyến, Work Order, kiểm tra tại chỗ (Kiệt, Len, Nhi, Tuấn) — hạn 02/12

**Backend (Kiệt):**
- [ ] Spec `/work-orders`: danh sách theo nhà hoặc người được giao, open, start, done (kèm nguyên nhân, ảnh, checklist), approve, reopen, cancel, reassign.
- [ ] Collection `workorders`: index `house_id + status` và `assignee_id + status`; index unique một phần trên `alert_id` khi chưa đóng, để mỗi cảnh báo chỉ có một Work Order mở. Ảnh lưu trên MinIO. Chạy `npm run db:script`.
- [ ] `alertRouting.service`:
  - người nhận là technician đang trực của nhà;
  - nhà không có technician thì gửi Farm Owner;
  - cảnh báo CRITICAL gửi cả hai cùng lúc;
  - cảnh báo suy luận gửi thêm Domain Expert (ALERT-FR-017).
- [ ] `alertEscalation.job` chạy mỗi phút:
  - leo thang lên Farm Owner một lần sau `escalation_min` (mặc định 15, khoảng 5–60, BR-40);
  - CRITICAL luôn tới ít nhất một kênh ngoài app (ALERT-FR-005).
- [ ] Cơ chế gửi lại đã có (`renotifyStaleAlerts`, ALERT-FR-015, `alertRenotify.test.ts`): giữ nguyên, chỉ đổi danh sách người nhận sang `alertRouting.service`, và giữ cho test cũ vẫn pass.
- [ ] `workOrder.service`:
  - mở tự động theo BR-39: `MISTING_INEFFECTIVE`, `ACTUATOR_FAULT`, `SENSOR_FAULT`, `RS485_BUS_FAILURE`, `SPEAKER_FAILURE`; `NODE_OFFLINE` hoặc `EDGE_AI_DEGRADED` còn mở sau 30 phút; cảnh báo suy luận chuyên gia xác nhận cần đến nhà;
  - cùng một sự cố lặp lại không mở Work Order thứ hai;
  - Farm Owner mở tay được; technician hoặc chuyên gia mở thì 403.
- [ ] Nguyên nhân tại chỗ (ALERT-FR-018): nước, béc phun, bơm, quạt, cửa, cảm biến, loa hoặc khác, kèm ảnh. Đóng Work Order của cảnh báo thiết bị mà thiếu nguyên nhân trả 422.
- [ ] `recoveryCheck.job` mỗi phút (BR-41):
  - "done" chuyển sang `VERIFYING`;
  - giữ phục hồi đủ `recovery_verify_min` (mặc định 10) thì chuyển `AWAITING_APPROVAL`;
  - sự cố quay lại thì về `IN_PROGRESS`;
  - cảnh báo tự phục hồi trước khi bắt đầu làm thì đóng với kết quả "self-recovered".
- [ ] Farm Owner duyệt (đóng Work Order và cảnh báo), mở lại kèm ghi chú, huỷ kèm lý do (OPS-FR-004). Duyệt sai trạng thái trả 409.
- [ ] MTTA, MTTR, tỷ lệ bảo trì đúng hạn theo nhà và theo technician (OPS-FR-009, BR-40), trong `opsMetrics.service`.
- [ ] **Kiểm tra tại chỗ (EXPERT-FR-021):**
  - mỗi cảnh báo suy luận ở nhà có technician tạo đúng một yêu cầu kiểm tra cho technician đó;
  - technician ghi quan sát (chim bị động, có người hoặc công việc gần đó, mưa, cảm biến bẩn hoặc hỏng, không có gì lạ, khác) kèm ảnh tuỳ chọn;
  - quan sát được thêm vào bằng chứng của cảnh báo (ALERT-FR-014) trước khi chuyên gia kết luận;
  - `SENSOR_ANOMALY` được trả lời "cảm biến hỏng" thì mở ngay một Work Order sửa chữa;
  - technician nhà khác trả lời thì 403;
  - nhà không có technician thì không tạo yêu cầu.

**Giao diện:**
- [ ] Len (mobile technician): danh sách cảnh báo của các nhà được gán, xác nhận cảnh báo kèm nguyên nhân; Work Order với các nút start, done, chụp ảnh; màn trả lời yêu cầu kiểm tra tại chỗ.
- [ ] Nhi (web Owner): danh sách Work Order, duyệt, mở lại, huỷ, giao lại; MTTA và MTTR trên trang nhà.
- [ ] Tuấn (web chuyên gia): hiện quan sát của technician trong gói bằng chứng của cảnh báo suy luận.

**Test phải viết trong PR:**
- TC-F23-01…03;
- TC-F24-01…03;
- TC-ST-54…63 (vòng đời Work Order);
- phần mới của TC-F13-01 (yêu cầu kiểm tra và quan sát nằm trong bằng chứng).

**Demo:** DS-03, DS-04 (Len trình bày), DS-07 (Tuấn trình bày).

### G-22 — Bảo trì phòng ngừa (Kiệt, Len, Nhi) — hạn 23/12

**Backend (Kiệt):**
- [ ] Spec `/maintenance`: kế hoạch, mẫu checklist, ghi bảo trì và hiệu chuẩn, danh sách đến hạn.
- [ ] Collection `maintenanceplans` (index `house_id + equipment`, `state + next_due_at`; mẫu checklist nhúng trong document).
- [ ] Kế hoạch theo giờ chạy hoặc số lần đóng ngắt (bơm, quạt) và theo lịch (vệ sinh cảm biến và béc phun, hiệu chuẩn). Khoảng ≤ 0 trả 422; technician tạo kế hoạch trả 403 (OPS-FR-005).
- [ ] **Không tự đặt chu kỳ bảo trì.** Chu kỳ do Farm Owner nhập theo khuyến cáo của nhà sản xuất hoặc người nuôi. Dữ liệu demo ghi rõ nguồn.
- [ ] `runHours.job` mỗi giờ (BR-45): tính giờ chạy khi relay ON; bộ điều khiển có đo dòng thì chỉ tính khi dòng trên 50 % dòng bình thường.
- [ ] `maintenanceDue.job` mỗi giờ, và lúc 07:00 cho kế hoạch theo lịch:
  - đến hạn thì tạo `MAINTENANCE_DUE` (mức LOW) và một Work Order phòng ngừa cho technician (ALERT-FR-016);
  - quá hạn thêm `maintenance_grace_days` (7 ngày) thì báo Farm Owner một lần (`OVERDUE`).
- [ ] Ghi bảo trì: đặt bộ đếm về 0, đóng `MAINTENANCE_DUE`, tính hạn kế tiếp. Ghi hiệu chuẩn thì lưu ngày hiệu chuẩn kế tiếp (OPS-FR-008).
- [ ] Checklist kiểm tra (bồn nước, béc phun, quạt, cửa, dấu vết chuột hoặc rắn): mục nào ghi "defect" thì mở Work Order sửa chữa (OPS-FR-007).

**Giao diện:**
- [ ] Len: làm checklist kèm ảnh, ghi bảo trì và hiệu chuẩn trên mobile.
- [ ] Nhi: tạo và sửa kế hoạch bảo trì, xem danh sách đến hạn và quá hạn trên web.

**Test:** TC-F25-01…03; TC-ST-64…68.

**Demo:** DS-13, DS-14 (Len trình bày).

### G-23 — Bù phun sương theo thời tiết (Bảo, Tuấn) — hạn 02/12

- [ ] Spec: luật bù thời tiết của nhà nằm trong `/farms` (houses); topic retained `swiftletcare/dev/{deviceId}/compensation` với `offset_pct` (−10…+10), `expires_at`, `rule_id`, QoS 1 (Report 4 §7.2).
- [ ] Backend: luật theo nhà (ENV-FR-030):
  - điều kiện dự báo: nhiệt độ ≥, độ ẩm ngoài trời ≥, hoặc có mưa;
  - offset ngoài ±10 hoặc thời hạn quá 2 giờ trả 400;
  - Farm Owner (ở farm có chuyên gia) hoặc technician gửi luật thì 403.
- [ ] `weatherCompensation.job` chạy mỗi giờ, sau `weather.job` của G-11 (ENV-FR-028):
  - lấy dự báo 2 giờ tới; khi nhiều luật cùng đúng thì lấy offset có trị tuyệt đối lớn nhất;
  - gửi offset kèm hạn, tối đa 2 giờ;
  - không có luật hoặc không có dự báo thì gửi 0.
- [ ] Firmware (ENV-FR-029):
  - cộng offset vào nhu cầu phun của bộ mờ cho tới khi hết hạn, kẹp kết quả trong 0–100 %;
  - hết hạn, hoặc mất broker 2 giờ, thì offset về 0;
  - không đụng quạt, bật tay hay chốt phun.
  - Hằng số: `WEATHER_COMP_MAX_PCT`, `WEATHER_COMP_MAX_MS` ở backend; `WEATHER_COMP_OFFLINE_MS` ở firmware (Report 4 §5.5).
- [ ] Ghi vào nhật ký mỗi lần áp offset, để đo hiệu quả trên những ngày có và không có bù (NFR-16, không cam kết, nhưng nên có số liệu).
- [ ] Tuấn: màn luật bù thời tiết trên web chuyên gia.

**Test:** TC-F26-01, TC-F26-03 (jest); TC-F26-02 (`pio test -e native`).

**Demo:** DS-01 (Bảo trình bày).

**Lưu ý:** làm sau G-07, vì topic `compensation` nằm trong cây topic theo thiết bị.

### G-11 (phần mới) — Chấm điểm của technician và xem ngày lệch (Kiệt, Len, Nhi, Tuấn) — hạn 02/12

Các bước chung của G-11 vẫn ở `todo-review2.md`. Phần đổi theo scope cuối:

- [x] Người chấm (BR-31, EXPERT-FR-012): *(Farm Owner xong, Domain Expert và Administrator 403 — Kiệt, 10/11, `08c5e18`; Farm Technician xong — Kiệt, 12/11, `621bd480` spec + `d515d45d`: thợ chấm, bỏ qua, ghi chú ở nhà được giao, nhà khác hoặc bị gỡ khỏi nhà 403, xem ngày, báo cáo, CSV của nhà được giao, không xem độ khớp và ngày lệch; thông báo "ngày đã sẵn sàng" tới thợ được giao.)*
  - Farm Technician của nhà chấm **mỗi ngày**; Farm Owner chấm **những ngày có mặt ở nhà**;
  - Domain Expert và Administrator gửi chấm điểm thì 403;
  - mỗi technician và mỗi Farm Owner chấm riêng.
- [x] Trước khi chấm hoặc bỏ qua, mọi endpoint (ngày, báo cáo, CSV) không trả trạng thái, lý do hay điểm của người khác. Rating và snapshot lưu trong một lần ghi atomic, rồi mới trả trạng thái. *(đã có từ 31/10, giữ nguyên khi đổi người chấm)*
- [x] Ngày được tạo lượt chấm chờ cho từng technician được gán và từng Farm Owner. *(lượt chấm suy ra lúc đọc, không lưu; Farm Owner xong, chuyên gia không còn lượt chấm — `08c5e18`; technician xong — `d515d45d`)* Quá 7 ngày chưa chấm thì `EXPIRED` (SM-18).
- [x] **Xem ngày lệch (EXPERT-FR-022):** *(backend: Kiệt, 10/11, `4dda5e6` + `08c5e18`, `GET /health-reports/disagreements`; màn hình: Tuấn)*
  - chuyên gia xem các ngày có điểm chấm khác snapshot, kèm chỉ số và lý do của từng ngày;
  - chuyên gia chỉnh mức chỉ số sức khỏe của nhà (BR-28); thay đổi lưu lịch sử và áp từ lần đánh giá tiếp theo;
  - Farm Owner (ở farm có chuyên gia) hoặc technician vào chức năng này thì 403.
- [ ] Giao diện *(còn mobile của Len và tab báo cáo của chuyên gia — Tuấn)*:
  - [ ] Len: chấm điểm trên mobile, hiện hướng dẫn chấm (BR-37) trước khi chấm;
  - [x] Nhi: chấm điểm trên web Owner; *(Nhi, 11/11: `/health` — Farm Owner chấm hoặc "Bỏ qua" ngày không có mặt ở nhà, hướng dẫn BR-37 trước khi chọn mức (10/11), Domain Expert không còn chấm (10/11))*
  - [x] Tuấn: màn ngày lệch và chỉnh mức trên web chuyên gia. *(Tuấn, 10/11, nhánh `feat/g11-health-assessment`, commits `1c5ee85c` + `bf936377`: DisagreementsSection (scope filter, KPI strip, Bento grid mức chỉ số), DisagreementDayCard, ExpertHealthLevelsModal (GET/PUT /farms/houses/{houseId}/health-levels, BR-28); 8 unit tests; 245/245 tests pass)*
  - [ ] Tuấn: tab "Báo cáo & Kết luận định kỳ" của chuyên gia (`/domain-expert/reports`) theo báo cáo theo nhà (`GET /health-reports?houseId|farmId&kind`, `GET /health-reports/{id}`) thay báo cáo tuần theo Zone đã deprecated; chuyên gia viết kết luận bằng `PUT /health-reports/{id}/conclusion` (EXPERT-FR-007); bỏ số liệu bịa khi chưa có báo cáo (chu kỳ, tên zone, số mẫu, số kỳ tuần); chữ qua `healthDict`. *(Nhi phát hiện 11/11; dùng lại `HealthReportSection`, `HealthReportView`)*

**Test:** TC-F22-01…03; TC-ST-44…53.

**Đo:** NFR-14 cần ít nhất 14 ngày được chấm ở nhà thật. **Bắt đầu chấm ngay khi G-11 lên staging**, vì càng chạy muộn thì càng không đủ ngày trước Defense.

### G-24 — Giai đoạn nhà, profile, luật khuyến nghị (Bảo, Tuấn, Nhi) — hạn 23/12

**Backend (Bảo):**
- [ ] Spec `/profiles` (draft, approve, archive, apply), `/recommendations` (luật, khuyến nghị của nhà, chấp nhận, từ chối, hiệu quả theo luật), giai đoạn nhà trong `/farms`.
- [ ] Collections `configprofiles`, `recommendationrules`, `recommendations` (unique `rule_id + house_id` khi đang `OPEN`). Chạy `npm run db:script`.
- [x] **Giai đoạn nhà** (FARM-FR-014, BR-46): *(backend: Kiệt, 12/11, `78ada1a` + `e5ebd08`, làm trong PR #126 của G-11; màn đặt giai đoạn trên web: Nhi)*
  - Farm Owner hoặc chuyên gia đặt `ATTRACTING` / `OCCUPIED`, có lịch sử; technician đặt thì 403;
  - nhà `ATTRACTING` không đánh giá chỉ số đàn, không tạo `LOW_RETURN_RATE`, lý do ghi "attracting stage".
- [ ] **Profile** (EXPERT-FR-014, 015; SM-23):
  - chuyên gia tạo profile `DRAFT` (ngưỡng, hệ số mờ, tham số phát hiện, lịch loa) rồi duyệt thành `APPROVED`;
  - giá trị ngoài khoảng trả 400; người không phải chuyên gia duyệt thì 403;
  - Farm Owner áp profile cho các nhà: mỗi zone nhận một thay đổi có lịch sử (nguồn `PROFILE`) và một phiên bản cấu hình mới (cần G-08);
  - áp profile `DRAFT` hoặc `ARCHIVED` trả 409.
- [ ] **Luật khuyến nghị** (EXPERT-FR-016…019, BR-42):
  - luật = chỉ số nhà + cửa sổ 1–30 ngày + hành động (loại Work Order hoặc thay đổi tham số);
  - `recommendation.job` chạy mỗi ngày sau đánh giá ngày, mỗi luật và nhà chỉ có một khuyến nghị đang mở; khuyến nghị mở quá 7 ngày thì `EXPIRED`;
  - Farm Owner chấp nhận thì tạo đúng một Work Order (cần G-21) hoặc một mục duyệt (G-04); từ chối thiếu lý do trả 422;
  - `recommendationEffect.job` tính hiệu quả vào ngày thứ 7 sau khi chấp nhận: chỉ số 7 ngày sau trừ 7 ngày trước, rồi chuyển `MEASURED`.
- [ ] **Không tự viết luật.** Phải có ít nhất 3 luật thật từ chuyên gia (phỏng vấn, mục 4); luật trong dữ liệu demo ghi rõ nguồn.

**Giao diện:**
- [ ] Tuấn (web chuyên gia): soạn và duyệt profile; soạn luật; trang hiệu quả theo luật (số khuyến nghị đã tạo, đã chấp nhận, đã cải thiện).
- [ ] Nhi (web Owner): áp profile cho nhiều nhà; đặt giai đoạn nhà; danh sách khuyến nghị với nút chấp nhận / từ chối kèm bằng chứng.

**Test:** TC-F27-01…03; TC-F28-01…03; TC-ST-69…74.

**Demo:** DS-15, DS-16 (Tuấn trình bày). Profile và giai đoạn nhà thuộc WF-05 (Kiệt trình bày): không có DS riêng, được kiểm bằng TC-F28 và có thể chạy thêm sau DS-09.

### G-25 — Tổng quan trại, so sánh nhà, điện năng (Bảo, Nhi) — hạn 23/12

- [ ] Spec `/farms/{id}/overview`, `/farms/{id}/comparison`.
- [ ] `farmOverview.service` (ANALYTICS-FR-015): mỗi nhà hiện giai đoạn, trạng thái hôm nay, cảnh báo đang mở, Work Order đang mở, tỷ lệ về gần nhất. Nhà chưa có trạng thái thì ghi lý do.
- [ ] `houseComparison.service` (ANALYTICS-FR-016, BR-44):
  - các cột: thời gian trong ngưỡng, tỷ lệ ngày `GOOD`, tỷ lệ về trung bình, xu hướng đàn, cảnh báo, MTTR, điện năng ước tính, sản lượng chu kỳ gần nhất;
  - sắp xếp được theo từng cột; **không có điểm tổng hay xếp hạng**.
- [ ] Điện năng (ANALYTICS-FR-017, BR-45): điện áp × dòng trung bình × thời gian chạy, theo tải và theo tháng; tải không đo dòng thì hiện "not available". Phải có G-13 mới có số thật.
- [ ] Xu hướng đàn theo tuần và tháng từ số chim ra buổi sáng (ANALYTICS-FR-002); lượng mưa của phiên ghi trên cảnh báo `LOW_RETURN_RATE` (VISION-FR-011).
- [ ] Thiết bị giả lập luôn có nhãn "simulated" trên mọi màn hình (SYSTEM-FR-004).
- [ ] Nhi: trang tổng quan trại và bảng so sánh nhà trên web.

**Test:** TC-F29-01…03.

**Demo:** dùng giả lập (G-27) để có nhiều nhà, cùng với DS-11.

### G-26 — Chu kỳ thu hoạch (Bảo, Nhi, Len, Tuấn) — hạn 23/12

- [ ] Spec `/harvests`: lô thu hoạch (nhập, xác nhận), chu kỳ của zone, kết luận mùa vụ.
- [ ] Collection `harvestcycles` (unique `zone_id + start_date`).
- [ ] Nhập lô (HARVEST-FR-001):
  - technician nhập thì lô ở `DRAFT`;
  - Farm Owner xác nhận thì thành `CONFIRMED`; xác nhận lại trả 409, technician xác nhận thì 403 (HARVEST-FR-006).
- [ ] Đóng chu kỳ khi xác nhận (HARVEST-FR-007, BR-43):
  - tính sản lượng; so với chu kỳ trước và cùng kỳ năm trước (±30 ngày);
  - tính tỷ lệ ngày `GOOD`, tỷ lệ về, thời gian trong ngưỡng;
  - chu kỳ có dưới 80 % số ngày được đánh giá thì ghi "incomplete".
- [ ] Chuyên gia viết kết luận mùa vụ thì chu kỳ chuyển `CONCLUDED`, và mỗi Farm Owner nhận một thông báo (EXPERT-FR-020).
- [ ] Nhập sổ sản lượng các mùa trước của nhà thử nghiệm nếu chủ nhà còn giữ (A-8). Không có thì dữ liệu mẫu phải ghi rõ là mẫu.
- [ ] Giao diện:
  - Len: nhập lô thu hoạch trên mobile;
  - Nhi: xác nhận lô và xem chu kỳ trên web; *(Xác nhận lô xong — Nhi, 11/11, nhánh `feat/g20-farm-technician` (API `fb2db1d` của Kiệt): trang Thu hoạch hiện nhãn "Chờ xác nhận" ở đợt còn lô `DRAFT`, lọc theo trạng thái, menu "Xác nhận đợt thu" (Farm Owner) gọi `POST /harvests/{id}/confirm` cho từng lô `DRAFT`. Còn xem chu kỳ, chờ backend G-26. 12/11: thẻ sản lượng, biểu đồ năm và tỉ lệ loại tổ chỉ tính lô đã xác nhận (BR-43); bảng và CSV (cột Trạng thái) vẫn có lô chờ xác nhận.)*
  - Tuấn: viết kết luận mùa vụ.

**Test:** TC-F30-01…03. Đây là luồng phụ, test không tính vào 170 nhưng vẫn phải viết.

### G-27 — Bộ giả lập thiết bị (Bảo) — hạn 02/12, làm sớm nhất

- [ ] `simulator/` (Node.js + mqtt.js):
  - đăng ký N controller và camera qua API Admin;
  - publish telemetry, heartbeat và số đếm trên đúng topic của thiết bị thật;
  - có kịch bản gây sự cố (cảnh báo, mất kết nối) để test định tuyến và Work Order.
- [ ] Mọi thiết bị giả lập có cờ `simulated`, hiện trên mọi màn hình (SYSTEM-FR-004).
- [ ] Dùng cho:
  - NFR-03: 120 controller và 20 camera;
  - NFR-15: 30 cảnh báo và 10 Work Order, đo độ trễ leo thang và độ trễ xác minh phục hồi;
  - demo nhiều nhà ở WF-06.

## 4. Việc ngoài code (cả nhóm cùng làm)

| Việc | Cần cho | Hạn |
|---|---|---|
| 18 mục sửa tài liệu của BM02 (BM04 §9, các mục có hạn 11/11) | Cam kết BM04 | 11/11/2026 |
| Train model v2 trên frame khó; đo NFR-09 trên cùng ngày test và clip của v1. Mục tiêu dưới 10 %, nên nhắm 5–7 % | WF-03, NFR-09 | 02/12/2026 |
| Phỏng vấn 2–3 người nuôi: mức chỉ số sức khỏe (BR-28…30), ít nhất 3 luật khuyến nghị, chu kỳ bảo trì thực tế | MF-06, MF-07, MF-08 có nguồn | 02/12/2026 |
| Chấm điểm thực địa ≥ 14 ngày (technician chấm hằng ngày) | NFR-14 | Bắt đầu từ khi G-11 lên staging |
| Staging (G-17) và seed cho từng DS. Chủ workflow viết điều kiện đầu; Kiệt và Bảo viết seed | 8 workflow đầu cuối | 02/12/2026 |
| Test E2E Playwright cho từng DS (`frontend/e2e/ds-xx.spec.ts`), mỗi chủ workflow viết DS của mình | DS-01…16 | 23/12/2026 |
| Đo NFR: Nhi NFR-01, 13, 14; Len NFR-02; Bảo NFR-06, 09; Kiệt NFR-15 | 7 NFR cam kết | 23/12/2026 |
| Viết 68 test tự động còn lại, mỗi test trong PR của tính năng nó kiểm | ≥ 85 test chạy trong CI | Theo từng gap |

## 5. Kiểm tra trước Defense 1.1

- [ ] 8/8 workflow chạy đầu cuối trên staging với seed; mỗi chủ workflow tự trình bày DS của mình.
- [ ] 16/16 DS: đạt 100 % kịch bản chính và ít nhất 7/8 kịch bản ngoại lệ.
- [ ] Ít nhất 90 % trong 170 test case pass, và 100 % test đường chính của các tính năng bắt buộc pass.
- [ ] Ít nhất 85 test chạy tự động trong CI. Hiện có 84; Bảo sinh lại Report 5 từ CI trên tag Defense.
- [ ] Không còn lỗi Critical hay High nào mở (issue gắn nhãn `bug`).
- [ ] Đã đóng G-20…G-27 ở Project Tracking §6; không còn test case nào ở trạng thái `todo-auto` mà tính năng đã xong.
- [ ] Mỗi thành viên đạt đủ cam kết của mình ở BM04 §7: số test, số DS trình bày, các mục sửa đứng tên mình.
