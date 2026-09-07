/**
 * StorageManager – NVS config + SPIFFS offline buffer
 * SRS: REL-NFR-003, ENV-FR-014
 */
#pragma once
#include "sensors/SensorManager.h"

namespace StorageManager {
  void begin();

  // NVS – config persistence
  void saveConfig();
  void loadConfig();

  // SPIFFS – offline telemetry buffer
  void   bufferTelemetry(const SensorData& data);
  void   flushBuffer();        // Upload all buffered records via MQTT
  int    getBufferCount();
  void   clearBuffer();
}
