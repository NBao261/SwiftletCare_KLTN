/**
 * SensorManager – Reads all 5 RS485 Modbus sensors on the shared bus
 * Hardware: Components Guide v3.3 §2.1, §4, §5
 * SRS: ENV-FR-001, ENV-FR-002, ENV-FR-003, THREAT-FR-013
 */
#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

struct SensorData {
  float temperature; // °C   (ES35-SW, reg0 ÷10)
  float humidity;    // %RH  (ES35-SW, reg1 ÷10)
  float lightLux;    // lux  (ES-ALS-02, reg2-3 ×100)
  float nh3Ppm;      // ppm  (ES-NH3-01, reg0)
  float co2Ppm;      // ppm  (ES-CO2-01, reg0)
  float soundDb;     // dB   (ES-NOISE-01, reg0 ÷10)
  unsigned long timestamp = 0; // millis() lúc đọc — 0 = chưa đọc lần nào
  // Epoch ms (NTP) lúc đọc — 0 nếu đồng hồ chưa sync. Backend dùng làm thời
  // điểm đo thật, nhất là cho dữ liệu buffer offline flush lại (REL-NFR-003).
  uint64_t epochMs = 0;
  bool isValid;

  // Per-slave read status (THREAT-FR-013: SENSOR_FAULT / RS485_BUS_FAILURE)
  bool noiseOk = false;
  bool co2Ok = false;
  bool nh3Ok = false;
  bool lightOk = false;
  bool tempHumidOk = false;
  int failedCount = 0; // number of Slave IDs that timed out this cycle

  // Field cảm biến theo backend TelemetryPayload — định nghĩa DUY NHẤT ở đây,
  // dùng chung cho telemetry sống (MQTTManager) và buffer offline (toJson()).
  // NaN (cảm biến timeout) được ArduinoJson ghi thành null, JSON luôn hợp lệ.
  void fillJson(JsonDocument &doc) const;
  String toJson() const;
};

namespace SensorManager {
void begin();
SensorData readAll();
bool validateRange(const SensorData &data);
bool isBusFailure(); // THREAT-FR-013: ≥3/5 IDs timeout, 3 consecutive cycles
float getAudioBaseline(); // THREAT-FR-006: rolling dB baseline (0 if not ready)
bool isAudioBaselineReady();
} // namespace SensorManager
