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
#include <Arduino.h>
#include <WiFi.h>
#include <esp_task_wdt.h>
#include <time.h>

// OTA update qua WiFi (http://<ip-esp32>/update) — chỉ cần cắm USB lần đầu,
// các lần nạp firmware sau thực hiện qua mạng. TASK-A8, 7.2
// (ELEGANTOTA_USE_ASYNC_WEBSERVER được định nghĩa qua build_flags trong platformio.ini)
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

// ── Boot reason tracking (THREAT-FR-012) ─────────────────────────────────────
static bool wasUnexpectedReset = false;

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

  // ── Connect WiFi ─────────────────────────────────────────────────────────
  Serial.print("[WiFi] Connecting to " + String(Config::wifiSsid));
  WiFi.begin(Config::wifiSsid, Config::wifiPassword);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✓ Connected! IP: " + WiFi.localIP().toString() +
                   " RSSI: " + String(WiFi.RSSI()) + " dBm");
    configTime(7 * 3600, 0, "pool.ntp.org"); // GMT+7, cho lịch loa ru (ENV-FR-013b)

    // ── OTA server (TASK-A8) ────────────────────────────────────────────────
    otaServer.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
      request->send(200, "text/plain", "SwiftletCare ESP32 — cập nhật firmware tại /update");
    });
    ElegantOTA.begin(&otaServer, SECRET_OTA_USERNAME, SECRET_OTA_PASSWORD);
    otaServer.begin();
    Serial.println("[OTA] Sẵn sàng tại http://" + WiFi.localIP().toString() + "/update");
  } else {
    Serial.println("\n[WiFi] ✗ Failed! Running in OFFLINE mode (REL-NFR-001)");
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
  vTaskDelay(pdMS_TO_TICKS(1000));
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
  TickType_t lastWake = xTaskGetTickCount();

  while (true) {
    esp_task_wdt_reset();

    SensorData data;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      xSemaphoreGive(dataMutex);
    }

    // Speaker schedule (ENV-FR-013b) – bật/tắt Relay IN2 + DFPlayer theo lịch,
    // trừ khi đang Manual Override
    if (!relayState.speakerOverride) {
      bool shouldPlay = AudioManager::updateSchedule();
      relayState.speaker = shouldPlay;
      relayState.applyRelay(PIN_RELAY_SPEAKER, shouldPlay);
    }

    if (data.isValid) {
      // Check manual override expiry (ENV-FR-018)
      PIDController::checkOverrideExpiry(relayState);

      // Run closed-loop control (ENV-FR-010..012)
      PIDController::runHumidityControl(data.humidity, relayState);
      PIDController::runVentilationControl(data.temperature, data.nh3Ppm, data.co2Ppm, relayState);
      PIDController::runHeatingControl(data.temperature, relayState);

      // Threat detection (THREAT-FR-006, 011, 013)
      PIDController::ThreatFlags threats =
          PIDController::handleThreatAlerts(data, relayState, AudioManager::isPlaying());

      if (threats.speakerFailure)
        MQTTManager::publishAlert("SPEAKER_FAILURE", "CRITICAL", "Amplitude dB không tăng khi loa ru đang phát");
      if (threats.pumpDry)
        MQTTManager::publishAlert("PUMP_DRY", "MEDIUM", "Misting ON 5 phút nhưng độ ẩm không tăng");
      if (threats.sensorFault)
        MQTTManager::publishAlert("SENSOR_FAULT", "MEDIUM", "Một cảm biến RS485 không phản hồi (timeout/CRC)");
      if (threats.busFailure)
        MQTTManager::publishAlert("RS485_BUS_FAILURE", "CRITICAL", "≥3/5 cảm biến RS485 mất kết nối 3 chu kỳ liên tiếp");
    }

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(Config::pidIntervalMs));
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
      MQTTManager::publishAlert("POWER_OUTAGE", "HIGH",
                                "ESP32 recovered from unexpected reset");
      powerOutagePublished = true;
      Serial.println("[MQTT] Published POWER_OUTAGE alert");
    }

    // Publish telemetry (ENV-FR-001)
    SensorData data;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      xSemaphoreGive(dataMutex);
    }
    MQTTManager::publishTelemetry(data, relayState);
    MQTTManager::publishRelayState(relayState);

    // Threat alerts (SPEAKER_FAILURE/PUMP_DRY/SENSOR_FAULT/RS485_BUS_FAILURE)
    // are published directly from pidTask (THREAT-FR-006/011/013) where the
    // flags are computed against the latest SensorData/RelayState.

    // Flush offline buffer when connected (REL-NFR-003)
    if (MQTTManager::isConnected()) {
      StorageManager::flushBuffer();
    }

    vTaskDelay(pdMS_TO_TICKS(10000)); // publish every 10s
  }
}
