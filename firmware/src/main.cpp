/**
 * SwiftletCare – ESP32 Firmware Entry Point
 *
 * FreeRTOS Tasks:
 *   - SensorTask  : Read 5 RS485 Modbus sensors every 10s (ENV-FR-001..003)
 *   - PIDTask     : Closed-loop control + speaker schedule + threat detect
 *                   (ENV-FR-010..019, THREAT-FR-006, 011, 013)
 *   - MQTTTask    : Publish telemetry, subscribe commands (ENV-FR-015, §9.2)
 *
 * Hardware BOM (Components Guide v3.3):
 *   ESP32-WROOM-32D 38 chân + đế mở rộng, UART-RS485 V2 (GPIO16/17),
 *   5 cảm biến RS485 (ES-NOISE-01, ES-CO2-01, ES-NH3-01, ES-ALS-02, ES35-SW),
 *   Relay 4 kênh kích mức CAO (GPIO25/26/27/14), DFPlayer Mini + PAM8403 6W
 *   (GPIO32/33), 2× Buck LM2596 12V→5V
 */

#include "audio/AudioManager.h"
#include "config/Config.h"
#include "config/Secrets.h"
#include "mqtt/MQTTManager.h"
#include "pid/PIDController.h"
#include "sensors/SensorManager.h"
#include "storage/StorageManager.h"
#include "wifi/WiFiProvisioner.h"
#include <Arduino.h>
#include <WiFi.h>
#include <esp_task_wdt.h>
#include <time.h>

// OTA update qua WiFi (http://<ip-esp32>/update) — chỉ cần cắm USB lần đầu,
// các lần nạp firmware sau thực hiện qua mạng. TASK-A8, 7.2
// (ELEGANTOTA_USE_ASYNC_WEBSERVER được định nghĩa qua build_flags trong
// platformio.ini)
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
static AsyncWebServer otaServer(80);

// ── FreeRTOS Task Handles ────────────────────────────────────────────────────
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t pidTaskHandle = NULL;
TaskHandle_t mqttTaskHandle = NULL;

// ── Shared Data (protected by mutex) ─────────────────────────────────────────
SemaphoreHandle_t dataMutex;
SensorData latestSensorData;
RelayState relayState;

// MQTT topic base "swiftletcare/{farmId}/{houseId}/{zoneId}" — tính 1 lần
// trong setup() (đơn luồng, trước khi tạo task nào), SAU KHI đã nạp
// farmId/houseId/zoneId từ NVS (nếu có, xem StorageManager::loadIdentity()
// bên dưới — Flow 21 Nhánh A, FARM-FR-007b). Từ đây tới lần dời Zone tiếp
// theo (luôn kèm ESP.restart(), xem MQTTManager::onConfigReassign()),
// Config::farmId/houseId/zoneId không đổi lúc runtime; sau setup() biến này
// chỉ ĐỌC (không ghi lại) nên mqttTask (Core 0) và pidTask (Core 1, qua
// publishAlert) đọc an toàn không cần mutex. Xem giải thích đầy đủ ở
// MQTTManager.cpp topicBase().
String mqttTopicBase;

// ── Boot reason tracking (THREAT-FR-012) ─────────────────────────────────────
static bool wasUnexpectedReset = false;

// Gửi cảnh báo theo CẠNH LÊN: 1 lần khi sự cố bắt đầu, không lặp lại mỗi chu kỳ
// PID (10s) chừng nào sự cố còn đó — trước đây 1 cảm biến hỏng sinh ~288 cảnh
// báo/ngày (dedup backend chỉ chặn 5 phút). Gửi thất bại (mất MQTT) thì giữ
// reported=false để thử lại chu kỳ sau; sự cố hết thì reset để lần sau báo lại.
static void reportOnRise(bool active, bool &reported, const char *type,
                         const char *severity, const char *message) {
  if (!active) {
    reported = false;
  } else if (!reported) {
    reported = MQTTManager::publishAlert(type, severity, message);
  }
}

// ── Task Declarations ────────────────────────────────────────────────────────
void sensorTask(void *pvParameters);
void pidTask(void *pvParameters);
void mqttTask(void *pvParameters);

// ══════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("╔══════════════════════════════════════════╗");
  Serial.println("║     SwiftletCare ESP32 Firmware v1.0     ║");
  Serial.println("║     SRS: ENV + THREAT + FARM modules     ║");
  Serial.println("╚══════════════════════════════════════════╝");

  // ── THREAT-FR-012: Check for unexpected reset ────────────────────────────
  esp_reset_reason_t reason = esp_reset_reason();
  if (reason == ESP_RST_PANIC || reason == ESP_RST_INT_WDT ||
      reason == ESP_RST_TASK_WDT || reason == ESP_RST_BROWNOUT) {
    wasUnexpectedReset = true;
    Serial.println("[BOOT] ⚠ UNEXPECTED RESET detected! Reason: " +
                   String(reason));
    Serial.println("[BOOT] Will publish POWER_OUTAGE alert when MQTT connects");
  } else {
    Serial.println("[BOOT] Normal boot. Reset reason: " + String(reason));
  }

  // ── Hardware watchdog (REL-NFR-002) ──────────────────────────────────────
  esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
  Serial.println("[WDT] Watchdog initialized: " + String(WATCHDOG_TIMEOUT_SEC) +
                 "s timeout");

  // ── Initialize storage (NVS + SPIFFS) ────────────────────────────────────
  StorageManager::begin();
  Config::load();

  // ── Nạp định danh Farm/House/Zone đã dời (nếu có) — Flow 21 Nhánh A ──────
  // FARM-FR-007b: chưa từng dời Zone → giữ mặc định Secrets.h (đã gán trong
  // Config.cpp). PHẢI chạy trước khi mqttTopicBase được tính bên dưới.
  {
    String savedFarmId, savedHouseId, savedZoneId;
    if (StorageManager::loadIdentity(savedFarmId, savedHouseId, savedZoneId)) {
      Config::farmId = savedFarmId;
      Config::houseId = savedHouseId;
      Config::zoneId = savedZoneId;
      Serial.println("[Config] Đã nạp định danh Farm/House/Zone từ NVS (đã "
                     "dời qua config/reassign): " +
                     savedFarmId + "/" + savedHouseId + "/" + savedZoneId);
    }
  }

  // ── Connect WiFi (tự bật AP-mode để cấu hình lại nếu không kết nối được) ──
  // FARM-FR-003b: đổi WiFi trên thiết bị đã lắp không cần Technician/USB —
  // xem WiFiProvisioner.h. Task cảm biến/relay/PID vẫn khởi động bình thường
  // ở dưới dù nhánh nào xảy ra (REL-NFR-001, offline resilience).
  bool wifiConnected = WiFiProvisioner::tryConnect();
  if (wifiConnected) {
    Serial.println("\n[WiFi] ✓ Connected! IP: " + WiFi.localIP().toString() +
                   " RSSI: " + String(WiFi.RSSI()) + " dBm");
    configTime(7 * 3600, 0,
               "pool.ntp.org"); // GMT+7, cho lịch loa ru (ENV-FR-013b)

    // ── OTA server (TASK-A8) ────────────────────────────────────────────────
    otaServer.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
      request->send(200, "text/plain",
                    "SwiftletCare ESP32 — cập nhật firmware tại /update");
    });
    ElegantOTA.begin(&otaServer, SECRET_OTA_USERNAME, SECRET_OTA_PASSWORD);
    otaServer.begin();
    Serial.println("[OTA] Sẵn sàng tại http://" + WiFi.localIP().toString() +
                   "/update");
  } else {
    Serial.println(
        "\n[WiFi] ✗ Không kết nối được — bật AP-mode để cấu hình lại WiFi");
    WiFiProvisioner::startCaptivePortal(otaServer);
  }

  // ── Initialize sensors (RS485 Modbus bus, Guide v3.3 §5) ─────────────────
  SensorManager::begin();

  // ── Initialize relays (all OFF) ──────────────────────────────────────────
  relayState.init();
  Serial.println("[Relay] 4-channel relay initialized (all OFF, active-HIGH)");

  // ── Initialize DFPlayer loa ru (Guide v3.3 §10-12) ────────────────────────
  AudioManager::begin();

  // ── Create mutex ─────────────────────────────────────────────────────────
  dataMutex = xSemaphoreCreateMutex();

  // ── MQTT topic base (đơn luồng, phải chạy trước khi tạo mqttTask/pidTask) ──
  mqttTopicBase = String("swiftletcare/") + Config::farmId + "/" +
                 Config::houseId + "/" + Config::zoneId;

  // ── Create FreeRTOS Tasks ────────────────────────────────────────────────
  xTaskCreatePinnedToCore(sensorTask, "SensorTask", 4096, NULL, 2,
                          &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(pidTask, "PIDTask", 4096, NULL, 3, &pidTaskHandle, 1);
  xTaskCreatePinnedToCore(mqttTask, "MQTTTask", 8192, NULL, 1, &mqttTaskHandle,
                          0);

  Serial.println("[BOOT] ✓ All FreeRTOS tasks started\n");
}

// ══════════════════════════════════════════════════════════════════════════════
void loop() {
  esp_task_wdt_reset();
  if (WiFiProvisioner::isPortalActive()) {
    // DNS cần trả lời nhanh để trình duyệt điện thoại tự bật popup captive
    // portal thay vì phải tự mở http://192.168.4.1
    WiFiProvisioner::handleDnsLoop();
    vTaskDelay(pdMS_TO_TICKS(50));
  } else if (MQTTManager::isBrokerUnreachable()) {
    // WiFi vẫn ổn nhưng MQTT không connect được suốt — nhiều khả năng IP LAN
    // broker cũ sai (đổi mạng WiFi khác). Bật lại đúng captive portal (đặt ở
    // đây, không gọi trực tiếp từ mqttTask, để tránh đổi WiFi.mode()/khởi
    // động AsyncWebServer từ 1 FreeRTOS task khác core).
    Serial.println("[MQTT] Broker không phản hồi sau nhiều lần thử — bật "
                   "AP-mode để nhập lại địa chỉ broker");
    WiFiProvisioner::startCaptivePortal(otaServer);
  } else {
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

// ── Sensor Task (Core 1)
// ────────────────────────────────────────────────────── SRS: ENV-FR-001..003 –
// Read 5 sensors every 10s
void sensorTask(void *pvParameters) {
  esp_task_wdt_add(NULL);
  TickType_t lastWake = xTaskGetTickCount();

  while (true) {
    esp_task_wdt_reset();

    SensorData data = SensorManager::readAll();

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      latestSensorData = data;
      xSemaphoreGive(dataMutex);
    }

    // Buffer to SPIFFS if MQTT disconnected (REL-NFR-003)
    if (!MQTTManager::isConnected()) {
      StorageManager::bufferTelemetry(data);
    }

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(Config::sensorIntervalMs));
  }
}

// ── PID Task (Core 1)
// ───────────────────────────────────────────────────────── SRS:
// ENV-FR-010..018 – Closed-loop PID control
void pidTask(void *pvParameters) {
  esp_task_wdt_add(NULL);

  while (true) {
    esp_task_wdt_reset();

    SensorData data;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      xSemaphoreGive(dataMutex);
    }

    // relayState bị đọc/ghi đồng thời bởi mqttTask (onRelayCommand, publish
    // telemetry/relay-status) — khoá dataMutex quanh TOÀN BỘ đoạn động tới
    // relayState (kể cả nhánh loa lịch ngoài if (data.isValid)). KHÔNG giữ
    // khoá qua các publishAlert() bên dưới: publishAlert() làm I/O mạng
    // (mqtt.publish(), có thể block vài giây) và không đụng relayState/
    // latestSensorData nữa (threats đã là bản copy cục bộ) — giữ khoá qua đó
    // sẽ làm sensorTask/mqttTask bị treo chờ dataMutex không cần thiết.
    PIDController::ThreatFlags threats;
    bool haveThreats = false;

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      // Loa ru (ENV-FR-013b/013c) – luôn cập nhật lịch + lệnh nghe thử cho
      // DFPlayer, nhưng chỉ áp ra Relay IN2 khi không Manual Override
      bool shouldPlay = AudioManager::updateSchedule();
      if (!relayState.speakerOverride) {
        relayState.speaker = shouldPlay;
        relayState.applyRelay(PIN_RELAY_SPEAKER, shouldPlay);
      }

      if (data.isValid) {
        // Check manual override expiry (ENV-FR-018)
        PIDController::checkOverrideExpiry(relayState);

        // Run closed-loop control (ENV-FR-010..012)
        PIDController::runHumidityControl(data.humidity, relayState);
        PIDController::runVentilationControl(data, relayState);
        PIDController::runHeatingControl(data.temperature, relayState);

        // Threat detection (THREAT-FR-006, 011, 013)
        threats = PIDController::handleThreatAlerts(
            data, relayState, AudioManager::isPlaying());
        haveThreats = true;
      }

      xSemaphoreGive(dataMutex);
    }

    if (haveThreats) {
      static bool speakerReported = false, pumpReported = false,
                  sensorReported = false, busReported = false;
      reportOnRise(threats.speakerFailure, speakerReported, "SPEAKER_FAILURE",
                   "CRITICAL", "Amplitude dB không tăng khi loa ru đang phát");
      // pumpDry chỉ true đúng 1 chu kỳ mỗi đợt phun (PIDController) — nếu gửi
      // thất bại thì mất cảnh báo đợt đó, chấp nhận được (không lặp spam).
      reportOnRise(threats.pumpDry, pumpReported, "PUMP_DRY", "MEDIUM",
                   "Misting ON 5 phút nhưng độ ẩm không tăng");
      reportOnRise(threats.sensorFault, sensorReported, "SENSOR_FAULT",
                   "MEDIUM", "Một cảm biến RS485 không phản hồi (timeout/CRC)");
      reportOnRise(threats.busFailure, busReported, "RS485_BUS_FAILURE",
                   "CRITICAL",
                   "≥3/5 cảm biến RS485 mất kết nối 3 chu kỳ liên tiếp");
    }

    // Chờ tới chu kỳ kế tiếp, hoặc tỉnh sớm khi có lệnh nghe thử
    // (MQTTManager::onAudioCommand → xTaskNotifyGive)
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(Config::pidIntervalMs));
  }
}

// ── MQTT Task (Core 0)
// ──────────────────────────────────────────────────────── SRS: ENV-FR-015,
// FARM-FR-005, SEC-NFR-001
void mqttTask(void *pvParameters) {
  esp_task_wdt_add(NULL);
  MQTTManager::begin();

  // Publish power outage alert if unexpected reset (THREAT-FR-012)
  bool powerOutagePublished = false;

  while (true) {
    esp_task_wdt_reset();
    MQTTManager::loop();

    // THREAT-FR-012: Publish POWER_OUTAGE alert once after reconnect
    if (wasUnexpectedReset && MQTTManager::isConnected() &&
        !powerOutagePublished) {
      powerOutagePublished = MQTTManager::publishAlert(
          "POWER_OUTAGE", "HIGH", "ESP32 recovered from unexpected reset");
      if (powerOutagePublished)
        Serial.println("[MQTT] Published POWER_OUTAGE alert");
    }

    // Publish telemetry (ENV-FR-001). Chỉ gửi khi lấy được snapshot thật VÀ
    // sensorTask đã đọc xong ít nhất 1 lần — trước đó latestSensorData toàn
    // số 0, backend coi là nhiệt/ẩm dưới ngưỡng → THRESHOLD_BREACH giả lúc boot.
    SensorData data;
    RelayState relaySnapshot;
    bool haveSnapshot = false;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      relaySnapshot = relayState;
      xSemaphoreGive(dataMutex);
      haveSnapshot = true;
    }
    if (haveSnapshot && data.timestamp != 0)
      MQTTManager::publishTelemetry(data, relaySnapshot);

    // relay/status (ENV-FR-015): chỉ khi trạng thái đổi (PID bật/tắt, override
    // hết hạn...) hoặc định kỳ để tự sửa nếu 1 message QoS0 bị rơi — không gửi
    // mỗi giây như trước (mỗi message = 1 lần ghi DB + 4 socket event ở backend).
    static String lastRelayJson;
    static unsigned long lastRelayPublish = 0;
    if (!MQTTManager::isConnected()) {
      lastRelayJson = ""; // kết nối lại → gửi ngay trạng thái hiện tại
    } else if (haveSnapshot) {
      String relayJson = relaySnapshot.toJson();
      if (relayJson != lastRelayJson ||
          millis() - lastRelayPublish > MQTT_HEARTBEAT_MS) {
        if (MQTTManager::publishRelayState(relaySnapshot)) {
          lastRelayJson = relayJson;
          lastRelayPublish = millis();
        }
      }
    }

    // Threat alerts (SPEAKER_FAILURE/PUMP_DRY/SENSOR_FAULT/RS485_BUS_FAILURE)
    // are published directly from pidTask (THREAT-FR-006/011/013) where the
    // flags are computed against the latest SensorData/RelayState.

    // Flush offline buffer when connected (REL-NFR-003)
    if (MQTTManager::isConnected()) {
      StorageManager::flushBuffer([](const String &jsonLine) {
        esp_task_wdt_reset(); // buffer vài giờ ≈ 1-2 nghìn dòng, lâu hơn WDT 30s
        return MQTTManager::publishRawTelemetryLine(jsonLine);
      });
    }

    // Dùng chung Config::sensorIntervalMs với sensorTask — tránh 2 con số lệch
    // nhau
    vTaskDelay(pdMS_TO_TICKS(Config::sensorIntervalMs));
  }
}
