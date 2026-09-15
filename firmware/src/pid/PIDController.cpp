/**
 * PIDController.cpp – On-off closed-loop control + threat detection
 * SRS: ENV-FR-010..019, THREAT-FR-006, THREAT-FR-011, THREAT-FR-013
 */
#include "PIDController.h"
#include "config/Config.h"
#include <Arduino.h>

// ── PIDLoop (generic PID algorithm, reserved for future proportional control) ──

PIDLoop::PIDLoop(float kp, float ki, float kd, float setpoint)
    : _kp(kp), _ki(ki), _kd(kd), _setpoint(setpoint) {}

float PIDLoop::compute(float measurement, unsigned long dt) {
  float error = _setpoint - measurement;
  float dtSec = dt / 1000.0f;
  if (dtSec <= 0) dtSec = 0.01f;

  _integral += error * dtSec;
  if (_integral > 100.0f) _integral = 100.0f;
  if (_integral < -100.0f) _integral = -100.0f;

  float derivative = (error - _prevError) / dtSec;
  _prevError = error;

  return _kp * error + _ki * _integral + _kd * derivative;
}

void PIDLoop::setSetpoint(float sp) { _setpoint = sp; }
void PIDLoop::reset() { _integral = 0; _prevError = 0; }

// ── RelayState implementation (Guide §8: kích mức CAO) ───────────────────────

void RelayState::init() {
  pinMode(PIN_RELAY_MISTING, OUTPUT);
  pinMode(PIN_RELAY_SPEAKER, OUTPUT);
  pinMode(PIN_RELAY_VENTILATION, OUTPUT);
  pinMode(PIN_RELAY_HEATING, OUTPUT);
  digitalWrite(PIN_RELAY_MISTING, LOW);
  digitalWrite(PIN_RELAY_SPEAKER, LOW);
  digitalWrite(PIN_RELAY_VENTILATION, LOW);
  digitalWrite(PIN_RELAY_HEATING, LOW);
}

void RelayState::applyRelay(int pin, bool state) {
  // Jumper đặt kích mức CAO (Guide §8): HIGH = bật
  digitalWrite(pin, state ? HIGH : LOW);
}

// Field names/cấu trúc khớp backend/src/types/domain.ts RelayStatusPayload.
// LƯU Ý: mỗi relay có cờ override riêng (mistingOverride, speakerOverride...)
// nhưng schema backend (SensorNode.control_mode) chỉ có 1 field AUTO/MANUAL
// cho cả node — đây là rút gọn hợp lý: MANUAL nếu CÓ BẤT KỲ relay nào đang bị
// override, AUTO nếu không cái nào. Trạng thái override chi tiết từng relay
// hiện chưa expose qua API/MQTT riêng.
String RelayState::toJson() const {
  bool anyOverride = mistingOverride || speakerOverride || ventilationOverride || heatingOverride;

  String json = "{";
  json += "\"deviceId\":\"" + String(Config::deviceId) + "\",";
  json += "\"relay_states\":{";
  json += "\"misting\":" + String(misting ? "true" : "false") + ",";
  json += "\"speaker\":" + String(speaker ? "true" : "false") + ",";
  json += "\"ventilation\":" + String(ventilation ? "true" : "false") + ",";
  json += "\"heating\":" + String(heating ? "true" : "false");
  json += "},";
  json += "\"control_mode\":\"" + String(anyOverride ? "MANUAL" : "AUTO") + "\"";
  json += "}";
  return json;
}

namespace PIDController {

// Pump dry detection state (THREAT-FR-011)
static unsigned long mistingOnSince = 0;
static float humidityWhenMistingStarted = 0;

// ENV-FR-010: humidity < min → misting ON
void runHumidityControl(float humidity, RelayState &relay) {
  if (relay.mistingOverride) return;

  bool shouldMist = (humidity < Config::humidityMin);

  if (shouldMist && !relay.misting) {
    mistingOnSince = millis();
    humidityWhenMistingStarted = humidity;
  }

  relay.misting = shouldMist;
  relay.applyRelay(PIN_RELAY_MISTING, relay.misting);

  if (relay.misting) {
    Serial.println("[PID] MISTING ON (humidity=" + String(humidity, 1) + "% < min=" + String(Config::humidityMin, 1) + "%)");
  }
}

// ENV-FR-011: temp > max HOẶC nh3 > nh3_max HOẶC co2 > co2_max → quạt ON
void runVentilationControl(float temperature, float nh3, float co2, RelayState &relay) {
  if (relay.ventilationOverride) return;

  bool shouldVent = (temperature > Config::tempMax) ||
                     (nh3 > Config::nh3Max) ||
                     (co2 > Config::co2Max);

  relay.ventilation = shouldVent;
  relay.applyRelay(PIN_RELAY_VENTILATION, relay.ventilation);

  if (relay.ventilation) {
    Serial.println("[PID] FAN ON (temp=" + String(temperature, 1) + " nh3=" + String(nh3, 1) + " co2=" + String(co2, 0) + ")");
  }
}

// ENV-FR-012: temp < min → sưởi ON (chỉ khi có gắn thiết bị sưởi ở IN4)
void runHeatingControl(float temperature, RelayState &relay) {
  if (relay.heatingOverride) return;
  relay.heating = (temperature < Config::tempMin);
  relay.applyRelay(PIN_RELAY_HEATING, relay.heating);
  if (relay.heating) {
    Serial.println("[PID] HEATER ON (temp=" + String(temperature, 1) + "°C < min=" + String(Config::tempMin, 1) + "°C)");
  }
}

// ── Manual Override (ENV-FR-016..018) ──────────────────────────────────────

void setManualOverride(const char *relayName, bool state, unsigned long durationMs, RelayState &relay) {
  String name(relayName);
  if (name == "misting") {
    relay.mistingOverride = true;
    relay.misting = state;
    relay.applyRelay(PIN_RELAY_MISTING, state);
  } else if (name == "speaker") {
    relay.speakerOverride = true;
    relay.speaker = state;
    relay.applyRelay(PIN_RELAY_SPEAKER, state);
  } else if (name == "ventilation") {
    relay.ventilationOverride = true;
    relay.ventilation = state;
    relay.applyRelay(PIN_RELAY_VENTILATION, state);
  } else if (name == "heating") {
    relay.heatingOverride = true;
    relay.heating = state;
    relay.applyRelay(PIN_RELAY_HEATING, state);
  }
  relay.overrideExpiryMs = millis() + durationMs;
  Serial.println("[PID] MANUAL OVERRIDE: " + name + " = " + String(state ? "ON" : "OFF") + " for " + String(durationMs / 60000) + " min");
}

void checkOverrideExpiry(RelayState &relay) {
  if (relay.overrideExpiryMs > 0 && millis() > relay.overrideExpiryMs) {
    relay.mistingOverride = false;
    relay.speakerOverride = false;
    relay.ventilationOverride = false;
    relay.heatingOverride = false;
    relay.overrideExpiryMs = 0;
    Serial.println("[PID] Manual override EXPIRED → back to AUTO");
  }
}

// ── Threat Detection (THREAT-FR-006, 011, 013) ──────────────────────────────

ThreatFlags handleThreatAlerts(const SensorData &data, const RelayState &relay, bool audioPlaying) {
  ThreatFlags flags;

  // THREAT-FR-013: cảm biến đơn lẻ lỗi / toàn bus lỗi
  flags.sensorFault = (data.failedCount > 0 && data.failedCount < 3);
  flags.busFailure = SensorManager::isBusFailure();

  // THREAT-FR-006: SPEAKER_FAILURE — relay speaker ON + DFPlayer đang phát
  // nhưng dB không tăng so với baseline nền
  if (relay.speaker && audioPlaying && SensorManager::isAudioBaselineReady()) {
    float baseline = SensorManager::getAudioBaseline();
    if (baseline > 0 && data.soundDb < baseline * (1.0f - AUDIO_DROP_THRESHOLD)) {
      flags.speakerFailure = true;
      Serial.println("[THREAT] ⚠ SPEAKER_FAILURE: dB=" + String(data.soundDb, 1) + " baseline=" + String(baseline, 1));
    }
  }

  // THREAT-FR-011: PUMP_DRY — misting ON > 5 phút nhưng ẩm không tăng
  if (relay.misting && mistingOnSince > 0) {
    unsigned long elapsed = millis() - mistingOnSince;
    if (elapsed > 300000) {
      if (data.humidity <= humidityWhenMistingStarted + 2.0f) {
        flags.pumpDry = true;
        Serial.println("[THREAT] ⚠ PUMP_DRY: misting ON 5' nhưng độ ẩm không tăng!");
        mistingOnSince = millis(); // tránh báo liên tục
      }
    }
  } else {
    mistingOnSince = 0;
  }

  return flags;
}

} // namespace PIDController
