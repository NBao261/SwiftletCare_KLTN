/**
 * PIDController.cpp – Fuzzy/threshold closed-loop control + threat detection
 * SRS: ENV-FR-010..019, THREAT-FR-006, THREAT-FR-011, THREAT-FR-013
 */
#include "PIDController.h"
#include "FuzzyControl.h"
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
  return mistingOverride || speakerOverride || ventilationOverride || heatingOverride;
}

String RelayState::toJson() const {

  String json = "{";
  json += "\"deviceId\":\"" + String(Config::deviceId) + "\",";
  json += "\"relay_states\":{";
  json += "\"misting\":" + String(misting ? "true" : "false") + ",";
  json += "\"speaker\":" + String(speaker ? "true" : "false") + ",";
  json += "\"ventilation\":" + String(ventilation ? "true" : "false") + ",";
  json += "\"heating\":" + String(heating ? "true" : "false");
  json += "},";
  json += "\"control_mode\":\"" + String(anyOverride() ? "MANUAL" : "AUTO") + "\"";
  json += "}";
  return json;
}

namespace PIDController {

// Pump dry detection state (THREAT-FR-011) — cập nhật trong handleThreatAlerts()
// (chạy mỗi chu kỳ bất kể relay.misting được set bởi AUTO hay Manual Override).
static const unsigned long PUMP_DRY_ON_MS = 300000; // 5 phút BẬT cộng dồn
static bool sprayActive = false;
static bool pumpDryReported = false;
static unsigned long sprayOnMs = 0;
static unsigned long lastThreatCheckMs = 0;
static float humidityAtBlockStart = 0;

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
  relay.mistingPct = toPct(duty);
  relay.misting = FuzzyControl::timeProportionalOn(duty, millis(), windowMs(), 0);
  relay.applyRelay(PIN_RELAY_MISTING, relay.misting);

  if (relay.mistingPct > 0) {
    Serial.println("[FUZZY] MISTING " + String(relay.mistingPct) + "% → " + (relay.misting ? "ON" : "OFF") +
                   " (humidity=" + String(humidity, 1) + "% temp=" + String(temperature, 1) + "°C)");
  }
}

// ENV-FR-011 (v1.24.0): logic mờ nhiệt độ + độ ẩm + NH3 + CO2 → % quạt; NH3/CO2
// vượt max luôn ép 100% (chốt an toàn trong FuzzyControl::ventilationDemand).
// Nhận cả SensorData để dùng nh3Ok/co2Ok — cảm biến timeout ở chu kỳ này trả
// NAN cho nh3Ppm/co2Ppm (SensorManager.cpp readAll()), phải loại khỏi quyết
// định thay vì so sánh NAN. Không gate CẢ HÀM theo nh3Ok/co2Ok vì riêng 1 cảm
// biến khí lỗi không nên làm dừng điều khiển theo nhiệt độ.
// data.temperature/humidity không cần guard: caller (main.cpp pidTask) chỉ gọi
// trong if (data.isValid), validateRange() đã bắt buộc 2 giá trị này không NaN.
void runVentilationControl(const SensorData &data, RelayState &relay) {
  if (relay.ventilationOverride) return;

  float duty = FuzzyControl::ventilationDemand(
      data.temperature, data.humidity, data.nh3Ppm, data.nh3Ok, data.co2Ppm, data.co2Ok,
      Config::tempMax, Config::humidityMin, Config::nh3Max, Config::co2Max, currentTuning());
  relay.ventilationPct = toPct(duty);
  // Lệch nửa cửa sổ so với phun sương: tránh vừa phun vừa hút hơi ẩm ra ngoài.
  relay.ventilation = FuzzyControl::timeProportionalOn(duty, millis(), windowMs(), windowMs() / 2);
  relay.applyRelay(PIN_RELAY_VENTILATION, relay.ventilation);

  if (relay.ventilationPct > 0) {
    Serial.println("[FUZZY] FAN " + String(relay.ventilationPct) + "% → " + (relay.ventilation ? "ON" : "OFF") +
                   " (temp=" + String(data.temperature, 1) + " nh3=" + String(data.nh3Ppm, 1) +
                   " co2=" + String(data.co2Ppm, 0) + ")");
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
  } else if (name == "heating") {
    relay.heatingOverride = true;
    relay.heating = state;
    relay.applyRelay(PIN_RELAY_HEATING, state);
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
  relay.heatingOverride = false;
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
  // Trạng thái relay misting ở CHU KỲ TRƯỚC — relay giữ nguyên trạng thái giữa
  // 2 chu kỳ nên khoảng thời gian từ lần gọi trước được tính là "đã BẬT" nếu
  // cờ này true. Theo dõi ở đây (không trong runHumidityControl(), hàm đó
  // return sớm khi override) để PUMP_DRY chạy cả khi bật bằng Manual Override.
  static bool mistingWasOn = false;

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
    if (baseline > 0 && data.soundDb < baseline * (1.0f - AUDIO_DROP_THRESHOLD)) {
      flags.speakerFailure = true;
      Serial.println("[THREAT] ⚠ SPEAKER_FAILURE: dB=" + String(data.soundDb, 1) + " baseline=" + String(baseline, 1));
    }
  }

  // THREAT-FR-011: PUMP_DRY — bơm đã BẬT cộng dồn > 5 phút nhưng ẩm không tăng.
  // Logic mờ bật/tắt bơm theo chu kỳ (time-proportioning) nên không còn "ON
  // liên tục 5 phút": 1 ĐỢT PHUN = liên tục có nhu cầu phun (AUTO: mistingPct
  // > 0; override: relay.misting), trong đợt cộng dồn thời gian relay thực sự
  // BẬT. Cứ mỗi 5 phút BẬT so độ ẩm với đầu khối 5 phút đó; báo 1 lần/đợt.
  unsigned long now = millis();
  bool spraying = relay.misting || relay.mistingPct > 0;
  if (!spraying) {
    sprayActive = false;
  } else if (!sprayActive) {
    sprayActive = true;
    pumpDryReported = false;
    sprayOnMs = 0;
    humidityAtBlockStart = data.humidity;
  } else if (mistingWasOn) {
    sprayOnMs += now - lastThreatCheckMs;
  }
  if (sprayActive && sprayOnMs > PUMP_DRY_ON_MS) {
    if (!pumpDryReported && data.humidity <= humidityAtBlockStart + 2.0f) {
      flags.pumpDry = true;
      pumpDryReported = true;
      Serial.println("[THREAT] ⚠ PUMP_DRY: bơm đã BẬT 5' nhưng độ ẩm không tăng!");
    }
    sprayOnMs = 0;
    humidityAtBlockStart = data.humidity;
  }
  lastThreatCheckMs = now;
  mistingWasOn = relay.misting;

  return flags;
}

} // namespace PIDController
