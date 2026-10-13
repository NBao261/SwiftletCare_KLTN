/**
 * PIDController – Closed-loop environmental control + Threat alert flags
 * Phun sương + quạt: logic mờ Sugeno (FuzzyControl.h) + time-proportioning.
 * Kênh relay IN4 (GPIO14) để dự phòng — SRS v2.0.0 bỏ sưởi (ENV-FR-012).
 * Hardware: Components Guide v3.3 §8-9 (Relay 4 kênh kích mức CAO)
 * SRS: ENV-FR-010..019, THREAT-FR-006, THREAT-FR-011, THREAT-FR-013
 */
#pragma once
#include "sensors/SensorManager.h"

struct RelayState {
  bool misting = false;     // IN1 GPIO25 – phun sương
  bool speaker = false;     // IN2 GPIO26 – nguồn amply loa ru
  bool ventilation = false; // IN3 GPIO27 – quạt thông gió

  // Manual override flags (ENV-FR-016..018)
  bool mistingOverride = false;
  bool speakerOverride = false;
  bool ventilationOverride = false;
  unsigned long overrideExpiryMs = 0;

  // Đầu ra bộ điều khiển mờ, % công suất 0-100 (= tỉ lệ thời gian BẬT trong
  // cửa sổ Config::fuzzyWindowSec). Override → 100/0. Gửi lên qua telemetry
  // control_output (KHÔNG qua toJson/relay-status: số này đổi liên tục).
  uint8_t mistingPct = 0;
  uint8_t ventilationPct = 0;

  void init();
  void applyRelay(int pin, bool state); // kích mức CAO = bật (Guide §8)
  bool anyOverride() const; // control_mode MANUAL/AUTO gửi lên backend
  String toJson() const;
};

/**
 * PIDLoop – Generic PID algorithm (chưa gắn vào control loop — phun sương/quạt
 * dùng logic mờ theo ENV-FR-010/011; giữ lại để mở rộng).
 */
class PIDLoop {
public:
  PIDLoop(float kp, float ki, float kd, float setpoint);
  float compute(float measurement, unsigned long dt);
  void setSetpoint(float sp);
  void reset();

private:
  float _kp, _ki, _kd, _setpoint;
  float _integral = 0;
  float _prevError = 0;
};

namespace PIDController {
void runHumidityControl(float humidity, float temperature, RelayState &relay); // ENV-FR-010 (mờ)
// Quạt chỉ theo nhiệt độ + độ ẩm (SRS v2.0.0) — NH3/CO2 không còn là đầu vào.
void runVentilationControl(float temperature, float humidity, RelayState &relay); // ENV-FR-011 (mờ)

void setManualOverride(const char *relayName, bool state,
                       unsigned long durationMs, RelayState &relay);
void checkOverrideExpiry(RelayState &relay);
// Trả mọi relay về AUTO ngay — dùng khi hết hạn override và khi backend gửi
// relay/command {"action":"clear_override"} (overrideExpiry.job.ts).
void clearOverrides(RelayState &relay);

// Threat detection (THREAT-FR-006, 011, 013) – chỉ tính flags, main.cpp/MQTTManager publish alert
struct ThreatFlags {
  bool speakerFailure = false; // relay speaker ON + đang play nhưng dB không tăng
  bool pumpDry = false;        // đợt phun đã BẬT cộng dồn đủ lâu nhưng ẩm không tăng (PumpDryMonitor)
  bool sensorFault = false;    // 1 Slave ID lỗi
  bool busFailure = false;     // ≥3/5 Slave ID lỗi, 3 chu kỳ liên tiếp
  bool noiseAnomaly = false;   // THREAT-FR-007 — do NoiseAnomalyDetector (sensorTask) báo, main.cpp gộp vào
};
ThreatFlags handleThreatAlerts(const SensorData &data, const RelayState &relay, bool audioPlaying);
} // namespace PIDController
