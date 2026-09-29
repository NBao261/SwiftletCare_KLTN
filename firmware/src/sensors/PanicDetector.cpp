#include "PanicDetector.h"
#include <math.h>

static int countBits(uint16_t v) {
  int n = 0;
  for (; v; v &= v - 1) n++;
  return n;
}

bool PanicDetector::update(float db, bool speakerActive) {
  if (isnan(db)) return _active; // cảm biến lỗi ở mẫu này — giữ nguyên trạng thái

  if (speakerActive) {
    _loudBits = 0;
    _active = false;
    return false;
  }

  bool loud = ready() && db > _baseline + RISE_DB;
  _loudBits = (uint16_t)(((_loudBits << 1) | (loud ? 1 : 0)) & ((1u << WINDOW) - 1));
  int loudCount = countBits(_loudBits);

  if (!_active && loudCount >= ENTER_LOUD) _active = true;
  else if (_active && loudCount <= EXIT_LOUD) _active = false;

  if (!loud && !_active) {
    _baseline = _baselineSamples == 0 ? db : _baseline + BASELINE_ALPHA * (db - _baseline);
    _baselineSamples++;
  }
  return _active;
}
