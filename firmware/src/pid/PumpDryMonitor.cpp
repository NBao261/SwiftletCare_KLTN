#include "PumpDryMonitor.h"

void PumpDryMonitor::startBlock(float humidity) {
  _blocked = false;
  _onMs = 0;
  _blockStartHumidity = humidity;
}

bool PumpDryMonitor::update(bool sensorOk, bool demand, bool manual, bool relayOn, float humidity,
                            uint32_t nowMs, uint32_t onMs, float minRise, uint32_t retryMs) {
  bool fired = false;

  if (!sensorOk) {
    // Không có số đo: không biết còn nhu cầu hay không — giữ nguyên, không cộng dồn
  } else if (!demand) {
    _active = false;
    _blocked = false;
  } else if (!_active || manual != _manual) {
    _active = true;
    startBlock(humidity);
  } else if (_blocked) {
    // Thử lại sau retryMs: báo nhầm thì phun sương tự hồi phục, khô thật thì bị chốt lại
    if (nowMs - _blockedSinceMs >= retryMs) startBlock(humidity);
  } else {
    // Relay giữ nguyên trạng thái giữa 2 chu kỳ: khoảng vừa qua tính là BẬT nếu chu kỳ trước BẬT
    if (_wasOn) _onMs += nowMs - _lastMs;
    if (_onMs > onMs) {
      if (humidity <= _blockStartHumidity + minRise) {
        _blocked = true;
        _blockedSinceMs = nowMs;
        fired = true;
      }
      _onMs = 0;
      _blockStartHumidity = humidity;
    }
  }

  if (sensorOk) _manual = manual;
  _wasOn = relayOn;
  _lastMs = nowMs;
  return fired;
}
