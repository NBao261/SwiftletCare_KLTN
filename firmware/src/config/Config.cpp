/**
 * Config.cpp – Runtime configuration defaults
 */
#include "Config.h"
#include <ArduinoJson.h>

namespace Config {
// WiFi credentials (override via NVS or hardcode for dev)
const char *wifiSsid = "SwiftletCare_AP";
const char *wifiPassword = "swiftlet2026";

// MQTT broker
const char *mqttBroker = "mqtt.swiftletcare.local";
const char *mqttUsername = "esp32_node";
const char *mqttPassword = "mqtt_secret";

// Device identity
const char *farmId = "farm_001";
const char *houseId = "house_001";
const char *zoneId = "zone_001";
const char *deviceId = "node_001";

// Runtime thresholds (loaded from NVS, fallback to defaults)
float tempMin = DEFAULT_TEMP_MIN;
float tempMax = DEFAULT_TEMP_MAX;
float humidityMin = DEFAULT_HUMIDITY_MIN;
float humidityMax = DEFAULT_HUMIDITY_MAX;
float lightMax = DEFAULT_LIGHT_MAX;
int co2Max = DEFAULT_CO2_MAX;
int sensorIntervalMs = SENSOR_INTERVAL_MS;
int pidIntervalMs = PID_INTERVAL_MS;

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
  if (doc.containsKey("co2_max"))
    co2Max = doc["co2_max"].as<int>();
  Serial.println("[Config] Updated from MQTT");
}
} // namespace Config
