// Unit test bộ điều khiển mờ (ENV-FR-010/011) — chạy trên host: pio test -e native
#include "pid/FuzzyControl.h"
#include <math.h>
#include <unity.h>

using namespace FuzzyControl;

// Ngưỡng mặc định Config.h
static const float H_MIN = 75, H_MAX = 95, T_MAX = 31, NH3_MAX = 25, CO2_MAX = 1500;

void setUp() {}
void tearDown() {}

void test_membership_functions() {
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.25f, rampDown(76, 70, 78));
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.5f, rampUp(30, 28, 32));
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.5f, tri(76, 72, 80, 88));
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 1.0f, tri(80, 72, 80, 88));
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.0f, tri(90, 72, 80, 88));
}

// Ví dụ tính tay trong tài liệu: ẩm 76%, 30°C
// THẤP=0.25→1.0, VỪA∧NÓNG=0.5→0.5, VỪA∧¬NÓNG=0.5→0 ⇒ (0.25+0.25)/1.25 = 0.4
void test_misting_worked_example() {
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.4f, mistingDemand(76, 30, H_MIN, H_MAX, T_MAX));
}

void test_misting_extremes() {
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 1.0f, mistingDemand(65, 28, H_MIN, H_MAX, T_MAX)); // rất khô
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.0f, mistingDemand(92, 33, H_MIN, H_MAX, T_MAX)); // ẩm cao, nóng vẫn tắt
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.0f, mistingDemand(80, 26, H_MIN, H_MAX, T_MAX)); // ẩm tốt, mát
}

void test_misting_hotter_mists_more() {
  TEST_ASSERT_TRUE(mistingDemand(79, 33, H_MIN, H_MAX, T_MAX) > mistingDemand(79, 26, H_MIN, H_MAX, T_MAX));
}

void test_ventilation_rules() {
  // Nóng, ẩm đủ → quạt 100%
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 1.0f, ventilationDemand(33, 80, 5, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
  // Nóng nhưng khô → quạt 40% (để phun sương làm mát, đừng hút hết hơi ẩm)
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.4f, ventilationDemand(33, 65, 5, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
  // Mát, không khí sạch → tắt
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.0f, ventilationDemand(26, 80, 5, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
  // NH3 20ppm (KHÍ_CAO=0.5), mát → 50%
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.5f, ventilationDemand(26, 80, 20, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
}

void test_ventilation_toxic_gas_safety() {
  // NH3 vượt max: luôn 100% kể cả khi nhà đang khô + nóng
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 1.0f, ventilationDemand(33, 65, 30, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 1.0f, ventilationDemand(26, 80, 5, true, 2000, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
  // Cảm biến NH3 lỗi (NAN) bị loại khỏi quyết định
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.0f, ventilationDemand(26, 80, NAN, false, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX));
}

// ENV-FR-021: hệ số chỉnh qua config/update
void test_tuning_defaults_match_original_breakpoints() {
  Tuning t; // mặc định = điểm gãy gốc
  TEST_ASSERT_FLOAT_WITHIN(1e-4, mistingDemand(76, 30, H_MIN, H_MAX, T_MAX),
                           mistingDemand(76, 30, H_MIN, H_MAX, T_MAX, t));
}

void test_wider_humidity_band_mists_earlier() {
  Tuning wide;
  wide.humidityBand = 16; // THẤP kéo tới hMin+6 thay vì hMin+3
  TEST_ASSERT_TRUE(mistingDemand(79, 26, H_MIN, H_MAX, T_MAX, wide) > mistingDemand(79, 26, H_MIN, H_MAX, T_MAX));
}

void test_fan_dry_level_is_tunable() {
  Tuning t;
  t.fanDryLevel = 0.2f;
  TEST_ASSERT_FLOAT_WITHIN(1e-4, 0.2f, ventilationDemand(33, 65, 5, true, 600, true, T_MAX, H_MIN, NH3_MAX, CO2_MAX, t));
}

void test_time_proportioning() {
  TEST_ASSERT_FALSE(timeProportionalOn(0.0f, 0, 120000, 0));
  TEST_ASSERT_TRUE(timeProportionalOn(1.0f, 119999, 120000, 0));
  TEST_ASSERT_TRUE(timeProportionalOn(0.4f, 47999, 120000, 0));  // 40% đầu cửa sổ = 48s
  TEST_ASSERT_FALSE(timeProportionalOn(0.4f, 48000, 120000, 0));
  TEST_ASSERT_FALSE(timeProportionalOn(0.4f, 0, 120000, 60000)); // lệch nửa cửa sổ
  TEST_ASSERT_TRUE(timeProportionalOn(0.4f, 60000, 120000, 60000));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_membership_functions);
  RUN_TEST(test_misting_worked_example);
  RUN_TEST(test_misting_extremes);
  RUN_TEST(test_misting_hotter_mists_more);
  RUN_TEST(test_ventilation_rules);
  RUN_TEST(test_ventilation_toxic_gas_safety);
  RUN_TEST(test_tuning_defaults_match_original_breakpoints);
  RUN_TEST(test_wider_humidity_band_mists_earlier);
  RUN_TEST(test_fan_dry_level_is_tunable);
  RUN_TEST(test_time_proportioning);
  return UNITY_END();
}
