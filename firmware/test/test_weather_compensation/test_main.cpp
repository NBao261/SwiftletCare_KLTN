// Unit test bù phun sương theo thời tiết (ENV-FR-029, BR-38, TC-F26-02) — pio test -e native
#include "pid/WeatherCompensation.h"
#include <unity.h>

void setUp() {}
void tearDown() {}

static const uint32_t MIN = 60000;
static const uint64_t EPOCH = 1794450000000ULL; // 11/2026, đã đồng bộ NTP

void test_offset_added_to_fuzzy_demand() {
  WeatherCompensation comp;
  comp.receive(5.0f, EPOCH + 60 * MIN, EPOCH, 1000);
  float offset = comp.current(1000 + MIN, true);
  TEST_ASSERT_EQUAL_FLOAT(5.0f, offset);
  // Nhu cầu mờ 40 % thành 45 %
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.45f, WeatherCompensation::apply(0.40f, offset));
}

void test_offset_zero_after_expiry() {
  WeatherCompensation comp;
  comp.receive(5.0f, EPOCH + 30 * MIN, EPOCH, 0);
  TEST_ASSERT_EQUAL_FLOAT(5.0f, comp.current(29 * MIN, true));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(30 * MIN, true));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.40f, WeatherCompensation::apply(0.40f, comp.current(31 * MIN, true)));
}

void test_forged_offset_and_duration_are_clamped() {
  WeatherCompensation comp;
  // +80 % và hạn 5 giờ trong một tin giả: kẹp về +10 % và 2 giờ
  comp.receive(80.0f, EPOCH + 300 * MIN, EPOCH, 0);
  TEST_ASSERT_EQUAL_FLOAT(10.0f, comp.current(MIN, true));
  TEST_ASSERT_EQUAL_FLOAT(10.0f, comp.current(119 * MIN, true));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(120 * MIN, true));
}

void test_demand_stays_within_0_and_100() {
  TEST_ASSERT_EQUAL_FLOAT(1.0f, WeatherCompensation::apply(0.95f, 10.0f));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, WeatherCompensation::apply(0.05f, -10.0f));
}

void test_offline_two_hours_gives_zero() {
  WeatherCompensation comp;
  comp.receive(-8.0f, EPOCH + 120 * MIN, EPOCH, 0);
  TEST_ASSERT_EQUAL_FLOAT(-8.0f, comp.current(10 * MIN, false));
  // Mất broker từ phút 0 (lúc nhận): tới phút 120 vừa đủ 2 giờ
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(120 * MIN, false));
}

void test_unknown_clock_or_past_expiry_gives_zero() {
  WeatherCompensation comp;
  comp.receive(5.0f, EPOCH + 60 * MIN, 0, 0); // chưa có NTP
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(MIN, true));
  comp.receive(5.0f, EPOCH - MIN, EPOCH, 0); // tin retained cũ, đã hết hạn
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(MIN, true));
}

void test_newer_offset_replaces_older_and_zero_clears() {
  WeatherCompensation comp;
  comp.receive(5.0f, EPOCH + 60 * MIN, EPOCH, 0);
  comp.receive(-3.0f, EPOCH + 60 * MIN, EPOCH, MIN);
  TEST_ASSERT_EQUAL_FLOAT(-3.0f, comp.current(2 * MIN, true));
  comp.receive(0.0f, EPOCH + 60 * MIN, EPOCH, 3 * MIN);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(4 * MIN, true));
}

void test_millis_wrap() {
  WeatherCompensation comp;
  uint32_t nearWrap = 0xFFFFFFFFUL - 5 * MIN;
  comp.receive(5.0f, EPOCH + 30 * MIN, EPOCH, nearWrap);
  TEST_ASSERT_EQUAL_FLOAT(5.0f, comp.current(nearWrap + 20 * MIN, true)); // millis() đã tràn
  TEST_ASSERT_EQUAL_FLOAT(0.0f, comp.current(nearWrap + 30 * MIN, true));
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_offset_added_to_fuzzy_demand);
  RUN_TEST(test_offset_zero_after_expiry);
  RUN_TEST(test_forged_offset_and_duration_are_clamped);
  RUN_TEST(test_demand_stays_within_0_and_100);
  RUN_TEST(test_offline_two_hours_gives_zero);
  RUN_TEST(test_unknown_clock_or_past_expiry_gives_zero);
  RUN_TEST(test_newer_offset_replaces_older_and_zero_clears);
  RUN_TEST(test_millis_wrap);
  return UNITY_END();
}
