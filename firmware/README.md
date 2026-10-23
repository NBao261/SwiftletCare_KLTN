# SwiftletCare Firmware (ESP32)

> **Phạm vi sau Review 1 — firmware 1.4.0.** Yêu cầu: Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md)); thiết kế: Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.1). Firmware đã có: quạt chỉ theo nhiệt độ + độ ẩm (NH3/CO2 chỉ gửi telemetry), không còn sưởi, bơm khô thì tự ngừng phun, mất cảm biến nhiệt-ẩm thì relay về TẮT, cảnh báo ồn là `NOISE_ANOMALY`, năm tham số phát hiện chỉnh được qua MQTT; từ 1.4.0 nhận lệnh `RESTART`/`OTA` từ xa (kiểm SHA-256, tự quay về bản cũ nếu bản mới không kết nối được MQTT trong 10 phút) và gửi lý do khởi động lại + IP trong heartbeat. Còn lại: ENV-FR-023 (phần cứng) — công tắc 3 vị trí Auto/Off/Hand cho bơm và quạt, chưa lắp; ENV-FR-027 — gửi version cấu hình đang áp trong heartbeat, chưa làm.
>
> **Thiết lập thiết bị (MF-10, FARM-FR-003c):** trang cài Wi-Fi (AP-mode) chỉ nhận Wi-Fi và địa chỉ broker, không có farm/house/zone hay khoá. Thiết bị không lưu mã kích hoạt in trên nhãn — backend kiểm tra mã đó khi Farm Owner quét nhãn; farm/house/zone do backend gửi xuống qua `config/reassign` khi heartbeat tới sai topic.
>
> **Thử trên thiết bị thật:** firmware đã chạy trên board ESP32 thật, nhưng chưa ghi lại bản nào và kịch bản nào đã thử. Ghi kết quả (ngày, bản firmware, đạt/không đạt) của từng kịch bản dưới đây vào đây trước khi báo cáo hoặc Report 5 dùng tới: rút cảm biến nhiệt-ẩm (relay phải TẮT), chạy bơm không có nước (phải báo `PUMP_DRY` và ngừng phun), đổi tham số từ web. Riêng 1.4.0: OTA từ trang OTA của Technician thành công (heartbeat báo bản mới); file sai SHA-256 và rút mạng giữa lúc tải (phải giữ bản cũ); bản mới không tới được broker (phải quay về bản cũ sau 10 phút); `RESTART` từ web; TLS bắt tay trong `mqttTask` (stack 12 KB) không tràn stack.

PlatformIO + Arduino framework, ESP32-WROOM-32D 38 chân. Hardware BOM & đấu nối: `docs/hardware/components-guide.md`. Checklist lắp đặt: `docs/task-checklist.md` mục A.

## Build / Nạp firmware

```bash
cd firmware
pio run                  # build
pio run -t upload        # nạp qua USB
pio device monitor        # Serial monitor 115200
```

Cấu hình WiFi/MQTT/Farm-House-Zone ID: sửa `src/config/Config.cpp` (dev) hoặc qua NVS/MQTT `config/update` (production, ENV-FR-006).

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
  storage/  NVS (config) + SPIFFS (buffer offline, REL-NFR-003)
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
pio test -e native   # unit test host (không cần board thật) — test/test_fuzzy, test_filter, test_noise_anomaly, test_pump_dry, test_remote_command
```

Env `native` chỉ build các file C++ thuần (`pid/FuzzyControl`, `pid/PumpDryMonitor`, `sensors/SignalFilter`, `sensors/NoiseAnomalyDetector` — không phụ thuộc Arduino) và cần **g++ trên máy** — Windows: cài MinGW-w64 (vd `choco install mingw`) rồi thêm vào PATH.

## Điều khiển mờ (ENV-FR-010/011)

- **Phun sương** = f(độ ẩm, nhiệt độ), **quạt** = f(nhiệt độ, độ ẩm) → % công suất 0-100 (Sugeno bậc 0, luật xem `FuzzyControl.h`). Điểm gãy tập mờ suy ra từ ngưỡng `Config` nên chỉnh ngưỡng qua MQTT `config/update` vẫn có tác dụng.
- Relay chỉ bật/tắt nên % được áp bằng time-proportioning: BẬT `duty × cửa sổ` đầu mỗi cửa sổ (mặc định 120s); quạt lệch nửa cửa sổ so với phun sương.
- **4 hệ số chỉnh được lúc chạy** qua `config/update`, lưu NVS, kẹp vào khoảng hợp lệ (ENV-FR-021): `fuzzy_humidity_band` (2–20 %RH, mặc định 8), `fuzzy_temp_band` (1–10 °C, 4), `fuzzy_fan_dry_level` (0–100 %, 40), `fuzzy_window_sec` (60–600 s, 120). Mặc định cho ra đúng hàm thuộc gốc. Chỉnh trên web: trang Analytics → "Hiệu quả điều khiển" → "Chỉnh hệ số".
- **NH3/CO2 không điều khiển gì** (Report 3 C-2, ALERT-FR-012): chưa có giới hạn nào được xác lập cho nhà yến, nên firmware chỉ gửi hai chỉ số này lên telemetry; cảnh báo vượt ngưỡng do backend tính. Khóa `nh3_max`/`co2_max` trong `config/update` bị bỏ qua.
- **Trạng thái an toàn (THREAT-FR-013):** không có số đo nhiệt-ẩm hợp lệ nào trong 2 chu kỳ điều khiển gần nhất (`CONTROL_INPUT_MAX_AGE_CYCLES` — một lần đọc RS485 lỗi lẻ thì vẫn dùng số đo hợp lệ gần nhất, không tắt relay), hoặc số đo ngoài dải vật lý (độ ẩm tới 101 % vẫn tính là bão hoà hợp lệ) → nhu cầu phun và quạt = 0, relay TẮT cho tới khi có số đo hợp lệ. Vòng điều khiển vẫn chạy nên override vẫn hết hạn và cảnh báo `SENSOR_FAULT`/`RS485_BUS_FAILURE` vẫn được phát. Can thiệp tay vẫn bật được relay.
- % gửi lên trong telemetry `control_output {misting, ventilation}`; dashboard web hiển thị trên gauge relay.
- **PUMP_DRY (THREAT-FR-011, `pid/PumpDryMonitor`):** chỉ xét khi độ ẩm còn **dưới `humidity_min`** — quanh mục tiêu bộ mờ giữ độ ẩm đứng yên là bình thường, xét ở đó thì bơm tốt cũng bị báo khô. Dưới mục tiêu, relay phun BẬT **cộng dồn** `pump_dry_on_sec` (mặc định 300 s) mà độ ẩm không tăng quá `pump_dry_min_rise_pct` (mặc định 2 điểm %RH) → báo và **ngừng phun** để bảo vệ bơm (`control_output.misting` = 0). Chốt nhả khi nhu cầu phun về 0, khi có can thiệp tay, hoặc **tự thử lại sau 30 phút** (`PUMP_DRY_RETRY_MS` trong `Config.h` — hằng số kỹ thuật chọn tay, chưa chỉnh được qua MQTT). Lần đọc cảm biến lỗi không xoá phần đã cộng dồn và không nhả chốt. Chốt **không** ngắt bơm đang được bật tay: khi đó nội dung cảnh báo nói rõ bơm vẫn chạy. Cảnh báo `PUMP_DRY` và `NOISE_ANOMALY` được gửi lại mỗi 15 phút (`EPISODE_ALERT_RESEND_MS`) chừng nào sự cố còn tiếp diễn, để backend không tự đóng một đợt đang diễn ra.

## Lọc đầu vào + phát hiện ồn bất thường

- `sensors/SignalFilter`: median 5 mẫu + Kalman vô hướng cho nhiệt độ và độ ẩm ở 1 Hz (sensorTask). **Chỉ bộ mờ dùng giá trị lọc**; telemetry vẫn gửi giá trị thô. Mẫu thô không hợp lệ (NaN hoặc ngoài dải vật lý) không được đưa vào bộ lọc; bộ mờ dùng giá trị lọc hợp lệ gần nhất tối đa `CONTROL_INPUT_MAX_AGE_CYCLES` chu kỳ (xem trạng thái an toàn). Tắt/bật qua `config/update` key `fuzzy_input_filter` (NVS `fzFilter`) để so sánh A/B (ENV-FR-022).
- `sensors/NoiseAnomalyDetector`: `NOISE_ANOMALY` theo mức dB (ES-NOISE-01 không có dạng sóng) — **24 mức nền, mỗi giờ trong ngày một mức** (phân vị 90 tự học khi loa tắt, nên giờ chim ra/vào tổ vốn ồn không bị báo nhầm); ồn > mức của giờ đó + `noise_margin_db` (mặc định 15 dB) trong ≥ `noise_min_sec` (mặc định 10) trên 15 giây → MEDIUM (THREAT-FR-007). Đây là tín hiệu tham khảo chờ Domain Expert kiểm chứng, không phải kết luận về hành vi chim. Bỏ qua khi loa đang phát (theo trạng thái loa thật: lịch đổi giờ, nghe thử, bật tay). Giờ chưa học đủ ~1 giờ dữ liệu hoặc chưa có NTP thì chưa đánh giá; mức nền nằm trong RAM nên khởi động lại phải học lại ~1 ngày. Hai ngưỡng chỉnh được theo Zone (bảng dưới), cần hiệu chỉnh bằng dữ liệu thật.

## Tham số phát hiện chỉnh theo Zone (EXPERT-FR-008, firmware 1.3.0)

Domain Expert chỉnh trên web → backend gửi qua `config/update` → firmware kẹp vào khoảng hợp lệ và lưu NVS. Mặc định là các hằng số dùng trước 1.3.0; khoảng hợp lệ là giới hạn kỹ thuật, không phải khuyến nghị nuôi yến.

| Khóa `config/update` | Mặc định | Khoảng | Khóa NVS | Dùng ở |
|---|---|---|---|---|
| `noise_margin_db` | 15 | 5–30 | `dtNoiseDb` | `NoiseAnomalyDetector` — dB trên mức nền của giờ đó |
| `noise_min_sec` | 10 | 5–15 | `dtNoiseSec` | `NoiseAnomalyDetector` — số giây ồn trong cửa sổ 15 s |
| `pump_dry_on_sec` | 300 | 120–900 | `dtPumpSec` | `PumpDryMonitor` — thời gian bơm BẬT cộng dồn |
| `pump_dry_min_rise_pct` | 2 | 0.5–10 | `dtPumpRise` | `PumpDryMonitor` — độ ẩm phải tăng |
| `speaker_drop_pct` | 70 | 30–90 | `dtSpkDrop` | `SPEAKER_FAILURE` — mức âm giảm so với nền |

`SPEAKER_FAILURE` hiện so mức dB đo được với `(100 − speaker_drop_pct)%` mức nền dB (nền 50 dB, mặc định 70 → báo khi dưới 15 dB). dB là thang logarit nên điều kiện này rất khó xảy ra trong thực tế; bản 1.3.0 chỉ đưa con số ra thành tham số, chưa đổi cách tính — cần đo ở nhà yến thật rồi mới quyết định sửa.
