#include "CurrentSensor.h"
#include "../config/Config.h"
#include <Adafruit_ADS1X15.h>
#include <Wire.h>

namespace {
Adafruit_ADS1115 ads;
bool found = false;

/**
 * Điện áp shunt → dòng. Đo một chiều phía âm nên số âm chỉ là nhiễu quanh 0: kẹp về 0 (backend cũng
 * không lưu dòng âm). Thang ±0,512 V trên 0,1 Ω là tối đa 5,12 A, bước 15,6 µV ≈ 0,16 mA — đủ cho bơm 5 V
 * và quạt 12 V của tải demo một chiều (Report 3 §8.1).
 */
float shuntAmps(int16_t raw) {
  float amps = ads.computeVolts(raw) / CURRENT_SHUNT_OHM;
  return amps > 0 ? amps : 0;
}
} // namespace

namespace CurrentSensor {

bool begin() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  found = ads.begin(CURRENT_ADC_ADDR, &Wire);
  if (found) ads.setGain(GAIN_EIGHT); // ±0,512 V
  Serial.println(found ? "[CURRENT] ADS1115 OK — đo dòng bơm và quạt"
                       : "[CURRENT] Không có ADS1115 — không đo dòng (THREAT-FR-014 tắt)");
  return found;
}

bool present() { return found; }

Reading read() {
  Reading reading;
  if (!found) return reading;
  reading.mistingA = shuntAmps(ads.readADC_Differential_0_1());
  reading.ventilationA = shuntAmps(ads.readADC_Differential_2_3());
  reading.ok = true;
  return reading;
}

} // namespace CurrentSensor
