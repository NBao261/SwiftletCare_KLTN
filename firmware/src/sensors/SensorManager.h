/**
 * SensorManager – Reads all sensors on ESP32
 * SRS: ENV-FR-001, ENV-FR-003, THREAT-FR-005..007
 */
#pragma once
#include <Arduino.h>

struct SensorData {
  float temperature;  // °C  (SHT31 indoor)
  float humidity;     // %RH (SHT31 indoor)
  float lightLux;     // lux (BH1750)
  float co2Ppm;       // ppm (MQ-135)
  float soundDb;      // dB  (MAX9814)
  float tempOutdoor;  // °C  (DHT22 outdoor)
  float humidOutdoor; // %RH (DHT22 outdoor)
  unsigned long timestamp;
  bool isValid;

  // Threat detection flags (THREAT-FR-006, THREAT-FR-007)
  bool speakerAlert = false; // Speaker failure detected
  bool panicAlert = false;   // Bird panic detected

  String toJson() const;
};

namespace SensorManager {
void begin();
SensorData readAll();
bool validateRange(const SensorData &data);
} // namespace SensorManager
