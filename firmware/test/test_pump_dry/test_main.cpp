// Unit test phát hiện bơm chạy khô + chốt ngừng phun (THREAT-FR-011) — pio test -e native
#include "pid/PumpDryMonitor.h"
#include <math.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static const uint32_t STEP = 10000;   // chu kỳ điều khiển 10 s
static const uint32_t ON_MS = 300000; // mặc định 5 phút BẬT cộng dồn
static const float RISE = 2.0f;       // mặc định +2 điểm %RH

struct Sim {
  PumpDryMonitor m;
  uint32_t now = 0;
  // Chạy n chu kỳ; relay tự động bị ngắt khi monitor đang chốt (như PIDController).
  // Trả về số lần báo bơm khô.
  int run(int n, float humidity, bool demand = true, bool manual = false, bool relayOn = true,
          uint32_t onMs = ON_MS, float rise = RISE) {
    int fired = 0;
    for (int i = 0; i < n; i++) {
      now += STEP;
      bool on = relayOn && (manual || !m.blocked());
      fired += m.update(demand, manual, on, humidity, now, onMs, rise) ? 1 : 0;
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
  TEST_ASSERT_EQUAL(0, s.run(200, 70)); // vẫn có nhu cầu: chốt giữ, không báo lại
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

void test_parameters_are_tunable() {
  Sim fast;
  fast.run(1, 70);
  TEST_ASSERT_EQUAL(1, fast.run(13, 70, true, false, true, 120000, RISE)); // 2 phút thay vì 5
  Sim strict;
  strict.run(1, 70);
  // +3 điểm đủ với mặc định 2 nhưng chưa đủ khi yêu cầu tăng 5
  TEST_ASSERT_EQUAL(1, strict.run(40, 73, true, false, true, ON_MS, 5.0f));
}

void test_nan_humidity_is_not_evaluated() {
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
  RUN_TEST(test_parameters_are_tunable);
  RUN_TEST(test_nan_humidity_is_not_evaluated);
  return UNITY_END();
}
