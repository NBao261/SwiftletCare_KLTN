# Kế hoạch sửa validate (rà soát 28/11/2026)

Nguồn: rà soát toàn bộ validate của `backend/` (route, service, MQTT) và `frontend/` (module `validations/`, các form). Kế hoạch này là danh sách việc, không phải yêu cầu; yêu cầu vẫn ở Report 3. Hằng số mới nằm ở Report 3 §4.5 (A-4).

## 1. Mục tiêu và phạm vi

- Không có body, query hay payload MQTT nào làm backend trả 500 chỉ vì sai kiểu.
- Mọi chuỗi người dùng nhập có độ dài tối đa; mọi số có biên; mọi khoảng thời gian có `from <= to`.
- Frontend chặn ngay những gì backend sẽ từ chối, với cùng giới hạn.
- Không đổi hành vi nghiệp vụ, không thêm tính năng. Chỗ nào chưa có nguồn quy định thì để nguyên (mục 6).

Ngoài phạm vi: `mobile/` (Len), đối chiếu từng ràng buộc với `api-spec.yaml` ngoài các trường đổi ở đây.

## 2. Quy tắc chung

1. **Mọi chuỗi** đi qua `isString().bail()` trước khi `trim`, `notEmpty`, `isEmail`, `isLength`, `matches` (express-validator coi mảng và object là hợp lệ với các hàm này; đã chạy thử).
2. Giới hạn dùng chung nằm ở `backend/src/utils/inputRules.util.ts`; route và service import từ đó, không viết lại số trong từng route.
3. Khoảng thời gian: `isISO8601()` + `Date.parse` hợp lệ + `from <= to`.
4. Dữ liệu thiết bị (MQTT) không đáng tin: giá trị sai kiểu hoặc ngoài khoảng bị coi là thiếu, không làm hỏng cả tin.
5. Giới hạn nào mới đặt thì thêm vào Report 3 §4.5 trong cùng PR.

## 3. Hằng số mới (Report 3 §4.5)

| Hằng | Giá trị |
|---|---|
| Địa chỉ trang trại | tối đa 200 ký tự |
| Mô tả nhà yến | tối đa 500 ký tự |
| Họ tên | tối đa 100 ký tự |
| Email | tối đa 254 ký tự |
| Số điện thoại | 8–20 ký tự gồm số, khoảng trắng, `+`, `-`, `(`, `)` |
| Mật khẩu mới | 8–72 ký tự (72 là giới hạn của bcrypt); mật khẩu khi đăng nhập tối đa 128 |
| Lý do thao tác thiết bị hoặc tài khoản | tối đa 500 ký tự |
| Mã kích hoạt thiết bị | tối đa 128 ký tự |
| Mã FCM của máy | tối đa 512 ký tự |
| Một lô thu hoạch | tối đa 100 000 tổ và 1 000 000 g |
| Link ảnh sản phẩm | tối đa 5 link, mỗi link http(s) tối đa 2048 ký tự |
| Số đếm chim mỗi phiên | tối đa 1 000 000; độ tin cậy trung bình 0–1; mốc giờ không trước 01/01/2025 và không quá 5 phút sau giờ nhận |
| Số đo hợp lệ của cảm biến | nhiệt độ, độ ẩm, ánh sáng, NH3, CO2 theo khoảng đo của ngưỡng (`THRESHOLD_LIMITS`); tiếng ồn 0–140 dB; ánh sáng, NH3, CO2 vượt tầm đo thì giữ ở mức cực đại |
| Chẩn đoán trong heartbeat | RSSI −127…0; FPS 0…1000; phiên bản firmware tối đa 32 ký tự, phiên bản mô hình tối đa 64 |
| Tin cảnh báo của thiết bị | nội dung tối đa 500 ký tự; link ảnh http(s) tối đa 2048; dữ liệu thô lưu tối đa 8 KB |

## 4. Backend (Bảo)

| ID | File | Việc | Test |
|---|---|---|---|
| B1 | `utils/inputRules.util.ts` (mới) | Hằng số mục 3; hàm dựng chain: `emailField`, `passwordField`, `reasonField`, `isoInstant`, `isoRange`. | Unit: mảng, object, chuỗi dài, `2026-W43`, `from > to` đều bị từ chối. |
| B2 | `routes/auth.route.ts`, `controllers/auth.controller.ts` | `login`, `forgot-password`, `reset-password`, `PUT /password` dùng `isString`; mã đặt lại đúng 6 số; mật khẩu mới 8–72. `quiet_hours` phải là object. `readRefreshToken` chỉ nhận chuỗi (sửa 500 ở logout và đổi mật khẩu). | Integration: email là mảng, mật khẩu là object, token là object đều 422, không 500. |
| B3 | `routes/admin.route.ts` | `farm-owners`: email, họ tên ≤100, số điện thoại theo mẫu. `reason` của `revoke`, `reject` ≤500. | Integration `farm-owners`. |
| B4 | `routes/farms.route.ts` | `nameRule` có `isString`. `address` bắt buộc ≤200 khi tạo; khi sửa phải là chuỗi không rỗng ≤200. `description` của nhà ≤500 (tạo và sửa). `members` dùng `emailField`. | Integration: sửa farm với `address` là mảng. |
| B5 | `routes/devices.route.ts` | `register` (sensor, camera) và `replace`: `device_id`, `new_device_id` đúng mẫu và ≤40, `secret_key` ≤128. `reason` của decommission, restore, replace ≤500. `relayName` thuộc danh sách. **`state` của relay dùng `toBoolean()`**: hiện chuỗi `"false"` lọt vào và được gửi nguyên chuỗi xuống thiết bị. `speaker-schedule`: `track` 1–255, `enabled` strict. `display_name` có `isString`. | Integration: relay `state: "false"` đến service là `false`. |
| B6 | `routes/harvests.route.ts` | `GET /` validate `farmId`. `nest_count` ≤100 000, `weight_grams` ≤1 000 000. `product_images` ≤5 link, mỗi link http(s) ≤2048. | Integration tạo lô với link `javascript:`. |
| B7 | `routes/telemetry.route.ts`, `expertActivity.route.ts`, `system.route.ts`, `workOrders.route.ts`, `analytics.route.ts`, `notifications.route.ts`, `invitations.route.ts` | `from`/`to` dùng `isoRange`. `telemetry/history` không thêm 422 cho `page`, `limit` (`paginate()` đã kẹp). `env/compare`: từng `zoneId` phải là Mongo ID, tối đa 6. `push-tokens`: `token` ≤512. `invitations`: `token` là chuỗi ≤128; `create-account`: họ tên ≤100, mật khẩu 8–72. | Integration: `from=2026-W43`, `from > to` đều 422. |
| B8 | `services/telemetry.service.ts` | Lọc payload trước khi dùng: số đo ngoài khoảng hoặc sai kiểu thành thiếu (vào `stale_fields`), riêng ánh sáng, NH3, CO2 vượt tầm đo thì giữ ở mức cực đại để cảnh báo vẫn bắn; `relay_states`, `control_output` đúng kiểu; socket phát giá trị đã lọc. | Unit: độ ẩm 9999 không được lưu, không gây vượt ngưỡng. |
| B9 | `services/device.service.ts` `recordHeartbeat`, `recordCameraHeartbeat` | `rssi`, `firmwareVersion`, `modelVersion`, `fps` kiểm kiểu và biên (mục 3); giá trị sai thì bỏ, không làm hỏng heartbeat. | Unit: `rssi: "abc"` vẫn ghi `last_heartbeat`. |
| B10 | `services/device.service.ts` `confirmRelayStatus` | `relay_states` thiếu thì bỏ tin, không ném `TypeError`; `remaining_ms` kẹp trong `MAX_OVERRIDE_MS`. | Unit: `remaining_ms` 10^12 chỉ cho hạn 24 giờ. |
| B11 | `services/alert.service.ts` `ingestDeviceAlert` | `message` chuỗi ≤500 (không thì dùng câu mặc định); `snapshotUrl` chỉ nhận http(s) ≤2048; `metadata.raw` quá 8 KB thì thay bằng `{ truncated: true }`. | Unit. |
| B12 | `services/birdCount.service.ts` | Số đếm ≤1 000 000; `confidence_avg` ngoài 0–1 thì bỏ; `timestamp` trước 01/01/2025 hoặc quá 5 phút sau giờ nhận thì lấy giờ nhận như telemetry; `bucket_start` ngoài khoảng đó thì từ chối. Không giới hạn quá khứ theo ngày vì số đếm tới trễ vẫn hợp lệ. | Unit. |
| B13 | `docs/api/api-spec.yaml` | `maxLength`, `minimum`, `maximum`, `pattern` cho các trường đổi ở B2–B7. | Test spec của repo (nếu có) vẫn qua. |
| B14 | `services/firmwareRollout.service.ts` | Không cần sửa: `createRollout` đã gộp `node_ids` trùng và kiểm máy thử trước nằm trong danh sách. | — |

Chạy: `npm run lint`, `npm run build:check`, `npm test` (ngưỡng coverage 80 %).

## 5. Frontend

Các file dưới đây thuộc Nhi (`pages/auth/`, `farm-owner/`, `admin/`) và Tuấn (`domain-expert/`) theo `todo-review2.md` §0.2. Bảo sửa theo yêu cầu của chính Bảo, người sở hữu cần duyệt (§0.2, mục 5).

| ID | File | Việc | Test |
|---|---|---|---|
| F1 | `validations/common/passwordChange.validation.ts` | Thêm `PASSWORD_MAX_LENGTH` 72 và `validateNewPassword(password, confirm)` dùng chung cho quên mật khẩu, mời tham gia, cài đặt. | Vitest. |
| F2 | `pages/auth/ForgotPasswordPage.tsx`, `pages/SettingsPage.tsx` | Mã đặt lại đúng 6 chữ số; thêm ô nhập lại mật khẩu; dùng `validateNewPassword`. | Vitest cho hàm. |
| F3 | `pages/auth/InvitationPage.tsx` | Bỏ hằng lặp, thêm ô nhập lại mật khẩu, họ tên ≤100. | |
| F4 | `components/features/farm-owner/farms/AddZoneModal.tsx` | `trim`, `maxLength` 50, báo trùng tên (`isNameTaken`), chặn tên toàn khoảng trắng. | |
| F5 | `AddHouseModal.tsx` | Tên `maxLength` 50, số tầng ≤10, mô tả ≤500, chặn tên toàn khoảng trắng. | |
| F6 | `FarmFormModal.tsx`, `AddressAutocomplete.tsx` | Tên ≤50, địa chỉ ≤200. | |
| F7 | `validations/admin/farmOwner.validation.ts` + `CreateFarmOwnerModal.tsx` | Họ tên ≤100, số điện thoại theo mẫu, email ≤254. | Cập nhật test có sẵn. |
| F8 | `AddStockDeviceModal.tsx` | Mã thiết bị ≤40. | |
| F9 | `onboarding.utils.ts`, `ReplaceControllerModal.tsx` | Mã thiết bị đúng mẫu và ≤40, mã kích hoạt ≤128. | Cập nhật `onboarding.utils.test.ts`. |
| F10 | `validations/farm-owner/audioTrack.validation.ts` | Tên bài ≤100, file 0 byte bị từ chối, kiểm thêm MIME. | |
| F11 | `validations/farm-owner/maintenancePlan.validation.ts` | Không đổi: form đã chặn độ dài bằng `maxLength` của từng ô (checklist 200, nguồn 300, ghi chú 1000). | — |
| F12 | `harvest/harvestMetrics.ts` | Số tổ ≤100 000, khối lượng ≤1 000 000 g, `Infinity` bị từ chối. | Cập nhật test. |

Chạy từ `C:\` chữ hoa (Vitest): `npm run lint`, `npx tsc --noEmit`, `npx vitest run`.

## 6. Không làm, và lý do

- Hai khung giờ loa chồng nhau: chưa có nguồn nói firmware xử lý ra sao, nên không chặn.
- `limit` trên route phân trang: `paginate()` đã kẹp về tối đa 100; thêm 422 sẽ làm hỏng client đang gửi giá trị lớn.
- Hằng số khoảng giá trị chép tay giữa frontend và backend (ngưỡng, hệ số mờ, lịch đếm…): cần một hợp đồng dùng chung, là việc riêng.
- Route ngưỡng, hệ số mờ, tuning không có express-validator cho body: service đã kiểm đủ, chỉ lệch quy ước.

## 7. Kết quả (28/11/2026)

- Backend: `npm run lint`, `npm run build:check`, `npm test` đều qua (117 bộ test, 1258 test, vượt ngưỡng coverage). Thêm `tests/integration/inputValidation.test.ts`, `tests/integration/deviceIngestValidation.test.ts`, `tests/unit/utils/deviceInput.util.test.ts`.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build` và `npx vitest run --no-file-parallelism` (510 test) đều qua. Máy này báo `EMFILE` khi chạy song song, nên chạy tuần tự.
- Phát hiện thêm khi sửa: route `POST /devices/sensor-nodes/{id}/relay` nhận `state: "false"` (chuỗi) rồi gửi nguyên chuỗi xuống thiết bị; đã sửa bằng `toBoolean()` (B5).
- `from > to` của `GET /work-orders/metrics` vẫn do service trả 400 như hợp đồng cũ (`isoRange(true, false)`).
- Số đếm chim tới trễ vẫn nhận: giới hạn mốc giờ là sau 01/01/2025 chứ không theo số ngày (B12).
- Không chạy Playwright (cần backend và dữ liệu seed); không có spec nào nhắc tới các form đã đổi.

## 8. Thứ tự

B1 → B2…B7 → B8…B12, B14 → B13 → F1…F12 → Report 3 §4.5 → chạy toàn bộ kiểm tra. Tách hai PR: backend cùng tài liệu, rồi frontend.
