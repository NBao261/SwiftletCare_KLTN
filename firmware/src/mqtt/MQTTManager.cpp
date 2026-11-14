/**
 * MQTTManager.cpp – MQTT qua ESP-IDF esp-mqtt, mỗi thiết bị một cây topic
 * swiftletcare/dev/{deviceId}/… và một tài khoản broker (Report 4 D3, §7.2)
 * SRS: ENV-FR-001, ENV-FR-015, BR-35, NFR-06 c, NFR-10 d
 *
 * esp-mqtt chạy trong task riêng và gọi onMqttEvent() từ đó. Handler chỉ ghi cờ và đẩy tin nhận được vào
 * hàng đợi: lệnh và cấu hình vẫn được xử lý trong mqttTask (loop()), vì lệnh OTA chặn hàng phút và
 * dataMutex, CommandFilter, Config vốn được dùng từ task này.
 */
#include "MQTTManager.h"
#include "AlertQueue.h"
#include "CommandFilter.h"
#include "audio/AudioManager.h"
#include "config/CaCert.h"
#include "config/Config.h"
#include "ota/RemoteCommand.h"
#include "ota/RemoteOta.h"
#include "storage/StorageManager.h"
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <WiFi.h>
#include <esp_ota_ops.h>
#include <esp_random.h>
#include <esp_timer.h>
#include <mqtt_client.h>

static esp_mqtt_client_handle_t client = nullptr;
static String brokerUri;
static unsigned long lastHeartbeat = 0;

// Ghi trong task esp-mqtt, đọc ở mqttTask và pidTask: mỗi biến một writer, không có
// read-modify-write xuyên task (mqttFailCount chỉ task esp-mqtt tăng và reset)
static volatile bool connected = false;
static volatile int mqttFailCount = 0;
// true từ lúc connect thành công tới khi heartbeat đầu tiên gửi được — heartbeat đó mang cờ
// justConnected để backend gửi lại `config` (lấp lần publish backend lỡ khi mất broker).
static volatile bool justConnected = false;
static volatile bool everConnected = false;
// Mỗi lần kết nối lại phải gửi lại hàng đợi alert: msgId của phiên trước không còn nghĩa
static volatile bool resendAlerts = false;

// ≈30 lần thử ở nhịp 1 giây (reconnect_timeout_ms) ≈ 30 giây — đủ lâu để không trigger nhầm lúc
// broker mới khởi động chưa kịp lên, nhưng không quá lâu để người dùng phải chờ.
static const int MQTT_PROVISION_TRIGGER_FAILURES = 30;
static const int MQTT_RECONNECT_MS = 1000;
static const int MQTT_KEEPALIVE_SEC = 30;
// Đủ cho gói `config` đầy đủ; tin dài hơn sẽ bị chia mảnh và bị bỏ
static const int MQTT_BUFFER_BYTES = 2048;
static const int MQTT_TASK_STACK_BYTES = 8192; // TLS bắt tay trong task này
static const int MQTT_QOS_LIVE = 0;
static const int MQTT_QOS_ACKED = 1;
static const TickType_t PUBACK_WAIT_MS = 5000;
static const UBaseType_t INBOUND_QUEUE_SIZE = 8;

// Flow 15 bước 5a — bản vừa OTA chờ xác nhận: kết nối được MQTT lần đầu mới đánh dấu hợp lệ
static bool imagePendingVerify = false;

// ── mDNS broker discovery (chỉ dev) ─────────────────────
// "swiftletcare-broker.local" (chạy `npm run mdns` trên máy host docker-compose,
// xem backend/src/scripts/mdns-responder.script.ts) trỏ về IP LAN hiện tại của
// broker — ESP32 tự hỏi lại mỗi khi cần thay vì phải biết/nhập tay IP, kể cả
// khi đổi mạng WiFi hay router cấp lại DHCP giữa lúc đang chạy. Bản TLS kiểm tên miền trong chứng
// chỉ nên không dùng IP tìm được qua mDNS.
static const char *MDNS_BROKER_HOST = "swiftletcare-broker"; // resolve "<host>.local"
static bool mdnsStarted = false;

static String uriOf(const String &host) {
  return String(MQTT_PORT == 8883 ? "mqtts://" : "mqtt://") + host + ":" + String(MQTT_PORT);
}

/**
 * true nếu resolve được (đã cập nhật Config::mqttBroker nếu cần). FARM-FR-003c: chỉ bản dev tìm broker
 * trên mạng LAN; bản chính thức (và bản TLS, vì chứng chỉ gắn tên miền) dùng địa chỉ nạp lúc flash.
 */
static bool resolveBrokerViaMdns() {
#if MQTT_PORT == 8883 || defined(SWIFTLETCARE_PRODUCTION_BUILD)
  return false;
#else
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
  return true;
#endif
}

// relayState sống trong main.cpp (dùng chung với pidTask) — MQTTManager chỉ
// áp Manual Override lên đó khi có lệnh từ cloud (ENV-FR-016).
extern RelayState relayState;
// dataMutex sống trong main.cpp, bảo vệ relayState/latestSensorData xuyên 3 task.
extern SemaphoreHandle_t dataMutex;
// pidTask chạy mỗi PID_INTERVAL_MS (10s) — lệnh nghe thử đánh thức nó ngay để
// loa kêu trong ~1s thay vì chờ tới chu kỳ kế tiếp.
extern TaskHandle_t pidTaskHandle;

// Base tính 1 lần trong main.cpp setup() (đơn luồng, trước khi tạo task nào); hàm này được gọi từ cả
// mqttTask lẫn task khác nên không tính lười ở đây.
extern String mqttTopicBase;
// FARM-FR-006 — lý do lần khởi động gần nhất, gán 1 lần trong main.cpp setup()
extern const char *bootResetReason;
static const String &topicBase() { return mqttTopicBase; }

// ── Tin nhận được ───────────────────────────────────────
enum InboundKind : uint8_t { INBOUND_CMD, INBOUND_CONFIG, INBOUND_COMPENSATION };
struct InboundMessage {
  InboundKind kind;
  char *payload; // malloc ở task esp-mqtt, free ở mqttTask
};
static QueueHandle_t inboundQueue = nullptr;

static void queueInbound(const esp_mqtt_event_t *event) {
  if (event->current_data_offset != 0 || event->data_len != event->total_data_len) {
    Serial.println("[MQTT] Bỏ tin quá dài: " + String(event->total_data_len) + " byte");
    return;
  }
  // topic của event không kết thúc bằng '\0'
  String topic(event->topic, event->topic_len);
  InboundKind kind;
  if (topic.endsWith("/config")) kind = INBOUND_CONFIG;
  else if (topic.endsWith("/compensation")) kind = INBOUND_COMPENSATION;
  else if (topic.endsWith("/cmd")) kind = INBOUND_CMD;
  else return;

  char *payload = static_cast<char *>(malloc(event->data_len + 1));
  if (!payload) return;
  memcpy(payload, event->data, event->data_len);
  payload[event->data_len] = '\0';
  InboundMessage message = {kind, payload};
  if (xQueueSend(inboundQueue, &message, 0) != pdTRUE) {
    Serial.println("[MQTT] Hàng đợi tin nhận đầy — bỏ tin");
    free(payload);
  }
}

// ── Xác nhận PUBACK ─────────────────────────────────────
// Cảnh báo chờ PUBACK (Report 4 §7.2): pidTask và mqttTask dùng chung, có alertMutex. PUBACK đi qua
// pubackQueue chứ task esp-mqtt không tự xoá: nó đang giữ khoá của client trong lúc gọi handler, còn
// sendQueuedAlerts giữ alertMutex trong lúc publish, nên khoá ở đây sẽ làm mất PUBACK và kẹt cảnh báo.
static AlertQueue alertQueue;
static SemaphoreHandle_t alertMutex = nullptr;
static QueueHandle_t pubackQueue = nullptr;
static const UBaseType_t PUBACK_QUEUE_SIZE = 32;

// Vài msgId vừa được xác nhận để publishAwaitAck đối chiếu: PUBACK có thể tới trước khi nó bắt đầu đợi
static const int RECENT_ACK_COUNT = 4;
static volatile int recentAcks[RECENT_ACK_COUNT] = {};
static volatile uint8_t recentAckNext = 0;
static SemaphoreHandle_t ackSignal = nullptr;

static void onPublished(int msgId) {
  recentAcks[recentAckNext] = msgId;
  recentAckNext = (recentAckNext + 1) % RECENT_ACK_COUNT;
  xSemaphoreGive(ackSignal);
  xQueueSend(pubackQueue, &msgId, 0); // đầy thì cảnh báo được gửi lại ở lần kết nối sau, backend bỏ bản trùng
}

static bool wasAcked(int msgId) {
  for (int i = 0; i < RECENT_ACK_COUNT; i++)
    if (recentAcks[i] == msgId) return true;
  return false;
}

static void subscribeDeviceTopics() {
  esp_mqtt_client_subscribe(client, (topicBase() + "/cmd").c_str(), MQTT_QOS_ACKED);
  esp_mqtt_client_subscribe(client, (topicBase() + "/config").c_str(), MQTT_QOS_ACKED);
  esp_mqtt_client_subscribe(client, (topicBase() + "/compensation").c_str(), MQTT_QOS_ACKED);
}

static void onMqttEvent(void *, esp_event_base_t, int32_t eventId, void *eventData) {
  auto *event = static_cast<esp_mqtt_event_handle_t>(eventData);
  switch (eventId) {
  case MQTT_EVENT_CONNECTED:
    Serial.println("[MQTT] Connected");
    connected = true;
    mqttFailCount = 0;
    justConnected = true;
    everConnected = true;
    resendAlerts = true;
    subscribeDeviceTopics();
    break;
  case MQTT_EVENT_DISCONNECTED:
    connected = false;
    mqttFailCount = mqttFailCount + 1;
    break;
  case MQTT_EVENT_PUBLISHED:
    onPublished(event->msg_id);
    break;
  case MQTT_EVENT_DATA:
    queueInbound(event);
    break;
  default:
    break;
  }
}

// ── Lệnh ────────────────────────────────────────────────
static CommandFilter commandFilter;
// Lệnh vừa đổi relay, gắn vào relay/status kế tiếp (Report 4 §7.2)
static String lastRelayCommandId;

static CommandFilter::Result filterCommand(const RemoteCommand &cmd, CommandFilter::AgePolicy policy) {
  time_t now = time(nullptr);
  uint64_t nowEpochMs = now > 1700000000 ? (uint64_t)now * 1000ULL : 0; // chưa sync NTP → 0
  CommandFilter::Result result = commandFilter.check(cmd.commandId, cmd.issuedAt, nowEpochMs, policy);
  if (result == CommandFilter::DUPLICATE) Serial.println("[MQTT] Bỏ lệnh trùng: " + String(cmd.commandId));
  if (result == CommandFilter::STALE) Serial.println("[MQTT] Bỏ lệnh trễ hoặc chưa kiểm được tuổi: " + String(cmd.commandId));
  return result;
}

static void withRelayState(void (*change)(const RemoteCommand &), const RemoteCommand &cmd) {
  // relayState là struct nhiều field đọc/ghi đồng thời bởi pidTask (Core 1) — khoá dataMutex
  // để tránh torn read/write xuyên struct.
  if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  change(cmd);
  // Xác nhận lại trạng thái ngay cho backend/dashboard (ENV-FR-015)
  MQTTManager::publishRelayState(relayState);
  xSemaphoreGive(dataMutex);
}

static void applyRelay(const RemoteCommand &cmd) {
  unsigned long durationMs = cmd.durationMs > 0 ? cmd.durationMs : (unsigned long)MANUAL_OVERRIDE_MS;
  PIDController::setManualOverride(cmd.relayName, cmd.state, durationMs, relayState);
}

static void applyClearOverride(const RemoteCommand &cmd) { PIDController::clearOverrides(relayState, cmd.relayName); }
static void reportOnly(const RemoteCommand &) {}

static void handleRelay(const RemoteCommand &cmd) {
  CommandFilter::Result result = filterCommand(cmd, CommandFilter::FRESH_REQUIRED);
  if (result == CommandFilter::DUPLICATE) return;
  // Bỏ lệnh trễ: backend đã ghi MANUAL lạc quan, báo trạng thái thật để nó sửa lại
  if (result == CommandFilter::APPLY) lastRelayCommandId = cmd.commandId;
  withRelayState(result == CommandFilter::APPLY ? applyRelay : reportOnly, cmd);
}

static void handleAudio(const RemoteCommand &cmd) {
  if (filterCommand(cmd, CommandFilter::FRESH_IF_KNOWN) != CommandFilter::APPLY) return;
  // ENV-FR-013c(c): one-shot, không ghi NVS (khác `config`). Xem AudioManager::requestPlay().
  if (cmd.audioPlay) AudioManager::requestPlay(cmd.track);
  else AudioManager::requestStop();
  if (pidTaskHandle) xTaskNotifyGive(pidTaskHandle);
}

// BR-35: RESTART trễ thì bỏ; OTA chỉ chặn trùng vì đã có kiểm tra phiên bản. Mã lưu NVS trước khi khởi
// động lại, nếu không bản giao lại sẽ làm thiết bị khởi động lại lần nữa.
static void restartAfter(const RemoteCommand &cmd) {
  StorageManager::saveLastRestartCommand(cmd.commandId);
  delay(1500); // để log kịp flush trước khi restart
  ESP.restart();
}

static void handleCommand(const char *payload) {
  Serial.println("[MQTT] Lệnh: " + String(payload));
  RemoteCommand cmd = parseRemoteCommand(payload, FIRMWARE_VERSION);
  switch (cmd.type) {
  case RemoteCommand::INVALID:
    Serial.println("[MQTT] Bỏ lệnh: " + String(cmd.error));
    break;
  case RemoteCommand::RELAY:
    handleRelay(cmd);
    break;
  case RemoteCommand::CLEAR_OVERRIDE:
    // Về AUTO luôn an toàn nên lệnh trễ vẫn áp, chỉ chặn trùng (Report 4 §7.2)
    if (filterCommand(cmd, CommandFilter::ANY_AGE) == CommandFilter::APPLY) withRelayState(applyClearOverride, cmd);
    break;
  case RemoteCommand::AUDIO:
    handleAudio(cmd);
    break;
  case RemoteCommand::RESTART:
    if (filterCommand(cmd, CommandFilter::FRESH_IF_KNOWN) != CommandFilter::APPLY) break;
    Serial.println("[MQTT] Lệnh RESTART — khởi động lại...");
    restartAfter(cmd);
    break;
  case RemoteCommand::OTA:
    if (filterCommand(cmd, CommandFilter::ANY_AGE) != CommandFilter::APPLY) break;
    Serial.println("[OTA] Tải " + String(cmd.version) + " từ " + cmd.url);
    // Thất bại thì giữ bản cũ; backend biết qua heartbeat vẫn báo bản cũ (markOtaTimeouts)
    if (!RemoteOta::download(cmd.url, cmd.sha256)) break;
    Serial.println("[OTA] Đã ghi " + String(cmd.version) + " — khởi động lại vào bản mới");
    restartAfter(cmd);
    break;
  }
}

// `config` retained về lại mỗi lần kết nối: giống hệt lần trước thì bỏ qua để không ghi NVS vô ích
static uint32_t fnv1a(const char *text) {
  uint32_t hash = 2166136261u;
  for (; *text; text++) hash = (hash ^ static_cast<uint8_t>(*text)) * 16777619u;
  return hash;
}

static void handleConfig(const char *payload) {
  uint32_t hash = fnv1a(payload);
  if (hash == StorageManager::loadConfigHash()) return;
  Serial.println("[MQTT] Cấu hình mới: " + String(payload));
  Config::update(payload);
  StorageManager::saveConfigHash(hash);
}

// ENV-FR-029, BR-38 — `compensation` retained: offset (điểm %), hạn (epoch ms), luật. Kẹp và đổi hạn ra millis()
// trong WeatherCompensation; tin retained đã hết hạn về lại lúc kết nối thì offset 0.
static void handleCompensation(const char *payload) {
  JsonDocument doc;
  if (deserializeJson(doc, payload)) {
    Serial.println("[MQTT] Bỏ tin compensation hỏng");
    return;
  }
  float offsetPct = doc["offset_pct"] | 0.0f;
  uint64_t expiresAt = doc["expires_at"] | (uint64_t)0;
  time_t now = time(nullptr);
  uint64_t nowEpochMs = now > 1700000000 ? (uint64_t)now * 1000ULL : 0; // chưa sync NTP → 0
  if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  PIDController::setWeatherCompensation(offsetPct, expiresAt, nowEpochMs);
  xSemaphoreGive(dataMutex);
  Serial.println("[MQTT] Bù thời tiết " + String(offsetPct, 1) + "% (luật " + String(doc["rule_id"] | "-") + ")");
}

// ── Gửi ─────────────────────────────────────────────────
/** msgId ≥ 0 khi đã đưa cho esp-mqtt (QoS 0 luôn là 0), -1 khi chưa gửi được */
static int publish(const char *suffix, const String &payload, int qos) {
  if (!connected) return -1;
  String topic = topicBase() + suffix;
  return esp_mqtt_client_publish(client, topic.c_str(), payload.c_str(), payload.length(), qos, 0);
}

/** Gửi QoS 1 và đợi PUBACK: true nghĩa là broker đã nhận (ENV-FR-024) */
static bool publishAwaitAck(const char *suffix, const String &payload) {
  int msgId = publish(suffix, payload, MQTT_QOS_ACKED);
  if (msgId <= 0) return false;
  TickType_t start = xTaskGetTickCount();
  while (xTaskGetTickCount() - start < pdMS_TO_TICKS(PUBACK_WAIT_MS)) {
    if (wasAcked(msgId)) return true;
    xSemaphoreTake(ackSignal, pdMS_TO_TICKS(100));
  }
  return wasAcked(msgId);
}

static String alertJson(const QueuedAlert &alert) {
  JsonDocument doc;
  doc["deviceId"] = Config::deviceId;
  doc["eventId"] = alert.eventId;
  doc["type"] = alert.type;
  doc["severity"] = alert.severity;
  doc["message"] = alert.message;
  if (alert.resetReason[0]) doc["resetReason"] = alert.resetReason; // backend lưu vào metadata.reset_reason
  String payload;
  serializeJson(doc, payload);
  return payload;
}

static void sendQueuedAlerts() {
  if (xSemaphoreTake(alertMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  bool removed = false;
  int ackedId;
  while (xQueueReceive(pubackQueue, &ackedId, 0) == pdTRUE) removed = alertQueue.ack(ackedId) || removed;
  if (removed) StorageManager::saveAlertQueue(&alertQueue, sizeof alertQueue);
  if (!connected) {
    xSemaphoreGive(alertMutex);
    return;
  }
  if (resendAlerts) {
    alertQueue.resetSent();
    resendAlerts = false;
  }
  for (int index = alertQueue.nextUnsent(); index >= 0; index = alertQueue.nextUnsent()) {
    int msgId = publish("/alert", alertJson(alertQueue.at(index)), MQTT_QOS_ACKED);
    if (msgId <= 0) break;
    alertQueue.markSent(index, msgId);
  }
  xSemaphoreGive(alertMutex);
}

static void copyText(char *dst, size_t size, const char *src) {
  strncpy(dst, src, size - 1);
  dst[size - 1] = '\0';
}

namespace MQTTManager {

void begin() {
  esp_ota_img_states_t imageState;
  imagePendingVerify = esp_ota_get_state_partition(esp_ota_get_running_partition(), &imageState) == ESP_OK &&
                       imageState == ESP_OTA_IMG_PENDING_VERIFY;
  if (imagePendingVerify) Serial.println("[OTA] Bản mới đang chờ xác nhận — cần kết nối MQTT để giữ lại");

#if MQTT_PORT != 8883
  Serial.println("[MQTT] CANH BAO: dang dung cong " + String(MQTT_PORT) +
                 " (cleartext, khong TLS) — CHI danh cho dev. KHONG deploy len "
                 "nha yen that (SEC-NFR-001) khi con o cau hinh nay.");
#endif

  inboundQueue = xQueueCreate(INBOUND_QUEUE_SIZE, sizeof(InboundMessage));
  alertMutex = xSemaphoreCreateMutex();
  ackSignal = xSemaphoreCreateBinary();
  pubackQueue = xQueueCreate(PUBACK_QUEUE_SIZE, sizeof(int));
  StorageManager::loadAlertQueue(&alertQueue, sizeof alertQueue);
  alertQueue.resetSent(); // msgId trong NVS thuộc phiên trước
  commandFilter.remember(StorageManager::loadLastRestartCommand().c_str());

  // Ưu tiên tự tìm broker qua mDNS — hoạt động ngay cả khi đổi mạng WiFi,
  // không ai cần biết/nhập IP thủ công. Chỉ khi mDNS thất bại (mạng chặn
  // multicast, hoặc chưa chạy `npm run mdns` trên máy host) mới rơi về IP đã
  // lưu qua captive portal, cuối cùng mới về mặc định Secrets.h.
  // FARM-FR-003c — broker nạp lúc flash (`flash_identity.py --broker`) thay mặc định biên dịch trong Secrets.h
  String flashedBroker;
  if (StorageManager::loadFlashedBroker(flashedBroker)) Config::mqttBroker = flashedBroker;
#ifdef SWIFTLETCARE_PRODUCTION_BUILD
  // FARM-FR-003c, BR-27 — bản production chỉ dùng broker nạp lúc flash (NVS `identity`, không có thì Secrets.h):
  // không mDNS, không địa chỉ nhập ở AP-mode, để thiết bị không thể bị trỏ sang broker khác tại nhà yến.
  Serial.println("[MQTT] Broker nạp lúc flash: " + Config::mqttBroker);
#else
  if (!resolveBrokerViaMdns()) {
    String savedBroker;
    if (StorageManager::loadMqttBroker(savedBroker)) {
      Config::mqttBroker = savedBroker;
      Serial.println("[MQTT] Dùng broker đã lưu trong NVS: " + savedBroker);
    } else {
      Serial.println("[MQTT] Dùng mặc định Secrets.h: " + Config::mqttBroker);
    }
  }
#endif

  brokerUri = uriOf(Config::mqttBroker);
  esp_mqtt_client_config_t config = {};
  config.uri = brokerUri.c_str();
  config.client_id = Config::deviceId;
  config.username = Config::deviceId;
  config.password = Config::mqttPassword;
  config.disable_clean_session = true; // phiên bền: lệnh QoS 1 không mất khi mất mạng ngắn
  config.keepalive = MQTT_KEEPALIVE_SEC;
  config.reconnect_timeout_ms = MQTT_RECONNECT_MS;
  config.buffer_size = MQTT_BUFFER_BYTES;
  config.task_stack = MQTT_TASK_STACK_BYTES;
#if MQTT_PORT == 8883
  config.cert_pem = ISRG_ROOT_X1;
#endif
  client = esp_mqtt_client_init(&config);
  esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, onMqttEvent, nullptr);
  esp_mqtt_client_start(client);
  Serial.println("[MQTT] Client initialized, broker=" + brokerUri);
}

void loop() {
  // Thử lại mDNS mỗi 5 lần fail liên tiếp (~5s) — IP host có thể đã đổi (router cấp lại DHCP) ngay
  // trong lúc ESP32 đang chạy, không cần đợi tới ngưỡng captive-portal mới tự sửa được.
  static int lastMdnsRetry = 0;
  if (!connected && mqttFailCount > 0 && mqttFailCount % 5 == 0 && mqttFailCount != lastMdnsRetry) {
    lastMdnsRetry = mqttFailCount;
    if (resolveBrokerViaMdns() && uriOf(Config::mqttBroker) != brokerUri) {
      brokerUri = uriOf(Config::mqttBroker);
      esp_mqtt_client_set_uri(client, brokerUri.c_str());
    }
  }

  if (imagePendingVerify && everConnected) {
    esp_ota_mark_app_valid_cancel_rollback();
    imagePendingVerify = false;
    Serial.println("[OTA] Đã xác nhận firmware " FIRMWARE_VERSION);
  }
  if (otaShouldRollback(imagePendingVerify, everConnected, millis(), OTA_VERIFY_TIMEOUT_MS)) {
    Serial.println("[OTA] Bản mới không kết nối được MQTT — quay về firmware cũ");
    esp_ota_mark_app_invalid_rollback_and_reboot();
  }

  processInbound();
  sendQueuedAlerts();

  // Heartbeat (FARM-FR-005) — gửi ngay sau mỗi lần connect, sau đó mỗi 30s
  if (justConnected || millis() - lastHeartbeat > MQTT_HEARTBEAT_MS) {
    if (publishHeartbeat()) justConnected = false;
    lastHeartbeat = millis();
  }
}

void processInbound() {
  InboundMessage message;
  while (xQueueReceive(inboundQueue, &message, 0) == pdTRUE) {
    if (message.kind == INBOUND_CONFIG) handleConfig(message.payload);
    else if (message.kind == INBOUND_COMPENSATION) handleCompensation(message.payload);
    else handleCommand(message.payload);
    free(message.payload);
  }
}

bool isConnected() { return connected; }

bool isBrokerUnreachable() { return mqttFailCount >= MQTT_PROVISION_TRIGGER_FAILURES; }

void publishTelemetry(const SensorData &data, const RelayState &relay) {
  if (!connected) return;
  JsonDocument doc;
  data.fillJson(doc); // deviceId + 6 cảm biến + timestamp (epoch ms)
  doc["relay_states"]["misting"] = relay.misting;
  doc["relay_states"]["speaker"] = relay.speaker;
  doc["relay_states"]["ventilation"] = relay.ventilation;
  doc["control_mode"] = relay.anyOverride() ? "MANUAL" : "AUTO";
  // % công suất bộ điều khiển mờ (ENV-FR-010/011) — dashboard hiển thị live
  doc["control_output"]["misting"] = relay.mistingPct;
  doc["control_output"]["ventilation"] = relay.ventilationPct;

  String payload;
  serializeJson(doc, payload);
  publish("/telemetry", payload, MQTT_QOS_LIVE);
}

bool publishHeartbeat() {
  if (!connected) return false;
  JsonDocument doc;
  // Field names khớp backend/src/types/domain.ts HeartbeatPayload
  doc["deviceId"] = Config::deviceId;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = esp_timer_get_time() / 1000; // ms, 64 bit — millis() tràn sau 49 ngày
  doc["resetReason"] = bootResetReason;
  doc["ip"] = WiFi.localIP().toString();
  doc["appliedConfigVersion"] = Config::configVersion; // ENV-FR-027: backend so với phiên bản của Zone
  doc["timestamp"] = millis();
  if (justConnected) doc["justConnected"] = true;

  String payload;
  serializeJson(doc, payload);
  return publish("/heartbeat", payload, MQTT_QOS_LIVE) >= 0;
}

// KHÔNG retain: relay/status là trạng thái sống — message retained bị broker
// phát lại cho backend mỗi lần backend (re)connect, kể cả khi thiết bị đã chết.
bool publishRelayState(const RelayState &relay) {
  bool sent = publish("/relay/status", relay.toJson(true, lastRelayCommandId.c_str()), MQTT_QOS_ACKED) >= 0;
  if (sent) lastRelayCommandId = "";
  return sent;
}

// NFR-06 c — vào hàng đợi NVS rồi mqttTask gửi, xoá khi có PUBACK. Trả true khi đã nhận vào hàng đợi,
// nên caller coi như đã báo; hàng đợi đầy thì false để caller thử lại.
bool publishAlert(const char *alertType, const char *severity, const char *payload, const char *resetReason) {
  if (!alertMutex) return false; // mqttTask chưa chạy begin()
  QueuedAlert alert;
  snprintf(alert.eventId, sizeof alert.eventId, "%08lx%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
  copyText(alert.type, sizeof alert.type, alertType);
  copyText(alert.severity, sizeof alert.severity, severity);
  copyText(alert.message, sizeof alert.message, payload);
  if (resetReason) copyText(alert.resetReason, sizeof alert.resetReason, resetReason);

  if (xSemaphoreTake(alertMutex, pdMS_TO_TICKS(100)) != pdTRUE) return false;
  uint8_t before = alertQueue.size();
  bool queued = alertQueue.push(alert);
  if (alertQueue.size() != before) StorageManager::saveAlertQueue(&alertQueue, sizeof alertQueue);
  xSemaphoreGive(alertMutex);
  return queued;
}

// Publish 1 dòng JSON telemetry đã buffer offline, nguyên văn — callback của
// StorageManager::flushBuffer() (ENV-FR-024). Buffer vài giờ mất vài phút mới gửi xong: phần việc thường
// của mqttTask vẫn chạy giữa các dòng, nếu không thì lệnh nằm tới khi quá 60 giây (BR-35), PUBACK của
// cảnh báo không được xử lý và heartbeat ngừng.
bool publishBufferedLine(const String &jsonLine) {
  loop();
  return publishAwaitAck("/telemetry/buffered", jsonLine);
}

} // namespace MQTTManager
