/**
 * PIDController – Closed-loop environmental control
 * SRS: ENV-FR-010..013, ENV-FR-014, ENV-FR-017, ENV-FR-018
 */
#pragma once
#include "sensors/SensorManager.h"

struct RelayState {
  bool misting     = false;
  bool ventilation = false;
  bool heating     = false;
  bool light       = false;

  // Manual override flags
  bool mistingOverride     = false;
  bool ventilationOverride = false;
  bool heatingOverride     = false;
  bool lightOverride       = false;

  unsigned long overrideExpiryMs = 0;

  void init();
  void applyRelay(int pin, bool state);
  String toJson() const;
};

class PIDController {
public:
  PIDController(float kp, float ki, float kd, float setpoint);

  float compute(float measurement, unsigned long dt);
  void  setSetpoint(float sp);
  void  reset();

private:
  float _kp, _ki, _kd, _setpoint;
  float _integral = 0;
  float _prevError = 0;
};

namespace PIDController {
  void runHumidityControl   (float humidity,    RelayState& relay);
  void runTemperatureControl(float temperature, RelayState& relay);
  void runLightControl      (float lux,         RelayState& relay);
  void runCO2Control        (float co2,         RelayState& relay);
  void setManualOverride    (const char* relayName, bool state, unsigned long durationMs);
  void checkOverrideExpiry  (RelayState& relay);
}
