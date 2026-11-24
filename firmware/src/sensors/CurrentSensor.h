/**
 * CurrentSensor – dòng của bơm phun sương và quạt qua ADS1115 (THREAT-FR-014, Report 4 §5.1)
 *
 * Board rev B2: shunt 0,1 Ω phía âm mỗi tải, đo vi sai AIN0–AIN1 (bơm) và AIN2–AIN3 (quạt). Board không
 * gắn ADS1115 (bo dev hiện tại) thì begin() trả false và mọi lần đọc là không có số đo: không xét
 * ACTUATOR_FAULT, telemetry không gửi dòng.
 */
#pragma once

namespace CurrentSensor {
struct Reading {
  bool ok = false;          // đọc được cả hai kênh ở lần này
  float mistingA = 0;       // dòng bơm phun sương (A)
  float ventilationA = 0;   // dòng quạt (A)
};

/** Gọi 1 lần trong setup(); false khi không thấy ADS1115 trên I2C */
bool begin();
bool present();
/** Đọc hai kênh (khoảng 20 ms), gọi từ SensorTask */
Reading read();
} // namespace CurrentSensor
