/**
 * PIDController.cpp – PID algorithm + closed-loop control + threat alerts
 * SRS: ENV-FR-010..018, THREAT-FR-006..012
 */
#include "PIDController.h"
#include "config/Config.h"
#include <Arduino.h>

// ── PIDLoop (generic PID algorithm) ──────────────────────────────────────────

PIDLoop::PIDLoop(float kp, float ki, float kd, float setpoint)
    : _kp(kp), _ki(ki), _kd(kd), _setpoint(setpoint) {}

float PIDLoop::compute(float measurement, unsigned long dt) {
  float error = _setpoint - measurement;
  float dtSec = dt / 1000.0f;
  if (dtSec <= 0)
    dtSec = 0.01f;

  _integral += error * dtSec;
  // Anti-windup clamp
  if (_integral > 100.0f)
    _integral = 100.0f;
  if (_integral < -100.0f)
    _integral = -100.0f;

  float derivative = (error - _prevError) / dtSec;
  _prevError = error;

  return _kp * error + _ki * _integral + _kd * derivative;
}

void PIDLoop::setSetpoint(float sp) { _setpoint = sp; }
void PIDLoop::reset() {
  _integral = 0;
  _prevError = 0;
}

// ── RelayState implementation ────────────────────────────────────────────────

void RelayState::init() {
  pinMode(PIN_RELAY_MISTING, OUTPUT);
  pinMode(PIN_RELAY_VENTILATION, OUTPUT);
  pinMode(PIN_RELAY_HEATING, OUTPUT);
  pinMode(PIN_RELAY_LIGHT, OUTPUT);
  // All OFF at boot
  digitalWrite(PIN_RELAY_MISTING, LOW);
  digitalWrite(PIN_RELAY_VENTILATION, LOW);
  digitalWrite(PIN_RELAY_HEATING, LOW);
  digitalWrite(PIN_RELAY_LIGHT, LOW);
}

void RelayState::applyRelay(int pin, bool state) {
  // Active-HIGH for Wokwi LED simulation (HIGH = ON)
  // For real relay module: change to state ? LOW : HIGH
  digitalWrite(pin, state ? HIGH : LOW);
}

String RelayState::toJson() const {
  String json = "{";
  json += "\"misting\":" + String(misting ? "true" : "false") + ",";
  json += "\"ventilation\":" + String(ventilation ? "true" : "false") + ",";
  json += "\"heating\":" + String(heating ? "true" : "false") + ",";
  json += "\"light\":" + String(light ? "true" : "false") + ",";
  json += "\"misting_override\":" + String(mistingOverride ? "true" : "false") +
          ",";
  json += "\"ventilation_override\":" +
          String(ventilationOverride ? "true" : "false") + ",";
  json += "\"heating_override\":" + String(heatingOverride ? "true" : "false") +
          ",";
  json += "\"light_override\":" + String(lightOverride ? "true" : "false");
  json += "}";
  return json;
}

// ── PID Control Functions (ENV-FR-010..013) ──────────────────────────────────

namespace PIDController {

// Pump dry detection counter (THREAT-FR-011)
static unsigned long mistingOnSince = 0;
static float humidityWhenMistingStarted = 0;

// ENV-FR-010: humidity < min → misting ON
void runHumidityControl(float humidity, RelayState &relay) {
  if (relay.mistingOverride)
    return;

  bool shouldMist = (humidity < Config::humidityMin);

  // Track pump-dry detection (THREAT-FR-011)
  if (shouldMist && !relay.misting) {
    // Just turned ON
    mistingOnSince = millis();
    humidityWhenMistingStarted = humidity;
  }

  relay.misting = shouldMist;
  relay.applyRelay(PIN_RELAY_MISTING, relay.misting);

  if (relay.misting) {
    Serial.println("[PID] MISTING ON  (humidity=" + String(humidity, 1) +
                   "% < min=" + String(Config::humidityMin, 1) + "%)");
  }
}

// ENV-FR-011 + ENV-FR-012: temperature control
void runTemperatureControl(float temperature, RelayState &relay) {
  // Ventilation: temp > max → fan ON
  if (!relay.ventilationOverride) {
    relay.ventilation = (temperature > Config::tempMax);
    relay.applyRelay(PIN_RELAY_VENTILATION, relay.ventilation);
    if (relay.ventilation) {
      Serial.println("[PID] FAN ON  (temp=" + String(temperature, 1) +
                     "°C > max=" + String(Config::tempMax, 1) + "°C)");
    }
  }

  // Heating: temp < min → heater ON
  if (!relay.heatingOverride) {
    relay.heating = (temperature < Config::tempMin);
    relay.applyRelay(PIN_RELAY_HEATING, relay.heating);
    if (relay.heating) {
      Serial.println("[PID] HEATER ON  (temp=" + String(temperature, 1) +
                     "°C < min=" + String(Config::tempMin, 1) + "°C)");
    }
  }
}

// ENV-FR-013: light > max → light OFF (birds prefer dark)
void runLightControl(float lux, RelayState &relay) {
  if (relay.lightOverride)
    return;
  relay.light = (lux <= Config::lightMax);
  relay.applyRelay(PIN_RELAY_LIGHT, relay.light);
}

// CO2 > max → force ventilation ON
void runCO2Control(float co2, RelayState &relay) {
  if (relay.ventilationOverride)
    return;
  if (co2 > Config::co2Max) {
    relay.ventilation = true;
    relay.applyRelay(PIN_RELAY_VENTILATION, true);
    Serial.println("[PID] FAN FORCED ON  (CO2=" + String(co2, 0) +
                   " ppm > max=" + String(Config::co2Max) + ")");
  }
}

// ── Manual Override (ENV-FR-016..018) ──────────────────────────────────────

void setManualOverride(const char *relayName, bool state,
                       unsigned long durationMs, RelayState &relay) {
  String name(relayName);
  if (name == "misting") {
    relay.mistingOverride = true;
    relay.misting = state;
    relay.applyRelay(PIN_RELAY_MISTING, state);
  } else if (name == "ventilation") {
    relay.ventilationOverride = true;
    relay.ventilation = state;
    relay.applyRelay(PIN_RELAY_VENTILATION, state);
  } else if (name == "heating") {
    relay.heatingOverride = true;
    relay.heating = state;
    relay.applyRelay(PIN_RELAY_HEATING, state);
  } else if (name == "light") {
    relay.lightOverride = true;
    relay.light = state;
    relay.applyRelay(PIN_RELAY_LIGHT, state);
  }
  relay.overrideExpiryMs = millis() + durationMs;
  Serial.println("[PID] MANUAL OVERRIDE: " + name + " = " +
                 String(state ? "ON" : "OFF") + " for " +
                 String(durationMs / 60000) + " min");
}

void checkOverrideExpiry(RelayState &relay) {
  if (relay.overrideExpiryMs > 0 && millis() > relay.overrideExpiryMs) {
    relay.mistingOverride = false;
    relay.ventilationOverride = false;
    relay.heatingOverride = false;
    relay.lightOverride = false;
    relay.overrideExpiryMs = 0;
    Serial.println("[PID] Manual override EXPIRED → back to AUTO");
  }
}

// ── Threat Detection Actuators ─────────────────────────────────────────────

void buzzAlert(int beeps, int durationMs) {
  for (int i = 0; i < beeps; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < beeps - 1)
      delay(durationMs / 2);
  }
}

void handleThreatAlerts(const SensorData &data, const RelayState &relay) {
  // THREAT-FR-006: Speaker failure
  if (data.speakerAlert) {
    buzzAlert(5, 200);
    Serial.println("[THREAT] ⚠ SPEAKER_FAILURE → buzzer alert");
  }

  // THREAT-FR-007: Bird panic
  if (data.panicAlert) {
    buzzAlert(3, 500);
    Serial.println("[THREAT] ⚠ BIRD_PANIC → buzzer alert");
  }

  // THREAT-FR-011: Pump dry (misting ON > 5 min but humidity not increasing)
  if (relay.misting && mistingOnSince > 0) {
    unsigned long elapsed = millis() - mistingOnSince;
    if (elapsed > 300000) { // 5 minutes
      if (data.humidity <= humidityWhenMistingStarted + 2.0f) {
        buzzAlert(10, 100);
        Serial.println(
            "[THREAT] ⚠ PUMP_DRY → misting ON 5 min but humidity not rising!");
        mistingOnSince = millis(); // Reset to avoid continuous buzzing
      }
    }
  } else {
    mistingOnSince = 0;
  }
}
} // namespace PIDController
