// Unit test kiểm tra tải theo relay bằng dòng đo (THREAT-FR-014, BR-32) — pio test -e native
#include "pid/ActuatorCurrentMonitor.h"
#include <unity.h>

void setUp() {}
void tearDown() {}

using Fault = ActuatorCurrentMonitor::Fault;
static const uint32_t STEP = 1000;  // SensorTask đọc dòng mỗi 1 s

/** Đọc `n` lần liền nhau với cùng relay và dòng; trả về số lần fault() đổi */
struct Sim {
  ActuatorCurrentMonitor m;
  uint32_t now = 0;
  int run(int n, bool relayOn, float currentA, bool currentOk = true) {
    int changes = 0;
    for (int i = 0; i < n; i++) {
      now += STEP;
      changes += m.update(relayOn, currentOk, currentA, now) ? 1 : 0;
    }
    return changes;
  }
  /** Đã học mức bình thường 2.0 A, relay đang TẮT và không có dòng */
  static Sim learned2A() {
    Sim s;
    s.m.setNormal(2.0f);
    s.run(1, false, 0.0f);
    return s;
  }
};

// TC-F06-02 — học 30 s đầu của lần BẬT, không báo lỗi trong lúc học
void test_learns_the_normal_current_over_the_first_30_s_of_an_on_period() {
  Sim s;
  TEST_ASSERT_EQUAL(0, s.run(30, true, 2.0f));  // 30 mẫu = 29 s từ mẫu đầu, chưa đủ
  TEST_ASSERT_FALSE(s.m.learned());
  TEST_ASSERT_EQUAL(0, s.run(1, true, 2.0f));
  TEST_ASSERT_TRUE(s.m.learned());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2.0f, s.m.normalA());
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
}

void test_an_on_period_shorter_than_30_s_is_not_learned() {
  Sim s;
  s.run(20, true, 2.0f);
  s.run(5, false, 0.0f);
  TEST_ASSERT_FALSE(s.m.learned());
  s.run(31, true, 1.6f);  // lần BẬT đủ dài: chỉ lấy lần này
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.6f, s.m.normalA());
}

void test_no_fault_is_judged_before_the_current_is_learned() {
  Sim s;
  TEST_ASSERT_EQUAL(0, s.run(120, false, 3.0f));  // dòng khi relay TẮT nhưng chưa có mức để so
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
}

// TC-F06-01 — relay BẬT, dòng dưới 50 % mức bình thường đủ 30 s: đúng 1 lần báo
void test_relay_on_without_current_for_30_s_raises_one_fault() {
  Sim s = Sim::learned2A();
  TEST_ASSERT_EQUAL(0, s.run(30, true, 0.8f));  // lần đọc đầu chỉ là lúc relay vừa đổi, 29 s cộng dồn
  TEST_ASSERT_EQUAL(1, s.run(1, true, 0.8f));
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NO_CURRENT_WHILE_ON);
  TEST_ASSERT_EQUAL(0, s.run(300, true, 0.8f));  // không báo lại
}

// TC-F06-03 — relay TẮT, dòng trên 20 % mức bình thường đủ 30 s: relay dính hoặc công tắc khác
void test_current_while_relay_off_for_30_s_raises_one_fault() {
  Sim s = Sim::learned2A();
  TEST_ASSERT_EQUAL(0, s.run(29, false, 0.6f));
  TEST_ASSERT_EQUAL(1, s.run(1, false, 0.6f));
  TEST_ASSERT_TRUE(s.m.fault() == Fault::CURRENT_WHILE_OFF);
}

void test_current_at_the_limits_is_not_a_fault() {
  Sim s = Sim::learned2A();
  TEST_ASSERT_EQUAL(0, s.run(120, true, 1.0f));   // đúng 50 %: chưa dưới
  TEST_ASSERT_EQUAL(0, s.run(120, false, 0.4f));  // đúng 20 %: chưa trên
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
}

void test_a_cycling_relay_adds_up_the_on_time() {
  // Bộ mờ bật bơm 20 s rồi tắt 100 s: 2 lần BẬT không dòng cộng dồn đủ 30 s
  Sim s = Sim::learned2A();
  int changes = 0;
  for (int cycle = 0; cycle < 3 && s.m.fault() == Fault::NONE; cycle++) {
    changes += s.run(20, true, 0.0f);
    changes += s.run(100, false, 0.0f);
  }
  TEST_ASSERT_EQUAL(1, changes);
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NO_CURRENT_WHILE_ON);
}

void test_fault_clears_when_the_load_follows_its_relay_again_for_30_s() {
  Sim s = Sim::learned2A();
  s.run(31, true, 0.0f);
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NO_CURRENT_WHILE_ON);
  TEST_ASSERT_EQUAL(0, s.run(60, false, 0.0f));  // relay TẮT không chứng minh motor đã chạy lại
  TEST_ASSERT_EQUAL(0, s.run(30, true, 2.0f));
  TEST_ASSERT_EQUAL(1, s.run(1, true, 2.0f));
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
}

void test_a_lost_current_reading_keeps_the_state() {
  Sim s = Sim::learned2A();
  s.run(20, true, 0.5f);
  TEST_ASSERT_EQUAL(0, s.run(60, true, 0.0f, false));  // ADS1115 không trả lời: không phải "không có dòng"
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
  TEST_ASSERT_EQUAL(1, s.run(11, true, 0.5f));  // 19 s trước + 11 s sau = 30 s
}

void test_relearn_forgets_the_level_and_the_fault() {
  Sim s = Sim::learned2A();
  s.run(31, true, 0.0f);
  s.m.relearn();  // thay tải khác công suất
  TEST_ASSERT_FALSE(s.m.learned());
  TEST_ASSERT_TRUE(s.m.fault() == Fault::NONE);
  s.run(31, true, 4.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.0f, s.m.normalA());
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_learns_the_normal_current_over_the_first_30_s_of_an_on_period);
  RUN_TEST(test_an_on_period_shorter_than_30_s_is_not_learned);
  RUN_TEST(test_no_fault_is_judged_before_the_current_is_learned);
  RUN_TEST(test_relay_on_without_current_for_30_s_raises_one_fault);
  RUN_TEST(test_current_while_relay_off_for_30_s_raises_one_fault);
  RUN_TEST(test_current_at_the_limits_is_not_a_fault);
  RUN_TEST(test_a_cycling_relay_adds_up_the_on_time);
  RUN_TEST(test_fault_clears_when_the_load_follows_its_relay_again_for_30_s);
  RUN_TEST(test_a_lost_current_reading_keeps_the_state);
  RUN_TEST(test_relearn_forgets_the_level_and_the_fault);
  return UNITY_END();
}
