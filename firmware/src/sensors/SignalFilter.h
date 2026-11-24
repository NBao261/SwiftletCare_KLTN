/**
 * SignalFilter – lọc nhiễu đầu vào bộ điều khiển mờ (ENV-FR-022)
 * Median 5 mẫu gần nhất (loại spike đơn lẻ) → Kalman vô hướng (làm mượt).
 * C++ thuần (không Arduino) để unit test trên host: pio test -e native.
 *
 * Chỉ dùng cho giá trị ĐƯA VÀO bộ điều khiển; telemetry/dashboard/phát hiện
 * cảm biến bất thường vẫn dùng giá trị thô (lọc sẽ che mất chính lỗi cần bắt).
 */
#pragma once

class SignalFilter {
public:
  /**
   * q = nhiễu quá trình, r = nhiễu đo. Hệ số Kalman ổn định chỉ phụ thuộc tỉ lệ
   * q/r nên dùng chung được cho mọi đơn vị (°C, %RH, ppm).
   * ponytail: q/r = 0.02 ở 1 mẫu/giây → hằng số thời gian ~7s, đủ nhanh so với
   * vòng điều khiển 10s; muốn mượt hơn thì giảm q (phản ứng chậm hơn).
   */
  explicit SignalFilter(float q = 0.01f, float r = 0.5f);

  /** Thêm 1 mẫu thô, trả giá trị đã lọc. Mẫu NaN (cảm biến lỗi) bị bỏ qua, giữ nguyên trạng thái. */
  float update(float measurement);
  float value() const { return _x; }
  bool ready() const { return _ready; }
  void reset();

private:
  static const int WINDOW = 5;
  float _window[WINDOW];
  int _count = 0;
  int _next = 0;
  float _q, _r;
  float _x = 0.0f; // ước lượng
  float _p = 0.0f; // phương sai ước lượng
  bool _ready = false;
};
