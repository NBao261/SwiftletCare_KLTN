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
// 300 mẫu × Config::sensorIntervalMs (mặc định SENSOR_INTERVAL_MS=1000ms,
// xem giải thích ở trên) = 300s = 5 phút, đúng ý định gốc THREAT-FR-006.
// LƯU Ý: con số 300 GẮN CHẶT với SENSOR_INTERVAL_MS ≈ 1s — nếu sau này đổi
// SENSOR_INTERVAL_MS (vd về lại 5-60s theo đúng SRS), phải tính lại số này
// (trước đây 30 mẫu tưởng ứng với chu kỳ đọc 10s = 5 phút, nhưng thực tế chu
// kỳ đọc là 1s nên 30 mẫu chỉ ≈ 30s, làm cửa sổ baseline ngắn hơn dự định 10
// lần). RAM: 300 float = 1200 byte, không đáng kể trên ESP32 320KB.
#define AUDIO_BASELINE_WINDOW_SAMPLES 300
#define AUDIO_DROP_THRESHOLD 0.70f // 70% drop = SPEAKER_FAILURE

// ── MQTT Broker (§9.2) ───────────────────────────────────────────────────────
// Dev: cổng 1883 non-TLS — khớp cách backend đang kết nối EMQX (xem
// backend/.env.example), tránh toàn bộ lớp phức tạp TLS/cert tự ký trên ESP32
// (đã gặp lỗi "start_ssl_client... Software caused connection abort" ở 8883).
// Production: đổi lại 8883 (SEC-NFR-001) + nạp CA cert thật, đừng dùng
// setInsecure().
#define MQTT_PORT 1883

// Cờ build dành riêng cho 1 build variant "production" trong tương lai — CHƯA
// tồn tại, không định nghĩa ở đâu trong repo (không có trong platformio.ini).
// Cố tình làm build fail ngay nếu ai đó bật cờ này trước khi TLS/CA-cert thật
// được implement trong MQTTManager.cpp, để tránh cảm giác an toàn giả ("đây
// là bản production") trong khi thực chất vẫn gửi MQTT cleartext qua 1883.
#ifdef SWIFTLETCARE_PRODUCTION_BUILD
#error                                                                         \
    "SWIFTLETCARE_PRODUCTION_BUILD requires MQTT_PORT=8883 + TLS (WiFiClientSecure + CA cert) -- not implemented in MQTTManager.cpp yet. Remove this flag (stay on dev port 1883), or add real TLS infrastructure first."
#endif

// Chỉ còn MQTT_QOS_COMMAND: đây là QoS DUY NHẤT thực sự dùng được, vì
// PubSubClient::publish() không có tham số QoS (luôn gửi QoS 0) — chỉ
// subscribe() mới nhận QoS (xem MQTTManager.cpp mqtt.subscribe(...,
// MQTT_QOS_COMMAND)). MQTT_QOS_TELEMETRY/MQTT_QOS_ALERT trước đây không được
// dùng ở đâu cả (dead code, dễ gây hiểu lầm là publish có QoS) — đã bỏ.
#define MQTT_QOS_COMMAND 1

namespace Config {
// wifiSsid/wifiPassword/mqttBroker/farmId/houseId/zoneId là String (không phải
// const char*) vì đều có thể bị ghi đè lúc runtime bằng giá trị mới:
// wifiSsid/wifiPassword qua captive portal (WiFiProvisioner đọc lại từ NVS lúc
// tryConnect()); mqttBroker qua captive portal (MQTTManager::begin() đọc lại
// từ NVS); farmId/houseId/zoneId qua lệnh MQTT config/reassign (Flow 21 Nhánh
// A, FARM-FR-007b — xem MQTTManager::onConfigReassign() + main.cpp setup()
// StorageManager::loadIdentity()). Việc ghi đè farmId/houseId/zoneId CHỈ xảy
// ra trong setup() trước khi mqttTask/pidTask được tạo (bằng ESP.restart() sau
// khi lưu NVS — không hot-swap lúc task đang chạy), nên KHÔNG vi phạm giả định
// "đọc xuyên core không cần mutex" của mqttTopicBase (xem MQTTManager.cpp).
// mqttUsername/mqttPassword/deviceId vẫn cố định theo Secrets.h — hệ thống MQTT
// credential riêng theo thiết bị chưa được implement (ngoài phạm vi Flow 21
// Nhánh A hiện tại).
extern String wifiSsid;
extern String wifiPassword;
extern String mqttBroker;
extern const char *mqttUsername;
extern const char *mqttPassword;
extern String farmId;
extern String houseId;
extern String zoneId;
extern const char *deviceId;

// Runtime config (loaded from NVS). volatile: các field dưới đây được GHI
// trong Config::update() (chạy trong mqttTask, Core 0, xem
// MQTTManager::onConfigUpdate) và ĐỌC mỗi chu kỳ bởi pidTask (Core 1, qua
// PIDController.cpp) và/hoặc AudioManager::updateSchedule() (gọi từ
// pidTask) — cùng loại cross-core visibility hazard đã fix cho
// mqttFailCount trong MQTTManager.cpp (static volatile int, xem comment ở
// đó). QUAN TRỌNG: volatile phải khớp ở CẢ HAI phía — extern ở đây VÀ định
// nghĩa thật trong Config.cpp — nếu không, 2 khai báo của cùng 1 biến ngoại
// vi không khớp cv-qualifier.
// sensorIntervalMs/pidIntervalMs KHÔNG cần volatile: chỉ được set 1 lần từ
// StorageManager::loadConfig() trong setup() (đơn luồng, trước khi tạo task
// nào) — Config::update() không xử lý 2 key này, không ai ghi lại lúc
// runtime (đã kiểm tra lại toàn bộ Config::update()).
extern volatile float tempMin;
extern volatile float tempMax;
extern volatile float humidityMin;
extern volatile float humidityMax;
extern volatile float lightMax;
extern volatile int nh3Max;
extern volatile int co2Max;
extern int sensorIntervalMs;
extern int pidIntervalMs;

// Speaker schedule (ENV-FR-013b) – overridable via MQTT config/update
extern volatile bool speakerScheduleEnabled;
extern volatile int speakerWindow1StartHour;
extern volatile int speakerWindow1EndHour;
extern volatile int speakerWindow2StartHour;
extern volatile int speakerWindow2EndHour;
extern volatile int speakerVolume;
extern volatile int speakerTrack;

void load();                          // Load from NVS
void save();                          // Persist to NVS
void update(const char *jsonPayload); // Update from MQTT command
} // namespace Config
