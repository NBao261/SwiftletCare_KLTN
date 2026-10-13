// Unit test phát hiện chim hoảng theo dB, nền riêng từng giờ (THREAT-FR-007) — pio test -e native
#include "sensors/PanicDetector.h"
#include <math.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static const int HOUR_SAMPLES = 3600; // 1 giờ ở 1 Hz

static void feed(PanicDetector &d, float db, int n, int hour, bool speaker = false) {
  for (int i = 0; i < n; i++) d.update(db, speaker, hour);
}

/** Ngày học: giờ 10 yên tĩnh 40 dB, giờ 17 nửa đầu 40 dB rồi chim về tổ 65 dB */
static void learnDay(PanicDetector &d) {
  feed(d, 40, HOUR_SAMPLES, 10);
  feed(d, 40, HOUR_SAMPLES / 2, 17);
  feed(d, 65, HOUR_SAMPLES / 2, 17);
}

void test_unlearned_hour_is_not_evaluated() {
  PanicDetector d;
  feed(d, 40, 100, 10);
  feed(d, 80, 30, 10);
  TEST_ASSERT_FALSE(d.ready(10));
  TEST_ASSERT_FALSE(d.active());
}

void test_unknown_hour_is_not_evaluated() {
  PanicDetector d;
  learnDay(d);
  feed(d, 80, 30, -1); // NTP chưa đồng bộ
  TEST_ASSERT_FALSE(d.active());
}

void test_naturally_loud_hour_does_not_trigger() {
  PanicDetector d;
  learnDay(d);
  feed(d, 65, 60, 17); // chim về tổ như mọi ngày
  TEST_ASSERT_FALSE(d.active());
}

void test_same_loudness_in_a_quiet_hour_triggers() {
  PanicDetector d;
  learnDay(d);
  bool triggered = false;
  for (int i = 0; i < 12; i++) triggered |= d.update(65, false, 10);
  TEST_ASSERT_TRUE(triggered);
}

void test_short_noise_does_not_trigger() {
  PanicDetector d;
  learnDay(d);
  feed(d, 70, 3, 10); // cửa đóng sập, 3 giây
  feed(d, 40, 12, 10);
  TEST_ASSERT_FALSE(d.active());
}

void test_speaker_playing_is_ignored_and_not_learned() {
  PanicDetector d;
  learnDay(d);
  float before = d.baseline(10);
  feed(d, 75, 600, 10, true); // loa ru/nghe thử phát lúc 10h (lịch đổi giờ)
  TEST_ASSERT_FALSE(d.active());
  TEST_ASSERT_FLOAT_WITHIN(0.01f, before, d.baseline(10));
}

void test_panic_raises_baseline_only_slowly_and_then_clears() {
  PanicDetector d;
  learnDay(d);
  feed(d, 70, 60, 10); // 1 phút hoảng
  TEST_ASSERT_TRUE(d.active());
  TEST_ASSERT_FLOAT_WITHIN(2.0f, 40.0f, d.baseline(10));
  feed(d, 40, 15, 10);
  TEST_ASSERT_FALSE(d.active());
}

/** Thực tế: 45 phút yên rồi chim về 15 phút — hôm sau chim về lại không bị báo */
void test_birds_returning_late_in_the_hour_are_learned() {
  PanicDetector d;
  feed(d, 40, 2700, 17);
  feed(d, 70, 900, 17);  // ngày 1
  feed(d, 40, 2700, 17); // ngày 2: 45 phút yên kéo mức xuống
  feed(d, 70, 120, 17);  // chim về như hôm qua
  TEST_ASSERT_FALSE(d.active());
}

/** Ngày đầu chim về chỉ 5 phút (học chưa tới) → hôm sau có thể báo, nhưng tự học dần, không báo nhầm mãi */
void test_under_learned_hour_self_corrects() {
  PanicDetector d;
  feed(d, 40, 3300, 17);
  feed(d, 70, 300, 17);
  for (int day = 0; day < 3; day++) {
    feed(d, 40, 2700, 17);
    feed(d, 70, 900, 17);
  }
  feed(d, 40, 2700, 17);
  feed(d, 70, 120, 17);
  TEST_ASSERT_FALSE(d.active());
}

void test_nan_sample_keeps_state() {
  PanicDetector d;
  learnDay(d);
  feed(d, 70, 12, 10);
  TEST_ASSERT_TRUE(d.update(NAN, false, 10));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_unlearned_hour_is_not_evaluated);
  RUN_TEST(test_unknown_hour_is_not_evaluated);
  RUN_TEST(test_naturally_loud_hour_does_not_trigger);
  RUN_TEST(test_same_loudness_in_a_quiet_hour_triggers);
  RUN_TEST(test_short_noise_does_not_trigger);
  RUN_TEST(test_speaker_playing_is_ignored_and_not_learned);
  RUN_TEST(test_panic_raises_baseline_only_slowly_and_then_clears);
  RUN_TEST(test_birds_returning_late_in_the_hour_are_learned);
  RUN_TEST(test_under_learned_hour_self_corrects);
  RUN_TEST(test_nan_sample_keeps_state);
  return UNITY_END();
}
