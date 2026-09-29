# SwiftletCare Firmware (ESP32)

PlatformIO + Arduino framework, ESP32-WROOM-32D 38 chân. Hardware BOM & đấu nối: `SwiftletCare_Components_Guide_v3.11.md`. Checklist lắp đặt: `SwiftletCare_TASK_DETAIL_Checklist.md` mục A.

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
            bộ mờ), PanicDetector (BIRD_PANIC theo dB)
  pid/      Điều khiển 4 relay + threat flags (PIDController); phun sương + quạt
            dùng logic mờ Sugeno + time-proportioning (FuzzyControl, C++ thuần)
  audio/    DFPlayer Mini — loa ru dẫn dụ theo lịch (AudioManager) — Guide §10-12
  mqtt/     Publish telemetry/heartbeat/relay status, subscribe command (§9.2)
  storage/  NVS (config) + SPIFFS (buffer offline, REL-NFR-003)
  main.cpp  SensorTask / PIDTask / MQTTTask
```

## Phần cứng chủ chốt (Guide v3.3)

- Bus RS485: GPIO16 (RX) / GPIO17 (TX), 4800bps — 5 cảm biến Slave ID 1-5
- Relay 4 kênh kích mức CAO: GPIO25 (misting) / 26 (speaker) / 27 (ventilation) / 14 (heating)
- DFPlayer Mini: GPIO33 (→ DFPlayer RX qua trở 1kΩ) / GPIO32 (← DFPlayer TX)
- 2× Buck LM2596 12V→5V (tách nguồn ESP32+RS485 / PAM8403+DFPlayer+relay)

## Công cụ hỗ trợ

`src/test_noise_rs485.cpp` — sketch quét Slave ID/baudrate RS485 độc lập (không build cùng `main.cpp`; đổi `src_filter` trong `platformio.ini` hoặc dùng `pio run -t upload --upload-port ... -e <env riêng>` khi cần chạy).

## Test

```bash
pio test -e native   # unit test host (không cần board thật) — test/test_fuzzy, test_filter, test_panic
```

Env `native` chỉ build `src/pid/FuzzyControl.cpp` (không phụ thuộc Arduino) và cần **g++ trên máy** — Windows: cài MinGW-w64 (vd `choco install mingw`) rồi thêm vào PATH.

## Điều khiển mờ (ENV-FR-010/011, firmware 1.1.0)

- **Phun sương** = f(độ ẩm, nhiệt độ), **quạt** = f(nhiệt độ, độ ẩm, NH3, CO2) → % công suất 0-100 (Sugeno bậc 0, luật xem `FuzzyControl.h`). Điểm gãy tập mờ suy ra từ ngưỡng `Config` nên chỉnh ngưỡng qua MQTT `config/update` vẫn có tác dụng.
- Relay chỉ bật/tắt nên % được áp bằng time-proportioning: BẬT `duty × cửa sổ` đầu mỗi cửa sổ (mặc định 120s); quạt lệch nửa cửa sổ so với phun sương.
- **4 hệ số chỉnh được lúc chạy** qua `config/update`, lưu NVS, kẹp vào khoảng hợp lệ (ENV-FR-021): `fuzzy_humidity_band` (2–20 %RH, mặc định 8), `fuzzy_temp_band` (1–10 °C, 4), `fuzzy_fan_dry_level` (0–100 %, 40), `fuzzy_window_sec` (60–600 s, 120). Mặc định cho ra đúng hàm thuộc gốc. Chỉnh trên web: trang Analytics → "Hiệu quả điều khiển" → "Chỉnh hệ số".
- NH3/CO2 vượt max luôn ép quạt 100%. Sưởi vẫn theo ngưỡng `temp_min`.
- % gửi lên trong telemetry `control_output {misting, ventilation}`; dashboard web hiển thị trên gauge relay.
- PUMP_DRY: 5 phút relay BẬT **cộng dồn** trong 1 đợt phun mà ẩm không tăng > 2%.

## Lọc đầu vào + phát hiện chim hoảng (firmware 1.2.0)

- `sensors/SignalFilter`: median 5 mẫu + Kalman vô hướng cho nhiệt/ẩm/NH3/CO2 ở 1 Hz (sensorTask). **Chỉ bộ mờ dùng giá trị lọc**; telemetry vẫn gửi giá trị thô, chốt an toàn NH3/CO2 xét trên giá trị thô. Tắt/bật qua `config/update` key `fuzzy_input_filter` (NVS `fzFilter`) để so sánh A/B (ENV-FR-022).
- `sensors/PanicDetector`: BIRD_PANIC theo mức dB (ES-NOISE-01 không có dạng sóng) — ồn > nền yên tĩnh + 15 dB trong ≥ 10/15 giây, bỏ qua lúc loa ru phát; gửi mức MEDIUM (THREAT-FR-007). Ngưỡng là hằng số trong `PanicDetector.h`, cần hiệu chỉnh bằng dữ liệu thật.
