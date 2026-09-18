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
// bufferTelemetry() ghi từ sensorTask (Core 1); flushBuffer()/getBufferCount()/
// clearBuffer() đọc/xoá từ mqttTask (Core 0) — cùng chạm 1 file SPIFFS, cần
// mutex (non-recursive, xem clearBufferInternal() bên dưới để tránh deadlock
// khi flushBuffer() tự gọi clearBuffer() trong lúc đang giữ lock).
static SemaphoreHandle_t bufferMutex;

namespace StorageManager {

void begin() {
  bufferMutex = xSemaphoreCreateMutex();
  if (!prefs.begin("swiftlet", false)) {
    Serial.println("[Storage] ⚠ Preferences (NVS) begin() thất bại — mọi "
                   "get/put threshold/lịch loa sẽ dùng mặc định, không lưu "
                   "được");
  }
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
  prefs.putInt("nh3Max", Config::nh3Max);
  prefs.putInt("co2Max", Config::co2Max);
  prefs.putInt("sensorMs", Config::sensorIntervalMs);
  prefs.putInt("pidMs", Config::pidIntervalMs);
  // Speaker schedule (ENV-FR-013b) — key ≤15 ký tự (giới hạn NVS Preferences)
  prefs.putBool("spkEn", Config::speakerScheduleEnabled);
  prefs.putInt("spkW1Start", Config::speakerWindow1StartHour);
  prefs.putInt("spkW1End", Config::speakerWindow1EndHour);
  prefs.putInt("spkW2Start", Config::speakerWindow2StartHour);
  prefs.putInt("spkW2End", Config::speakerWindow2EndHour);
  prefs.putInt("spkVol", Config::speakerVolume);
  prefs.putInt("spkTrack", Config::speakerTrack);
  Serial.println("[Storage] Config saved to NVS");
}

void loadConfig() {
  Config::tempMin = prefs.getFloat("tempMin", DEFAULT_TEMP_MIN);
  Config::tempMax = prefs.getFloat("tempMax", DEFAULT_TEMP_MAX);
  Config::humidityMin = prefs.getFloat("humMin", DEFAULT_HUMIDITY_MIN);
  Config::humidityMax = prefs.getFloat("humMax", DEFAULT_HUMIDITY_MAX);
  Config::lightMax = prefs.getFloat("lightMax", DEFAULT_LIGHT_MAX);
  Config::nh3Max = prefs.getInt("nh3Max", DEFAULT_NH3_MAX);
  Config::co2Max = prefs.getInt("co2Max", DEFAULT_CO2_MAX);
  Config::sensorIntervalMs = prefs.getInt("sensorMs", SENSOR_INTERVAL_MS);
  Config::pidIntervalMs = prefs.getInt("pidMs", PID_INTERVAL_MS);
  Config::speakerScheduleEnabled = prefs.getBool("spkEn", true);
  Config::speakerWindow1StartHour =
      prefs.getInt("spkW1Start", SPEAKER_WINDOW_1_START_HOUR);
  Config::speakerWindow1EndHour =
      prefs.getInt("spkW1End", SPEAKER_WINDOW_1_END_HOUR);
  Config::speakerWindow2StartHour =
      prefs.getInt("spkW2Start", SPEAKER_WINDOW_2_START_HOUR);
  Config::speakerWindow2EndHour =
      prefs.getInt("spkW2End", SPEAKER_WINDOW_2_END_HOUR);
  Config::speakerVolume = prefs.getInt("spkVol", DFPLAYER_DEFAULT_VOLUME);
  Config::speakerTrack = prefs.getInt("spkTrack", DFPLAYER_DEFAULT_TRACK);
  Serial.println("[Storage] Config loaded from NVS");
}

bool loadWifiCredentials(String &ssid, String &password) {
  if (!prefs.isKey("wifiSsid"))
    return false; // chưa từng cấu hình qua captive portal — dùng mặc định
                  // Secrets.h
  ssid = prefs.getString("wifiSsid", "");
  password = prefs.getString("wifiPass", "");
  return ssid.length() > 0;
}

void saveWifiCredentials(const String &ssid, const String &password) {
  prefs.putString("wifiSsid", ssid);
  prefs.putString("wifiPass", password);
  Serial.println("[Storage] Đã lưu WiFi mới vào NVS: " + ssid);
}

bool loadMqttBroker(String &broker) {
  if (!prefs.isKey("mqttBroker"))
    return false; // chưa từng cấu hình qua captive portal — dùng mặc định
                  // Secrets.h
  broker = prefs.getString("mqttBroker", "");
  return broker.length() > 0;
}

void saveMqttBroker(const String &broker) {
  prefs.putString("mqttBroker", broker);
  Serial.println("[Storage] Đã lưu MQTT broker mới vào NVS: " + broker);
}

bool loadIdentity(String &farmId, String &houseId, String &zoneId) {
  if (!prefs.isKey("idFarmId"))
    return false; // chưa từng dời Zone — dùng mặc định Secrets.h
  farmId = prefs.getString("idFarmId", "");
  houseId = prefs.getString("idHouseId", "");
  zoneId = prefs.getString("idZoneId", "");
  return farmId.length() > 0 && houseId.length() > 0 && zoneId.length() > 0;
}

void saveIdentity(const String &farmId, const String &houseId,
                  const String &zoneId) {
  prefs.putString("idFarmId", farmId);
  prefs.putString("idHouseId", houseId);
  prefs.putString("idZoneId", zoneId);
  Serial.println("[Storage] Đã lưu định danh Farm/House/Zone mới vào NVS: " +
                 farmId + "/" + houseId + "/" + zoneId);
}

void bufferTelemetry(const SensorData &data) {
  if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(200)) != pdTRUE)
    return;
  File f = SPIFFS.open(BUFFER_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[Storage] Cannot open buffer file");
    xSemaphoreGive(bufferMutex);
    return;
  }
  f.println(data.toJson());
  f.close();
  xSemaphoreGive(bufferMutex);
}

// Xoá buffer KHÔNG khoá — chỉ gọi khi caller đã giữ bufferMutex (flushBuffer())
// hoặc từ clearBuffer() (tự khoá trước khi gọi). KHÔNG gọi trực tiếp từ nơi
// khác để tránh deadlock (mutex tạo bằng xSemaphoreCreateMutex() không phải
// recursive).
static void clearBufferInternal() { SPIFFS.remove(BUFFER_FILE); }

void flushBuffer(PublishLineFn publishLine) {
  if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(200)) != pdTRUE)
    return;

  if (!SPIFFS.exists(BUFFER_FILE)) {
    xSemaphoreGive(bufferMutex);
    return;
  }

  File f = SPIFFS.open(BUFFER_FILE, FILE_READ);
  if (!f || f.size() == 0) {
    if (f)
      f.close();
    xSemaphoreGive(bufferMutex);
    return;
  }

  Serial.println("[Storage] Flushing " + String(f.size()) +
                 " bytes of buffered data");

  bool allOk = true;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0)
      continue;
    if (!publishLine(line)) {
      allOk = false;
      break;
    }
  }
  f.close();

  if (allOk) {
    clearBufferInternal();
    Serial.println("[Storage] Buffer flushed & cleared");
  } else {
    Serial.println("[Storage] Flush failed partway — buffer kept for retry");
  }

  xSemaphoreGive(bufferMutex);
}

int getBufferCount() {
  if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(200)) != pdTRUE)
    return 0;
  if (!SPIFFS.exists(BUFFER_FILE)) {
    xSemaphoreGive(bufferMutex);
    return 0;
  }
  File f = SPIFFS.open(BUFFER_FILE, FILE_READ);
  if (!f) {
    xSemaphoreGive(bufferMutex);
    return 0;
  }
  int count = 0;
  while (f.available()) {
    if (f.read() == '\n')
      count++;
  }
  f.close();
  xSemaphoreGive(bufferMutex);
  return count;
}

void clearBuffer() {
  if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(200)) != pdTRUE)
    return;
  clearBufferInternal();
  xSemaphoreGive(bufferMutex);
}
} // namespace StorageManager
