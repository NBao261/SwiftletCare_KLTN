/**
 * MQTTManager – MQTT client over TLS (port 8883)
 * Pub/Sub telemetry, commands, heartbeat
 * SRS: ENV-FR-001, ENV-FR-015, §9.2, SEC-NFR-001
 */
#pragma once
#include <Arduino.h>
#include "sensors/SensorManager.h"
#include "pid/PIDController.h"

namespace MQTTManager {
  void begin();
  void loop();
  bool isConnected();

  // Publish
  void publishTelemetry (const SensorData& data, const RelayState& relay);
  void publishHeartbeat ();
  void publishRelayState(const RelayState& relay);
  void publishAlert     (const char* alertType, const char* severity, const char* payload);

  // Subscribe callbacks
  void onRelayCommand  (const char* payload);
  void onConfigUpdate  (const char* payload);
}
