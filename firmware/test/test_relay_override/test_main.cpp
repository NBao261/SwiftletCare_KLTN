// Unit test hạn can thiệp tay riêng từng relay (BR-20, ENV-FR-018) — pio test -e native
#include "pid/RelayOverride.h"
#include <unity.h>

void setUp() {}
void tearDown() {}

static const uint32_t MIN = 60000;

void test_relay_names() {
  RelayChannel channel;
  TEST_ASSERT_TRUE(relayChannelFromName("ventilation", channel));
  TEST_ASSERT_EQUAL(RELAY_VENTILATION, channel);
  TEST_ASSERT_EQUAL_STRING("speaker", relayChannelName(RELAY_SPEAKER));
  TEST_ASSERT_FALSE(relayChannelFromName("heating", channel));
}

void test_second_relay_does_not_change_the_first_expiry() {
  RelayOverrides overrides;
  overrides.set(RELAY_MISTING, 0, 10 * MIN);
  overrides.set(RELAY_VENTILATION, 5 * MIN, 30 * MIN);

  TEST_ASSERT_EQUAL_UINT32(5 * MIN, overrides.remainingMs(RELAY_MISTING, 5 * MIN));
  TEST_ASSERT_TRUE(overrides.expired(RELAY_MISTING, 10 * MIN));
  TEST_ASSERT_FALSE(overrides.expired(RELAY_VENTILATION, 10 * MIN));
}

void test_one_relay_expires_and_the_other_stays_manual() {
  RelayOverrides overrides;
  overrides.set(RELAY_MISTING, 0, 10 * MIN);
  overrides.set(RELAY_VENTILATION, 0, 30 * MIN);

  overrides.clear(RELAY_MISTING);
  TEST_ASSERT_FALSE(overrides.active(RELAY_MISTING));
  TEST_ASSERT_TRUE(overrides.active(RELAY_VENTILATION));
  TEST_ASSERT_TRUE(overrides.any());
}

void test_clear_all() {
  RelayOverrides overrides;
  overrides.set(RELAY_MISTING, 0, MIN);
  overrides.set(RELAY_SPEAKER, 0, MIN);
  overrides.clearAll();
  TEST_ASSERT_FALSE(overrides.any());
}

void test_same_relay_again_replaces_its_expiry() {
  RelayOverrides overrides;
  overrides.set(RELAY_MISTING, 0, 10 * MIN);
  overrides.set(RELAY_MISTING, 9 * MIN, 10 * MIN);
  TEST_ASSERT_FALSE(overrides.expired(RELAY_MISTING, 10 * MIN));
  TEST_ASSERT_EQUAL_UINT32(9 * MIN, overrides.remainingMs(RELAY_MISTING, 10 * MIN));
}

void test_expiry_survives_the_millis_rollover() {
  RelayOverrides overrides;
  uint32_t start = 0xFFFFFFFFu - MIN;
  overrides.set(RELAY_MISTING, start, 10 * MIN);
  TEST_ASSERT_FALSE(overrides.expired(RELAY_MISTING, start + 5 * MIN));
  TEST_ASSERT_TRUE(overrides.expired(RELAY_MISTING, start + 10 * MIN));
}

void test_relay_without_override_never_expires() {
  RelayOverrides overrides;
  TEST_ASSERT_FALSE(overrides.expired(RELAY_SPEAKER, 123456));
  TEST_ASSERT_EQUAL_UINT32(0, overrides.remainingMs(RELAY_SPEAKER, 123456));
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_relay_names);
  RUN_TEST(test_second_relay_does_not_change_the_first_expiry);
  RUN_TEST(test_one_relay_expires_and_the_other_stays_manual);
  RUN_TEST(test_clear_all);
  RUN_TEST(test_same_relay_again_replaces_its_expiry);
  RUN_TEST(test_expiry_survives_the_millis_rollover);
  RUN_TEST(test_relay_without_override_never_expires);
  return UNITY_END();
}
