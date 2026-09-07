/**
 * SwiftletCare – Global Configuration
 * Loaded from NVS on boot. Overridable via MQTT config/update command.
 * 
 * SRS: ENV-FR-006, ENV-FR-007
 */

#pragma once
#include <Arduino.h>

// ── Pin Mapping ────────────────────────────────────────────────────────────────
#define PIN_SDA           21    // I2C SDA (SHT31 + BH1750)
#define PIN_SCL           22    // I2C SCL
#define PIN_DHT22         4     // DHT22 1-Wire
#define PIN_MQ135         34    // MQ-135 ADC (analog input)
#define PIN_MAX9814       35    // MAX9814 microphone ADC

// Relay pins (active-LOW)
#define PIN_RELAY_MISTING     26
#define PIN_RELAY_VENTILATION 27
#define PIN_RELAY_HEATING     14
#define PIN_RELAY_LIGHT       12

// ── Timing ────────────────────────────────────────────────────────────────────
#define WATCHDOG_TIMEOUT_SEC    30
#define SENSOR_INTERVAL_MS      10000   // 10 seconds (ENV-FR-002)
#define PID_INTERVAL_MS         10000
#define MQTT_HEARTBEAT_MS       30000   // 30 seconds (FARM-FR-005)
#define MANUAL_OVERRIDE_MS      1800000 // 30 minutes (ENV-FR-018)

// ── Default Thresholds (ENV-FR-007) ───────────────────────────────────────────
#define DEFAULT_TEMP_MIN        26.0f
#define DEFAULT_TEMP_MAX        31.0f
#define DEFAULT_HUMIDITY_MIN    75.0f
#define DEFAULT_HUMIDITY_MAX    95.0f
#define DEFAULT_LIGHT_MAX       0.2f
#define DEFAULT_CO2_MAX         1500

// ── Audio Anomaly Detection ────────────────────────────────────────────────────
#define AUDIO_BASELINE_WINDOW_MS  300000  // 5 minute baseline (THREAT-FR-006)
#define AUDIO_DROP_THRESHOLD      0.70f   // 70% drop = speaker failure
#define AUDIO_SAMPLE_INTERVAL_MS  1000    // sample every 1s

// ── MQTT Broker ────────────────────────────────────────────────────────────────
#define MQTT_PORT               8883      // TLS (SEC-NFR-001)
#define MQTT_QOS_TELEMETRY      0
#define MQTT_QOS_COMMAND        1
#define MQTT_QOS_ALERT          1

namespace Config {
  extern const char* wifiSsid;
  extern const char* wifiPassword;
  extern const char* mqttBroker;
  extern const char* mqttUsername;
  extern const char* mqttPassword;
  extern const char* farmId;
  extern const char* houseId;
  extern const char* zoneId;
  extern const char* deviceId;

  // Runtime config (loaded from NVS)
  extern float  tempMin;
  extern float  tempMax;
  extern float  humidityMin;
  extern float  humidityMax;
  extern float  lightMax;
  extern int    co2Max;
  extern int    sensorIntervalMs;
  extern int    pidIntervalMs;

  void load();   // Load from NVS
  void save();   // Persist to NVS
  void update(const char* jsonPayload); // Update from MQTT command
}
