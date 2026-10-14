// Unit test bộ lọc đầu vào bộ điều khiển mờ (ENV-FR-022) — pio test -e native
#include "sensors/SignalFilter.h"
#include <math.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

void test_not_ready_until_first_valid_sample() {
  SignalFilter f;
  TEST_ASSERT_FALSE(f.ready());
  f.update(NAN);
  TEST_ASSERT_FALSE(f.ready());
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 80.0f, f.update(80.0f));
  TEST_ASSERT_TRUE(f.ready());
}

void test_single_spike_is_rejected_by_median() {
  SignalFilter f;
  for (int i = 0; i < 20; i++) f.update(80.0f);
  f.update(95.0f); // 1 mẫu nhiễu RS485
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 80.0f, f.update(80.0f));
}

void test_follows_a_real_step_change() {
  SignalFilter f;
  for (int i = 0; i < 20; i++) f.update(80.0f);
  for (int i = 0; i < 40; i++) f.update(85.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 85.0f, f.value());
}

void test_smooths_alternating_noise() {
  SignalFilter f;
  float maxDev = 0;
  for (int i = 0; i < 60; i++) {
    float out = f.update(i % 2 ? 81.0f : 79.0f); // ±1 quanh 80
    if (i > 10) maxDev = fmaxf(maxDev, fabsf(out - 80.0f));
  }
  TEST_ASSERT_TRUE(maxDev < 1.0f); // đầu ra dao động ít hơn đầu vào
}

void test_nan_keeps_state() {
  SignalFilter f;
  for (int i = 0; i < 10; i++) f.update(30.0f);
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 30.0f, f.update(NAN));
  TEST_ASSERT_TRUE(f.ready());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_not_ready_until_first_valid_sample);
  RUN_TEST(test_single_spike_is_rejected_by_median);
  RUN_TEST(test_follows_a_real_step_change);
  RUN_TEST(test_smooths_alternating_noise);
  RUN_TEST(test_nan_keeps_state);
  return UNITY_END();
}
