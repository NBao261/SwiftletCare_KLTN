#include "PanicDetector.h"
#include <math.h>

static int countBits(uint16_t v) {
  int n = 0;
  for (; v; v &= v - 1) n++;
  return n;
}

bool PanicDetector::update(float db, bool speakerActive, int hour) {
  if (isnan(db)) return _active; // cảm biến lỗi ở mẫu này — giữ nguyên trạng thái

  if (speakerActive || !validHour(hour)) {
    _loudBits = 0;
    _active = false;
    return false;
  }

  bool loud = ready(hour) && db > _baseline[hour] + RISE_DB;
  _loudBits = (uint16_t)(((_loudBits << 1) | (loud ? 1 : 0)) & ((1u << WINDOW) - 1));
  int loudCount = countBits(_loudBits);

  if (!_active && loudCount >= ENTER_LOUD) _active = true;
  else if (_active && loudCount <= EXIT_LOUD) _active = false;

  // Học mức ồn thường gặp của giờ này = phân vị QUANTILE ước lượng trực tuyến:
  // mẫu cao hơn → nhích lên STEP·q, thấp hơn → nhích xuống STEP·(1−q); cân bằng khi
  // đúng (1−q) số mẫu vượt mức. Học CẢ mẫu ồn: nếu bỏ qua, một giờ học chưa tới
  // mức tiếng chim về tổ sẽ bị coi là "bất thường" mãi mãi và báo nhầm mỗi ngày.
  // Đổi lại lúc chim hoảng thật mức chỉ nhích lên chậm (~1,6 dB/phút) rồi tự hạ.
  if (_samples[hour] == 0) _baseline[hour] = db;
  else if (db > _baseline[hour]) _baseline[hour] += STEP_DB * QUANTILE;
  else _baseline[hour] -= STEP_DB * (1.0f - QUANTILE);
  if (_samples[hour] < READY_SAMPLES) _samples[hour]++;
  return _active;
}
