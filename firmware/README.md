# SwiftletCare Firmware (ESP32)

PlatformIO + Arduino framework, ESP32-WROOM-32D 38 chân. Hardware BOM & đấu nối: `SwiftletCare_Components_Guide_v3.3.md`. Checklist lắp đặt: `SwiftletCare_TASK_DETAIL_Checklist.md` mục A.

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
  sensors/  Đọc 5 cảm biến RS485 Modbus (SensorManager) — Guide §5
  pid/      Closed-loop on-off control 4 relay + threat flags (PIDController)
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
pio test -e native   # unit test host (không cần board thật)
```
