#include "ActuatorCurrentMonitor.h"

void ActuatorCurrentMonitor::resetTimers() {
  _onBadMs = _onGoodMs = _offBadMs = _offGoodMs = 0;
}

void ActuatorCurrentMonitor::relearn() {
  _normalA = 0;
  _fault = Fault::NONE;
  _learning = false;
  resetTimers();
}

void ActuatorCurrentMonitor::setNormal(float normalA) {
  _normalA = normalA > 0 ? normalA : 0;
  _learning = false;
  resetTimers();
}

bool ActuatorCurrentMonitor::update(bool relayOn, bool currentOk, float currentA, uint32_t nowMs) {
  // Khoảng vừa qua tính theo trạng thái relay ở lần đọc trước, như PumpDryMonitor
  uint32_t dt = _hasLast ? nowMs - _lastMs : 0;
  bool wasOn = _lastOn;
  _hasLast = true;
  _lastOn = relayOn;
  _lastMs = nowMs;
  if (!currentOk) return false;

  if (!learned()) {
    if (!relayOn) {
      _learning = false;  // lần BẬT ngắn hơn LEARN_MS: chờ lần sau
      return false;
    }
    if (!_learning) {
      _learning = true;
      _learnSinceMs = nowMs;
      _learnSum = 0;
      _learnSamples = 0;
    }
    _learnSum += currentA;
    _learnSamples++;
    if (nowMs - _learnSinceMs >= LEARN_MS) {
      float mean = _learnSum / _learnSamples;
      _learning = false;
      if (mean > 0) _normalA = mean;
      resetTimers();
    }
    return false;
  }

  // Chỉ cộng khi relay giữ nguyên trạng thái giữa 2 lần đọc: lúc vừa đổi, dòng còn đang lên hoặc xuống
  if (relayOn == wasOn) {
    if (relayOn) {
      bool bad = currentA < ON_MIN_RATIO * _normalA;
      if (bad) { _onBadMs += dt; _onGoodMs = 0; } else { _onGoodMs += dt; _onBadMs = 0; }
    } else {
      bool bad = currentA > OFF_MAX_RATIO * _normalA;
      if (bad) { _offBadMs += dt; _offGoodMs = 0; } else { _offGoodMs += dt; _offBadMs = 0; }
    }
  }

  Fault before = _fault;
  if (_fault == Fault::NONE) {
    if (_onBadMs >= HOLD_MS) _fault = Fault::NO_CURRENT_WHILE_ON;
    else if (_offBadMs >= HOLD_MS) _fault = Fault::CURRENT_WHILE_OFF;
  } else if ((_fault == Fault::NO_CURRENT_WHILE_ON && _onGoodMs >= HOLD_MS)
             || (_fault == Fault::CURRENT_WHILE_OFF && _offGoodMs >= HOLD_MS)) {
    _fault = Fault::NONE;
  }
  if (_fault != before) resetTimers();
  return _fault != before;
}
