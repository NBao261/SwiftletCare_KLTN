/**
 * Config.cpp – Runtime configuration defaults
 */
#include "Config.h"
#include "Secrets.h" // KHÔNG commit — copy từ Secrets.h.example rồi điền giá trị thật
#include "storage/StorageManager.h" // save() gọi StorageManager::saveConfig() — không có include-cycle (StorageManager.h chỉ include sensors/SensorManager.h)
#include <ArduinoJson.h>

namespace Config {
// WiFi credentials — giá trị mặc định từ Secrets.h, có thể bị WiFiProvisioner
// ghi đè bằng giá trị đã lưu trong NVS (WiFi nhập qua captive portal AP-mode).
String wifiSsid = SECRET_WIFI_SSID;
String wifiPassword = SECRET_WIFI_PASSWORD;

// MQTT broker — giá trị mặc định từ Secrets.h, có thể bị ghi đè bằng IP mới
// nhập qua captive portal (đổi WiFi mạng khác => IP LAN broker cũng đổi, xem
// MQTTManager::begin() + WiFiProvisioner).
String mqttBroker = SECRET_MQTT_BROKER;
const char *mqttUsername = SECRET_MQTT_USERNAME;
const char *mqttPassword = SECRET_MQTT_PASSWORD;

// Device identity — farmId/houseId/zoneId mặc định từ Secrets.h, có thể bị
// ghi đè bằng giá trị mới nhận qua lệnh MQTT config/reassign (Flow 21 Nhánh A,
// FARM-FR-007b) và lưu vào NVS — xem main.cpp setup() (StorageManager::loadIdentity())
// và MQTTManager::onConfigReassign(). deviceId KHÔNG đổi lúc runtime (định danh
// vật lý cố định của thiết bị, không thuộc phạm vi dời Zone).
String farmId = SECRET_FARM_ID;
String houseId = SECRET_HOUSE_ID;
String zoneId = SECRET_ZONE_ID;
const char *deviceId = SECRET_DEVICE_ID;

// Runtime thresholds (loaded from NVS, fallback to defaults). volatile:
// xem giải thích ở Config.h — phải khớp cv-qualifier với extern ở đó.
volatile float tempMin = DEFAULT_TEMP_MIN;
volatile float tempMax = DEFAULT_TEMP_MAX;
volatile float humidityMin = DEFAULT_HUMIDITY_MIN;
volatile float humidityMax = DEFAULT_HUMIDITY_MAX;
volatile float lightMax = DEFAULT_LIGHT_MAX;
volatile int nh3Max = DEFAULT_NH3_MAX;
volatile int co2Max = DEFAULT_CO2_MAX;
int sensorIntervalMs = SENSOR_INTERVAL_MS;
int pidIntervalMs = PID_INTERVAL_MS;

// Speaker schedule (ENV-FR-013b)
volatile bool speakerScheduleEnabled = true;
volatile int speakerWindow1StartHour = SPEAKER_WINDOW_1_START_HOUR;
volatile int speakerWindow1EndHour = SPEAKER_WINDOW_1_END_HOUR;
volatile int speakerWindow2StartHour = SPEAKER_WINDOW_2_START_HOUR;
volatile int speakerWindow2EndHour = SPEAKER_WINDOW_2_END_HOUR;
volatile int speakerVolume = DFPLAYER_DEFAULT_VOLUME;
volatile int speakerTrack = DFPLAYER_DEFAULT_TRACK;

void load() {
  // Giá trị thật (mặc định Config.h hoặc đã lưu từ NVS) đã được
  // StorageManager::loadConfig() áp dụng TRƯỚC khi hàm này chạy — xem thứ tự
  // gọi trong main.cpp setup(): StorageManager::begin() (gọi loadConfig()
  // bên trong) rồi mới tới Config::load(). Hàm này chỉ log xác nhận, không
  // tự làm gì thêm.
  Serial.println("[Config] San sang (mac dinh Config.h hoac gia tri da luu "
                 "tu NVS — xem StorageManager::loadConfig())");
}

void save() { StorageManager::saveConfig(); }

void update(const char *jsonPayload) {
  JsonDocument doc;
  if (deserializeJson(doc, jsonPayload)) {
    Serial.println("[Config] Invalid JSON");
    return;
  }
  if (doc["temp_min"].is<float>())
    tempMin = doc["temp_min"].as<float>();
  if (doc["temp_max"].is<float>())
    tempMax = doc["temp_max"].as<float>();
  if (doc["humidity_min"].is<float>())
    humidityMin = doc["humidity_min"].as<float>();
  if (doc["humidity_max"].is<float>())
    humidityMax = doc["humidity_max"].as<float>();
  if (doc["light_max"].is<float>())
    lightMax = doc["light_max"].as<float>();
  if (doc["nh3_max"].is<int>())
    nh3Max = doc["nh3_max"].as<int>();
  if (doc["co2_max"].is<int>())
    co2Max = doc["co2_max"].as<int>();
  if (doc["speaker_schedule_enabled"].is<bool>())
    speakerScheduleEnabled = doc["speaker_schedule_enabled"].as<bool>();
  if (doc["speaker_window1_start_hour"].is<int>())
    speakerWindow1StartHour = doc["speaker_window1_start_hour"].as<int>();
  if (doc["speaker_window1_end_hour"].is<int>())
    speakerWindow1EndHour = doc["speaker_window1_end_hour"].as<int>();
  if (doc["speaker_window2_start_hour"].is<int>())
    speakerWindow2StartHour = doc["speaker_window2_start_hour"].as<int>();
  if (doc["speaker_window2_end_hour"].is<int>())
    speakerWindow2EndHour = doc["speaker_window2_end_hour"].as<int>();
  if (doc["speaker_volume"].is<int>())
    speakerVolume = doc["speaker_volume"].as<int>();
  if (doc["speaker_track"].is<int>())
    speakerTrack = doc["speaker_track"].as<int>();
  Serial.println("[Config] Updated from MQTT");
  save(); // ENV-FR-013b/006/007: persist ngay, không chỉ sống trong RAM
}
} // namespace Config
