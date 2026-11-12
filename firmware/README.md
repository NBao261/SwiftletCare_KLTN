# SwiftletCare Firmware (ESP32)

> **Phạm vi sau Review 1 — firmware 1.4.0.** Yêu cầu: Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md)); thiết kế: Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.1). Firmware đã có: quạt chỉ theo nhiệt độ + độ ẩm (NH3/CO2 chỉ gửi telemetry), không còn sưởi, bơm khô thì tự ngừng phun, mất cảm biến nhiệt-ẩm thì relay về TẮT, cảnh báo ồn là `NOISE_ANOMALY`, năm tham số phát hiện chỉnh được qua MQTT; từ 1.4.0 nhận lệnh `RESTART`/`OTA` từ xa (kiểm SHA-256, tự quay về bản cũ nếu bản mới không kết nối được MQTT trong 10 phút) và gửi lý do khởi động lại + IP trong heartbeat. Công tắc bypass đã bỏ khỏi phạm vi (nhà yến thử nghiệm đi mượn, không đấu lại được — Report 3 §8). Còn lại: THREAT-FR-014 — đo dòng bơm và quạt trên mạch nhóm tự vẽ, chưa làm; ENV-FR-027 — từ 2.1.0 heartbeat báo phiên bản cấu hình đang chạy (`appliedConfigVersion`).
>
> **Thiết lập thiết bị (SF-01, FARM-FR-003c):** trang cài Wi-Fi (AP-mode) chỉ nhận Wi-Fi, không có farm/house/zone hay khoá; từ 2.1.0 bản `esp32prod` không còn ô địa chỉ broker (broker là tên miền trong `Secrets.h`, hoặc nạp lúc flash bằng `tools/flash_identity.py --broker`), bản dev vẫn có ô IP broker khi mDNS không tìm được. Thiết bị không lưu mã kích hoạt in trên nhãn — backend kiểm tra mã đó khi Farm Owner quét nhãn; từ 2.0.0 thiết bị chỉ biết device ID và broker secret (nạp vào NVS bằng `tools/flash_identity.py`); farm/house/zone nằm ở backend, thiết bị chỉ nhận cấu hình của tầng qua topic retained `swiftletcare/dev/{deviceId}/config`, nên dời tầng chỉ đổi trong DB (không còn `config/reassign`).
>
> **Thử trên thiết bị thật:** firmware đã chạy trên board ESP32 thật, nhưng chưa ghi lại bản nào và kịch bản nào đã thử. Ghi kết quả (ngày, bản firmware, đạt/không đạt) của từng kịch bản dưới đây vào đây trước khi báo cáo hoặc Report 5 dùng tới: rút cảm biến nhiệt-ẩm (relay phải TẮT), chạy bơm không có nước (phải báo `PUMP_DRY` và ngừng phun), đổi tham số từ web. Riêng 1.4.0: OTA từ trang OTA của Technician thành công (heartbeat báo bản mới); file sai SHA-256 và rút mạng giữa lúc tải (phải giữ bản cũ); bản mới không tới được broker (phải quay về bản cũ sau 10 phút); `RESTART` từ web; TLS bắt tay trong `mqttTask` (stack 12 KB) không tràn stack.
>
> **1.6.0 (hạn riêng từng relay BR-20, lọc lệnh BR-35) — chưa thử trên board.** Đã làm 09/11/2026: `pio run -e esp32dev` build được (`espressif32@6.9.0`, core 2.0.17; RAM 16,5 %, flash 58,3 %), test native `test_relay_override` 7/7, `test_command_filter` 10/10, `test_remote_command` 9/9. Còn phải thử trên board:
> - bật tay bơm rồi quạt với 2 thời hạn khác nhau: mỗi relay về tự động đúng hạn của nó, relay kia giữ nguyên, `relay/status` báo `relays.{tên}.remaining_ms` giảm dần;
> - `clear_override` kèm `relayName` (nút "Về tự động" của 1 relay) chỉ trả relay đó về tự động; không kèm `relayName` thì trả cả 3;
> - lệnh giao lại cùng `commandId` (gửi lại tay bằng MQTTX) chỉ áp 1 lần;
> - rút mạng, bấm bật relay trên web, cắm lại sau hơn 60 giây: lệnh bị bỏ và thiết bị gửi `relay/status` để web hiện đúng trạng thái;
> - bật relay ngay sau khi khởi động, trước khi có giờ NTP: lệnh vẫn áp (Report 3 §8.1);
> - board còn chạy 1.5.0 vẫn điều khiển tay được với backend mới (hết hạn hoặc huỷ 1 relay thì cả 3 relay về tự động như trước).
>
> **2.0.0 (MQTT theo thiết bị, G-07, Report 4 D3, §7.2) — chưa thử trên board.** Đã làm 08/11/2026: `pio run -e esp32dev` và `pio run -e esp32prod` build được (`espressif32@6.9.0`); test native chạy ở CI (gồm `test_alert_queue`, `test_command_filter`, `test_remote_command`); backend với EMQX thật trong Docker: mỗi thiết bị chỉ vào được cây topic của mình 8/8 (`npm run mqtt:isolation`, NFR-10 d), chạy thử đầu cuối 9/9 bằng client giả lập. Còn phải thử trên board (2 controller + AI node, trước khi lên staging):
> - nạp device ID + broker secret bằng `tools/flash_identity.py` rồi khởi động: thiết bị nối EMQX bằng tài khoản riêng, backend chuyển `ONLINE` và thiết bị nhận cấu hình retained của tầng;
> - bản `esp32prod`: TLS bắt tay với CA ISRG Root X1 ở cổng 8883 thành công, `mqttTask` không tràn stack; sai mật khẩu hoặc thiết bị đã thu hồi thì EMQX từ chối;
> - controller A không publish, không subscribe được vào topic của controller B (thử bằng MQTTX với tài khoản của A);
> - rút mạng 30 phút: điều khiển vẫn chạy, cảm biến lưu buffer, cảnh báo nằm trong hàng đợi NVS; cắm lại thì buffer và cảnh báo được gửi lại, chỉ xoá sau PUBACK, backend không lưu trùng (NFR-06);
> - khởi động lại khi còn cảnh báo chưa có PUBACK: cảnh báo vẫn được gửi lại sau khi nối lại;
> - lệnh `cmd` giao lại cùng `commandId` chỉ áp 1 lần; RESTART bị giao lại sau khi khởi động lại không gây khởi động lại lần 2 (mã lưu NVS);
> - dời controller sang tầng khác trên app (kể cả lúc thiết bị đang mất mạng): thiết bị nhận cấu hình của tầng mới khi nối lại, không cần cài lại;
> - OTA qua HTTPS dùng CA mới (không còn `setInsecure()`); bản mới không tới được broker thì quay về bản cũ sau 10 phút;
> - AI node: nối bằng tài khoản riêng, heartbeat có `fps` và `model_version`, nhận vòng đếm từ `config` retained.
>
> **2.1.0 (phiên bản cấu hình G-08, ENV-FR-027; trang AP-mode chỉ hỏi Wi-Fi ở bản production, FARM-FR-003c) — chưa thử trên board.** Đã làm 12/11/2026: `pio run -e esp32dev` và `pio run -e esp32prod` build được, `pio test -e native` 76/76. Còn phải thử trên board:
> - sửa ngưỡng trên web: thiết bị nhận `config` có `config_version` mới, heartbeat kế tiếp báo `appliedConfigVersion` bằng số đó, màn hình hiện "đã áp" (`config_sync` = `APPLIED`);
> - khởi động lại thiết bị: heartbeat đầu tiên vẫn báo đúng phiên bản (đọc lại từ NVS, khoá `cfgVersion`);
> - bản `esp32prod`: trang AP-mode chỉ có Wi-Fi; gửi tay `mqttBroker` vào `/save` cũng không đổi broker;
> - nạp bản `esp32prod` + `flash_identity.py --broker <tên miền>` (G-09): thiết bị nối đúng broker đã nạp (NVS `identity`, khoá `broker`), log không có dòng mDNS; không nạp `--broker` thì dùng tên miền trong `Secrets.h`; lưu Wi-Fi xong trang "Đã lưu" hiện rồi thiết bị khởi động lại;
> - bản `esp32dev` vẫn tìm được broker trên laptop qua `npm run mdns` và vẫn có ô broker; mạng Wi-Fi không tới được broker thì trang AP mở lại để đổi Wi-Fi;
> - board còn chạy 2.0.0 với backend mới: hiện `UNKNOWN`, không có cảnh báo `CONFIG_MISMATCH`.

PlatformIO + Arduino framework, ESP32-WROOM-32D 38 chân. Hardware BOM & đấu nối: `docs/hardware/components-guide.md`. Việc lắp đặt và thử ngoài thực địa: `docs/reports/todo-review2.md` mục 3.

## Build / Nạp firmware

```bash
cd firmware
pio run                  # build
pio run -t upload        # nạp qua USB
pio device monitor        # Serial monitor 115200
```

Cấu hình WiFi/MQTT: `src/config/Secrets.h` cho dev (mẫu `Secrets.h.example`), production nhập Wi-Fi ở trang AP-mode và nạp device ID + broker secret (và địa chỉ broker với `--broker`) vào NVS bằng `tools/flash_identity.py`. Thiết bị không lưu farm/house/zone. Tham số chạy (ngưỡng, hệ số mờ, tham số phát hiện, loa) nhận qua topic retained `…/{deviceId}/config` (ENV-FR-006).

## Kiến trúc (FreeRTOS, 3 task)

```
src/
  config/   Pin mapping, ngưỡng mặc định, lịch loa ru (Config.h/.cpp)
  sensors/  Đọc 5 cảm biến RS485 Modbus (SensorManager) — Guide §5; SignalFilter (lọc đầu vào
            bộ mờ), NoiseAnomalyDetector (NOISE_ANOMALY theo dB)
  pid/      Điều khiển relay + threat flags (PIDController); phun sương + quạt
            dùng logic mờ Sugeno + time-proportioning (FuzzyControl, C++ thuần);
            PumpDryMonitor (bơm khô → chốt ngừng phun, C++ thuần)
  audio/    DFPlayer Mini — loa ru dẫn dụ theo lịch (AudioManager) — Guide §10-12
  mqtt/     Publish telemetry/heartbeat/relay status, subscribe command (§9.2)
  storage/  NVS (config) + SPIFFS (buffer offline, ENV-FR-024)
  main.cpp  SensorTask / PIDTask / MQTTTask
```

## Phần cứng chủ chốt (Guide v3.3)

- Bus RS485: GPIO16 (RX) / GPIO17 (TX), 4800bps — 5 cảm biến Slave ID 1-5
- Relay 4 kênh kích mức CAO: GPIO25 (misting) / 26 (speaker) / 27 (ventilation) / 14 (dự phòng — luôn TẮT)
- DFPlayer Mini: GPIO33 (→ DFPlayer RX qua trở 1kΩ) / GPIO32 (← DFPlayer TX)
- 2× Buck LM2596 12V→5V (tách nguồn ESP32+RS485 / PAM8403+DFPlayer+relay)

## Công cụ hỗ trợ

`src/test_noise_rs485.cpp` — sketch quét Slave ID/baudrate RS485 độc lập (không build cùng `main.cpp`; đổi `src_filter` trong `platformio.ini` hoặc dùng `pio run -t upload --upload-port ... -e <env riêng>` khi cần chạy).

## Test

```bash
pio test -e native   # unit test host (không cần board thật) — test/test_fuzzy, test_filter, test_noise_anomaly, test_pump_dry, test_remote_command, test_relay_override, test_command_filter
```

Env `native` chỉ build các file C++ thuần (`pid/FuzzyControl`, `pid/PumpDryMonitor`, `pid/RelayOverride`, `mqtt/CommandFilter`, `sensors/SignalFilter`, `sensors/NoiseAnomalyDetector` — không phụ thuộc Arduino) và cần **g++ trên máy** — Windows: cài MinGW-w64 (vd `choco install mingw`) rồi thêm vào PATH.

## Điều khiển mờ (ENV-FR-010/011)

- **Phun sương** = f(độ ẩm, nhiệt độ), **quạt** = f(nhiệt độ, độ ẩm) → % công suất 0-100 (Sugeno bậc 0, luật xem `FuzzyControl.h`). Điểm gãy tập mờ suy ra từ ngưỡng `Config` nên chỉnh ngưỡng qua MQTT topic `config` vẫn có tác dụng.
- Relay chỉ bật/tắt nên % được áp bằng time-proportioning: BẬT `duty × cửa sổ` đầu mỗi cửa sổ (mặc định 120s); quạt lệch nửa cửa sổ so với phun sương.
- **4 hệ số chỉnh được lúc chạy** qua topic `config`, lưu NVS, kẹp vào khoảng hợp lệ (ENV-FR-021): `fuzzy_humidity_band` (2–20 %RH, mặc định 8), `fuzzy_temp_band` (1–10 °C, 4), `fuzzy_fan_dry_level` (0–100 %, 40), `fuzzy_window_sec` (60–600 s, 120). Mặc định cho ra đúng hàm thuộc gốc. Chỉnh trên web: trang Analytics → "Hiệu quả điều khiển" → "Chỉnh hệ số".
- **NH3/CO2 không điều khiển gì** (Report 3 C-2, ALERT-FR-012): chưa có giới hạn nào được xác lập cho nhà yến, nên firmware chỉ gửi hai chỉ số này lên telemetry; cảnh báo vượt ngưỡng do backend tính. Khóa `nh3_max`/`co2_max` trong topic `config` bị bỏ qua.
- **Trạng thái an toàn (THREAT-FR-013):** không có số đo nhiệt-ẩm hợp lệ nào trong 2 chu kỳ điều khiển gần nhất (`CONTROL_INPUT_MAX_AGE_CYCLES` — một lần đọc RS485 lỗi lẻ thì vẫn dùng số đo hợp lệ gần nhất, không tắt relay), hoặc số đo ngoài dải vật lý (độ ẩm tới 101 % vẫn tính là bão hoà hợp lệ) → nhu cầu phun và quạt = 0, relay TẮT cho tới khi có số đo hợp lệ. Vòng điều khiển vẫn chạy nên override vẫn hết hạn và cảnh báo `SENSOR_FAULT`/`RS485_BUS_FAILURE` vẫn được phát. Can thiệp tay vẫn bật được relay.
- % gửi lên trong telemetry `control_output {misting, ventilation}`; dashboard web hiển thị trên gauge relay.
- **MISTING_INEFFECTIVE (THREAT-FR-011, `pid/PumpDryMonitor`; tên `PUMP_DRY` trước bản 1.5.0, lớp và tham số `pump_dry_*` giữ tên cũ):** chỉ xét khi độ ẩm còn **dưới `humidity_min`** — quanh mục tiêu bộ mờ giữ độ ẩm đứng yên là bình thường, xét ở đó thì bơm tốt cũng bị báo khô. Dưới mục tiêu, relay phun BẬT **cộng dồn** `pump_dry_on_sec` (mặc định 300 s) mà độ ẩm không tăng quá `pump_dry_min_rise_pct` (mặc định 2 điểm %RH) → báo và **ngừng phun** để bảo vệ bơm (`control_output.misting` = 0). Chốt nhả khi nhu cầu phun về 0, khi có can thiệp tay, hoặc **tự thử lại sau 30 phút** (`PUMP_DRY_RETRY_MS` trong `Config.h` — hằng số kỹ thuật chọn tay, chưa chỉnh được qua MQTT). Lần đọc cảm biến lỗi không xoá phần đã cộng dồn và không nhả chốt. Chốt **không** ngắt bơm đang được bật tay: khi đó nội dung cảnh báo nói rõ bơm vẫn chạy. Cảnh báo `PUMP_DRY` và `NOISE_ANOMALY` được gửi lại mỗi 15 phút (`EPISODE_ALERT_RESEND_MS`) chừng nào sự cố còn tiếp diễn, để backend không tự đóng một đợt đang diễn ra.
- **Can thiệp tay (BR-20, BR-35):** mỗi relay một hạn (`pid/RelayOverride`), `CLEAR_OVERRIDE` có `relayName` thì chỉ huỷ relay đó; `mqtt/CommandFilter` áp mỗi `commandId` 1 lần (16 mã trong RAM, mã RESTART/OTA lưu NVS), bỏ lệnh relay trễ quá 60 giây hoặc chưa kiểm được tuổi vì chưa có NTP.
- **MQTT (từ bản 2.0.0):** `esp-mqtt`, topic và tài khoản riêng từng thiết bị. `pio run -e esp32prod` dùng cổng 8883 và TLS; nạp tài khoản bằng `python tools/flash_identity.py --port COM5 --device-id <id> --broker-secret <secret>`. **Không tương thích backend trước G-07:** backend và mọi thiết bị phải lên cùng lúc.

## Lọc đầu vào + phát hiện ồn bất thường

- `sensors/SignalFilter`: median 5 mẫu + Kalman vô hướng cho nhiệt độ và độ ẩm ở 1 Hz (sensorTask). **Chỉ bộ mờ dùng giá trị lọc**; telemetry vẫn gửi giá trị thô. Mẫu thô không hợp lệ (NaN hoặc ngoài dải vật lý) không được đưa vào bộ lọc; bộ mờ dùng giá trị lọc hợp lệ gần nhất tối đa `CONTROL_INPUT_MAX_AGE_CYCLES` chu kỳ (xem trạng thái an toàn). Tắt/bật qua topic `config` key `fuzzy_input_filter` (NVS `fzFilter`) để so sánh A/B (ENV-FR-022).
- `sensors/NoiseAnomalyDetector`: `NOISE_ANOMALY` theo mức dB (ES-NOISE-01 không có dạng sóng) — **24 mức nền, mỗi giờ trong ngày một mức** (phân vị 90 tự học khi loa tắt, nên giờ chim ra/vào tổ vốn ồn không bị báo nhầm); ồn > mức của giờ đó + `noise_margin_db` (mặc định 15 dB) trong ≥ `noise_min_sec` (mặc định 10) trên 15 giây → MEDIUM (THREAT-FR-007). Đây là tín hiệu tham khảo chờ Domain Expert kiểm chứng, không phải kết luận về hành vi chim. Bỏ qua khi loa đang phát (theo trạng thái loa thật: lịch đổi giờ, nghe thử, bật tay). Giờ chưa học đủ ~1 giờ dữ liệu hoặc chưa có NTP thì chưa đánh giá; mức nền nằm trong RAM nên khởi động lại phải học lại ~1 ngày. Hai ngưỡng chỉnh được theo Zone (bảng dưới), cần hiệu chỉnh bằng dữ liệu thật.

## Tham số phát hiện chỉnh theo Zone (EXPERT-FR-008, firmware 1.3.0)

Domain Expert chỉnh trên web → backend gửi cấu hình đầy đủ qua topic retained `…/{deviceId}/config` → firmware kẹp vào khoảng hợp lệ và lưu NVS. Mặc định là các hằng số dùng trước 1.3.0; khoảng hợp lệ là giới hạn kỹ thuật, không phải khuyến nghị nuôi yến.

| Khóa trong `config` | Mặc định | Khoảng | Khóa NVS | Dùng ở |
|---|---|---|---|---|
| `noise_margin_db` | 15 | 5–30 | `dtNoiseDb` | `NoiseAnomalyDetector` — dB trên mức nền của giờ đó |
| `noise_min_sec` | 10 | 5–15 | `dtNoiseSec` | `NoiseAnomalyDetector` — số giây ồn trong cửa sổ 15 s |
| `pump_dry_on_sec` | 300 | 120–900 | `dtPumpSec` | `PumpDryMonitor` — thời gian bơm BẬT cộng dồn |
| `pump_dry_min_rise_pct` | 2 | 0.5–10 | `dtPumpRise` | `PumpDryMonitor` — độ ẩm phải tăng |
| `speaker_drop_pct` | 70 | 30–90 | `dtSpkDrop` | `SPEAKER_FAILURE` — mức âm giảm so với nền |

`SPEAKER_FAILURE` hiện so mức dB đo được với `(100 − speaker_drop_pct)%` mức nền dB (nền 50 dB, mặc định 70 → báo khi dưới 15 dB). dB là thang logarit nên điều kiện này rất khó xảy ra trong thực tế; bản 1.3.0 chỉ đưa con số ra thành tham số, chưa đổi cách tính — cần đo ở nhà yến thật rồi mới quyết định sửa.
