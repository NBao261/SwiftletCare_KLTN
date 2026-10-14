/**
 * FuzzyControl.cpp – Sugeno bậc 0: mỗi luật cho 1 hằng số đầu ra, giải mờ bằng
 * trung bình có trọng số Σ(wᵢ·zᵢ) / Σwᵢ (wᵢ = độ kích hoạt luật, VÀ = min).
 * Điểm gãy hàm thuộc là offset quanh ngưỡng Config, co giãn theo Tuning
 * (độ rộng vùng độ ẩm/nhiệt độ) — cả ngưỡng lẫn Tuning chỉnh được qua MQTT
 * config/update, không cần nạp lại firmware. Hiệu chỉnh bằng dữ liệu nhà yến
 * thật: trang Analytics → "Hiệu quả điều khiển".
 */
#include "FuzzyControl.h"
#include <math.h>

namespace FuzzyControl {

float rampDown(float x, float a, float b) {
  if (x <= a) return 1.0f;
  if (x >= b) return 0.0f;
  return (b - x) / (b - a);
}

float rampUp(float x, float a, float b) { return 1.0f - rampDown(x, a, b); }

float tri(float x, float a, float b, float c) {
  if (x <= a || x >= c) return 0.0f;
  return x <= b ? (x - a) / (b - a) : (c - x) / (c - b);
}

static float humidityLow(float h, float hMin, float s) { return rampDown(h, hMin - 5.0f * s, hMin + 3.0f * s); }
static float isHot(float t, float tMax, float k) { return rampUp(t, tMax - 3.0f * k, tMax + k); }

// Σ(w·z) / Σw — không luật nào kích hoạt thì coi như không có nhu cầu.
static float defuzzify(const float *w, const float *z, int n) {
  float num = 0, den = 0;
  for (int i = 0; i < n; i++) {
    num += w[i] * z[i];
    den += w[i];
  }
  return den > 0 ? num / den : 0.0f;
}

bool inputsValid(float temperature, float humidity) {
  return isfinite(temperature) && isfinite(humidity) && temperature >= -40.0f && temperature <= 80.0f &&
         humidity >= 0.0f && humidity <= HUMIDITY_SATURATION_MAX;
}

float mistingDemand(float humidity, float temperature, float hMin, float hMax, float tMax,
                    const Tuning &tuning) {
  if (!inputsValid(temperature, humidity)) return 0.0f;
  float s = tuning.humidityBand / 8.0f;
  float low = humidityLow(humidity, hMin, s);
  float mid = tri(humidity, hMin - 3.0f * s, hMin + 5.0f * s, hMin + 13.0f * s);
  float high = rampUp(humidity, hMax - 10.0f, hMax);
  float hot = isHot(temperature, tMax, tuning.tempBand / 4.0f);

  const float w[] = {low, fminf(mid, hot), fminf(mid, 1.0f - hot), high};
  const float z[] = {1.0f, 0.5f, 0.0f, 0.0f};
  return defuzzify(w, z, 4);
}

float ventilationDemand(float temperature, float humidity, float tMax, float hMin,
                        const Tuning &tuning) {
  if (!inputsValid(temperature, humidity)) return 0.0f;
  float hot = isHot(temperature, tMax, tuning.tempBand / 4.0f);
  float dry = humidityLow(humidity, hMin, tuning.humidityBand / 8.0f);

  const float w[] = {fminf(hot, 1.0f - dry), fminf(hot, dry), 1.0f - hot};
  const float z[] = {1.0f, tuning.fanDryLevel, 0.0f};
  return defuzzify(w, z, 3);
}

bool timeProportionalOn(float duty, uint32_t nowMs, uint32_t windowMs, uint32_t phaseMs) {
  if (duty <= 0.0f) return false;
  if (duty >= 1.0f) return true;
  return (nowMs + phaseMs) % windowMs < (uint32_t)(duty * windowMs);
}

} // namespace FuzzyControl
