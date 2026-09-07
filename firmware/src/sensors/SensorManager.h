/**
 * SensorManager – Reads all 5 sensors on ESP32
 * SRS: ENV-FR-001, ENV-FR-003
 */
#pragma once
#include <Arduino.h>

struct SensorData {
  float temperature;    // °C  (SHT31)
  float humidity;       // %RH (SHT31)
  float lightLux;       // lux (BH1750)
  float co2Ppm;         // ppm (MQ-135)
  float soundDb;        // dB  (MAX9814)
  float tempOutdoor;    // °C  (DHT22)
  float humidOutdoor;   // %RH (DHT22)
  unsigned long timestamp;
  bool  isValid;

  // Serialize to JSON string for MQTT publish
  String toJson() const;
};

namespace SensorManager {
  void begin();
  SensorData readAll();
  bool validateRange(const SensorData& data);
}
