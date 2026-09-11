/**
 * StorageManager.cpp – NVS config + SPIFFS offline telemetry buffer
 * SRS: REL-NFR-003, ENV-FR-014
 */
#include "StorageManager.h"
#include "config/Config.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include <SPIFFS.h>

static Preferences prefs;
static const char *BUFFER_FILE = "/telemetry_buffer.jsonl";

namespace StorageManager {

void begin() {
  prefs.begin("swiftlet", false);
  if (!SPIFFS.begin(true)) {
    Serial.println("[Storage] SPIFFS mount failed");
  }
  loadConfig();
  Serial.println("[Storage] Initialized");
}

void saveConfig() {
  prefs.putFloat("tempMin", Config::tempMin);
  prefs.putFloat("tempMax", Config::tempMax);
  prefs.putFloat("humMin", Config::humidityMin);
  prefs.putFloat("humMax", Config::humidityMax);
  prefs.putFloat("lightMax", Config::lightMax);
  prefs.putInt("co2Max", Config::co2Max);
  prefs.putInt("sensorMs", Config::sensorIntervalMs);
  prefs.putInt("pidMs", Config::pidIntervalMs);
  Serial.println("[Storage] Config saved to NVS");
}

void loadConfig() {
  Config::tempMin = prefs.getFloat("tempMin", DEFAULT_TEMP_MIN);
  Config::tempMax = prefs.getFloat("tempMax", DEFAULT_TEMP_MAX);
  Config::humidityMin = prefs.getFloat("humMin", DEFAULT_HUMIDITY_MIN);
  Config::humidityMax = prefs.getFloat("humMax", DEFAULT_HUMIDITY_MAX);
  Config::lightMax = prefs.getFloat("lightMax", DEFAULT_LIGHT_MAX);
  Config::co2Max = prefs.getInt("co2Max", DEFAULT_CO2_MAX);
  Config::sensorIntervalMs = prefs.getInt("sensorMs", SENSOR_INTERVAL_MS);
  Config::pidIntervalMs = prefs.getInt("pidMs", PID_INTERVAL_MS);
  Serial.println("[Storage] Config loaded from NVS");
}

void bufferTelemetry(const SensorData &data) {
  File f = SPIFFS.open(BUFFER_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[Storage] Cannot open buffer file");
    return;
  }
  f.println(data.toJson());
  f.close();
}

void flushBuffer() {
  if (!SPIFFS.exists(BUFFER_FILE))
    return;

  File f = SPIFFS.open(BUFFER_FILE, FILE_READ);
  if (!f || f.size() == 0) {
    f.close();
    return;
  }

  Serial.println("[Storage] Flushing " + String(f.size()) +
                 " bytes of buffered data");
  // In production: parse each line and re-publish via MQTT
  f.close();
  clearBuffer();
}

int getBufferCount() {
  if (!SPIFFS.exists(BUFFER_FILE))
    return 0;
  File f = SPIFFS.open(BUFFER_FILE, FILE_READ);
  int count = 0;
  while (f.available()) {
    if (f.read() == '\n')
      count++;
  }
  f.close();
  return count;
}

void clearBuffer() { SPIFFS.remove(BUFFER_FILE); }
} // namespace StorageManager
