// Unit test phát hiện chim hoảng theo dB (THREAT-FR-007) — pio test -e native
#include "sensors/PanicDetector.h"
#include <math.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static void feed(PanicDetector &d, float db, int n, bool speaker = false) {
  for (int i = 0; i < n; i++) d.update(db, speaker);
}

void test_not_ready_without_quiet_baseline() {
  PanicDetector d;
  feed(d, 70, 30);
  TEST_ASSERT_FALSE(d.active());
}

void test_sustained_loudness_triggers_panic() {
  PanicDetector d;
  feed(d, 40, 100);
  bool triggered = false;
  for (int i = 0; i < 12; i++) triggered |= d.update(70, false);
  TEST_ASSERT_TRUE(triggered);
}

void test_short_noise_does_not_trigger() {
  PanicDetector d;
  feed(d, 40, 100);
  feed(d, 70, 3); // cửa đóng sập, 3 giây
  feed(d, 40, 12);
  TEST_ASSERT_FALSE(d.active());
}

void test_speaker_playing_is_ignored_and_keeps_baseline() {
  PanicDetector d;
  feed(d, 40, 100);
  feed(d, 75, 120, true); // loa ru đang phát
  TEST_ASSERT_FALSE(d.active());
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 40.0f, d.baseline());
}

void test_panic_does_not_raise_baseline_and_then_clears() {
  PanicDetector d;
  feed(d, 40, 100);
  feed(d, 70, 60);
  TEST_ASSERT_TRUE(d.active());
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 40.0f, d.baseline());
  feed(d, 40, 15);
  TEST_ASSERT_FALSE(d.active());
}

void test_nan_sample_keeps_state() {
  PanicDetector d;
  feed(d, 40, 100);
  feed(d, 70, 12);
  TEST_ASSERT_TRUE(d.update(NAN, false));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_not_ready_without_quiet_baseline);
  RUN_TEST(test_sustained_loudness_triggers_panic);
  RUN_TEST(test_short_noise_does_not_trigger);
  RUN_TEST(test_speaker_playing_is_ignored_and_keeps_baseline);
  RUN_TEST(test_panic_does_not_raise_baseline_and_then_clears);
  RUN_TEST(test_nan_sample_keeps_state);
  return UNITY_END();
}
