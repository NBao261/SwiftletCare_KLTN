/**
 * SensorManager.cpp – Read all sensors (Wokwi-compatible)
 *
 * Wokwi simulation mapping:
 *   SHT31 (I2C)  → DHT22 #1 on PIN_SHT31_SIM (GPIO13)
 *   DHT22 (outdoor) → DHT22 #2 on PIN_DHT22 (GPIO4)
 *   BH1750 (I2C) → Photoresistor analog on PIN_BH1750_AO (GPIO32)
 *   MQ-135       → Slide potentiometer on PIN_MQ135 (GPIO34)
 *   MAX9814      → Slide potentiometer on PIN_MAX9814 (GPIO35)
 *
 * SRS: ENV-FR-001, ENV-FR-003
 */
#include "SensorManager.h"
#include "config/Config.h"
#include <DHT.h>
#include <cmath>

static DHT sht31Sim(PIN_SHT31_SIM, DHT22); // Indoor (simulates SHT31)
static DHT dht22(PIN_DHT22, DHT22);        // Outdoor

// Audio baseline tracking (THREAT-FR-006)
static float audioBaseline = 0;
static float audioSamples[300]; // 5-min window at 1 sample/s
static int audioIdx = 0;
static bool baselineReady = false;

namespace SensorManager {

void begin() {
  sht31Sim.begin();
  dht22.begin();
  pinMode(PIN_BH1750_AO, INPUT);
  pinMode(PIN_MQ135, INPUT);
  pinMode(PIN_MAX9814, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  Serial.println("[Sensors] All initialized (Wokwi mode)");
}

SensorData readAll() {
  SensorData d;
  d.timestamp = millis();

  // ── Indoor T+H (SHT31 simulated by DHT22 #1) ─────────────────────────
  d.temperature = sht31Sim.readTemperature();
  d.humidity = sht31Sim.readHumidity();

  // ── Outdoor T+H (DHT22 #2) ───────────────────────────────────────────
  d.tempOutdoor = dht22.readTemperature();
  d.humidOutdoor = dht22.readHumidity();

  // ── Light (BH1750 simulated by photoresistor analog) ──────────────────
  int lightRaw = analogRead(PIN_BH1750_AO);
  // Map 0-4095 → 0-65535 lux (BH1750 range)
  d.lightLux = (float)lightRaw * 65535.0f / 4095.0f;

  // ── Gas/CO2 (MQ-135 potentiometer) ────────────────────────────────────
  int mqRaw = analogRead(PIN_MQ135);
  // Map 0-4095 → 400-5000 ppm
  d.co2Ppm = 400.0f + ((float)mqRaw / 4095.0f) * 4600.0f;

  // ── Sound (MAX9814 potentiometer) ─────────────────────────────────────
  int sndRaw = analogRead(PIN_MAX9814);
  // Map 0-4095 → 30-120 dB
  d.soundDb = 30.0f + ((float)sndRaw / 4095.0f) * 90.0f;

  // ── Audio baseline tracking (THREAT-FR-006) ──────────────────────────
  audioSamples[audioIdx % 300] = d.soundDb;
  audioIdx++;
  if (audioIdx >= 300) {
    baselineReady = true;
    float sum = 0;
    for (int i = 0; i < 300; i++)
      sum += audioSamples[i];
    audioBaseline = sum / 300.0f;
  }

  // Check speaker failure: amplitude drop > 70%
  if (baselineReady && audioBaseline > 0) {
    float dropRatio = d.soundDb / audioBaseline;
    if (dropRatio < (1.0f - AUDIO_DROP_THRESHOLD)) {
      d.speakerAlert = true;
      Serial.println(
          "[THREAT] SPEAKER_FAILURE detected! dB=" + String(d.soundDb, 1) +
          " baseline=" + String(audioBaseline, 1));
    }
  }

  // Check bird panic: sudden spike
  if (d.soundDb > 100.0f) {
    d.panicAlert = true;
    Serial.println("[THREAT] BIRD_PANIC detected! dB=" + String(d.soundDb, 1));
  }

  d.isValid = validateRange(d);

  // ── Serial output ────────────────────────────────────────────────────
  Serial.println("────────── Sensor Reading ──────────");
  Serial.println("  Indoor  T: " + String(d.temperature, 1) +
                 "°C  H: " + String(d.humidity, 1) + "%");
  Serial.println("  Outdoor T: " + String(d.tempOutdoor, 1) +
                 "°C  H: " + String(d.humidOutdoor, 1) + "%");
  Serial.println("  Light: " + String(d.lightLux, 1) + " lux");
  Serial.println("  CO2:   " + String(d.co2Ppm, 0) + " ppm");
  Serial.println("  Sound: " + String(d.soundDb, 1) + " dB");
  Serial.println("────────────────────────────────────");

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
} // namespace SensorManager

String SensorData::toJson() const {
  String json = "{";
  json += "\"temperature\":" + String(temperature, 1) + ",";
  json += "\"humidity\":" + String(humidity, 1) + ",";
  json += "\"light_lux\":" + String(lightLux, 1) + ",";
  json += "\"co2_ppm\":" + String(co2Ppm, 0) + ",";
  json += "\"sound_db\":" + String(soundDb, 1) + ",";
  json += "\"temp_outdoor\":" + String(tempOutdoor, 1) + ",";
  json += "\"hum_outdoor\":" + String(humidOutdoor, 1) + ",";
  json += "\"speaker_alert\":" + String(speakerAlert ? "true" : "false") + ",";
  json += "\"panic_alert\":" + String(panicAlert ? "true" : "false") + ",";
  json += "\"ts\":" + String(timestamp);
  json += "}";
  return json;
}
