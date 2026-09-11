/**
 * SwiftletCare – ESP32 Firmware Entry Point (Wokwi-compatible)
 *
 * FreeRTOS Tasks:
 *   - SensorTask  : Read 5+2 sensors every 10s          (ENV-FR-001..003)
 *   - PIDTask     : Closed-loop control + threat detect  (ENV-FR-010..018,
 * THREAT-FR-005..012)
 *   - MQTTTask    : Publish telemetry, subscribe commands (ENV-FR-015, §9.2)
 *
 * Hardware BOM (SRS §7.1):
 *   ESP32-WROOM-32D, SHT31, BH1750, MQ-135, MAX9814, DHT22,
 *   Relay 4CH, Buzzer, LM2596 buck converter
 *
 * Wokwi substitutions:
 *   SHT31  → DHT22 #1 (GPIO13)
 *   BH1750 → Photoresistor (GPIO32)
 *   MQ-135 → Slide Potentiometer (GPIO34)
 *   MAX9814→ Slide Potentiometer (GPIO35)
 *   Relay  → 4x LED (GPIO 26,27,14,12)
 */

#include "config/Config.h"
#include "mqtt/MQTTManager.h"
#include "pid/PIDController.h"
#include "sensors/SensorManager.h"
#include "storage/StorageManager.h"
#include <Arduino.h>
#include <WiFi.h>
#include <esp_task_wdt.h>

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
  } else {
    Serial.println("\n[WiFi] ✗ Failed! Running in OFFLINE mode (REL-NFR-001)");
  }

  // ── Initialize sensors ───────────────────────────────────────────────────
  SensorManager::begin();

  // ── Initialize relays (all OFF) ──────────────────────────────────────────
  relayState.init();
  Serial.println("[Relay] 4-channel relay initialized (all OFF)");

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

    if (data.isValid) {
      // Check manual override expiry (ENV-FR-018)
      PIDController::checkOverrideExpiry(relayState);

      // Run closed-loop control (ENV-FR-010..013)
      PIDController::runHumidityControl(data.humidity, relayState);
      PIDController::runTemperatureControl(data.temperature, relayState);
      PIDController::runLightControl(data.lightLux, relayState);
      PIDController::runCO2Control(data.co2Ppm, relayState);

      // Threat detection (THREAT-FR-006, 007, 011)
      PIDController::handleThreatAlerts(data, relayState);
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

    // Publish threat alerts via MQTT
    if (data.speakerAlert) {
      MQTTManager::publishAlert(
          "SPEAKER_FAILURE", "CRITICAL",
          "Speaker amplitude dropped >70% below baseline");
    }
    if (data.panicAlert) {
      MQTTManager::publishAlert("BIRD_PANIC", "HIGH",
                                "Abnormal high-dB sound pattern detected");
    }

    // Flush offline buffer when connected (REL-NFR-003)
    if (MQTTManager::isConnected()) {
      StorageManager::flushBuffer();
    }

    vTaskDelay(pdMS_TO_TICKS(10000)); // publish every 10s
  }
}
