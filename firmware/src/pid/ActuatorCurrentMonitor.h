/**
 * ActuatorCurrentMonitor – tải (bơm phun sương, quạt) có chạy theo relay không (THREAT-FR-014, BR-32)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native.
 * Mỗi tải một đối tượng; SensorTask gọi update() mỗi lần đọc dòng từ ADS1115 (Report 4 §5.1).
 *
 * Học dòng bình thường: trung bình dòng trong 30 giây đầu của một lần relay BẬT liên tục (BR-32).
 * Lần BẬT ngắn hơn thì bỏ phần đã đo và chờ lần BẬT sau, để không lấy dòng khởi động làm mức
 * bình thường. Chưa học xong thì không xét lỗi (chưa có mức để so).
 *
 * Báo lỗi khi tải không theo relay đủ 30 giây (BR-32):
 * - relay BẬT mà dòng dưới 50 % mức bình thường: motor cháy, aptomat nhảy, đứt dây, công tắc riêng
 *   của nhà bị tắt;
 * - relay TẮT mà dòng trên 20 % mức bình thường: relay dính, hoặc tải được bật bằng công tắc khác.
 * Thời gian chỉ cộng khi relay đang ở đúng trạng thái đó: bộ mờ bật tắt bơm theo chu kỳ, nên
 * "liên tục 30 giây" tính trên thời gian BẬT (hoặc TẮT) cộng dồn, không bị chu kỳ cắt về 0.
 * Lỗi đóng khi tải chạy đúng theo relay đủ 30 giây (THREAT-FR-014), đếm cùng cách.
 *
 * Mất số đo dòng (`currentOk = false`) không phải là "không có dòng": giữ nguyên mọi trạng thái,
 * không cộng thời gian, như PumpDryMonitor với số đo độ ẩm.
 */
#pragma once
#include <stdint.h>

class ActuatorCurrentMonitor {
public:
  /** Report 3 §4.5 (A-4), BR-32 */
  static constexpr uint32_t LEARN_MS = 30000;
  static constexpr uint32_t HOLD_MS = 30000;
  static constexpr float ON_MIN_RATIO = 0.5f;
  static constexpr float OFF_MAX_RATIO = 0.2f;

  enum class Fault : uint8_t { NONE = 0, NO_CURRENT_WHILE_ON, CURRENT_WHILE_OFF };

  /**
   * Gọi mỗi lần đọc dòng.
   * @param relayOn   relay của tải đang BẬT
   * @param currentOk có số đo dòng hợp lệ ở lần đọc này
   * @param currentA  dòng đo được (A); bỏ qua khi currentOk = false
   * @return true khi fault() vừa đổi (vừa báo lỗi, hoặc lỗi vừa hết) — người gọi gửi hoặc dừng cảnh báo
   */
  bool update(bool relayOn, bool currentOk, float currentA, uint32_t nowMs);

  /** Học lại từ lần BẬT tới: sau khi thay tải hoặc khi được yêu cầu (THREAT-FR-014). Lỗi đang có được xoá. */
  void relearn();
  /** Khôi phục mức đã học (đọc từ NVS lúc khởi động); giá trị ≤ 0 nghĩa là chưa học */
  void setNormal(float normalA);

  bool learned() const { return _normalA > 0; }
  float normalA() const { return _normalA; }
  Fault fault() const { return _fault; }

private:
  void resetTimers();

  float _normalA = 0;
  Fault _fault = Fault::NONE;

  // Học: tổng và số mẫu của lần BẬT hiện tại, tính từ lúc BẬT
  bool _learning = false;
  uint32_t _learnSinceMs = 0;
  float _learnSum = 0;
  uint32_t _learnSamples = 0;

  // Thời gian cộng dồn của mỗi điều kiện (BR-32), chỉ cộng khi relay ở đúng trạng thái
  uint32_t _onBadMs = 0, _onGoodMs = 0, _offBadMs = 0, _offGoodMs = 0;

  bool _hasLast = false;
  bool _lastOn = false;
  uint32_t _lastMs = 0;
};
