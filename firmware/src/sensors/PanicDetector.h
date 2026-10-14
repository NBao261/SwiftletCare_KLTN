/**
 * PanicDetector – phát hiện chim hoảng loạn theo mức ồn (THREAT-FR-007, BIRD_PANIC)
 *
 * ES-NOISE-01 chỉ trả về mức dB (không có dạng sóng) nên KHÔNG phân loại được
 * tiếng chim bằng FFT/ML — chỉ phát hiện theo mẫu dB: ồn vượt mức nền ≥ RISE_DB
 * trong phần lớn cửa sổ ~15 giây. C++ thuần, gọi 1 lần/mẫu (1 Hz).
 *
 * Mức nền RIÊNG CHO TỪNG GIỜ TRONG NGÀY (24 mức): nhà yến có giờ vốn ồn tự nhiên
 * (chim ra tổ lúc sáng, về tổ lúc chiều tối) — so với nền chung cả ngày thì giờ
 * đó bị báo nhầm. Mỗi giờ tự học "mức ồn thường gặp" = phân vị 90 (mức mà 90%
 * thời gian của giờ đó không vượt) qua các ngày — dùng phân vị chứ không dùng
 * trung bình vì 1 giờ có thể nửa yên nửa ồn (chim về lúc 17h30): trung bình sẽ
 * nằm giữa và vẫn báo nhầm lúc chim về. Không cần cấu hình khung giờ chim ra/vào,
 * vẫn đúng khi đổi lịch loa ru.
 *
 * Chống báo nhầm:
 * - Nền chỉ học khi loa tắt → loa ru không kéo nền lên; lúc chim hoảng thật
 *   nền chỉ nhích lên chậm (bước nhỏ) nên vẫn kịp báo.
 * - Giờ chưa học đủ (≥ READY_SAMPLES mẫu ≈ 1 giờ quan sát) hoặc chưa biết giờ
 *   (NTP chưa đồng bộ) → không đánh giá.
 * - Loa đang phát (lịch ru, nghe thử, bật tay) → không đánh giá, xoá đếm.
 * - Cần ≥ 10/15 mẫu ồn mới báo (1 tiếng động ngắn không đủ), thoát khi ≤ 3/15.
 *
 * ponytail: mức nền nằm trong RAM — khởi động lại (mất điện/OTA) phải học lại
 * ~1 ngày; nếu thấy mất điện thường xuyên thì lưu 24 mức vào NVS mỗi giờ.
 */
#pragma once
#include <stdint.h>

class PanicDetector {
public:
  /** Thêm 1 mẫu dB; hour = giờ địa phương 0..23, -1 nếu chưa biết giờ. Trả về đang-hoảng hay không. */
  bool update(float db, bool speakerActive, int hour);
  bool active() const { return _active; }
  bool ready(int hour) const { return validHour(hour) && _samples[hour] >= READY_SAMPLES; }
  float baseline(int hour) const { return validHour(hour) ? _baseline[hour] : 0.0f; }

  // ponytail: ngưỡng chọn theo cảm quan (+15 dB ≈ ồn gấp ~5 lần); cần ghi âm/đo
  // lúc chim hoảng thật để chỉnh — đổi ở đây, không cần đụng logic.
  static constexpr float RISE_DB = 15.0f;
  static constexpr float QUANTILE = 0.9f;
  /** Bước ước lượng phân vị (dB/mẫu): lên 0,027 · xuống 0,003. Cả giờ yên tĩnh chỉ kéo
   *  mức xuống ~11 dB < RISE_DB → tiếng chim về tổ đã học không bị báo nhầm; ~15 phút
   *  chim ra/vào trong ngày đầu đủ nâng mức lên ~24 dB. */
  static constexpr float STEP_DB = 0.03f;
  static const uint32_t READY_SAMPLES = 3600; // ≈ 1 giờ quan sát của giờ đó
  static const int WINDOW = 15;
  static const int ENTER_LOUD = 10;
  static const int EXIT_LOUD = 3;

private:
  static bool validHour(int hour) { return hour >= 0 && hour < 24; }
  float _baseline[24] = {0};
  uint32_t _samples[24] = {0};
  uint16_t _loudBits = 0; // 1 bit / mẫu, WINDOW mẫu gần nhất
  bool _active = false;
};
