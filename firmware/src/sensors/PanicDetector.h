/**
 * PanicDetector – phát hiện chim hoảng loạn theo mức ồn (THREAT-FR-007, BIRD_PANIC)
 *
 * ES-NOISE-01 chỉ trả về mức dB (không có dạng sóng) nên KHÔNG phân loại được
 * tiếng chim bằng FFT/ML — chỉ phát hiện theo mẫu dB: ồn vượt nền yên tĩnh
 * ≥ RISE_DB trong phần lớn cửa sổ ~15 giây. C++ thuần, gọi 1 lần/mẫu (1 Hz).
 *
 * Chống báo nhầm:
 * - Nền là EWMA chậm, CHỈ cập nhật khi loa tắt và không đang ồn → loa ru và
 *   chính lúc chim hoảng không kéo nền lên.
 * - Loa đang phát (lịch ru hoặc nghe thử) → không đánh giá, xoá đếm.
 * - Cần ≥ 10/15 mẫu ồn mới báo (1 tiếng động ngắn không đủ), thoát khi ≤ 3/15.
 */
#pragma once
#include <stdint.h>

class PanicDetector {
public:
  /** Thêm 1 mẫu dB; trả về đang-hoảng hay không (main.cpp báo theo cạnh lên). */
  bool update(float db, bool speakerActive);
  bool active() const { return _active; }
  bool ready() const { return _baselineSamples >= MIN_BASELINE_SAMPLES; }
  float baseline() const { return _baseline; }

  // ponytail: ngưỡng chọn theo cảm quan (+15 dB ≈ ồn gấp ~5 lần); cần ghi âm/đo
  // lúc chim hoảng thật để chỉnh — đổi ở đây, không cần đụng logic.
  static constexpr float RISE_DB = 15.0f;
  static constexpr float BASELINE_ALPHA = 0.01f; // ~100 mẫu ≈ 100 giây
  static const int MIN_BASELINE_SAMPLES = 60;
  static const int WINDOW = 15;
  static const int ENTER_LOUD = 10;
  static const int EXIT_LOUD = 3;

private:
  float _baseline = 0.0f;
  int _baselineSamples = 0;
  uint16_t _loudBits = 0; // 1 bit / mẫu, WINDOW mẫu gần nhất
  bool _active = false;
};
