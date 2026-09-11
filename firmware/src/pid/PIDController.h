/**
 * PIDController – Closed-loop environmental control + Threat alerts
 * SRS: ENV-FR-010..018, THREAT-FR-006..012
 */
#pragma once
#include "sensors/SensorManager.h"

struct RelayState {
  bool misting = false;
  bool ventilation = false;
  bool heating = false;
  bool light = false;

  // Manual override flags (ENV-FR-016..018)
  bool mistingOverride = false;
  bool ventilationOverride = false;
  bool heatingOverride = false;
  bool lightOverride = false;
  unsigned long overrideExpiryMs = 0;

  void init();
  void applyRelay(int pin, bool state);
  String toJson() const;
};

/**
 * PIDLoop – Generic PID algorithm (used internally).
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
void runHumidityControl(float humidity, RelayState &relay);
void runTemperatureControl(float temperature, RelayState &relay);
void runLightControl(float lux, RelayState &relay);
void runCO2Control(float co2, RelayState &relay);

void setManualOverride(const char *relayName, bool state,
                       unsigned long durationMs, RelayState &relay);
void checkOverrideExpiry(RelayState &relay);

// Threat detection actuators (THREAT-FR-006, THREAT-FR-011)
void handleThreatAlerts(const SensorData &data, const RelayState &relay);
void buzzAlert(int beeps, int durationMs);
} // namespace PIDController
