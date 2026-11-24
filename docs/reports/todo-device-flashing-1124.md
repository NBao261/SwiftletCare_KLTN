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
| 2 | `feat/device-flash-firmware` | Nạp firmware ngay trên trang bằng `esptool-js` cho bo mạch trống hoặc firmware cũ, file lấy từ kho firmware của backend; chi tiết ở §6 |
| 3 | `feat/device-ota-rollout` | Đợt cập nhật firmware từ xa lấy file từ cùng kho, máy thử trước, tự dừng khi lỗi, máy offline nhận khi online lại; chi tiết ở §7 |

Màn Admin trên web theo bảng phân công là của Nhi: Bảo làm, Nhi duyệt.

## 5. Kiểm tra

- `pio test -e native` (test lệnh serial), `pio run -e esp32dev` và `-e esp32prod` build được.
- Backend: lint, `build:check`, `npm test` (thêm ca `chip_mac` trùng 409, sai định dạng 422, `broker_host`).
- Web: lint, tsc, vitest (tách dòng, đọc trả lời, đề xuất mã), build.
- **Trên board thật (bắt buộc trước khi coi là xong):** ESP32 trống danh tính → nạp → khởi động lại kết nối được EMQX bằng mã mới; bo đã có danh tính → từ chối khi không `force`; rút cáp giữa chừng → trang báo lỗi, bấm nạp lại được. Ghi kết quả vào `firmware/README.md`.

## 6. PR 2: nạp firmware ngay trên trang (24/11/2026)

**Vấn đề:** lệnh `SC INFO`/`SC SET` là của firmware SwiftletCare, nên bo mạch mới mua (chưa có firmware) hoặc chạy firmware cũ hơn 2.4.0 không trả lời; hiện vẫn phải mở terminal chạy `pio run -t upload`.

**Quyết định:** trang ghi luôn firmware vào chip bằng `esptool-js` (bản JavaScript chính thức của Espressif, làm đúng việc `esptool` của PlatformIO), file lấy từ **kho firmware riêng trên backend**.

Vì sao không để file trên GitHub Releases: repo công khai, mà bản build chứa giá trị của `Secrets.h` (mật khẩu cổng cập nhật qua mạng LAN, Wi-Fi mặc định) → không được công khai. Kho trên backend chỉ Administrator tải lên và tải về; file nằm trong bucket riêng (MinIO), backend đọc và trả qua route có đăng nhập.

### 6.1. Ảnh cài đặt (factory image)

- Một file gộp bootloader, bảng phân vùng, `boot_app0` và firmware, ghi từ địa chỉ `0x0`; dựng bằng `pio run -e esp32prod -t factory` (`firmware/tools/factory_image.py`, gọi `esptool merge_bin` của PlatformIO) → `.pio/build/esp32prod/factory.bin`.
- Phân vùng (`min_spiffs.csv`): `nvs` 0x9000–0xE000, `otadata` 0xE000, `app0` 0x10000 (0x1E0000). File lớn nhất 0x10000 + 0x1E0000 = 2 031 616 byte.
- **Giữ NVS khi nạp:** trang chia file thành hai đoạn `[0x0, 0x9000)` và `[0xE000, hết)`, bỏ qua vùng NVS, nên bo đã có mã, Wi-Fi, mức dòng đã học vẫn giữ sau khi cập nhật firmware. Bo trống thì vùng NVS vốn trống.
- Backend kiểm khi tải lên: đủ dài, byte `0xE9` (đầu ảnh ESP32) ở 0x1000 và 0x10000, không vượt kích thước tối đa, và trong file có chuỗi `Firmware v<phiên bản>` (dòng chào khi khởi động) để không ghi nhầm số phiên bản.

### 6.2. Việc từng phần

| # | Phần | Việc |
|---|---|---|
| F-3 | Firmware | `tools/factory_image.py` (extra script PlatformIO, đích `factory`), `platformio.ini`, README |
| B-3 | Backend | Model `firmwareImage` (phiên bản duy nhất, khoá file, cỡ, SHA-256, ghi chú, người tải); `POST /admin/firmware-images` (multipart `file`, `version` x.y.z, `note`), `GET /admin/firmware-images`, `GET /admin/firmware-images/:id/file`, `DELETE /admin/firmware-images/:id`; kiểm ảnh ở `utils/firmwareImage.util.ts` (test unit); `getObject` trong `minio.config.ts`; audit `FIRMWARE_IMAGE_UPLOADED`/`DELETED`; test, spec, `db:script` |
| B-4 | Backend | `GET /admin/provisioned-devices?chipMac=`: bo đã nạp trước đây nhưng mất mã (nạp lại toàn bộ bằng công cụ khác) vẫn nhận ra mục kho của nó qua MAC |
| W-3 | Web | Thẻ "Firmware cho trạm nạp" ở màn Kho thiết bị: tải lên (phiên bản, ghi chú, file), danh sách, xoá |
| W-4 | Web | `lib/firmwareFlasher.ts`: chia đoạn bỏ NVS (hàm thuần, test), ghi bằng `esptool-js`, khởi động lại bo; `DeviceSerial` trả cổng cho `esptool-js` rồi mở lại |
| W-5 | Web | Màn nạp: bo không trả lời sau 6 giây hoặc firmware cũ hơn bản mới nhất trong kho → nút "Nạp firmware vX" với thanh tiến độ (~1 phút); xong thì tự đọc chip và đi tiếp bước nạp mã |
| D-2 | Tài liệu | Report 4 D9 (2.2.28), Report 3 FARM-FR-010 (4.2.23), `firmware/README.md` (dựng ảnh cài đặt, kiểm tra trên board), `backend/CLAUDE.md` |

### 6.3. Trải nghiệm (thêm vào §1)

- Bước 2, bo không trả lời: sau 6 giây trang hiện "Bo chưa có firmware SwiftletCare hoặc quá cũ" và nút **"Nạp firmware 2.4.x"** (bản mới nhất trong kho); vẫn chờ thêm tới 30 giây phòng bo đang thử Wi-Fi.
- Bo trả lời nhưng firmware cũ hơn bản trong kho: hiện "Có bản mới 2.4.x" và nút cập nhật, không bắt buộc.
- Khi nạp: thanh tiến độ theo phần trăm, câu "Đừng rút cáp"; xong thì bo tự khởi động lại, trang tự đọc lại chip và về bước nạp mã.
- Kho chưa có firmware: nút nạp firmware khoá, kèm câu "Tải firmware lên ở thẻ Firmware cho trạm nạp".

### 6.4. Kiểm tra trên board (bắt buộc trước khi coi là xong)

ESP32 trống (xoá sạch bằng `esptool erase_flash`) → nạp firmware → nạp mã → nối EMQX; bo đã có mã chạy 2.4.0 → cập nhật firmware → vẫn giữ mã và Wi-Fi; rút cáp giữa lúc ghi firmware → bo không chạy, cắm lại nạp lại được (ROM bootloader của ESP32 không hỏng được qua cổng USB).

## 7. PR 3: đợt cập nhật firmware từ xa, máy offline nhận khi online lại (24/11/2026)

**Vấn đề:** OTA hiện tại (FARM-FR-013) gửi từng máy, Administrator tự để file ở đâu đó có HTTPS rồi gõ tay URL và SHA-256; máy offline bị từ chối 409. Để file trên GitHub Releases thì lộ `Secrets.h` (§6).

**Quyết định:** làm theo cách các hệ thống cập nhật thiết bị hàng loạt vẫn làm (đợt triển khai có thử trước, tự dừng khi lỗi): Administrator tạo **một đợt cập nhật** (rollout) gồm một bản trong kho firmware (§6) và các bộ điều khiển chọn. Backend giữ từng máy trong hàng đợi và tự gửi lệnh khi máy online; firmware không đổi (lệnh OTA vẫn mang `version`, `url`, `sha256`).

### 7.1. File gửi cho máy

- Phần từ `0x10000` của `factory.bin` trùng từng byte với `firmware.bin` (đã kiểm trên bản 2.4.0), nên một lần tải lên dùng cho cả trạm nạp lẫn OTA. Backend tính sẵn cỡ và SHA-256 của phần này khi tải lên (`app_size`, `app_sha256`).
- Mỗi lần gửi một máy, backend cấp một **link tải dùng riêng cho máy đó**: `GET /firmware/ota/<token>`, token ngẫu nhiên 32 byte, chỉ lưu SHA-256 của token, hết hạn sau 30 phút (bằng hạn xác nhận OTA). Route không cần đăng nhập (chip không có tài khoản) và trả nhị phân kèm `Content-Length` (firmware cần để biết đã tải đủ).
- URL gốc lấy từ biến mới `OTA_DOWNLOAD_BASE_URL` (HTTPS, chứng chỉ Let's Encrypt vì chip chỉ tin ISRG Root X1, ví dụ tên miền API của staging). Trống thì không tạo được đợt (503). URL ≤ 255 ký tự (giới hạn `cmd.url` của firmware).

### 7.2. Đợt cập nhật

- **Chọn máy:** chỉ bộ điều khiển đang dùng. Loại ra (kèm lý do): firmware trước 1.4.0 (chưa nhận OTA, phải nạp USB), đã chạy đúng bản, đang trong đợt khác hoặc đang chờ một lệnh OTA gửi tay.
- **Thử trước (canary):** Administrator chọn máy thử (mặc định 1 máy đang online); các máy còn lại chờ tới khi mọi máy thử đã cập nhật xong. Bấm "Cập nhật tất cả ngay" để bỏ qua. Không chọn máy thử thì gửi tất cả ngay.
- **Trạng thái từng máy:** `QUEUED` (chờ: máy offline hoặc chưa tới lượt) → `SENT` (đã gửi lệnh, chờ heartbeat báo bản mới) → `SUCCEEDED` / `FAILED` (quá 30 phút, máy đã quay về bản cũ); `CANCELLED` (huỷ khi còn chờ), `SKIPPED` (máy bị gỡ trước khi tới lượt). Máy online lại mà đã chạy đúng bản (nạp USB) thì tính là `SUCCEEDED`.
- **Máy offline:** ở `QUEUED`; heartbeat đầu tiên khi máy online lại làm backend gửi lệnh ngay. Job mỗi phút cũng quét để không sót (backend mất broker lúc gửi thì trả về `QUEUED`).
- **Trạng thái đợt:** `ACTIVE` → `PAUSED` (Administrator dừng, hoặc **tự dừng khi một máy lỗi**) → `ACTIVE` (tiếp tục) / `CANCELLED` (huỷ: máy chờ thành `CANCELLED`, máy đang tải vẫn ghi kết quả) / `COMPLETED` (mọi máy xong). Máy lỗi có nút "Thử lại" (về `QUEUED`).
- Mỗi lần gửi giữ đúng hành vi FARM-FR-013 cũ: ghi `ota_pending` của máy, audit `DEVICE_COMMAND_SENT`, báo Farm Owner của trang trại. Người tạo đợt được báo khi đợt tự dừng vì lỗi và khi đợt xong.
- Bản firmware đang dùng trong một đợt chưa xong thì không xoá được (409).

### 7.3. Việc từng phần

| # | Phần | Việc |
|---|---|---|
| B-5 | Backend | `firmwareImage`: thêm `app_size`, `app_sha256` khi tải lên; xoá bị chặn 409 khi đợt chưa xong dùng bản đó |
| B-6 | Backend | Model `firmwareRollout` (máy nhúng trong đợt); `firmwareRollout.service.ts`: tạo, dừng, tiếp tục, mở rộng, huỷ, thử lại, gửi lệnh theo lượt; móc vào heartbeat (`recordHeartbeat`) và job OTA mỗi phút (`markOtaTimeouts` → máy lỗi, đợt tự dừng); lệnh OTA gửi tay bị 409 khi máy đang trong đợt |
| B-7 | Backend | Routes `GET/POST /admin/firmware-rollouts`, `POST /admin/firmware-rollouts/:id/{pause,resume,promote,cancel}`, `POST /admin/firmware-rollouts/:id/targets/:nodeId/retry`, `GET /firmware/ota/:token`; spec, `.env.example`, `db:script`, test tích hợp |
| W-6 | Web | Trang "Cập nhật firmware" (`/ota`) viết lại: danh sách đợt (phiên bản, tiến độ, số máy theo trạng thái), chi tiết đợt (nút dừng/tiếp tục/cập nhật tất cả/huỷ, bảng máy với trạng thái, thời gian, "Thử lại"), cửa sổ "Tạo đợt cập nhật" (chọn bản, chọn máy có lọc và lý do bị loại, máy thử, tóm tắt). Tự làm mới mỗi 10 giây khi có đợt đang chạy. Bỏ form gõ URL/SHA-256 cũ |
| W-7 | Web | Cả quy trình trên một trang: nút "Tải bản mới lên" ở trang Cập nhật firmware (form dùng chung `FirmwareUploadForm` với thẻ kho), phiên bản đọc sẵn từ chuỗi `Firmware vX.Y.Z` trong file (`detectFirmwareVersion`, test), tải xong mở luôn cửa sổ tạo đợt với bản đó; thẻ "Firmware cho trạm nạp" đổi tên "Kho firmware" vì giờ dùng cho cả trạm nạp lẫn cập nhật từ xa. Bước dựng `factory.bin` vẫn chạy trên máy dev (CI tự build phải giữ thêm `Secrets.h`, để sau) |
| D-3 | Tài liệu | Report 3 FARM-FR-013 + FARM-FR-013b, §6.15, §4.5 (4.2.24); Report 4 D21, SM-15, AD-11, bảng collection (2.2.29); `backend/CLAUDE.md`, `firmware/README.md` (kiểm tra trên board) |

### 7.4. Kiểm tra trên board (trước khi coi là xong)

Hai bộ điều khiển 2.4.0 trên staging (`OTA_DOWNLOAD_BASE_URL` trỏ tên miền API có chứng chỉ Let's Encrypt): tải lên 2.4.1 → tạo đợt, máy thử online → cập nhật xong thì máy thứ hai (đang tắt) vẫn chờ; bật máy thứ hai → nhận lệnh trong 1 phút, lên 2.4.1; một bản cố tình không nối được broker → máy quay về bản cũ sau 10 phút, đợt tự dừng sau 30 phút.
