/**
 * SwiftletCare – ESP32 Firmware Entry Point
 * 
 * FreeRTOS Tasks:
 *   - SensorTask  : Read 5 sensors every 10s
 *   - PIDTask     : Closed-loop control (humidity, temp, co2, light)
 *   - MQTTTask    : Publish telemetry, subscribe commands
 *   - OTATask     : Over-the-air firmware update
 * 
 * SRS refs: ENV-FR-001..019, REL-NFR-001..007, THREAT-FR-005..012
 */

#include <Arduino.h>
#include <WiFi.h>
#include "config/Config.h"
#include "sensors/SensorManager.h"
#include "pid/PIDController.h"
#include "mqtt/MQTTManager.h"
#include "storage/StorageManager.h"

// ── FreeRTOS Task Handles ────────────────────────────────────────────────────
TaskHandle_t sensorTaskHandle  = NULL;
TaskHandle_t pidTaskHandle     = NULL;
TaskHandle_t mqttTaskHandle    = NULL;

// ── Shared Data (protected by mutex) ─────────────────────────────────────────
SemaphoreHandle_t dataMutex;
SensorData        latestSensorData;
RelayState        relayState;

// ── FreeRTOS Task Declarations ────────────────────────────────────────────────
void sensorTask(void* pvParameters);
void pidTask(void* pvParameters);
void mqttTask(void* pvParameters);

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("[SwiftletCare] Firmware booting...");

  // Hardware watchdog (REL-NFR-002)
  esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);

  // Initialize storage (NVS config + SPIFFS buffer)
  StorageManager::begin();

  // Load config from NVS
  Config::load();

  // Connect WiFi
  WiFi.begin(Config::wifiSsid, Config::wifiPassword);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected: " + WiFi.localIP().toString());
  }

  // Initialize sensor hardware
  SensorManager::begin();

  // Initialize relay pins (active-low)
  relayState.init();

  // Create mutex for shared data
  dataMutex = xSemaphoreCreateMutex();

  // ── Create FreeRTOS Tasks ──────────────────────────────────────────────────
  xTaskCreatePinnedToCore(sensorTask, "SensorTask", 4096, NULL, 2, &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(pidTask,    "PIDTask",    4096, NULL, 3, &pidTaskHandle,    1);
  xTaskCreatePinnedToCore(mqttTask,   "MQTTTask",   8192, NULL, 4, &mqttTaskHandle,   0);

  Serial.println("[SwiftletCare] All tasks started.");
}

void loop() {
  // Feed watchdog from main loop
  esp_task_wdt_reset();
  vTaskDelay(pdMS_TO_TICKS(1000));
}

// ── Sensor Task (Core 1) ──────────────────────────────────────────────────────
void sensorTask(void* pvParameters) {
  esp_task_wdt_add(NULL);
  TickType_t lastWake = xTaskGetTickCount();

  while (true) {
    esp_task_wdt_reset();

    SensorData data = SensorManager::readAll();

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      latestSensorData = data;
      xSemaphoreGive(dataMutex);
    }

    // Buffer to SPIFFS if MQTT not connected (REL-NFR-003)
    if (!MQTTManager::isConnected()) {
      StorageManager::bufferTelemetry(data);
    }

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(Config::sensorIntervalMs));
  }
}

// ── PID Task (Core 1) ─────────────────────────────────────────────────────────
void pidTask(void* pvParameters) {
  esp_task_wdt_add(NULL);
  TickType_t lastWake = xTaskGetTickCount();

  while (true) {
    esp_task_wdt_reset();

    SensorData data;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      xSemaphoreGive(dataMutex);
    }

    // Run closed-loop control (ENV-FR-010..013)
    PIDController::runHumidityControl(data.humidity, relayState);
    PIDController::runTemperatureControl(data.temperature, relayState);
    PIDController::runLightControl(data.lightLux, relayState);
    PIDController::runCO2Control(data.co2Ppm, relayState);

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(Config::pidIntervalMs));
  }
}

// ── MQTT Task (Core 0) ────────────────────────────────────────────────────────
void mqttTask(void* pvParameters) {
  esp_task_wdt_add(NULL);
  MQTTManager::begin();

  while (true) {
    esp_task_wdt_reset();
    MQTTManager::loop();

    // Publish telemetry
    SensorData data;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      data = latestSensorData;
      xSemaphoreGive(dataMutex);
    }
    MQTTManager::publishTelemetry(data, relayState);

    // Flush offline buffer if connected (REL-NFR-003)
    if (MQTTManager::isConnected()) {
      StorageManager::flushBuffer();
    }

    vTaskDelay(pdMS_TO_TICKS(10000)); // publish every 10s
  }
}
