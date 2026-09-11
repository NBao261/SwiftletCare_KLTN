/**
 * MQTTManager.cpp – MQTT client (PubSubClient) over WiFi
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

// MQTT topic helpers
static String topicBase() {
  return String("swiftlet/") + Config::farmId + "/" + Config::houseId + "/" +
         Config::zoneId;
}

static void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];

  String t(topic);
  if (t.endsWith("/command/relay")) {
    MQTTManager::onRelayCommand(msg.c_str());
  } else if (t.endsWith("/config/update")) {
    MQTTManager::onConfigUpdate(msg.c_str());
  }
}

namespace MQTTManager {

void begin() {
  wifiSecure
      .setInsecure(); // Skip cert validation for dev; use CA cert in production
  mqtt.setClient(wifiSecure);
  mqtt.setServer(Config::mqttBroker, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(1024);
  Serial.println("[MQTT] Client initialized");
}

void loop() {
  if (!mqtt.connected()) {
    String clientId = String("SC-") + Config::deviceId;
    if (mqtt.connect(clientId.c_str(), Config::mqttUsername,
                     Config::mqttPassword)) {
      Serial.println("[MQTT] Connected");
      mqtt.subscribe((topicBase() + "/command/relay").c_str(),
                     MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/config/update").c_str(),
                     MQTT_QOS_COMMAND);
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
  if (!mqtt.connected())
    return;
  JsonDocument doc;
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["light_lux"] = data.lightLux;
  doc["co2_ppm"] = data.co2Ppm;
  doc["sound_db"] = data.soundDb;
  doc["temp_outdoor"] = data.tempOutdoor;
  doc["hum_outdoor"] = data.humidOutdoor;
  doc["misting"] = relay.misting;
  doc["ventilation"] = relay.ventilation;
  doc["heating"] = relay.heating;
  doc["light"] = relay.light;
  doc["ts"] = data.timestamp;

  String payload;
  serializeJson(doc, payload);
  mqtt.publish((topicBase() + "/telemetry").c_str(), payload.c_str(), false);
}

void publishHeartbeat() {
  if (!mqtt.connected())
    return;
  JsonDocument doc;
  doc["device_id"] = Config::deviceId;
  doc["uptime_ms"] = millis();
  doc["rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();

  String payload;
  serializeJson(doc, payload);
  mqtt.publish((topicBase() + "/heartbeat").c_str(), payload.c_str(), false);
}

void publishRelayState(const RelayState &relay) {
  if (!mqtt.connected())
    return;
  mqtt.publish((topicBase() + "/relay/state").c_str(), relay.toJson().c_str(),
               true);
}

void publishAlert(const char *alertType, const char *severity,
                  const char *payload) {
  if (!mqtt.connected())
    return;
  JsonDocument doc;
  doc["type"] = alertType;
  doc["severity"] = severity;
  doc["message"] = payload;
  doc["device_id"] = Config::deviceId;
  doc["ts"] = millis();

  String msg;
  serializeJson(doc, msg);
  mqtt.publish((topicBase() + "/alert").c_str(), msg.c_str(), false);
}

void onRelayCommand(const char *payload) {
  Serial.println("[MQTT] Relay command: " + String(payload));
  // Parse JSON command and apply manual override
}

void onConfigUpdate(const char *payload) {
  Serial.println("[MQTT] Config update: " + String(payload));
  Config::update(payload);
}
} // namespace MQTTManager
