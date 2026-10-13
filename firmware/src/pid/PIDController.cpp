/**
 * PIDController.cpp – Fuzzy/threshold closed-loop control + threat detection
 * SRS: ENV-FR-010..019, THREAT-FR-006, THREAT-FR-011, THREAT-FR-013
 */
#include "PIDController.h"
#include "FuzzyControl.h"
#include "PumpDryMonitor.h"
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
  pinMode(PIN_RELAY_SPARE, OUTPUT);
  digitalWrite(PIN_RELAY_MISTING, LOW);
  digitalWrite(PIN_RELAY_SPEAKER, LOW);
  digitalWrite(PIN_RELAY_VENTILATION, LOW);
  digitalWrite(PIN_RELAY_SPARE, LOW); // IN4 dự phòng — luôn TẮT
}

void RelayState::applyRelay(int pin, bool state) {
  // Jumper đặt kích mức CAO (Guide §8): HIGH = bật. Dùng RELAY_ACTIVE_HIGH
  // (Config.h) thay vì hardcode HIGH — đổi board sang active-low sau này chỉ
  // cần đổi 1 macro, không phải sửa lại logic ở đây.
  digitalWrite(pin, (state == RELAY_ACTIVE_HIGH) ? HIGH : LOW);
}

// Field names/cấu trúc khớp backend/src/types/domain.ts RelayStatusPayload.
// LƯU Ý: mỗi relay có cờ override riêng (mistingOverride, speakerOverride...)
// nhưng schema backend (SensorNode.control_mode) chỉ có 1 field AUTO/MANUAL
// cho cả node — đây là rút gọn hợp lý: MANUAL nếu CÓ BẤT KỲ relay nào đang bị
// override, AUTO nếu không cái nào. Trạng thái override chi tiết từng relay
// hiện chưa expose qua API/MQTT riêng.
bool RelayState::anyOverride() const {
  return mistingOverride || speakerOverride || ventilationOverride;
}

String RelayState::toJson() const {

  String json = "{";
  json += "\"deviceId\":\"" + String(Config::deviceId) + "\",";
  json += "\"relay_states\":{";
  json += "\"misting\":" + String(misting ? "true" : "false") + ",";
  json += "\"speaker\":" + String(speaker ? "true" : "false") + ",";
  json += "\"ventilation\":" + String(ventilation ? "true" : "false");
  json += "},";
  json += "\"control_mode\":\"" + String(anyOverride() ? "MANUAL" : "AUTO") + "\"";
  json += "}";
  return json;
}

namespace PIDController {

// THREAT-FR-011: phát hiện bơm khô + chốt ngừng phun tới hết đợt (PumpDryMonitor.h).
// Cập nhật trong handleThreatAlerts() — chạy mỗi chu kỳ bất kể relay.misting do
// AUTO hay Manual Override đặt. autoMistingDemand = bộ mờ đang muốn phun, lưu
// riêng vì khi đang chốt thì relay.mistingPct bị ép về 0. autoDemandKnown = chu kỳ
// này có số đo hợp lệ để tính nhu cầu; số đo hỏng cho nhu cầu 0 nhưng KHÔNG có
// nghĩa là hết đợt phun (xem PumpDryMonitor.h).
static PumpDryMonitor pumpMonitor;
static bool autoMistingDemand = false;
static bool autoDemandKnown = false;

static uint8_t toPct(float duty) { return (uint8_t)lroundf(duty * 100.0f); }

// Hệ số mờ + cửa sổ đọc lại mỗi chu kỳ: config/update (mqttTask) đổi được lúc chạy
static FuzzyControl::Tuning currentTuning() {
  FuzzyControl::Tuning t;
  t.humidityBand = Config::fuzzyHumidityBand;
  t.tempBand = Config::fuzzyTempBand;
  t.fanDryLevel = Config::fuzzyFanDryLevel / 100.0f;
  return t;
}
static uint32_t windowMs() { return (uint32_t)Config::fuzzyWindowSec * 1000UL; }

// ENV-FR-010 (v1.24.0): logic mờ độ ẩm + nhiệt độ → % phun, chạy theo tỉ lệ
// thời gian BẬT trong cửa sổ Config::fuzzyWindowSec (xem FuzzyControl.h). Phun sương
// vừa tăng ẩm vừa hạ nhiệt nên trời nóng thì phun sớm hơn, ẩm đã cao thì tắt.
void runHumidityControl(float humidity, float temperature, RelayState &relay) {
  if (relay.mistingOverride) return;

  float duty = FuzzyControl::mistingDemand(humidity, temperature, Config::humidityMin,
                                           Config::humidityMax, Config::tempMax, currentTuning());
  autoMistingDemand = duty > 0.0f;
  autoDemandKnown = FuzzyControl::inputsValid(temperature, humidity);
  // Bơm khô đã phát hiện ở đợt này → ngừng phun tới hết đợt để bảo vệ bơm
  if (pumpMonitor.blocked()) duty = 0.0f;
  relay.mistingPct = toPct(duty);
  relay.misting = FuzzyControl::timeProportionalOn(duty, millis(), windowMs(), 0);
  relay.applyRelay(PIN_RELAY_MISTING, relay.misting);

  if (relay.mistingPct > 0) {
    Serial.println("[FUZZY] MISTING " + String(relay.mistingPct) + "% → " + (relay.misting ? "ON" : "OFF") +
                   " (humidity=" + String(humidity, 1) + "% temp=" + String(temperature, 1) + "°C)");
  }
}

// ENV-FR-011 (SRS v2.0.0): logic mờ nhiệt độ + độ ẩm → % quạt. NH3/CO2 không
// còn là đầu vào và không còn chốt "khí vượt ngưỡng thì ép quạt 100%" — hai chỉ
// số này chỉ theo dõi + cảnh báo ở backend. Số đo không hợp lệ → nhu cầu 0
// (FuzzyControl::inputsValid, THREAT-FR-013).
void runVentilationControl(float temperature, float humidity, RelayState &relay) {
  if (relay.ventilationOverride) return;

  float duty = FuzzyControl::ventilationDemand(temperature, humidity, Config::tempMax, Config::humidityMin,
                                               currentTuning());
  relay.ventilationPct = toPct(duty);
  // Lệch nửa cửa sổ so với phun sương: tránh vừa phun vừa hút hơi ẩm ra ngoài.
  relay.ventilation = FuzzyControl::timeProportionalOn(duty, millis(), windowMs(), windowMs() / 2);
  relay.applyRelay(PIN_RELAY_VENTILATION, relay.ventilation);

  if (relay.ventilationPct > 0) {
    Serial.println("[FUZZY] FAN " + String(relay.ventilationPct) + "% → " + (relay.ventilation ? "ON" : "OFF") +
                   " (temp=" + String(temperature, 1) + "°C humidity=" + String(humidity, 1) + "%)");
  }
}

// ── Manual Override (ENV-FR-016..018) ──────────────────────────────────────

void setManualOverride(const char *relayName, bool state, unsigned long durationMs, RelayState &relay) {
  String name(relayName);
  if (name == "misting") {
    relay.mistingOverride = true;
    relay.misting = state;
    relay.mistingPct = state ? 100 : 0;
    relay.applyRelay(PIN_RELAY_MISTING, state);
  } else if (name == "speaker") {
    relay.speakerOverride = true;
    relay.speaker = state;
    relay.applyRelay(PIN_RELAY_SPEAKER, state);
  } else if (name == "ventilation") {
    relay.ventilationOverride = true;
    relay.ventilation = state;
    relay.ventilationPct = state ? 100 : 0;
    relay.applyRelay(PIN_RELAY_VENTILATION, state);
  } else {
    Serial.println("[PID] MANUAL OVERRIDE: relayName không hợp lệ: " + name);
    return; // không động tới hạn override của các relay khác
  }
  relay.overrideExpiryMs = millis() + durationMs;
  Serial.println("[PID] MANUAL OVERRIDE: " + name + " = " + String(state ? "ON" : "OFF") + " for " + String(durationMs / 60000) + " min");
}

void clearOverrides(RelayState &relay) {
  relay.mistingOverride = false;
  relay.speakerOverride = false;
  relay.ventilationOverride = false;
  relay.overrideExpiryMs = 0;
}

void checkOverrideExpiry(RelayState &relay) {
  if (relay.overrideExpiryMs > 0 && millis() > relay.overrideExpiryMs) {
    clearOverrides(relay);
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
  // nhưng dB không tăng so với baseline nền. Guard noiseOk: cảm biến noise
  // timeout ở chu kỳ này → soundDb = NAN → so sánh luôn false, không phải
  // lỗi, chỉ là không đánh giá được ở chu kỳ đó (cùng gốc NaN-comparison
  // như fix runVentilationControl(), thêm cho nhất quán).
  if (relay.speaker && audioPlaying && data.noiseOk && SensorManager::isAudioBaselineReady()) {
    float baseline = SensorManager::getAudioBaseline();
    // speakerDropPct chỉnh theo Zone (EXPERT-FR-008), mặc định 70
    if (baseline > 0 && data.soundDb < baseline * (1.0f - Config::speakerDropPct / 100.0f)) {
      flags.speakerFailure = true;
      Serial.println("[THREAT] ⚠ SPEAKER_FAILURE: dB=" + String(data.soundDb, 1) + " baseline=" + String(baseline, 1));
    }
  }

  // THREAT-FR-011: PUMP_DRY — bơm BẬT cộng dồn đủ lâu trong 1 đợt phun mà độ ẩm
  // không tăng → chốt ngừng phun (runHumidityControl đọc pumpMonitor.blocked()),
  // tự thử lại sau PUMP_DRY_RETRY_MS. Thời gian + mức tăng chỉnh theo Zone
  // (EXPERT-FR-008). Đợt phun: AUTO = bộ mờ muốn phun; override = relay được ép BẬT.
  bool humidityOk = data.tempHumidOk && isfinite(data.humidity);
  bool sensorOk = humidityOk && (relay.mistingOverride || autoDemandKnown);
  bool demand = relay.mistingOverride ? relay.misting : autoMistingDemand;
  bool fired = pumpMonitor.update(sensorOk, demand, relay.mistingOverride, relay.misting, data.humidity, millis(),
                                  (uint32_t)Config::pumpDryOnSec * 1000UL, Config::pumpDryMinRisePct,
                                  PUMP_DRY_RETRY_MS);
  if (fired) {
    Serial.println("[THREAT] ⚠ PUMP_DRY: bơm BẬT " + String(Config::pumpDryOnSec) +
                   "s nhưng độ ẩm không tăng → ngừng phun, thử lại sau " + String(PUMP_DRY_RETRY_MS / 60000UL) + " phút");
  }
  // Cờ theo MỨC (đang chốt), không theo xung 1 chu kỳ: nếu MQTT rớt đúng lúc phát
  // hiện thì main.cpp gửi lại ở chu kỳ sau cho tới khi gửi được — phun sương đang
  // bị ngắt thì Farm Owner phải được báo.
  flags.pumpDry = pumpMonitor.blocked();

  return flags;
}

} // namespace PIDController
