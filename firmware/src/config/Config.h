/**
 * SwiftletCare – Global Configuration
 * Loaded from NVS on boot. Overridable via MQTT config/update command.
 *
 * Hardware BOM: Components Guide v3.3 (RS485 Modbus sensor bus + GPIO relay)
 * SRS: ENV-FR-001, ENV-FR-006, ENV-FR-007, ENV-FR-013b
 */

#pragma once
#include <Arduino.h>

// ── RS485 Modbus Bus (Guide §5) ──────────────────────────────────────────────
// UART TTL→RS485 V2 module: ESP32 GPIO17→TXD, GPIO16→RXD
#define PIN_RS485_RX 16
#define PIN_RS485_TX 17
#define MODBUS_BAUDRATE 4800 // all 5 sensors unified at 4800bps (Guide §3)

// Modbus Slave IDs (Guide §2.1, §4)
#define MODBUS_ID_NOISE 1      // ES-NOISE-01
#define MODBUS_ID_CO2 2        // ES-CO2-01
#define MODBUS_ID_NH3 3        // ES-NH3-01
#define MODBUS_ID_LIGHT 4      // ES-ALS-02
#define MODBUS_ID_TEMP_HUMID 5 // ES35-SW (SHT35), cuối bus, DIP Pin5 ON

// ── Relay 4 kênh (kích mức CAO, Guide §8-9) ──────────────────────────────────
#define PIN_RELAY_MISTING 25     // IN1 – phun sương
#define PIN_RELAY_SPEAKER 26     // IN2 – nguồn amply loa ru
#define PIN_RELAY_VENTILATION 27 // IN3 – quạt thông gió
#define PIN_RELAY_HEATING 14     // IN4 – dự phòng (sưởi)
#define RELAY_ACTIVE_HIGH true   // Jumper đặt ở High-level trigger

// ── DFPlayer Mini (loa ru, Guide §10) ────────────────────────────────────────
// DFPlayer RX ← ESP32 GPIO33 (qua trở 1kΩ) | DFPlayer TX → ESP32 GPIO32
#define PIN_DFPLAYER_ESP_TX 33
#define PIN_DFPLAYER_ESP_RX 32
#define DFPLAYER_DEFAULT_VOLUME 20 // 0-30
#define DFPLAYER_DEFAULT_TRACK 1   // 0001.mp3

// ── Firmware version (báo lên backend qua heartbeat — FARM-FR-006) ──────────
#define FIRMWARE_VERSION "1.0.0"

// ── Timing ────────────────────────────────────────────────────────────────
#define WATCHDOG_TIMEOUT_SEC 30
// ⚠️ SRS ENV-FR-002 quy định 5-60s; đặt 1000ms theo yêu cầu thực tế của user để
// dashboard cập nhật liên tục. Với RS485, mỗi Slave ID timeout ~1s
// (ModbusMaster mặc định), nên khi còn cảm biến chưa đấu dây, chu kỳ đọc THỰC
// TẾ vẫn bị kéo dài bởi số lần timeout đó (vd 4/5 cảm biến timeout ≈ 4s/chu kỳ)
// — không phải lỗi.
#define SENSOR_INTERVAL_MS 1000
#define PID_INTERVAL_MS 10000
#define MQTT_HEARTBEAT_MS 30000    // 30 seconds (FARM-FR-005)
#define MANUAL_OVERRIDE_MS 1800000 // 30 minutes (ENV-FR-018)

// ── Default Thresholds (ENV-FR-006, ENV-FR-007) ─────────────────────────────
#define DEFAULT_TEMP_MIN 26.0f
#define DEFAULT_TEMP_MAX 31.0f
#define DEFAULT_HUMIDITY_MIN 75.0f
#define DEFAULT_HUMIDITY_MAX 95.0f
#define DEFAULT_LIGHT_MAX 0.2f
#define DEFAULT_NH3_MAX 25 // ppm (ES-NH3-01, bản 0-500ppm)
#define DEFAULT_CO2_MAX 1500

// ── Speaker Schedule (ENV-FR-013b) – mặc định 5-7h & 17-19h ─────────────────
#define SPEAKER_WINDOW_1_START_HOUR 5
#define SPEAKER_WINDOW_1_END_HOUR 7
#define SPEAKER_WINDOW_2_START_HOUR 17
#define SPEAKER_WINDOW_2_END_HOUR 19

// ── Audio Anomaly Detection (THREAT-FR-006, dựa trên ES-NOISE-01) ───────────
#define AUDIO_BASELINE_WINDOW_SAMPLES 30 // ~5 phút @ chu kỳ đọc 10s
#define AUDIO_DROP_THRESHOLD 0.70f       // 70% drop = SPEAKER_FAILURE

// ── MQTT Broker (§9.2) ───────────────────────────────────────────────────────
#define MQTT_PORT 8883 // TLS (SEC-NFR-001)
#define MQTT_QOS_TELEMETRY 0
#define MQTT_QOS_COMMAND 1
#define MQTT_QOS_ALERT 1

namespace Config {
// String (không phải const char*) vì WiFiProvisioner có thể ghi đè giá trị này
// bằng WiFi mới nhập qua captive portal, đọc lại từ NVS lúc boot — khác với
// mqttBroker/mqttUsername/... vẫn cố định theo Secrets.h (không đổi khi đổi
// WiFi).
extern String wifiSsid;
extern String wifiPassword;
extern const char *mqttBroker;
extern const char *mqttUsername;
extern const char *mqttPassword;
extern const char *farmId;
extern const char *houseId;
extern const char *zoneId;
extern const char *deviceId;

// Runtime config (loaded from NVS)
extern float tempMin;
extern float tempMax;
extern float humidityMin;
extern float humidityMax;
extern float lightMax;
extern int nh3Max;
extern int co2Max;
extern int sensorIntervalMs;
extern int pidIntervalMs;

// Speaker schedule (ENV-FR-013b) – overridable via MQTT config/update
extern bool speakerScheduleEnabled;
extern int speakerWindow1StartHour;
extern int speakerWindow1EndHour;
extern int speakerWindow2StartHour;
extern int speakerWindow2EndHour;
extern int speakerVolume;
extern int speakerTrack;

void load();                          // Load from NVS
void save();                          // Persist to NVS
void update(const char *jsonPayload); // Update from MQTT command
} // namespace Config
