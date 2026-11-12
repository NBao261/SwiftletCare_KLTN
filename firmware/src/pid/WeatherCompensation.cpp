#include "WeatherCompensation.h"
#include <math.h>

static float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

void WeatherCompensation::receive(float offsetPct, uint64_t expiresAtEpochMs, uint64_t nowEpochMs, uint32_t nowMs) {
  offsetPct_ = 0.0f;
  durationMs_ = 0;
  if (!isfinite(offsetPct) || nowEpochMs == 0 || expiresAtEpochMs <= nowEpochMs) return;
  uint64_t remaining = expiresAtEpochMs - nowEpochMs;
  offsetPct_ = clampf(offsetPct, -WEATHER_COMP_MAX_PCT, WEATHER_COMP_MAX_PCT);
  durationMs_ = remaining > WEATHER_COMP_MAX_MS ? WEATHER_COMP_MAX_MS : (uint32_t)remaining;
  receivedMs_ = nowMs;
  lastConnectedMs_ = nowMs; // tin vừa tới qua broker
}

float WeatherCompensation::current(uint32_t nowMs, bool brokerConnected) {
  if (brokerConnected) lastConnectedMs_ = nowMs;
  if (offsetPct_ == 0.0f) return 0.0f;
  bool expired = nowMs - receivedMs_ >= durationMs_;
  bool offlineTooLong = !brokerConnected && nowMs - lastConnectedMs_ >= WEATHER_COMP_OFFLINE_MS;
  if (expired || offlineTooLong) {
    offsetPct_ = 0.0f; // SM-24: ACTIVE → NONE
    return 0.0f;
  }
  return offsetPct_;
}

float WeatherCompensation::apply(float duty, float offsetPct) { return clampf(duty + offsetPct / 100.0f, 0.0f, 1.0f); }
