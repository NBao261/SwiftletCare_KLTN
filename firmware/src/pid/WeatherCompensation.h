/**
 * WeatherCompensation – offset phun sương theo dự báo thời tiết (ENV-FR-029, BR-38, Report 3 §6.24)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Backend gửi offset (điểm % của nhu cầu phun) kèm hạn trên topic retained `compensation`. Hạn đổi ngay lúc
 * nhận thành thời lượng theo millis() nên lệch đồng hồ NTP về sau không kéo dài offset, và so bằng
 * `now - receivedMs < durationMs` nên vẫn đúng khi millis() tràn. Offset chỉ cộng vào nhu cầu tự động của
 * bộ mờ: can thiệp tay, quạt và chốt bơm khô không đổi.
 */
#pragma once
#include <stdint.h>

/** BR-38 — khớp backend `WEATHER_COMP_MAX_PCT` / `WEATHER_COMP_MAX_MS` (utils/weatherCompensation.util.ts) */
static const float WEATHER_COMP_MAX_PCT = 10.0f;
static const uint32_t WEATHER_COMP_MAX_MS = 2UL * 3600UL * 1000UL;
/** BR-38 — mất broker quá 2 giờ thì offset về 0 (Report 3 §4.5) */
static const uint32_t WEATHER_COMP_OFFLINE_MS = 2UL * 3600UL * 1000UL;

class WeatherCompensation {
public:
  /**
   * Tin `compensation` mới (thay tin cũ). nowEpochMs = 0 khi chưa đồng bộ NTP: không biết còn hạn bao lâu nên
   * offset về 0. offsetPct bị kẹp về ±WEATHER_COMP_MAX_PCT, thời hạn về WEATHER_COMP_MAX_MS.
   */
  void receive(float offsetPct, uint64_t expiresAtEpochMs, uint64_t nowEpochMs, uint32_t nowMs);
  /** Offset đang có hiệu lực (điểm %); gọi mỗi chu kỳ điều khiển, brokerConnected để đếm thời gian mất broker */
  float current(uint32_t nowMs, bool brokerConnected);
  /** Nhu cầu phun 0..1 cộng offset (điểm %), kẹp trong 0..1 */
  static float apply(float duty, float offsetPct);

private:
  float offsetPct_ = 0.0f;
  uint32_t receivedMs_ = 0;
  uint32_t durationMs_ = 0;
  uint32_t lastConnectedMs_ = 0;
};
