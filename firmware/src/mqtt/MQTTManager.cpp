/**
 * MQTTManager.cpp – MQTT client (PubSubClient) over WiFi
 * Topic schema đúng SRS §9.2: swiftletcare/{farmId}/{houseId}/{zoneId}/...
 * SRS: ENV-FR-001, ENV-FR-015, §9.2, SEC-NFR-001
 */
#include "MQTTManager.h"
#include "audio/AudioManager.h"
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
// true từ lúc connect thành công tới khi heartbeat đầu tiên gửi được — heartbeat
// đó mang cờ justConnected để backend đẩy lại config/update (ngưỡng + lịch loa)
// mà thiết bị có thể đã lỡ lúc offline/restart. Chỉ đọc/ghi trong mqttTask.
static bool justConnected = false;

// Đếm số lần connect() thất bại liên tiếp — sai/đổi IP broker không làm WiFi
// fail nên không tái dùng được trigger captive-portal cũ, cần đếm riêng.
// volatile: biến này được GHI trong mqttTask (pin vào Core 0, xem main.cpp)
// và ĐỌC trong isBrokerUnreachable() gọi từ Arduino loop() (Core 1 mặc định)
// — 2 core khác nhau, không có mutex/atomic bảo vệ, nên cần volatile để loop()
// không bao giờ đọc phải giá trị cache cũ trong register do compiler tối ưu.
// volatile (không cần mutex/std::atomic) là đủ vì đây là counter đơn giản với
// đúng 1 writer + 1 reader, không có read-modify-write phức hợp xuyên core
// (mqttTask chỉ increment/reset; loop() chỉ so sánh với ngưỡng). Khác với
// portalActive trong WiFiProvisioner.cpp (cố tình KHÔNG volatile, vì chỉ được
// ghi/đọc từ cùng 1 task/core, không có race xuyên core) — đừng "sửa" biến đó
// theo cùng lý do vì không áp dụng được.
static volatile int mqttFailCount = 0;
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
// dataMutex sống trong main.cpp, bảo vệ relayState/latestSensorData xuyên
// 3 task — MQTTManager cần lock khi đọc/ghi relayState từ onRelayCommand()
// (chạy trong mqttTask, Core 0) vì pidTask (Core 1) đọc/ghi relayState mỗi
// chu kỳ không đồng bộ (relayState là struct nhiều field, không phải 1
// scalar như mqttFailCount — cần mutex thật, volatile không đủ).
extern SemaphoreHandle_t dataMutex;
// pidTask chạy mỗi PID_INTERVAL_MS (10s) — lệnh nghe thử đánh thức nó ngay để
// loa kêu trong ~1s thay vì chờ tới chu kỳ kế tiếp.
extern TaskHandle_t pidTaskHandle;

// MQTT topic helpers (§9.2). Base đã được tính 1 lần trong main.cpp setup()
// (đơn luồng, trước khi tạo task nào) vào biến toàn cục mqttTopicBase — vì
// hàm này được gọi từ CẢ mqttTask (Core 0) LẪN pidTask (Core 1, qua
// publishAlert()), và Config::farmId/houseId/zoneId không đổi lúc runtime
// SAU setup() (nay là String, có thể được nạp từ NVS TRONG setup() — xem
// main.cpp — nhưng lần đổi tiếp theo, nếu có, chỉ tới qua onConfigReassign()
// bên dưới, luôn kết thúc bằng ESP.restart() nên không có ai đổi giá trị này
// trong lúc task đang chạy). KHÔNG dùng
// biến static cục bộ tính lười ("magic static") trong hàm này dù C++11 có
// guard thread-safe cho kiểu đó — lý do là lần gọi ĐẦU TIÊN của hàm này chỉ
// xảy ra sau khi mqtt.connected() lần đầu trả true (mọi hàm publish* đều
// return sớm nếu chưa connected), mà bản thân mqtt.connected()/
// PubSubClient::_state lại bị đọc xuyên core KHÔNG có đồng bộ (gap có sẵn từ
// trước, ngoài phạm vi fix này) — không muốn chồng thêm 1 giả định "trust
// compiler guard" lên trên 1 gap đồng bộ đã tồn tại. Tính sẵn 1 lần ở
// setup() đơn giản hơn, chứng minh đúng dễ hơn.
extern String mqttTopicBase; // định nghĩa + gán 1 lần trong main.cpp setup()
static const String &topicBase() { return mqttTopicBase; }

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
  } else if (t.endsWith("/config/reassign")) {
    MQTTManager::onConfigReassign(msg.c_str());
  } else if (t.endsWith("/audio/command")) {
    MQTTManager::onAudioCommand(msg.c_str());
  }
}

namespace MQTTManager {

void begin() {
  mqtt.setClient(wifiClient);

#if MQTT_PORT != 8883
  Serial.println("[MQTT] CANH BAO: dang dung cong " + String(MQTT_PORT) +
                 " (cleartext, khong TLS) — CHI danh cho dev. KHONG deploy len "
                 "nha yen that (SEC-NFR-001) khi con o cau hinh nay.");
#endif

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
      justConnected = true;
      mqtt.subscribe((topicBase() + "/relay/command").c_str(), MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/config/update").c_str(), MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/config/reassign").c_str(), MQTT_QOS_COMMAND);
      mqtt.subscribe((topicBase() + "/audio/command").c_str(), MQTT_QOS_COMMAND);
    } else {
      mqttFailCount++;
      Serial.println("[MQTT] Connection failed, rc=" + String(mqtt.state()));
    }
  }
  mqtt.loop();

  // Heartbeat (FARM-FR-005) — gửi ngay sau mỗi lần connect, sau đó mỗi 30s
  if (justConnected || millis() - lastHeartbeat > MQTT_HEARTBEAT_MS) {
    if (publishHeartbeat()) justConnected = false;
    lastHeartbeat = millis();
  }
}

bool isConnected() { return mqtt.connected(); }

bool isBrokerUnreachable() { return mqttFailCount >= MQTT_PROVISION_TRIGGER_FAILURES; }

void publishTelemetry(const SensorData &data, const RelayState &relay) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  data.fillJson(doc); // deviceId + 6 cảm biến + timestamp (epoch ms)
  doc["relay_states"]["misting"] = relay.misting;
  doc["relay_states"]["speaker"] = relay.speaker;
  doc["relay_states"]["ventilation"] = relay.ventilation;
  doc["relay_states"]["heating"] = relay.heating;
  doc["control_mode"] = relay.anyOverride() ? "MANUAL" : "AUTO";

  String payload;
  serializeJson(doc, payload);
  mqtt.publish((topicBase() + "/telemetry").c_str(), payload.c_str(), false);
}

bool publishHeartbeat() {
  if (!mqtt.connected()) return false;
  JsonDocument doc;
  // Field names khớp backend/src/types/domain.ts HeartbeatPayload
  doc["deviceId"] = Config::deviceId;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  doc["timestamp"] = millis();
  if (justConnected) doc["justConnected"] = true;

  String payload;
  serializeJson(doc, payload);
  return mqtt.publish((topicBase() + "/heartbeat").c_str(), payload.c_str(), false);
}

// KHÔNG retain: relay/status là trạng thái sống — message retained bị broker
// phát lại cho backend mỗi lần backend (re)connect, kể cả khi thiết bị đã chết.
bool publishRelayState(const RelayState &relay) {
  if (!mqtt.connected()) return false;
  return mqtt.publish((topicBase() + "/relay/status").c_str(), relay.toJson().c_str(), false);
}

// Topic `{base}/alert` (SRS §9.2) — backend alert.handler.ts tra thiết bị
// theo field `deviceId`. Trả false nếu chưa gửi được để caller thử lại.
bool publishAlert(const char *alertType, const char *severity, const char *payload) {
  if (!mqtt.connected()) return false;
  JsonDocument doc;
  doc["deviceId"] = Config::deviceId;
  doc["type"] = alertType;
  doc["severity"] = severity;
  doc["message"] = payload;

  String msg;
  serializeJson(doc, msg);
  return mqtt.publish((topicBase() + "/alert").c_str(), msg.c_str(), false);
}

// Publish 1 dòng JSON telemetry đã buffer offline, nguyên văn (không build
// lại từ SensorData sống) — dùng làm callback cho StorageManager::flushBuffer()
// (REL-NFR-003). Trả về true nếu publish thành công (StorageManager dùng giá
// trị này để quyết định có xoá buffer hay giữ lại thử lại lần sau).
bool publishRawTelemetryLine(const String &jsonLine) {
  if (!mqtt.connected()) return false;
  return mqtt.publish((topicBase() + "/telemetry").c_str(), jsonLine.c_str(), false);
}

void onRelayCommand(const char *payload) {
  Serial.println("[MQTT] Relay command: " + String(payload));

  JsonDocument doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("[MQTT] Relay command: invalid JSON");
    return;
  }

  // Backend overrideExpiry.job.ts: override đã hết hạn phía server → về AUTO ngay
  if (doc["action"] == "clear_override") {
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      PIDController::clearOverrides(relayState);
      publishRelayState(relayState);
      xSemaphoreGive(dataMutex);
    }
    Serial.println("[MQTT] Relay command: clear_override → AUTO");
    return;
  }

  const char *relayName = doc["relayName"] | "";
  bool state = doc["state"] | false;
  unsigned long durationMs = doc["durationMs"] | (unsigned long)MANUAL_OVERRIDE_MS;

  if (strlen(relayName) == 0) {
    Serial.println("[MQTT] Relay command: missing relayName");
    return;
  }

  // ENV-FR-016..018: bật Manual Override, tạm dừng PID cho relay này.
  // relayState là struct nhiều field (4 relay bool + 4 override bool + 1
  // expiry) đọc/ghi đồng thời bởi pidTask (Core 1) — khoá dataMutex để tránh
  // torn read/write xuyên struct.
  if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    PIDController::setManualOverride(relayName, state, durationMs, relayState);
    // Xác nhận lại trạng thái ngay cho backend/dashboard (ENV-FR-015)
    publishRelayState(relayState);
    xSemaphoreGive(dataMutex);
  }
}

// ENV-FR-013c(c): {"action":"play","track":N} | {"action":"stop"} — one-shot,
// không ghi NVS (khác config/update). Xem AudioManager::requestPlay().
void onAudioCommand(const char *payload) {
  Serial.println("[MQTT] Audio command: " + String(payload));
  JsonDocument doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("[MQTT] Audio command: invalid JSON");
    return;
  }
  if (doc["action"] == "play") {
    int track = doc["track"] | 0;
    if (track <= 0) {
      Serial.println("[MQTT] Audio command: thiếu track");
      return;
    }
    AudioManager::requestPlay(track);
  } else if (doc["action"] == "stop") {
    AudioManager::requestStop();
  } else {
    return;
  }
  if (pidTaskHandle) xTaskNotifyGive(pidTaskHandle);
}

void onConfigUpdate(const char *payload) {
  Serial.println("[MQTT] Config update: " + String(payload));
  Config::update(payload);
}

// Flow 21 Nhánh A (FARM-FR-007b): Technician dời thiết bị sang Zone/Farm khác
// trong khi thiết bị còn ONLINE. Backend publish lệnh này lên topic CŨ (dựa
// trên farmId/houseId/zoneId hiện tại của thiết bị). Lưu định danh mới vào
// NVS rồi restart — mqttTopicBase chỉ được tính lại 1 lần trong setup() (xem
// main.cpp + giải thích ở topicBase() phía trên), không hot-swap khi task
// đang chạy, để không phá vỡ giả định "đọc xuyên core không cần mutex".
// newMqttUsername/newMqttPassword (nếu có trong payload) bị BỎ QUA có chủ ý —
// hệ thống MQTT credential riêng theo thiết bị chưa được implement (ngoài
// phạm vi Flow 21 Nhánh A hiện tại).
void onConfigReassign(const char *payload) {
  Serial.println("[MQTT] Config reassign: " + String(payload));

  JsonDocument doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("[MQTT] Config reassign: invalid JSON");
    return;
  }

  const char *newFarmId = doc["newFarmId"] | "";
  const char *newHouseId = doc["newHouseId"] | "";
  const char *newZoneId = doc["newZoneId"] | "";

  if (strlen(newFarmId) == 0 || strlen(newHouseId) == 0 || strlen(newZoneId) == 0) {
    Serial.println("[MQTT] Config reassign: thiếu newFarmId/newHouseId/newZoneId");
    return;
  }

  StorageManager::saveIdentity(newFarmId, newHouseId, newZoneId);
  Serial.println("[MQTT] Đã lưu định danh mới — khởi động lại để áp dụng...");
  delay(1500); // để log/response kịp flush trước khi restart
  ESP.restart();
}
} // namespace MQTTManager
