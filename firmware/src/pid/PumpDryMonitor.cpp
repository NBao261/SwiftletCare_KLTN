#include "PumpDryMonitor.h"
#include <math.h>

bool PumpDryMonitor::update(bool demand, bool manual, bool relayOn, float humidity, uint32_t nowMs,
                            uint32_t onMs, float minRise) {
  bool fired = false;
  bool newSession = !_active || manual != _manual;

  if (!demand) {
    _active = false;
    _blocked = false;
  } else if (isnan(humidity)) {
    // Không có số đo để so — giữ nguyên trạng thái, không cộng dồn
  } else if (newSession) {
    _active = true;
    _blocked = false;
    _onMs = 0;
    _blockStartHumidity = humidity;
  } else {
    // Relay giữ nguyên trạng thái giữa 2 chu kỳ: khoảng vừa qua tính là BẬT nếu chu kỳ trước BẬT
    if (_wasOn) _onMs += nowMs - _lastMs;
    if (_onMs > onMs) {
      if (!_blocked && humidity <= _blockStartHumidity + minRise) {
        _blocked = true;
        fired = true;
      }
      _onMs = 0;
      _blockStartHumidity = humidity;
    }
  }

  _manual = manual;
  _wasOn = relayOn;
  _lastMs = nowMs;
  return fired;
}
