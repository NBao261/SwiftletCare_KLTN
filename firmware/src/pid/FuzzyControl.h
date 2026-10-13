/**
 * FuzzyControl – Bộ điều khiển logic mờ Sugeno bậc 0 cho phun sương + quạt
 * SRS: ENV-FR-010, ENV-FR-011 (v2.0.0: quạt chỉ theo nhiệt độ + độ ẩm), THREAT-FR-013
 *
 * C++ thuần (không include Arduino) để chạy được unit test trên host:
 *   pio test -e native   (firmware/test/test_fuzzy)
 *
 * Mỗi hàm *Demand() trả về nhu cầu 0..1 (% công suất). Relay chỉ bật/tắt
 * được nên % được đổi thành tỉ lệ thời gian BẬT trong 1 cửa sổ cố định
 * (time-proportioning) bằng timeProportionalOn().
 */
#pragma once
#include <stdint.h>

namespace FuzzyControl {

/**
 * Hệ số chỉnh được lúc chạy qua MQTT config/update (fuzzy_humidity_band,
 * fuzzy_temp_band, fuzzy_fan_dry_level — xem Config.h). Giá trị mặc định cho
 * ra đúng các điểm gãy gốc (−5/+3 %RH, −3/+1 °C, quạt 40%).
 */
struct Tuning {
  float humidityBand = 8.0f; // %RH — độ rộng vùng chuyển tiếp độ ẩm (điểm gãy × band/8)
  float tempBand = 4.0f;     // °C — độ rộng vùng "nóng" (điểm gãy × band/4)
  float fanDryLevel = 0.4f;  // 0..1 — mức quạt khi nóng mà khô
};

// ── Hàm thuộc (membership functions), giá trị 0..1 ────────────────────────────
float rampDown(float x, float a, float b); // 1 khi x <= a, giảm tuyến tính về 0 tại b
float rampUp(float x, float a, float b);   // 0 khi x <= a, tăng tuyến tính lên 1 tại b
float tri(float x, float a, float b, float c); // tam giác: 0 tại a, đỉnh 1 tại b, 0 tại c

/**
 * THREAT-FR-013 — trạng thái an toàn: nhiệt độ/độ ẩm phải là số hữu hạn trong
 * dải vật lý của cảm biến (−40..80 °C, 0..100 %RH). Không hợp lệ (cảm biến
 * timeout → NAN, giá trị rác) thì mistingDemand()/ventilationDemand() trả 0
 * → relay phun sương và quạt TẮT cho tới khi có số đo hợp lệ trở lại.
 */
bool inputsValid(float temperature, float humidity);

/**
 * Nhu cầu phun sương theo độ ẩm + nhiệt độ (s = humidityBand/8, k = tempBand/4;
 * với Tuning mặc định s = k = 1).
 *   Ẩm THẤP  = rampDown(h, hMin-5s, hMin+3s)
 *   Ẩm VỪA   = tri(h, hMin-3s, hMin+5s, hMin+13s)
 *   Ẩm CAO   = rampUp(h, hMax-10, hMax)
 *   NÓNG     = rampUp(t, tMax-3k, tMax+k)
 * Luật: THẤP → 1.0 | VỪA ∧ NÓNG → 0.5 | VỪA ∧ ¬NÓNG → 0 | CAO → 0
 */
float mistingDemand(float humidity, float temperature, float hMin, float hMax, float tMax,
                    const Tuning &tuning = Tuning());

/**
 * Nhu cầu thông gió theo nhiệt độ + độ ẩm (KHÔ = Ẩm THẤP ở trên).
 * Luật: NÓNG ∧ ¬KHÔ → 1.0 | NÓNG ∧ KHÔ → fanDryLevel (0.4) | ¬NÓNG → 0
 * NH3/CO2 KHÔNG tham gia (SRS v2.0.0): chưa có giới hạn nào được xác lập cho
 * nhà yến nên hai chỉ số này chỉ theo dõi + cảnh báo ở backend (ALERT-FR-012).
 */
float ventilationDemand(float temperature, float humidity, float tMax, float hMin,
                        const Tuning &tuning = Tuning());

/**
 * Time-proportioning: relay BẬT trong `duty` phần đầu của mỗi cửa sổ
 * `windowMs`, lệch pha `phaseMs` (để 2 relay không cùng bật một lúc).
 * ponytail: vòng PID chạy mỗi PID_INTERVAL_MS (10s) nên thời gian BẬT bị làm
 * tròn theo bước 10s (≈8% với cửa sổ 120s) — cần mịn hơn thì chạy vòng này
 * nhanh hơn hoặc dùng timer riêng cho relay.
 */
bool timeProportionalOn(float duty, uint32_t nowMs, uint32_t windowMs, uint32_t phaseMs);

} // namespace FuzzyControl
