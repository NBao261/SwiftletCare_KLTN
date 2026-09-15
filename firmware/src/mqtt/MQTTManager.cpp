/**
 * MQTTManager.cpp – MQTT client (PubSubClient) over WiFi
 * Topic schema đúng SRS §9.2: swiftletcare/{farmId}/{houseId}/{zoneId}/...
 * SRS: ENV-FR-001, ENV-FR-015, §9.2, SEC-NFR-001
 */
#include "MQTTManager.h"
#include "config/Config.h"
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

static WiFiClientSecure wifiSecure;
static PubSubClient mqtt;
static unsigned long lastHeartbeat = 0;

// relayState sống trong main.cpp (dùng chung với pidTask) — MQTTManager chỉ
// áp Manual Override lên đó khi có lệnh từ cloud (ENV-FR-016).
extern RelayState relayState;

// MQTT topic helpers (§9.2)
static String topicBase() {
  return String("swiftletcare/") + Config::farmId + "/" + Config::houseId + "/" + Config::zoneId;
}

static void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];

  String t(topic);
  if (t.endsWith("/relay/command")) {
    MQTTManager::onRelayCommand(msg.c_str());
  } else if (t.endsWith("/config/update")) {
    MQTTManager::onConfigUpdate(msg.c_str());
  }
}

namespace MQTTManager {

void begin() {
  wifiSecure.setInsecure(); // Skip cert validation for dev; use CA cert in production
  mqtt.setClient(wifiSecure);
  mqtt.setServer(Config::mqttBroker, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(1024);
  Serial.println("[MQTT] Client initialized");
}

void loop() {
  if (!mqtt.connected()) {
    String clientId = String("SC-") + Config::deviceId;
    if (mqtt.connect(clientId.c_str(), Config::mqttUsername, Config::mqttPassword)) {
      Serial.println("[MQTT] Connected");
      mqtt.subscribe((topicBase() + "/relay/command").c_str(), MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/config/update").c_str(), MQTT_QOS_COMMAND);
    } else {
      Serial.println("[MQTT] Connection failed, rc=" + String(mqtt.state()));
    }
  }
  mqtt.loop();

  // Heartbeat (FARM-FR-005)
  if (millis() - lastHeartbeat > MQTT_HEARTBEAT_MS) {
    publishHeartbeat();
    lastHeartbeat = millis();
  }
}

bool isConnected() { return mqtt.connected(); }

void publishTelemetry(const SensorData &data, const RelayState &relay) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["deviceId"] = Config::deviceId; // backend tra SensorNode theo field này (telemetryHandler.ts)
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["light_lux"] = data.lightLux;
  doc["nh3_ppm"] = data.nh3Ppm;
  doc["co2_ppm"] = data.co2Ppm;
  doc["sound_db"] = data.soundDb;
  doc["relay_states"]["misting"] = relay.misting;
  doc["relay_states"]["speaker"] = relay.speaker;
  doc["relay_states"]["ventilation"] = relay.ventilation;
  doc["relay_states"]["heating"] = relay.heating;
  doc["ts"] = data.timestamp;

  String payload;
  serializeJson(doc, payload);
  mqtt.publish((topicBase() + "/telemetry").c_str(), payload.c_str(), false);
}

void publishHeartbeat() {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  // Field names khớp backend/src/types/domain.ts HeartbeatPayload
  doc["deviceId"] = Config::deviceId;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);
  mqtt.publish((topicBase() + "/heartbeat").c_str(), payload.c_str(), false);
}

void publishRelayState(const RelayState &relay) {
  if (!mqtt.connected()) return;
  mqtt.publish((topicBase() + "/relay/status").c_str(), relay.toJson().c_str(), true);
}

void publishAlert(const char *alertType, const char *severity, const char *payload) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["type"] = alertType;
  doc["severity"] = severity;
  doc["message"] = payload;
  doc["device_id"] = Config::deviceId;
  doc["ts"] = millis();

  String msg;
  serializeJson(doc, msg);
  // Alerts không có topic riêng trong §9.2 cho ESP32 (chỉ vision/alert cho RPi) —
  // publish qua relay/status kèm cờ alert để backend suy ra, hoặc mở rộng topic
  // riêng `alert` nếu cần. Tạm publish lên `{base}/alert` (ngoài §9.2, cần backend cấu hình subscribe thêm).
  mqtt.publish((topicBase() + "/alert").c_str(), msg.c_str(), false);
}

void onRelayCommand(const char *payload) {
  Serial.println("[MQTT] Relay command: " + String(payload));

  JsonDocument doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("[MQTT] Relay command: invalid JSON");
    return;
  }

  const char *relayName = doc["relayName"] | "";
  bool state = doc["state"] | false;
  unsigned long durationMs = doc["durationMs"] | (unsigned long)MANUAL_OVERRIDE_MS;

  if (strlen(relayName) == 0) {
    Serial.println("[MQTT] Relay command: missing relayName");
    return;
  }

  // ENV-FR-016..018: bật Manual Override, tạm dừng PID cho relay này
  PIDController::setManualOverride(relayName, state, durationMs, relayState);

  // Xác nhận lại trạng thái ngay cho backend/dashboard (ENV-FR-015)
  publishRelayState(relayState);
}

void onConfigUpdate(const char *payload) {
  Serial.println("[MQTT] Config update: " + String(payload));
  Config::update(payload);
}
} // namespace MQTTManager
