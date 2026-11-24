// Unit test phát hiện bơm chạy khô + chốt ngừng phun (THREAT-FR-011) — pio test -e native
#include "pid/PumpDryMonitor.h"
#include <math.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static const uint32_t STEP = 10000;     // chu kỳ điều khiển 10 s
static const uint32_t ON_MS = 300000;   // mặc định 5 phút BẬT cộng dồn
static const float RISE = 2.0f;         // mặc định +2 điểm %RH
static const uint32_t RETRY = 1800000;  // mặc định chốt 30 phút rồi thử lại
static const float H_MIN = 75.0f;       // ngưỡng dưới độ ẩm mặc định của Zone

/**
 * Mô phỏng đúng đường gọi của PIDController: số đo hỏng → bộ mờ cho nhu cầu 0 (demand
 * = false) VÀ sensorOk = false; relay tự động bị ngắt khi monitor đang chốt.
 */
struct Sim {
  PumpDryMonitor m;
  uint32_t now = 0;
  int run(int n, float humidity, bool wantSpray = true, bool manual = false, bool relayOn = true,
          uint32_t onMs = ON_MS, float rise = RISE, uint32_t retry = RETRY) {
    int fired = 0;
    for (int i = 0; i < n; i++) {
      now += STEP;
      bool sensorOk = !isnan(humidity);
      bool demand = manual ? wantSpray : (wantSpray && sensorOk);
      bool on = relayOn && demand && (manual || !m.blocked());
      bool belowTarget = sensorOk && humidity < H_MIN;
      fired += m.update(sensorOk, demand, manual, on, humidity, belowTarget, now, onMs, rise, retry) ? 1 : 0;
    }
    return fired;
  }
};

void test_dry_pump_is_detected_once_and_latches() {
  Sim s;
  TEST_ASSERT_EQUAL(0, s.run(31, 70)); // 1 chu kỳ mở đợt + 30 chu kỳ = đúng 5 phút, chưa quá
  TEST_ASSERT_FALSE(s.m.blocked());
  TEST_ASSERT_EQUAL(1, s.run(1, 70)); // vượt 5 phút, ẩm không tăng
  TEST_ASSERT_TRUE(s.m.blocked());
  TEST_ASSERT_EQUAL(0, s.run(100, 70)); // ~17 phút sau vẫn chốt, không báo lại
  TEST_ASSERT_TRUE(s.m.blocked());
}

void test_rising_humidity_is_not_dry() {
  Sim s;
  s.run(1, 70);
  TEST_ASSERT_EQUAL(0, s.run(40, 73)); // tăng 3 điểm > 2
  TEST_ASSERT_FALSE(s.m.blocked());
}

void test_only_relay_on_time_is_counted() {
  Sim s;
  // Bộ mờ chạy 50%: xen kẽ BẬT/TẮT — 5 phút BẬT cộng dồn cần ~10 phút thật
  int fired = 0;
  for (int i = 0; i < 40; i++) fired += s.run(1, 70, true, false, i % 2 == 0);
  TEST_ASSERT_EQUAL(0, fired); // ~3,3 phút BẬT
  for (int i = 0; i < 30; i++) fired += s.run(1, 70, true, false, i % 2 == 0);
  TEST_ASSERT_EQUAL(1, fired);
}

void test_next_session_retries() {
  Sim s;
  s.run(40, 70);
  TEST_ASSERT_TRUE(s.m.blocked());
  s.run(1, 70, false); // hết nhu cầu → hết đợt
  TEST_ASSERT_FALSE(s.m.blocked());
  TEST_ASSERT_EQUAL(1, s.run(40, 70)); // đợt mới: thử lại, vẫn khô thì báo lại
}

void test_manual_override_is_not_blocked_and_starts_a_new_session() {
  Sim s;
  s.run(40, 70);
  TEST_ASSERT_TRUE(s.m.blocked());
  s.run(1, 70, true, true); // người dùng bật tay sau khi châm nước
  TEST_ASSERT_FALSE(s.m.blocked());
  s.run(5, 78, true, true);
  s.run(1, 78, true, false); // hết override → đợt tự động mới, được phun lại
  TEST_ASSERT_FALSE(s.m.blocked());
}

// Báo nhầm (bơm còn nước, độ ẩm đang cân bằng) không được tắt phun sương vô thời hạn
void test_latch_retries_after_the_lockout() {
  Sim s;
  s.run(32, 70);
  TEST_ASSERT_TRUE(s.m.blocked());
  s.run(179, 70); // gần hết 30 phút — vẫn chốt
  TEST_ASSERT_TRUE(s.m.blocked());
  s.run(1, 70); // đủ 30 phút → nhả chốt, phun lại
  TEST_ASSERT_FALSE(s.m.blocked());
  // Lần thử lại này bơm phun được: độ ẩm lên → không báo, không chốt
  TEST_ASSERT_EQUAL(0, s.run(40, 74));
  TEST_ASSERT_FALSE(s.m.blocked());
}

void test_retry_that_is_still_dry_latches_and_reports_again() {
  Sim s;
  TEST_ASSERT_EQUAL(1, s.run(32, 70));
  s.run(180, 70); // hết thời gian chốt
  TEST_ASSERT_FALSE(s.m.blocked());
  TEST_ASSERT_EQUAL(1, s.run(32, 70)); // phun thêm 5 phút vẫn không lên → báo lần nữa
  TEST_ASSERT_TRUE(s.m.blocked());
}

// Bơm tốt, bộ mờ giữ độ ẩm đứng yên quanh mục tiêu (≥ hMin): KHÔNG phải bơm khô
void test_steady_humidity_at_target_is_not_dry() {
  Sim s;
  TEST_ASSERT_EQUAL(0, s.run(600, 80)); // 100 phút phun mà ẩm đứng ở 80 %
  TEST_ASSERT_FALSE(s.m.blocked());
  // Rơi xuống dưới mục tiêu rồi không lên: lúc này mới tính, và tính từ lúc rơi xuống
  TEST_ASSERT_EQUAL(0, s.run(30, 72)); // đúng 5 phút BẬT dưới mục tiêu — chưa quá
  TEST_ASSERT_EQUAL(1, s.run(2, 72));
  TEST_ASSERT_TRUE(s.m.blocked());
}

void test_parameters_are_tunable() {
  Sim fast;
  fast.run(1, 70);
  TEST_ASSERT_EQUAL(1, fast.run(13, 70, true, false, true, 120000, RISE)); // 2 phút thay vì 5
  Sim strict;
  strict.run(1, 70);
  // +3 điểm đủ với mặc định 2 nhưng chưa đủ khi yêu cầu tăng 5
  TEST_ASSERT_EQUAL(1, strict.run(40, 73, true, false, true, ON_MS, 5.0f));
  Sim quick;
  quick.run(32, 70);
  quick.run(6, 70, true, false, true, ON_MS, RISE, 60000); // chốt 1 phút thay vì 30
  TEST_ASSERT_FALSE(quick.m.blocked());
}

// RS485 chập chờn: lần đọc lỗi không được xoá phần đã cộng dồn, cũng không được nhả chốt
void test_sensor_dropouts_keep_the_accumulated_time_and_the_latch() {
  Sim s;
  s.run(1, 70);
  int fired = 0;
  for (int i = 0; i < 60 && fired == 0; i++) {
    fired += s.run(4, 70);  // 4 chu kỳ đọc được, relay BẬT
    fired += s.run(1, NAN); // 1 chu kỳ mất số đo (bộ mờ cho nhu cầu 0)
  }
  TEST_ASSERT_EQUAL(1, fired); // vẫn phát hiện được dù cứ 5 chu kỳ lại mất 1
  TEST_ASSERT_TRUE(s.m.blocked());
  s.run(3, NAN); // mất số đo lúc đang chốt: không được coi là hết đợt
  TEST_ASSERT_TRUE(s.m.blocked());
}

void test_long_sensor_outage_is_not_evaluated() {
  Sim s;
  s.run(1, 70);
  TEST_ASSERT_EQUAL(0, s.run(60, NAN));
  TEST_ASSERT_FALSE(s.m.blocked());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_dry_pump_is_detected_once_and_latches);
  RUN_TEST(test_rising_humidity_is_not_dry);
  RUN_TEST(test_only_relay_on_time_is_counted);
  RUN_TEST(test_next_session_retries);
  RUN_TEST(test_manual_override_is_not_blocked_and_starts_a_new_session);
  RUN_TEST(test_latch_retries_after_the_lockout);
  RUN_TEST(test_retry_that_is_still_dry_latches_and_reports_again);
  RUN_TEST(test_steady_humidity_at_target_is_not_dry);
  RUN_TEST(test_parameters_are_tunable);
  RUN_TEST(test_sensor_dropouts_keep_the_accumulated_time_and_the_latch);
  RUN_TEST(test_long_sensor_outage_is_not_evaluated);
  return UNITY_END();
}
