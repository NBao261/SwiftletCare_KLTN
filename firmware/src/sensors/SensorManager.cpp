/**
 * SensorManager.cpp – Modbus RTU polling of the 5-sensor RS485 bus
 *
 * Bus: UART TTL→RS485 V2, ESP32 GPIO17→TXD, GPIO16→RXD, 4800bps 8-N-1
 * Register map (Function 0x03, Components Guide v3.3 §5):
 *   Noise      (ID1) reg 0x0000            ÷10   = dB
 *   CO2        (ID2) reg 0x0000                  = ppm
 *   NH3        (ID3) reg 0x0000                  = ppm
 *   Light      (ID4) reg 0x0002 (2 reg, 32-bit) ×100 = Lux
 *   Temp/Humid (ID5) reg 0x0000+0x0001      ÷10   = °C, %RH
 *
 * SRS: ENV-FR-001..003, THREAT-FR-013 (SENSOR_FAULT / RS485_BUS_FAILURE)
 */
#include "SensorManager.h"
#include "config/Config.h"
#include <ModbusMaster.h>
#include <cmath>

static ModbusMaster modbus;

// RS485_BUS_FAILURE tracking: ≥3/5 IDs timeout for 3 consecutive cycles
// (THREAT-FR-013)
static int consecutiveBusFailureCycles = 0;

// Audio baseline tracking for SPEAKER_FAILURE (THREAT-FR-006), consumed by
// PIDController
static float audioSamples[AUDIO_BASELINE_WINDOW_SAMPLES];
static int audioIdx = 0;
static bool audioBaselineReady = false;
static float audioBaseline = 0;

static void preTransmission() {
} // RS485 module V2 is auto-direction (no DE/RE pin)
static void postTransmission() {}

namespace SensorManager {

void begin() {
  Serial2.begin(MODBUS_BAUDRATE, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  modbus.preTransmission(preTransmission);
  modbus.postTransmission(postTransmission);
  Serial.println("[Sensors] RS485 Modbus bus initialized @ " +
                 String(MODBUS_BAUDRATE) + "bps");
}

// Sóng phản xạ (ringing) sau MỘT LẦN CÓ THIẾT BỊ TRẢ LỜI cần thời gian ngắn để
// tắt hẳn trước khi gửi query kế tiếp — nếu không, query ngay sau đó dễ bị lỗi
// CRC/timeout dù thiết bị đó hoàn toàn bình thường. Thực tế đo được: lỗi luôn
// rơi đúng vào ID được đọc NGAY SAU một lần đọc thành công, không rơi vào ID
// theo sau 1 lần timeout (vì timeout = im lặng hoàn toàn, không có gì để dội).
// Không cần delay sau timeout vì ModbusMaster đã tự chờ ~1s timeout sẵn rồi.
// 20ms ban đầu không đủ: sau khi gắn điện trở termination 120Ω ở cuối bus
// (Domino5, ES35-SW) vẫn còn FAULT chập chờn ở ES35-SW (ID5, đọc ngay sau
// Light/ID4) — tăng lên 70ms để thử loại trừ khả năng do thời gian settle
// chưa đủ, trước khi nghi ngờ tiếp dây/domino lỏng hoặc bản thân cảm biến.
static constexpr uint32_t BUS_SETTLE_MS = 70;

// Đọc 1 thanh ghi 16-bit, trả về true nếu thành công
static bool readRegister(uint8_t slaveId, uint16_t reg, int16_t &outValue) {
  modbus.begin(slaveId, Serial2);
  uint8_t result = modbus.readHoldingRegisters(reg, 1);
  if (result != modbus.ku8MBSuccess)
    return false;
  outValue = (int16_t)modbus.getResponseBuffer(0);
  delay(BUS_SETTLE_MS);
  return true;
}

// Đọc 2 thanh ghi liên tiếp (dùng cho Light 32-bit và Temp/Humid)
static bool readRegisters2(uint8_t slaveId, uint16_t startReg, int16_t &reg0,
                           int16_t &reg1) {
  modbus.begin(slaveId, Serial2);
  uint8_t result = modbus.readHoldingRegisters(startReg, 2);
  if (result != modbus.ku8MBSuccess)
    return false;
  reg0 = (int16_t)modbus.getResponseBuffer(0);
  reg1 = (int16_t)modbus.getResponseBuffer(1);
  delay(BUS_SETTLE_MS);
  return true;
}

SensorData readAll() {
  SensorData d;
  d.timestamp = millis();
  d.failedCount = 0;
  int16_t r0 = 0, r1 = 0;

  // ── Noise (ID1) ──────────────────────────────────────────────────────
  d.noiseOk = readRegister(MODBUS_ID_NOISE, 0x0000, r0);
  d.soundDb = d.noiseOk ? r0 / 10.0f : NAN;
  if (!d.noiseOk)
    d.failedCount++;

  // ── CO2 (ID2) ────────────────────────────────────────────────────────
  d.co2Ok = readRegister(MODBUS_ID_CO2, 0x0000, r0);
  d.co2Ppm = d.co2Ok ? (float)r0 : NAN;
  if (!d.co2Ok)
    d.failedCount++;

  // ── NH3 (ID3) ────────────────────────────────────────────────────────
  d.nh3Ok = readRegister(MODBUS_ID_NH3, 0x0000, r0);
  d.nh3Ppm = d.nh3Ok ? (float)r0 : NAN;
  if (!d.nh3Ok)
    d.failedCount++;

  // ── Light (ID4, 2 reg 32-bit) ────────────────────────────────────────
  d.lightOk = readRegisters2(MODBUS_ID_LIGHT, 0x0002, r0, r1);
  d.lightLux = d.lightOk
                   ? (((uint32_t)(uint16_t)r0 << 16 | (uint16_t)r1) * 100.0f)
                   : NAN;
  if (!d.lightOk)
    d.failedCount++;

  // ── Temp/Humid (ID5, cuối bus) ───────────────────────────────────────
  d.tempHumidOk = readRegisters2(MODBUS_ID_TEMP_HUMID, 0x0000, r0, r1);
  d.temperature = d.tempHumidOk ? r0 / 10.0f : NAN;
  d.humidity = d.tempHumidOk ? r1 / 10.0f : NAN;
  if (!d.tempHumidOk)
    d.failedCount++;

  // ── THREAT-FR-013: RS485_BUS_FAILURE (≥3/5 timeout, 3 chu kỳ liên tiếp) ─
  if (d.failedCount >= 3) {
    consecutiveBusFailureCycles++;
  } else {
    consecutiveBusFailureCycles = 0;
  }

  // ── Audio baseline tracking (feeds THREAT-FR-006 in PIDController) ────
  if (d.noiseOk) {
    audioSamples[audioIdx % AUDIO_BASELINE_WINDOW_SAMPLES] = d.soundDb;
    audioIdx++;
    if (audioIdx >= AUDIO_BASELINE_WINDOW_SAMPLES) {
      audioBaselineReady = true;
      float sum = 0;
      for (int i = 0; i < AUDIO_BASELINE_WINDOW_SAMPLES; i++)
        sum += audioSamples[i];
      audioBaseline = sum / AUDIO_BASELINE_WINDOW_SAMPLES;
    }
  }

  d.isValid = validateRange(d);

  // ── Serial output ────────────────────────────────────────────────────
  Serial.println("────────── Sensor Reading (RS485) ──────────");
  Serial.println("  Temp/Humid : " + String(d.temperature, 1) + "°C / " +
                 String(d.humidity, 1) + "%  " +
                 (d.tempHumidOk ? "OK" : "FAULT"));
  Serial.println("  Light      : " + String(d.lightLux, 1) + " lux  " +
                 (d.lightOk ? "OK" : "FAULT"));
  Serial.println("  NH3        : " + String(d.nh3Ppm, 1) + " ppm  " +
                 (d.nh3Ok ? "OK" : "FAULT"));
  Serial.println("  CO2        : " + String(d.co2Ppm, 0) + " ppm  " +
                 (d.co2Ok ? "OK" : "FAULT"));
  Serial.println("  Sound      : " + String(d.soundDb, 1) + " dB  " +
                 (d.noiseOk ? "OK" : "FAULT"));
  if (consecutiveBusFailureCycles >= 3) {
    Serial.println("  ⚠ RS485_BUS_FAILURE: " + String(d.failedCount) +
                   "/5 IDs timeout, " + String(consecutiveBusFailureCycles) +
                   " cycles");
  }
  Serial.println("──────────────────────────────────────────");

  return d;
}

bool validateRange(const SensorData &data) {
  if (std::isnan(data.temperature) || std::isnan(data.humidity))
    return false;
  if (data.temperature < -40 || data.temperature > 80)
    return false;
  if (data.humidity < 0 || data.humidity > 100)
    return false;
  return true;
}

bool isBusFailure() { return consecutiveBusFailureCycles >= 3; }
float getAudioBaseline() { return audioBaseline; }
bool isAudioBaselineReady() { return audioBaselineReady; }

} // namespace SensorManager

String SensorData::toJson() const {
  String json = "{";
  json += "\"deviceId\":\"" + String(Config::deviceId) + "\",";
  json += "\"temperature\":" + String(temperature, 1) + ",";
  json += "\"humidity\":" + String(humidity, 1) + ",";
  json += "\"light_lux\":" + String(lightLux, 1) + ",";
  json += "\"nh3_ppm\":" + String(nh3Ppm, 1) + ",";
  json += "\"co2_ppm\":" + String(co2Ppm, 0) + ",";
  json += "\"sound_db\":" + String(soundDb, 1) + ",";
  json += "\"ts\":" + String(timestamp);
  json += "}";
  return json;
}
