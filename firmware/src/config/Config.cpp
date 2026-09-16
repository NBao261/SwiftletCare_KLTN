/**
 * Config.cpp – Runtime configuration defaults
 */
#include "Config.h"
#include "Secrets.h" // KHÔNG commit — copy từ Secrets.h.example rồi điền giá trị thật
#include <ArduinoJson.h>

namespace Config {
// WiFi credentials — giá trị mặc định từ Secrets.h, có thể bị WiFiProvisioner
// ghi đè bằng giá trị đã lưu trong NVS (WiFi nhập qua captive portal AP-mode).
String wifiSsid = SECRET_WIFI_SSID;
String wifiPassword = SECRET_WIFI_PASSWORD;

// MQTT broker
const char *mqttBroker = SECRET_MQTT_BROKER;
const char *mqttUsername = SECRET_MQTT_USERNAME;
const char *mqttPassword = SECRET_MQTT_PASSWORD;

// Device identity
const char *farmId = SECRET_FARM_ID;
const char *houseId = SECRET_HOUSE_ID;
const char *zoneId = SECRET_ZONE_ID;
const char *deviceId = SECRET_DEVICE_ID;

// Runtime thresholds (loaded from NVS, fallback to defaults)
float tempMin = DEFAULT_TEMP_MIN;
float tempMax = DEFAULT_TEMP_MAX;
float humidityMin = DEFAULT_HUMIDITY_MIN;
float humidityMax = DEFAULT_HUMIDITY_MAX;
float lightMax = DEFAULT_LIGHT_MAX;
int nh3Max = DEFAULT_NH3_MAX;
int co2Max = DEFAULT_CO2_MAX;
int sensorIntervalMs = SENSOR_INTERVAL_MS;
int pidIntervalMs = PID_INTERVAL_MS;

// Speaker schedule (ENV-FR-013b)
bool speakerScheduleEnabled = true;
int speakerWindow1StartHour = SPEAKER_WINDOW_1_START_HOUR;
int speakerWindow1EndHour = SPEAKER_WINDOW_1_END_HOUR;
int speakerWindow2StartHour = SPEAKER_WINDOW_2_START_HOUR;
int speakerWindow2EndHour = SPEAKER_WINDOW_2_END_HOUR;
int speakerVolume = DFPLAYER_DEFAULT_VOLUME;
int speakerTrack = DFPLAYER_DEFAULT_TRACK;

void load() {
  // StorageManager::loadConfig() handles this
  Serial.println("[Config] Defaults loaded (NVS override via StorageManager)");
}

void save() {
  // StorageManager::saveConfig() handles this
}

void update(const char *jsonPayload) {
  JsonDocument doc;
  if (deserializeJson(doc, jsonPayload)) {
    Serial.println("[Config] Invalid JSON");
    return;
  }
  if (doc.containsKey("temp_min"))
    tempMin = doc["temp_min"].as<float>();
  if (doc.containsKey("temp_max"))
    tempMax = doc["temp_max"].as<float>();
  if (doc.containsKey("humidity_min"))
    humidityMin = doc["humidity_min"].as<float>();
  if (doc.containsKey("humidity_max"))
    humidityMax = doc["humidity_max"].as<float>();
  if (doc.containsKey("light_max"))
    lightMax = doc["light_max"].as<float>();
  if (doc.containsKey("nh3_max"))
    nh3Max = doc["nh3_max"].as<int>();
  if (doc.containsKey("co2_max"))
    co2Max = doc["co2_max"].as<int>();
  if (doc.containsKey("speaker_schedule_enabled"))
    speakerScheduleEnabled = doc["speaker_schedule_enabled"].as<bool>();
  if (doc.containsKey("speaker_volume"))
    speakerVolume = doc["speaker_volume"].as<int>();
  if (doc.containsKey("speaker_track"))
    speakerTrack = doc["speaker_track"].as<int>();
  Serial.println("[Config] Updated from MQTT");
}
} // namespace Config
