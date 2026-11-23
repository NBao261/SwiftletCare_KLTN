# Nạp thiết bị từ màn kho của Administrator (24/11/2026)

**Quyết định (Bảo, 24/11/2026):** Administrator nạp mã thiết bị và mật khẩu broker vào ESP32 **từ màn Kho thiết bị trên web**, qua cổng USB (Web Serial của Chrome, Edge máy tính), không mở terminal. Firmware tự nhận danh tính qua một lệnh serial và ghi vào NVS. `firmware/tools/flash_identity.py` giữ làm cách dự phòng. Report 4 D9 ghi lựa chọn này (2.2.27), Report 3 FARM-FR-010 thêm tiêu chí (4.2.22).

Vì sao cách này (so với để trình duyệt ghi cả vùng NVS bằng `esptool-js`): phía web chỉ gửi một dòng lệnh, không phải dựng định dạng NVS (trang, mục, CRC) bằng TypeScript; firmware đọc lại và trả lời nên trang biết chắc đã ghi đúng.

## 1. Trải nghiệm của Administrator

Một màn "Nạp thiết bị" (nút ở màn Kho thiết bị), làm như một trạm ở xưởng: cắm, bấm, dán nhãn, cắm con tiếp theo.

1. **Kết nối:** cắm ESP32 qua USB, bấm "Kết nối thiết bị", chọn cổng (trình duyệt nhớ cổng đã cho phép).
2. **Đọc bo mạch:** trang hỏi firmware (`SC INFO`) và hiện MAC, phiên bản firmware, đã có danh tính chưa. Bo mạch tự khởi động lại khi mở cổng (DTR) nên trang hỏi lại mỗi 0,5 giây tới khi có trả lời (tối đa 15 giây).
   - Chưa có danh tính: đề xuất mã từ MAC (`ctl-a1b2c3` cho bộ điều khiển), sửa được.
   - Đã có danh tính: báo "Bo mạch này đang là `node_001`". Nếu mã đó có trong kho thì cho "Nạp lại" (cấp mật khẩu broker mới rồi ghi); nếu không thì hỏi lại trước khi ghi đè.
   - Firmware quá cũ (chưa có lệnh `SC`): báo "Nạp firmware từ 2.4.0 trước" (PR 2 làm bước nạp firmware ngay trên trang).
3. **Bấm "Nạp":** tạo thiết bị trong kho (kèm MAC) → gửi `SC SET` với mã, mật khẩu broker, địa chỉ broker → firmware ghi NVS, đọc lại, trả `ok` → trang báo xong. Mật khẩu broker đi thẳng từ backend vào chip, không hiện trên màn.
4. **Nhãn:** QR nhãn hiện ngay, nút In, dòng nhắc "Dán lên bo mạch đang cắm". Bo mạch tự khởi động lại để dùng danh tính mới.
5. **Bo tiếp theo:** rút, cắm con khác, bấm "Kết nối" lại; danh sách bên phải ghi các bo đã nạp trong phiên để in lại nhãn.

Lỗi nào cũng có câu và cách xử lý: trình duyệt không hỗ trợ ("Dùng Chrome hoặc Edge trên máy tính"), không thấy cổng ("Cài driver CP210x hoặc CH340"), bo không trả lời ("Kiểm tra cáp USB có truyền dữ liệu, rồi cắm lại"), ghi lỗi trên chip (thiết bị đã vào kho thì bấm "Nạp lại").

## 2. Giao thức serial (firmware ≥ 2.4.0)

Một dòng một lệnh, kết thúc `\n`, 115200 baud. Trả lời là một dòng bắt đầu bằng `SC> ` theo sau là JSON, để tách khỏi log thường của firmware.

| Lệnh | Trả lời |
|---|---|
| `SC INFO` | `SC> {"ok":true,"mac":"A1B2C3D4E5F6","fw":"2.4.0","kind":"SENSOR","deviceId":"node_001"}` (`deviceId` là `null` khi chưa có danh tính) |
| `SC SET {"deviceId":"…","brokerSecret":"…","broker":"…","force":false}` | `SC> {"ok":true,"deviceId":"…"}` rồi khởi động lại sau 1 giây; lỗi: `SC> {"ok":false,"error":"…"}` |

Lỗi của `SC SET`: `BAD_JSON`, `BAD_DEVICE_ID` (không khớp `^[A-Za-z0-9_-]{1,40}$`, cùng quy tắc với backend), `BAD_SECRET` (rỗng hoặc dài quá 64), `BAD_BROKER` (có khoảng trắng hoặc dài quá 100), `PROVISIONED` (đã có danh tính mà không gửi `"force":true`), `WRITE_FAILED` (ghi NVS lỗi hoặc đọc lại không khớp).

An toàn: người cắm được USB vào bo mạch đã nạp lại được cả firmware bằng esptool (chưa bật secure boot, Report 4 §9), nên lệnh này không mở thêm đường nào; `force` chỉ để tránh ghi nhầm. Trang cài Wi-Fi (AP-mode) vẫn chỉ nhận Wi-Fi. Mật khẩu broker không bao giờ in ra log hay trả lại qua `SC INFO`.

## 3. Việc từng phần

| # | Phần | Việc | File |
|---|---|---|---|
| F-1 | Firmware | Đọc, kiểm lệnh (C++ thuần, test native) | `src/system/SerialProvisioning.{h,cpp}`, `test/test_serial_provisioning/` |
| F-2 | Firmware | Đọc serial không chặn trong `loop()`, ghi NVS namespace `identity` (cùng khoá với `flash_identity.py`), đọc lại, khởi động lại; `FIRMWARE_VERSION` 2.4.0 | `src/main.cpp`, `src/storage/StorageManager.*`, `src/config/Config.h` |
| B-1 | Backend | `chip_mac` (tuỳ chọn, 12 hex, duy nhất) khi thêm thiết bị vào kho, hiện trong danh sách; chip đã có trong kho → 409 | `provisionedDevice.model.ts`, `.service.ts`, `admin.route.ts`, test, `api-spec.yaml`, `npm run db:script` |
| B-2 | Backend | Trả `broker_host` (biến môi trường `DEVICE_BROKER_HOST`, trống thì `null` để firmware dùng địa chỉ có sẵn) cùng mật khẩu broker khi thêm hoặc cấp lại | `.env.example`, service, spec |
| W-1 | Web | Lớp Web Serial thuần (`lib/deviceSerial.ts`): mở cổng, đọc dòng, gửi lệnh, chờ `SC> `; hàm thuần tách dòng, đọc trả lời, đề xuất mã từ MAC (test vitest) | `src/lib/deviceSerial.ts`, `deviceSerial.test.ts` |
| W-2 | Web | Màn "Nạp thiết bị" theo §1, nút ở màn Kho thiết bị, nhãn VI/EN | `components/features/admin/device-stock/FlashDeviceModal.tsx`, `AdminDeviceStockPage.tsx`, i18n |
| D-1 | Tài liệu | Report 3 FARM-FR-010 (4.2.22), Report 4 D9 (2.2.27), `firmware/README.md`, FE_Design §7 màn Admin | |

## 4. Thứ tự PR (Bảo)

| PR | Nhánh | Nội dung |
|---|---|---|
| 1 | `feat/device-flash-station` | Kế hoạch này, F-1, F-2, B-1, B-2, W-1, W-2, D-1 |
| 2 | `feat/device-flash-firmware` | Nạp firmware ngay trên trang bằng `esptool-js` cho bo mạch trống hoặc firmware cũ (file `.bin` gộp do Administrator chọn, hoặc từ máy chủ OTA); bước 2 của §1 nối thẳng sang bước nạp danh tính |

Màn Admin trên web theo bảng phân công là của Nhi: Bảo làm, Nhi duyệt.

## 5. Kiểm tra

- `pio test -e native` (test lệnh serial), `pio run -e esp32dev` và `-e esp32prod` build được.
- Backend: lint, `build:check`, `npm test` (thêm ca `chip_mac` trùng 409, sai định dạng 422, `broker_host`).
- Web: lint, tsc, vitest (tách dòng, đọc trả lời, đề xuất mã), build.
- **Trên board thật (bắt buộc trước khi coi là xong):** ESP32 trống danh tính → nạp → khởi động lại kết nối được EMQX bằng mã mới; bo đã có danh tính → từ chối khi không `force`; rút cáp giữa chừng → trang báo lỗi, bấm nạp lại được. Ghi kết quả vào `firmware/README.md`.
