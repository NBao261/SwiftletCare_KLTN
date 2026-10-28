// Unit test lý do khởi động lại bất thường (THREAT-FR-012) — pio test -e native
#include "system/ResetReason.h"
#include <unity.h>

void setUp() {}
void tearDown() {}

void test_crash_watchdog_and_brownout_are_reported_with_srs_reasons() {
  TEST_ASSERT_EQUAL_STRING("CRASH", unexpectedRestartReason(BootReset::Panic, true));
  TEST_ASSERT_EQUAL_STRING("BROWNOUT", unexpectedRestartReason(BootReset::Brownout, true));
  TEST_ASSERT_EQUAL_STRING("WATCHDOG", unexpectedRestartReason(BootReset::IntWdt, true));
  TEST_ASSERT_EQUAL_STRING("WATCHDOG", unexpectedRestartReason(BootReset::TaskWdt, true));
  TEST_ASSERT_EQUAL_STRING("WATCHDOG", unexpectedRestartReason(BootReset::Wdt, true));
}

void test_faults_are_reported_even_before_the_first_connection() {
  TEST_ASSERT_EQUAL_STRING("CRASH", unexpectedRestartReason(BootReset::Panic, false));
  TEST_ASSERT_EQUAL_STRING("WATCHDOG", unexpectedRestartReason(BootReset::TaskWdt, false));
}

void test_power_on_is_a_power_loss_only_after_the_device_has_connected_once() {
  TEST_ASSERT_EQUAL_STRING("POWER_ON", unexpectedRestartReason(BootReset::PowerOn, true));
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::PowerOn, false)); // lần cấp điện đầu lúc lắp đặt
}

void test_intended_restarts_are_not_reported() {
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::Software, true)); // RESTART/OTA từ xa
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::External, true));
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::DeepSleep, true));
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::Sdio, true));
  TEST_ASSERT_NULL(unexpectedRestartReason(BootReset::Unknown, true));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_crash_watchdog_and_brownout_are_reported_with_srs_reasons);
  RUN_TEST(test_faults_are_reported_even_before_the_first_connection);
  RUN_TEST(test_power_on_is_a_power_loss_only_after_the_device_has_connected_once);
  RUN_TEST(test_intended_restarts_are_not_reported);
  return UNITY_END();
}
