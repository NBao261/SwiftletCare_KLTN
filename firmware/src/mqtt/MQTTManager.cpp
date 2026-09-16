/**
 * MQTTManager.cpp – MQTT client (PubSubClient) over WiFi
 * Topic schema đúng SRS §9.2: swiftletcare/{farmId}/{houseId}/{zoneId}/...
 * SRS: ENV-FR-001, ENV-FR-015, §9.2, SEC-NFR-001
 */
#include "MQTTManager.h"
#include "config/Config.h"
#include "storage/StorageManager.h"
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <WiFi.h>

// Dev dùng cổng 1883 non-TLS (xem MQTT_PORT ở Config.h) — WiFiClient thường,
// không cần WiFiClientSecure/setInsecure() nữa.
static WiFiClient wifiClient;
static PubSubClient mqtt;
static unsigned long lastHeartbeat = 0;

// Đếm số lần connect() thất bại liên tiếp — sai/đổi IP broker không làm WiFi
// fail nên không tái dùng được trigger captive-portal cũ, cần đếm riêng.
static int mqttFailCount = 0;
// ≈30 lần retry ở nhịp hiện tại (mqttTask delay = Config::sensorIntervalMs ≈
// 1s/lần) ≈ 30 giây — đủ lâu để không trigger nhầm lúc broker container mới
// khởi động chưa kịp lên, nhưng không quá lâu để người dùng phải chờ.
static const int MQTT_PROVISION_TRIGGER_FAILURES = 30;

// ── mDNS broker discovery ────────────────────────────────────────────────────
// "swiftletcare-broker.local" (chạy `npm run mdns` trên máy host docker-compose,
// xem backend/src/scripts/mdns-responder.script.ts) trỏ về IP LAN hiện tại của
// broker — ESP32 tự hỏi lại mỗi khi cần thay vì phải biết/nhập tay IP, kể cả
// khi đổi mạng WiFi hay router cấp lại DHCP giữa lúc đang chạy.
static const char *MDNS_BROKER_HOST = "swiftletcare-broker"; // resolve "<host>.local"
static bool mdnsStarted = false;

/** true nếu resolve được (đã cập nhật Config::mqttBroker + mqtt.setServer() nếu cần) */
static bool resolveBrokerViaMdns() {
  if (!mdnsStarted) {
    mdnsStarted = MDNS.begin(Config::deviceId);
    if (!mdnsStarted) {
      Serial.println("[MQTT] mDNS.begin() thất bại");
      return false;
    }
  }

  IPAddress ip = MDNS.queryHost(MDNS_BROKER_HOST, 3000);
  if (ip == IPAddress(0, 0, 0, 0)) return false;

  String ipStr = ip.toString();
  if (ipStr != Config::mqttBroker) {
    Serial.println("[MQTT] mDNS tìm được broker tại " + ipStr);
    Config::mqttBroker = ipStr;
  }
  mqtt.setServer(Config::mqttBroker.c_str(), MQTT_PORT);
  return true;
}

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
  mqtt.setClient(wifiClient);

  // Ưu tiên tự tìm broker qua mDNS — hoạt động ngay cả khi đổi mạng WiFi,
  // không ai cần biết/nhập IP thủ công. Chỉ khi mDNS thất bại (mạng chặn
  // multicast, hoặc chưa chạy `npm run mdns` trên máy host) mới rơi về IP đã
  // lưu qua captive portal, cuối cùng mới về mặc định Secrets.h.
  if (!resolveBrokerViaMdns()) {
    String savedBroker;
    if (StorageManager::loadMqttBroker(savedBroker)) {
      Config::mqttBroker = savedBroker;
      Serial.println("[MQTT] mDNS thất bại — dùng broker đã lưu trong NVS: " + savedBroker);
    } else {
      Serial.println("[MQTT] mDNS thất bại — dùng mặc định Secrets.h: " + Config::mqttBroker);
    }
    mqtt.setServer(Config::mqttBroker.c_str(), MQTT_PORT);
  }

  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(1024);
  Serial.println("[MQTT] Client initialized, broker=" + Config::mqttBroker);
}

void loop() {
  if (!mqtt.connected()) {
    // Thử lại mDNS mỗi 5 lần fail liên tiếp (~5s) — IP host có thể đã đổi
    // (router cấp lại DHCP) ngay trong lúc ESP32 đang chạy, không cần đợi tới
    // ngưỡng captive-portal mới tự sửa được.
    if (mqttFailCount > 0 && mqttFailCount % 5 == 0) {
      resolveBrokerViaMdns();
    }

    String clientId = String("SC-") + Config::deviceId;
    if (mqtt.connect(clientId.c_str(), Config::mqttUsername, Config::mqttPassword)) {
      Serial.println("[MQTT] Connected");
      mqttFailCount = 0;
      mqtt.subscribe((topicBase() + "/relay/command").c_str(), MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/config/update").c_str(), MQTT_QOS_COMMAND);
    } else {
      mqttFailCount++;
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

bool isBrokerUnreachable() { return mqttFailCount >= MQTT_PROVISION_TRIGGER_FAILURES; }

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
