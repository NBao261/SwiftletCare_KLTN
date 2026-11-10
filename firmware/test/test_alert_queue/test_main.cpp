// Unit test hàng đợi cảnh báo chờ PUBACK (Report 4 §7.2, NFR-06 c) — pio test -e native
#include "mqtt/AlertQueue.h"
#include <stdio.h>
#include <string.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static QueuedAlert alertOf(const char *type) {
  QueuedAlert alert;
  strcpy(alert.type, type);
  strcpy(alert.eventId, "e");
  return alert;
}

void test_alert_stays_until_its_puback() {
  AlertQueue queue;
  queue.push(alertOf("SENSOR_FAULT"));
  int index = queue.nextUnsent();
  TEST_ASSERT_EQUAL(0, index);
  queue.markSent(index, 7);

  TEST_ASSERT_EQUAL(-1, queue.nextUnsent());
  TEST_ASSERT_FALSE(queue.ack(8)); // PUBACK của tin khác
  TEST_ASSERT_EQUAL(1, queue.size());
  TEST_ASSERT_TRUE(queue.ack(7));
  TEST_ASSERT_EQUAL(0, queue.size());
}

void test_lost_connection_sends_again() {
  AlertQueue queue;
  queue.push(alertOf("SENSOR_FAULT"));
  queue.markSent(0, 7);
  queue.resetSent();
  TEST_ASSERT_EQUAL(0, queue.nextUnsent());
}

void test_same_type_waiting_is_not_added_twice() {
  AlertQueue queue;
  TEST_ASSERT_TRUE(queue.push(alertOf("SENSOR_FAULT")));
  TEST_ASSERT_TRUE(queue.push(alertOf("SENSOR_FAULT")));
  TEST_ASSERT_EQUAL(1, queue.size());
}

void test_full_queue_refuses_and_keeps_what_it_has() {
  AlertQueue queue;
  char type[24];
  for (int i = 0; i < ALERT_QUEUE_SIZE; i++) {
    snprintf(type, sizeof type, "T%d", i);
    TEST_ASSERT_TRUE(queue.push(alertOf(type)));
  }
  TEST_ASSERT_FALSE(queue.push(alertOf("ONE_MORE")));
  TEST_ASSERT_EQUAL(ALERT_QUEUE_SIZE, queue.size());
}

void test_order_is_kept_after_a_middle_ack() {
  AlertQueue queue;
  queue.push(alertOf("A"));
  queue.push(alertOf("B"));
  queue.push(alertOf("C"));
  queue.markSent(0, 1);
  queue.markSent(1, 2);
  queue.ack(2);
  TEST_ASSERT_EQUAL_STRING("A", queue.at(0).type);
  TEST_ASSERT_EQUAL_STRING("C", queue.at(queue.nextUnsent()).type);
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_alert_stays_until_its_puback);
  RUN_TEST(test_lost_connection_sends_again);
  RUN_TEST(test_same_type_waiting_is_not_added_twice);
  RUN_TEST(test_full_queue_refuses_and_keeps_what_it_has);
  RUN_TEST(test_order_is_kept_after_a_middle_ack);
  return UNITY_END();
}
