#include "SignalFilter.h"
#include <algorithm>
#include <math.h>

SignalFilter::SignalFilter(float q, float r) : _q(q), _r(r) {}

void SignalFilter::reset() {
  _count = 0;
  _next = 0;
  _x = 0.0f;
  _p = 0.0f;
  _ready = false;
}

float SignalFilter::update(float measurement) {
  if (isnan(measurement)) return _x;

  _window[_next] = measurement;
  _next = (_next + 1) % WINDOW;
  if (_count < WINDOW) _count++;

  float sorted[WINDOW];
  std::copy(_window, _window + _count, sorted);
  std::sort(sorted, sorted + _count);
  float median = sorted[_count / 2];

  if (!_ready) {
    _x = median;
    _p = _r;
    _ready = true;
    return _x;
  }
  _p += _q;                  // dự đoán: giá trị thật trôi chậm
  float k = _p / (_p + _r);  // hệ số Kalman
  _x += k * (median - _x);   // cập nhật theo phép đo
  _p *= (1.0f - k);
  return _x;
}
