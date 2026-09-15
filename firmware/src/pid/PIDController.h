/**
 * PIDController – Closed-loop environmental control + Threat alert flags
 * Hardware: Components Guide v3.3 §8-9 (Relay 4 kênh kích mức CAO)
 * SRS: ENV-FR-010..019, THREAT-FR-006, THREAT-FR-011, THREAT-FR-013
 */
#pragma once
#include "sensors/SensorManager.h"

struct RelayState {
  bool misting = false;     // IN1 GPIO25 – phun sương
  bool speaker = false;     // IN2 GPIO26 – nguồn amply loa ru
  bool ventilation = false; // IN3 GPIO27 – quạt thông gió
  bool heating = false;     // IN4 GPIO14 – sưởi (dự phòng)

  // Manual override flags (ENV-FR-016..018)
  bool mistingOverride = false;
  bool speakerOverride = false;
  bool ventilationOverride = false;
  bool heatingOverride = false;
  unsigned long overrideExpiryMs = 0;

  void init();
  void applyRelay(int pin, bool state); // kích mức CAO = bật (Guide §8)
  String toJson() const;
};

/**
 * PIDLoop – Generic PID algorithm (dùng nội bộ, chưa gắn vào control loop
 * hiện tại đang dùng on-off theo ENV-FR-010/011; giữ lại để mở rộng).
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
void runHumidityControl(float humidity, RelayState &relay);   // ENV-FR-010
void runVentilationControl(float temperature, float nh3, float co2, RelayState &relay); // ENV-FR-011
void runHeatingControl(float temperature, RelayState &relay); // ENV-FR-012

void setManualOverride(const char *relayName, bool state,
                       unsigned long durationMs, RelayState &relay);
void checkOverrideExpiry(RelayState &relay);

// Threat detection (THREAT-FR-006, 011, 013) – chỉ tính flags, main.cpp/MQTTManager publish alert
struct ThreatFlags {
  bool speakerFailure = false; // relay speaker ON + đang play nhưng dB không tăng
  bool pumpDry = false;        // misting ON >5' nhưng ẩm không tăng
  bool sensorFault = false;    // 1 Slave ID lỗi
  bool busFailure = false;     // ≥3/5 Slave ID lỗi, 3 chu kỳ liên tiếp
};
ThreatFlags handleThreatAlerts(const SensorData &data, const RelayState &relay, bool audioPlaying);
} // namespace PIDController
