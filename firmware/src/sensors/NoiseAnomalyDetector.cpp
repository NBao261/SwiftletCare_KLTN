#include "NoiseAnomalyDetector.h"
#include <math.h>

static int countBits(uint16_t v) {
  int n = 0;
  for (; v; v &= v - 1) n++;
  return n;
}

bool NoiseAnomalyDetector::update(float db, bool speakerActive, int hour, const Tuning &tuning) {
  if (isnan(db)) return _active; // cảm biến lỗi ở mẫu này — giữ nguyên trạng thái

  if (speakerActive || !validHour(hour)) {
    _loudBits = 0;
    _active = false;
    return false;
  }

  // Kẹp lại ở đây: minLoud > WINDOW thì không bao giờ báo, ≤ EXIT_LOUD thì bật/tắt liên tục
  int minLoud = tuning.minLoud < EXIT_LOUD + 1 ? EXIT_LOUD + 1 : (tuning.minLoud > WINDOW ? WINDOW : tuning.minLoud);

  bool loud = ready(hour) && db > _baseline[hour] + tuning.marginDb;
  _loudBits = (uint16_t)(((_loudBits << 1) | (loud ? 1 : 0)) & ((1u << WINDOW) - 1));
  int loudCount = countBits(_loudBits);

  if (!_active && loudCount >= minLoud) _active = true;
  else if (_active && loudCount <= EXIT_LOUD) _active = false;

  // Học mức ồn thường gặp của giờ này = phân vị QUANTILE ước lượng trực tuyến:
  // mẫu cao hơn → nhích lên STEP·q, thấp hơn → nhích xuống STEP·(1−q); cân bằng khi
  // đúng (1−q) số mẫu vượt mức. Học CẢ mẫu ồn: nếu bỏ qua, một giờ học chưa tới
  // mức tiếng chim về tổ sẽ bị coi là "bất thường" mãi mãi và báo nhầm mỗi ngày.
  // Đổi lại lúc ồn bất thường thật mức chỉ nhích lên chậm (~1,6 dB/phút) rồi tự hạ.
  if (_samples[hour] == 0) _baseline[hour] = db;
  else if (db > _baseline[hour]) _baseline[hour] += STEP_DB * QUANTILE;
  else _baseline[hour] -= STEP_DB * (1.0f - QUANTILE);
  if (_samples[hour] < READY_SAMPLES) _samples[hour]++;
  return _active;
}
