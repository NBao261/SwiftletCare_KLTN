# Spec trang Thiết bị theo công việc thực tế của từng vai (28/11/2026)

Bản nháp để nhóm duyệt. Chưa sửa Report 3, Report 4 hay code; mọi thay đổi nằm ở §9 theo thứ tự "tài liệu trước, code sau" như G-34. Mã yêu cầu lấy từ Report 3 (4.2.35).

## 1. Vì sao có spec này

Từ commit `79c54d96`, Kỹ thuật viên dùng chung trang `/devices` và `/devices/detail` với Chủ nhà yến, nút ẩn theo quyền. Làm vậy bỏ được một trang trùng, nhưng **gộp theo giao diện, chưa theo công việc**: hai vai làm việc rất khác nhau với thiết bị, và gộp xong Kỹ thuật viên mất những thứ nó cần nhất (xem §3). Spec này thiết kế lại hai trang theo việc thật ở nhà yến, giữ một bộ trang chung nhưng mỗi vai thấy đúng thứ nó cần trước.

Không đổi nghiệp vụ đã chốt: quyền ở Report 3 §2.4 (hàng "View devices", "Register a device", "Enter the address of a bird-counting camera", "Remote commands") giữ nguyên. Spec này chỉ quyết định **ai thấy gì trước, và thiết bị nối với cảnh báo và phiếu việc ra sao**.

## 2. Nghiệp vụ thực tế

### 2.1. Kỹ thuật viên (nhân viên của chủ nhà, các nhà được giao)

Công việc đến theo hai kiểu, cả hai đều bắt đầu từ **cảnh báo**, không phải từ danh sách thiết bị:

| Tình huống | Điều xảy ra ở nhà yến | Điều kỹ thuật viên cần biết | Điều nó làm |
| --- | --- | --- | --- |
| Bộ điều khiển mất kết nối (`NODE_OFFLINE`, ngưỡng 30 s, BR-10) | Mất điện, mất Wi-Fi, nguồn hỏng, bộ điều khiển treo | Mất từ lúc nào, Wi-Fi lần cuối yếu hay mạnh, lần khởi động lại cuối vì sao (watchdog, sập nguồn), có cảnh báo mất điện cùng lúc ở nhà khác không | Đến nhà. Kiểm nguồn và Wi-Fi tại chỗ. Khởi động lại bằng nút nguồn nếu máy không online. Xác nhận thiết bị online lại |
| Bộ điều khiển online nhưng lỗi (`SENSOR_FAULT`, `RS485_BUS_FAILURE`, `ACTUATOR_FAULT`, `SPEAKER_FAILURE`) | Cảm biến bẩn, dây RS485 lỏng, rơ-le hỏng | Lỗi nào, Zone nào, từ lúc nào, phiếu việc đã mở chưa | Nhận phiếu, sửa, ghi nguyên nhân và ảnh, báo xong |
| Camera đếm chim không đọc được (`EDGE_AI_DEGRADED`, camera `AUTH_FAILED`, `UNREACHABLE`, `NO_FRAMES`) | Đổi mật khẩu camera, mất mạng nhà, camera treo | Camera báo lỗi nào của năm lỗi, lần nhận hình cuối | Kiểm camera tại chỗ, sửa địa chỉ trong "Cài đặt camera" (FARM-FR-004b), đợi trạng thái về "Đang nhận hình" |
| Lắp mới, đổi máy, dời tầng | Hỏng thì thay, nhà thêm tầng thì dời | Nhãn thiết bị, mã QR tầng | Quét hai mã QR trên điện thoại (SF-01); trên web chỉ dán mã nhãn |

Điểm quan trọng:

- Kỹ thuật viên **thường đang đứng trong nhà yến, trên điện thoại**: nhà tối, ẩm, một tay. Màn quan trọng nhất là điện thoại, không phải web. Web phục vụ lúc ở văn phòng hoặc nhà nghỉ.
- Khởi động lại từ xa **chỉ có khi thiết bị đang online** (409 nếu không, BR-10) và cần firmware từ 1.4.0 (501 nếu cũ hơn). Thiết bị mất kết nối thì việc cần làm là đi đến nhà, không phải bấm nút. Giao diện phải nói điều đó, không chỉ ẩn nút.
- Phiếu việc sửa chữa tự mở khi cảnh báo thiết bị xảy ra, hoặc khi `NODE_OFFLINE` và `EDGE_AI_DEGRADED` còn mở sau 30 phút (BR-39). Phiếu chỉ đóng khi dữ liệu xác nhận đã hồi phục (BR-41; với `NODE_OFFLINE` là thiết bị online) và Chủ nhà yến duyệt. Nên **thiết bị là nơi kỹ thuật viên thấy "việc của tôi ở thiết bị này" và "đã online lại chưa"**.
- Nó chỉ thấy và chỉ làm trên **nhà được giao** (AUTH-FR-013); mọi thao tác thiết lập, dời, gỡ của nó được ghi nhật ký và báo cho Chủ nhà yến.

### 2.2. Chủ nhà yến

- Hay ở xa. Muốn trả lời nhanh: **hệ thống thiết bị có khoẻ không, ai đang xử lý, đã xử lý xong chưa**.
- Việc của riêng chủ: thiết lập thiết bị khi tự lắp, cấp mã QR tầng, nhập địa chỉ camera khi không có kỹ thuật viên, in nhãn tầng, đặt lịch loa ru và chọn bài, theo dõi nhà có kỹ thuật viên hay không (không có thì chủ nhận cảnh báo và phiếu việc, ALERT-FR-017).
- Không cần chẩn đoán sâu từng thiết bị trừ khi nhà không có kỹ thuật viên.

### 2.3. Chuyên gia (chỉ đọc) và Quản trị viên

- Chuyên gia chỉ đọc trang của Chủ nhà yến, không thêm gì (đã chốt 27/10/2026).
- Quản trị viên giữ trang riêng (mọi trang trại, lệnh từ xa, OTA, kho thiết bị). Không thuộc spec này.

## 3. Hiện trạng và khoảng trống

Sau `79c54d96` (đã commit, chưa push):

| Có | Thiếu so với §2 |
| --- | --- |
| Danh sách một bảng, tab Tất cả, Mất kết nối, Online, Chờ | Không có tab **Cần xử lý** (thiết bị lỗi hoặc có cảnh báo mở) mà trang kỹ thuật viên cũ có; kỹ thuật viên phải tự đoán thiết bị nào đáng đến trước |
| Trang chi tiết nhà: thẻ thiết bị với trạng thái, heartbeat, mạng, thời gian chạy, bộ nhớ | **Không thấy cảnh báo mở của thiết bị** và **không thấy phiếu việc của nó**: thiết bị và cảnh báo là hai thế giới tách nhau |
| Nút Khởi động lại khi thiết bị online | Thiết bị **mất kết nối** thì nút biến mất, không giải thích; hàm `restartBlockReason` còn đó nhưng không còn dùng |
| Thẻ camera có trạng thái và nút "Cài đặt camera" | Gợi ý sửa lỗi chỉ nằm trong cửa sổ cài đặt, không nằm trên thẻ |
| Lý do khởi động lại gần nhất (`reset_reason`) có ở model | Trang riêng cũ của kỹ thuật viên có hiện, thẻ của Chủ nhà yến chưa từng có; commit `79c54d96` xoá cùng trang cũ. **Đã khôi phục trên thẻ chung ở #294 (commit `8878f9fc`)**, bước W-1 không phải làm lại (D5) |
| Dời, thay, gỡ trong menu "Thao tác khác" | Đúng quyền, nhưng không nói rõ "nhà này chưa được giao cho bạn" khi bị 403 |

Hai thiếu sót cần backend: lọc **cảnh báo** theo thiết bị (`GET /alerts` chỉ lọc `farmId`, `zoneId`, `houseId`, `type`) và lọc **phiếu việc** theo thiết bị (`GET /work-orders` chỉ lọc `houseId`, `alertId`...). Cả `Alert` và `WorkOrder` đã có `node_id`, nên không cần đổi dữ liệu.

## 4. Quyết định thiết kế

| # | Quyết định | Lý do |
| --- | --- | --- |
| D1 | Giữ **một bộ hai trang** (`/devices`, `/devices/detail`) cho Chủ nhà yến, Kỹ thuật viên và Chuyên gia; **không** quay lại trang riêng của kỹ thuật viên | Một chỗ sửa, đỡ lệch; đã làm ở `79c54d96` |
| D2 | Khác biệt giữa các vai là **thứ tự và nội dung nổi**, không phải hai trang: kỹ thuật viên mở trang ra thấy tab "Cần xử lý" trước; chủ nhà thấy tổng quan khoẻ của hệ thống trước | Việc đầu tiên của hai vai khác nhau (§2) |
| D3 | Trang chi tiết thêm khối **"Việc đang mở"** trên mỗi thẻ thiết bị: cảnh báo đang mở của đúng thiết bị đó và phiếu việc liên quan, bấm vào mở thẳng cảnh báo hoặc phiếu | Thiết bị là nơi kỹ thuật viên hỏi "đã online lại chưa" |
| D4 | Mỗi thiết bị lỗi có **một câu việc cần làm** theo bảng §6, nói cả khi không có nút (VD mất kết nối: đi kiểm nguồn và Wi-Fi) | Không ẩn nút âm thầm; đúng thao tác thật ở nhà |
| D5 | Hiện `reset_reason` ("khởi động lại vì mất nguồn / treo / lỗi") trên thẻ bộ điều khiển | FARM-FR-006 |
| D6 | Mobile là nơi làm việc chính của kỹ thuật viên; web chỉ cần đủ xem và xử lý, không cần quét QR | §2.1 |
| D7 | Không thêm quyền mới: kỹ thuật viên không sửa ngưỡng, không đặt lịch loa ru, không in mã QR tầng, không xem nhà khác | Report 3 §2.4 |
| D8 | Không thêm loại cảnh báo mới và không thêm sự kiện socket mới (cảnh báo thiết bị đã có socket `ALERT_NEW`) | Giữ enum dùng chung (CLAUDE.md) |

## 5. Màn hình

### 5.1. Danh sách `/devices`

Cột và hàng như hiện nay (loại, mã, nhà · Zone, trạng thái, kết nối cuối). Thêm:

- **Tab "Cần xử lý"** đứng ngay sau "Tất cả", kèm số. Vào tab khi: thiết bị `OFFLINE`, hoặc camera có `cameraStatus` là `AUTH_FAILED`, `UNREACHABLE` hoặc `NO_FRAMES`, hoặc thiết bị có cảnh báo thiết bị đang mở (`ACTIVE` hoặc `ACKNOWLEDGED`), hoặc `PENDING` quá 15 phút (BR-27). Camera `NO_SOURCE` vào tab khi nhà chưa có địa chỉ camera mà đã đăng ký.
- Tab "Mất kết nối" **không** còn là tab riêng vì "Cần xử lý" đã chứa. Giữ "Online" và "Chờ".
- Kỹ thuật viên mở trang rơi vào tab "Cần xử lý" nếu có số; còn lại vào "Tất cả". Chủ nhà yến luôn vào "Tất cả" (đã quen).
- Sắp xếp: trong tab, thiết bị **mất kết nối lâu nhất** lên đầu, rồi lỗi camera, rồi chờ.
- Cột "Kết nối cuối" là thời gian tương đối ("12 phút trước") có tooltip giờ đầy đủ.
- Nút "Thiết lập thiết bị" giữ cho Chủ nhà yến và Kỹ thuật viên (`DEVICE_SETUP_ROLES`). Chuyên gia không thấy.

### 5.2. Trang chi tiết nhà `/devices/detail`

Bố cục hiện nay giữ (bốn ô số, các Zone, camera). Mỗi **thẻ thiết bị** thêm hai khối ở đầu và sắp lại hành động:

1. **Dải trạng thái** (chỉ hiện khi thiết bị cần chú ý): màu theo mức, một câu việc cần làm (§6), ví dụ "Mất kết nối 14 phút. Đi kiểm nguồn và Wi-Fi tại nhà." Không có số mã lỗi thô.
2. **Việc đang mở** (chỉ hiện khi có): danh sách ngắn, tối đa 3 dòng, mỗi dòng là cảnh báo (loại, mức, thời gian) hoặc phiếu việc (số, trạng thái, người nhận), bấm mở đúng màn đó. Quá 3 thì ghi "Xem thêm ở Cảnh báo".
3. Phần thông tin giữ (vị trí, firmware, heartbeat, mạng) và **thêm "Lần khởi động lại cuối: <vì sao>"** từ `reset_reason`, ẩn khi chưa có.

Hành động trên thẻ, **chỉ hiện khi vai được và thiết bị ở trạng thái làm được**; khi vai được mà thiết bị chưa làm được thì hiện nút khoá kèm lý do (dùng `restartBlockReason`), không ẩn:

| Hành động | Chủ nhà yến | Kỹ thuật viên (nhà được giao) | Chuyên gia |
| --- | --- | --- | --- |
| Khởi động lại bộ điều khiển | ✓ | ✓ | – |
| Lịch loa ru | ✓ | – | – |
| Bài loa ru | ✓ (quản lý) | xem | xem |
| Dời, thay, gỡ bộ điều khiển | ✓ | ✓ | – |
| Cài đặt camera | ✓ | ✓ | – |
| Mở ngưỡng của Zone (sửa ở `/domain-expert/tuning`) | ✓ | xem | ✓ |
| Khôi phục thiết bị đã gỡ trong 24 giờ | ✓ | ✓ | – |

Chuyên gia: trang ở chế độ chỉ đọc đã có chữ "chỉ xem" (DE-10); thêm hai khối ở trên cũng chỉ đọc.

### 5.3. Thay thiết bị hỏng (luồng kỹ thuật viên hay làm nhất)

Giữ cửa sổ thay hiện tại (FARM-FR-008): quét hoặc dán nhãn thiết bị mới, thiết bị cũ chuyển `DECOMMISSIONED` giữ lịch sử, thiết bị mới nhận cấu hình của Zone. Thêm hai điều:

- Sau khi thay, thẻ thiết bị mới hiện dải "Đang chờ kết nối lần đầu" với đếm ngược 15 phút (BR-27); quá thì báo theo FARM-FR-012 (đã có thông báo cho người đăng ký).
- Nếu thiết bị cũ có phiếu việc `NODE_OFFLINE` đang mở, ghi vào phiếu một dòng "đã thay máy" để chủ nhà thấy lý do. Thay máy đóng cảnh báo của máy cũ nên phiếu `OPEN` chưa ai bắt đầu tự đóng `SELF_RECOVERED` sau 10 phút, còn phiếu `IN_PROGRESS` chờ kỹ thuật viên báo xong rồi qua kiểm phục hồi (luồng sẵn có, không đổi). Dòng ghi chú do backend ghi (§8, đã làm ở #296).

## 6. Việc cần làm theo tình trạng thiết bị

Câu hiển thị ở dải trạng thái. Nguồn: ngưỡng và trạng thái ở Report 3 (BR-10, BR-27, BR-39, BR-41, FARM-FR-004b, FARM-FR-006). Các câu hướng dẫn tại chỗ là hằng số tay của nhóm (A-4), **firmware lead và một kỹ thuật viên thật duyệt trước khi đưa vào app**.

| Tình trạng | Câu hiển thị (vi) | Có nút gì |
| --- | --- | --- |
| Bộ điều khiển `OFFLINE` | "Mất kết nối {thời gian}. Kiểm nguồn điện và Wi-Fi tại nhà, rồi bật lại nguồn." | Không có khởi động lại (không gửi lệnh được); có "Xem cảnh báo" |
| Bộ điều khiển `OFFLINE` ngay sau khi khởi động lại từ xa | "Đã gửi lệnh khởi động lại, đang chờ kết nối lại." | – |
| Bộ điều khiển `PENDING` dưới 15 phút | "Đang chờ kết nối lần đầu." | – |
| Bộ điều khiển `PENDING` quá 15 phút | "Chưa kết nối sau 15 phút. Kiểm mật khẩu Wi-Fi và sóng tại tầng." | "Thiết lập lại" (mở `/devices/onboarding`) |
| Bộ điều khiển online, firmware dưới 1.4.0 | "Firmware cũ, chưa khởi động lại từ xa được." | Nút khoá kèm lý do |
| Wi-Fi yếu (`wifiQuality` kém) khi online | "Sóng Wi-Fi yếu, dễ mất kết nối." | – |
| Camera `NO_SOURCE` | "Chưa nhập địa chỉ camera." | "Cài đặt camera" |
| Camera `AUTH_FAILED` | "Sai mật khẩu camera." | "Cài đặt camera" + gợi ý (§FARM-FR-004b đã có) |
| Camera `UNREACHABLE` | "Không kết nối được camera." | "Cài đặt camera" + gợi ý |
| Camera `NO_FRAMES` | "Kết nối được nhưng không có hình." | "Cài đặt camera" + gợi ý |
| Camera `OFFLINE` (nút AI) | "Nút AI mất kết nối. Kiểm máy nút AI và mạng tại nhà." | – |

Cảnh báo thiết bị đang mở được dịch bằng tên cảnh báo sẵn có (`constants/enumLabels.i18n.ts`), không viết lại.

## 7. Điện thoại (kỹ thuật viên) và web

Quy tắc chung: nội dung §5 và §6 là một; mobile và web dùng cùng câu, cùng thứ tự.

- **Mobile (Len):** màn thiết bị của kỹ thuật viên có cùng tab "Cần xử lý" và khối "Việc đang mở"; nút gọi **quét QR** (thiết lập, thay) và **chụp ảnh** nằm ở dưới màn hình, vừa ngón cái. Cửa sổ "Cài đặt camera" (`CameraSourceSheet`) mở cho kỹ thuật viên.
- **Web:** đủ xem và xử lý; không quét QR (dán mã nhãn).

## 8. Backend cần thêm

Chỉ hai bộ lọc và một dòng ghi chú, không model mới:

| Việc | Chi tiết |
| --- | --- |
| `GET /alerts?nodeId=` | Lọc cảnh báo theo thiết bị (`node_id` đã có; truy vấn luôn kèm phạm vi nhà nên chưa cần index riêng). Kiểm quyền như `houseId`: nhà của thiết bị ngoài phạm vi → 403, thiết bị không có → 404 |
| `GET /work-orders?nodeId=` | Tương tự cho phiếu việc (`node_id` đã có) |
| Ghi chú thay thiết bị | Khi thay thiết bị có phiếu `NODE_OFFLINE` đang mở, thêm một dòng vào lịch sử phiếu: thiết bị đã được thay bởi ai, lúc nào. Không đổi trạng thái phiếu; phiếu vẫn chỉ đóng theo BR-41 |
| `docs/api/api-spec.yaml` | Thêm hai tham số trên |
| Test tích hợp | `nodeId` đúng nhà, `nodeId` sai nhà (403), kỹ thuật viên chưa được giao nhà (403), `nodeId` không tồn tại (404), `nodeId` sai dạng (422), thiết bị đã gỡ vẫn xem được |

Số cảnh báo mở của từng thiết bị cho danh sách (tab "Cần xử lý") lấy từ một lần gọi `GET /alerts?open=true&houseId=` rồi gom theo `node_id` ở web (một lần duyệt), **không** gọi theo từng thiết bị.

## 9. Việc theo thứ tự

| PR | Việc | Nơi sửa | Người |
| --- | --- | --- | --- |
| D-1 | Tài liệu: Report 3 thêm Kỹ thuật viên vào FARM-FR-005 và FARM-FR-006 (hiện chỉ Farm Owner, Domain Expert / Farm Owner, Administrator), thêm yêu cầu "cảnh báo và phiếu việc đang mở của thiết bị" (FARM-FR-015 mới), nhắc BR-27 và BR-10 trong tiêu chí; Report 4 cập nhật mô tả trang; `report5/tc.py` thêm ca (TC thiết bị vai kỹ thuật viên); dòng mới ở `project-tracking.md` §6 (G-36) | `docs/reports/` | Bảo |
| B-1 | `GET /alerts?nodeId=`, `GET /work-orders?nodeId=`, ghi chú khi thay thiết bị; spec; test. **Xong: PR #296** | `backend/` | Bảo |
| W-1 | Web: tab "Cần xử lý", khối "Việc đang mở", dải trạng thái §6, `reset_reason`, nút khởi động lại khoá kèm lý do; test thuần cho hàm "cần xử lý" và "việc cần làm"; e2e T4 cập nhật | `frontend/` (Nhi duyệt `farm-owner/`) | Bảo |
| M-1 | Mobile: cùng tab, khối và câu §6 | `mobile/` | Len |
| X-1 | Xoá dòng G-36 khỏi §6 khi xong; cập nhật `CLAUDE.md` các module | docs | Bảo |

Thứ tự: D-1 → B-1 → W-1 và M-1 song song. W-1 chưa làm được trước B-1 (cần hai bộ lọc), trừ tab "Cần xử lý" chỉ theo trạng thái thiết bị, có thể giao trước.

## 10. Nghiệm thu

Với dữ liệu demo (nhà A có kỹ thuật viên, nhà B không):

1. Kỹ thuật viên đăng nhập, mở `/devices`: rơi vào "Cần xử lý" khi có thiết bị lỗi; không thấy thiết bị nhà chưa được giao.
2. Mở chi tiết một bộ điều khiển `OFFLINE`: thấy dải "Mất kết nối …", cảnh báo `NODE_OFFLINE` mở và phiếu việc (nếu đã quá 30 phút); không có nút khởi động lại; có lý do.
3. Thiết bị online: bấm khởi động lại → thông báo gửi lệnh; Chủ nhà yến nhận thông báo "kỹ thuật viên đã thao tác" như hiện nay.
4. Camera `AUTH_FAILED`: thẻ nói sai mật khẩu, "Cài đặt camera" mở; lưu xong, khi nút AI báo `OK` thì dải biến mất.
5. Thay một bộ điều khiển có phiếu `NODE_OFFLINE` mở: phiếu có dòng "đã thay máy"; phiếu chưa ai bắt đầu tự đóng sau 10 phút, phiếu đang làm thì kỹ thuật viên báo xong và qua kiểm phục hồi như thường.
6. Chủ nhà yến mở cùng trang: thấy cùng dải và khối, có thêm lịch loa ru, thiết lập, mã QR tầng; mở đúng nhà của mình.
7. Chuyên gia: chỉ xem, không nút thao tác.
8. `npm run lint`, `tsc --noEmit`, `vitest run`, `build` qua; backend `npm test` qua; e2e T4 qua trên CI.

## 11. Câu hỏi còn mở (mặc định đã ghi, đổi nếu không đúng)

1. **Nhà không có kỹ thuật viên:** mặc định Chủ nhà yến thấy dải và việc cần làm giống kỹ thuật viên (vì chủ nhận cảnh báo và phiếu, ALERT-FR-017). Không thêm gì khác.
2. **Tab "Cần xử lý" có tính camera `NO_SOURCE` của camera vừa đăng ký không:** mặc định có, vì không có địa chỉ thì không đếm chim được.
3. **Có cần lịch sử thao tác từ xa của từng thiết bị** (ai khởi động lại lúc nào) trên thẻ: mặc định **không** làm bây giờ; nhật ký kiểm toán đã ghi và Chủ nhà yến đã nhận thông báo.
4. **Câu hướng dẫn tại chỗ ở §6** cần một kỹ thuật viên thật hoặc firmware lead đọc lại trước khi đưa vào app (không tự bịa quy trình sửa).
5. **Thông báo khi kỹ thuật viên chạm vào nhà không được giao** (403): mặc định hiện câu "Nhà này chưa được giao cho bạn", đã có kiểu "forbidden" trong `useApiErrorMessage`.

## 12. Đối chiếu vai Kỹ thuật viên với thực tế nhà yến (28/11/2026)

Câu hỏi: ngoài các tài liệu của nhóm, vai Farm Technician có đúng với cách nhà yến vận hành ngoài đời không, thiếu hay thừa gì.

**Nguồn đã tìm được** (tìm web 28/11/2026; ít): Nghị định 13/2020/NĐ-CP cho phát loa dẫn dụ 5:00–11:30 và 13:30–19:00, không quá 70 dBA, và cấm dùng loa khi nhà yến nằm trong hoặc cách khu dân cư dưới 300 m (nguồn: [thuvienphapluat.vn](https://thuvienphapluat.vn/hoi-dap-phap-luat/duoc-phat-loa-phong-de-dan-du-chim-yen-trong-khung-thoi-gian-nao-138021180.html)); một khảo sát nhà yến cho thấy 82,86 % có hệ thống đo nhiệt độ (77,14 % tự động) và 94,29 % phát loa dẫn dụ hàng ngày ([vjol.info.vn](https://vjol.info.vn/khcn/article/download/44254/35697/)). **Không tìm được nguồn nào** nói ai làm gì trong nhà yến, hạn chế ra vào theo mùa sinh sản hay việc thuê người quản lý. Mọi nhận định dưới đây về vai là **suy luận từ cách nhà yến chạy**, chưa kiểm chứng, và phải hỏi chủ nhà yến thật (chủ ngôi nhà mượn để chạy thử) trước khi đưa vào Report 3.

### 12.1. Đúng

| Điều đã chốt | Vì sao hợp thực tế |
| --- | --- |
| Kỹ thuật viên là nhân viên của chủ nhà, chỉ làm trên nhà được giao | Chủ thường ở xa, có người ở hoặc thường xuyên có mặt tại nhà yến; quyền theo nhà đúng với cách giao việc |
| Cảnh báo đến người ở nhà trước, 15 phút không ai nhận thì lên Chủ nhà yến; nghiêm trọng đến cả hai | Người ở nhà là người xử lý được ngay |
| Kỹ thuật viên thiết lập, thay, gỡ thiết bị và nhập địa chỉ camera | Việc cần có mặt (quét QR tầng, cắm máy, sờ camera); chủ không cần về |
| Nhà không có kỹ thuật viên thì chủ làm hết | Nhà yến nhỏ phần lớn do chủ tự trông |
| Loa ru: kỹ thuật viên chỉ xem lịch | Giờ phát loa bị luật giới hạn (nguồn trên), nên giữ ở người chịu trách nhiệm là chủ |
| Không có nhà cung cấp dịch vụ ngoài, hợp đồng, SLA (§8) | Phạm vi một chủ, không phải nền tảng |

### 12.2. Thiếu (đề xuất, chưa vào Report 3)

| # | Thiếu | Vì sao | Đề xuất |
| --- | --- | --- | --- |
| R1 | Gộp sự cố **cả nhà mất kết nối cùng lúc** | Ở nhà yến nguồn điện và Wi-Fi dùng chung cả nhà, nên mất điện hoặc mất mạng làm bộ điều khiển và nút AI offline cùng lúc, nhưng mỗi thiết bị hiện một cảnh báo và (sau 30 phút) một phiếu việc, trong khi nguyên nhân chỉ một. Bộ điều khiển còn nguồn vẫn tự chạy theo cấu hình lưu trong máy khi mất mạng (MF-01), nên mất mạng ít gấp hơn mất điện | Trên trang Thiết bị, khi từ hai thiết bị trở lên của cùng một nhà offline cùng lúc, hiện **một dòng của nhà**: "Nhiều thiết bị của nhà này mất kết nối cùng lúc, có thể mất điện hoặc mất mạng" thay vì từng dòng. Chỉ là cách hiện, không đổi dữ liệu, cảnh báo hay phiếu; không cần ngưỡng mới |
| R2 | **Cái giá của việc vào nhà** | Chim yến nhạy với xáo trộn (nguồn tìm được chỉ nói về tiếng ồn, chưa nói về việc ra vào), nên chỉ đi khi cần. Việc làm được từ xa (xem số liệu, khởi động lại khi còn online) phải được nói trước việc "đi kiểm tra" | Câu việc cần làm ở §6 luôn đặt cách làm từ xa trước, "đi đến nhà" sau. Chưa đưa giờ nên vào nhà vào app vì chưa có nguồn |
| R3 | **Chuyển việc ra ngoài**: người ở nhà thường không sửa được điện, rơ-le, mạch; việc sửa thật hay do thợ điện hoặc nhà cung cấp thiết bị | Phiếu việc hiện chỉ có "xong" hoặc "huỷ", không có kết quả "cần thợ ngoài" | **Chưa làm.** Hỏi chủ nhà yến hiện xử lý thế nào. Nếu cần, chỉ thêm một ghi chú trong phiếu, không thêm nhà cung cấp, danh bạ hay theo dõi thợ (§8) |
| R4 | Người dùng có thể **không rành kỹ thuật** | Người ở nhà yến có thể là người nhà của chủ | Câu ở §6 ngắn, không mã lỗi thô; đã là quy tắc FE_Design §6.4 |

### 12.3. Thừa hoặc nên cân nhắc cắt

| # | Mục | Nhận định |
| --- | --- | --- |
| E1 | Web đầy đủ cho kỹ thuật viên (G-33): phân tích, vòng đếm, hồ sơ | Người ở nhà dùng điện thoại là chính; nhưng đã làm xong và menu đã ẩn bớt, **không cắt**, chỉ không mở rộng thêm |
| E2 | Kỹ thuật viên vẽ vòng đếm camera | Vẽ trên ảnh nên làm ở đâu cũng được, không cần ở nhà. Giữ vì quyền đã chốt; không phải việc đặc trưng của người ở nhà |
| E3 | Trang web riêng của kỹ thuật viên cho thiết bị | Đã bỏ ở #294 |

Không có quyền nào của kỹ thuật viên **nên bỏ** theo suy luận trên; chỉ R1 và R2 đổi cách hiện, R3 cần hỏi chủ nhà.

### 12.4. Câu hỏi cho chủ nhà yến thật (nhà mượn chạy thử)

1. Ai là người ra vào nhà yến hằng ngày, làm những việc gì (kiểm tra, dọn, bẫy chuột, mở cửa, thu hoạch)?
2. Khi máy phun sương, quạt, loa hay cảm biến hỏng thì ai sửa: chính người đó, thợ điện quanh vùng, hay nhà cung cấp thiết bị?
3. Có giờ hay mùa nào hạn chế vào nhà yến không, và vào lúc nào trong ngày là ít xáo trộn nhất?
4. Mất điện hoặc mất mạng ở nhà xảy ra bao lâu một lần, ai biết đầu tiên và làm gì?
5. Một người trông mấy nhà? Người đó dùng điện thoại gì và có hay mở ứng dụng khi đang trong nhà không?
