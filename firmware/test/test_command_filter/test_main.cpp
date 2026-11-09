// Unit test lọc lệnh trùng và lệnh trễ (BR-35) — pio test -e native
#include "mqtt/CommandFilter.h"
#include <stdio.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static const uint64_t NOW = 1770000000000ULL;

void test_new_command_is_applied() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c1", NOW - 1000, NOW, true));
}

void test_same_id_is_applied_once() {
  CommandFilter filter;
  filter.check("c1", NOW, NOW, true);
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check("c1", NOW, NOW, true));
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check("c1", NOW, NOW, false));
}

void test_command_at_the_limit_is_applied_and_later_is_stale() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c1", NOW - COMMAND_MAX_AGE_MS, NOW, true));
  TEST_ASSERT_EQUAL(CommandFilter::STALE, filter.check("c2", NOW - COMMAND_MAX_AGE_MS - 1, NOW, true));
}

void test_stale_command_redelivered_is_a_duplicate() {
  CommandFilter filter;
  filter.check("c1", NOW - 120000, NOW, true);
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check("c1", NOW - 120000, NOW, true));
}

void test_clear_override_and_ota_are_not_limited_by_age() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c1", NOW - 3600000, NOW, false));
}

void test_unknown_age_is_applied() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c1", NOW - 120000, 0, true)); // chưa sync NTP
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c2", 0, NOW, true));          // không có issuedAt
}

void test_future_issued_at_is_not_stale() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c1", NOW + 5000, NOW, true));
}

void test_command_without_id_is_applied_every_time() {
  CommandFilter filter;
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("", 0, NOW, true));
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("", 0, NOW, true));
}

void test_remembers_the_last_sixteen_ids() {
  CommandFilter filter;
  char id[8];
  for (int i = 0; i <= COMMAND_ID_MEMORY; i++) {
    snprintf(id, sizeof id, "c%d", i);
    filter.check(id, NOW, NOW, true);
  }
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check("c16", NOW, NOW, true));
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check("c1", NOW, NOW, true));
  TEST_ASSERT_EQUAL(CommandFilter::APPLY, filter.check("c0", NOW, NOW, true)); // đã bị đẩy ra
}

void test_uuid_fits() {
  CommandFilter filter;
  const char *uuid = "123e4567-e89b-12d3-a456-426614174000";
  filter.check(uuid, NOW, NOW, true);
  TEST_ASSERT_EQUAL(CommandFilter::DUPLICATE, filter.check(uuid, NOW, NOW, true));
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_new_command_is_applied);
  RUN_TEST(test_same_id_is_applied_once);
  RUN_TEST(test_command_at_the_limit_is_applied_and_later_is_stale);
  RUN_TEST(test_stale_command_redelivered_is_a_duplicate);
  RUN_TEST(test_clear_override_and_ota_are_not_limited_by_age);
  RUN_TEST(test_unknown_age_is_applied);
  RUN_TEST(test_future_issued_at_is_not_stale);
  RUN_TEST(test_command_without_id_is_applied_every_time);
  RUN_TEST(test_remembers_the_last_sixteen_ids);
  RUN_TEST(test_uuid_fits);
  return UNITY_END();
}
