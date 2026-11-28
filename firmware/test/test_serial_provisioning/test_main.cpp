// Unit test nạp danh tính qua cổng USB từ màn Kho thiết bị (FARM-FR-010) — pio test -e native
#include "system/SerialProvisioning.h"
#include <string.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

void test_lines_not_for_us_are_ignored() {
  TEST_ASSERT_EQUAL(SerialRequest::NONE, parseSerialLine("[WiFi] Connected").type);
  TEST_ASSERT_EQUAL(SerialRequest::NONE, parseSerialLine("").type);
  TEST_ASSERT_EQUAL(SerialRequest::NONE, parseSerialLine("SCINFO").type);
}

void test_info_and_unknown_command() {
  TEST_ASSERT_EQUAL(SerialRequest::INFO, parseSerialLine("SC INFO").type);
  SerialRequest unknown = parseSerialLine("SC REBOOT");
  TEST_ASSERT_EQUAL(SerialRequest::INVALID, unknown.type);
  TEST_ASSERT_EQUAL_STRING("UNKNOWN_COMMAND", unknown.error);
}

void test_set_reads_every_field() {
  SerialRequest r = parseSerialLine(
      "SC SET {\"deviceId\":\"ctl-a1b2c3\",\"brokerSecret\":\"s3cr3t_-x\",\"broker\":\"mqtt.swiftletcare.io.vn\",\"force\":true}");
  TEST_ASSERT_EQUAL(SerialRequest::SET, r.type);
  TEST_ASSERT_EQUAL_STRING("ctl-a1b2c3", r.deviceId);
  TEST_ASSERT_EQUAL_STRING("s3cr3t_-x", r.brokerSecret);
  TEST_ASSERT_EQUAL_STRING("mqtt.swiftletcare.io.vn", r.broker);
  TEST_ASSERT_TRUE(r.force);
}

void test_set_broker_and_force_are_optional() {
  SerialRequest r = parseSerialLine("SC SET {\"deviceId\":\"node_001\",\"brokerSecret\":\"abc\"}");
  TEST_ASSERT_EQUAL(SerialRequest::SET, r.type);
  TEST_ASSERT_EQUAL_STRING("", r.broker);
  TEST_ASSERT_FALSE(r.force);
}

void test_set_rejects_bad_values() {
  TEST_ASSERT_EQUAL_STRING("BAD_JSON", parseSerialLine("SC SET {nope").error);
  TEST_ASSERT_EQUAL_STRING("BAD_JSON", parseSerialLine("SC SET [1]").error);
  // Ký tự + # / phá cô lập topic trên broker
  TEST_ASSERT_EQUAL_STRING("BAD_DEVICE_ID", parseSerialLine("SC SET {\"deviceId\":\"a/b\",\"brokerSecret\":\"x\"}").error);
  TEST_ASSERT_EQUAL_STRING("BAD_DEVICE_ID", parseSerialLine("SC SET {\"deviceId\":\"\",\"brokerSecret\":\"x\"}").error);
  TEST_ASSERT_EQUAL_STRING("BAD_SECRET", parseSerialLine("SC SET {\"deviceId\":\"n1\",\"brokerSecret\":\"\"}").error);
  char longSecret[120] = "SC SET {\"deviceId\":\"n1\",\"brokerSecret\":\"";
  for (int i = 0; i < 65; i++) strcat(longSecret, "a");
  strcat(longSecret, "\"}");
  TEST_ASSERT_EQUAL_STRING("BAD_SECRET", parseSerialLine(longSecret).error);
  TEST_ASSERT_EQUAL_STRING("BAD_BROKER",
                           parseSerialLine("SC SET {\"deviceId\":\"n1\",\"brokerSecret\":\"x\",\"broker\":\"a b\"}").error);
}

void test_device_id_rule_matches_backend() {
  TEST_ASSERT_TRUE(isValidDeviceId("ESP-001_a"));
  TEST_ASSERT_FALSE(isValidDeviceId("có dấu"));
  TEST_ASSERT_FALSE(isValidDeviceId("a+b"));
  char id41[42];
  memset(id41, 'a', 41);
  id41[41] = '\0';
  TEST_ASSERT_FALSE(isValidDeviceId(id41));
}

void test_provisioned_board_needs_force() {
  SerialRequest r = parseSerialLine("SC SET {\"deviceId\":\"n1\",\"brokerSecret\":\"x\"}");
  TEST_ASSERT_NULL(setBlockedReason(r, false));
  TEST_ASSERT_EQUAL_STRING("PROVISIONED", setBlockedReason(r, true));
  r.force = true;
  TEST_ASSERT_NULL(setBlockedReason(r, true));
}

void test_replies_are_one_prefixed_json_line() {
  char out[200];
  unsigned char mac[6] = {0xA1, 0xB2, 0xC3, 0x0D, 0x0E, 0x0F};
  char macText[13];
  formatMac(mac, macText);
  TEST_ASSERT_EQUAL_STRING("A1B2C30D0E0F", macText);

  buildInfoReply(out, sizeof out, macText, "2.4.0", nullptr);
  TEST_ASSERT_EQUAL_STRING("SC> {\"ok\":true,\"mac\":\"A1B2C30D0E0F\",\"fw\":\"2.4.0\",\"kind\":\"SENSOR\",\"deviceId\":null}", out);
  buildInfoReply(out, sizeof out, macText, "2.4.0", "node_001");
  TEST_ASSERT_NOT_NULL(strstr(out, "\"deviceId\":\"node_001\""));
  buildOkReply(out, sizeof out, "node_001");
  TEST_ASSERT_EQUAL_STRING("SC> {\"ok\":true,\"deviceId\":\"node_001\"}", out);
  buildErrorReply(out, sizeof out, "PROVISIONED");
  TEST_ASSERT_EQUAL_STRING("SC> {\"ok\":false,\"error\":\"PROVISIONED\"}", out);
}

void test_line_buffer_splits_lines_and_drops_overlong_ones() {
  SerialLineBuffer buffer;
  const char *input = "SC INFO\r\n";
  bool done = false;
  for (const char *c = input; *c; c++) done = buffer.feed(*c);
  TEST_ASSERT_TRUE(done);
  TEST_ASSERT_EQUAL_STRING("SC INFO", buffer.line());

  for (size_t i = 0; i < SERIAL_LINE_MAX + 10; i++) TEST_ASSERT_FALSE(buffer.feed('x'));
  TEST_ASSERT_FALSE(buffer.feed('\n'));
  for (const char *c = "SC INFO\n"; *c; c++) done = buffer.feed(*c);
  TEST_ASSERT_TRUE(done);
  TEST_ASSERT_EQUAL_STRING("SC INFO", buffer.line());
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_lines_not_for_us_are_ignored);
  RUN_TEST(test_info_and_unknown_command);
  RUN_TEST(test_set_reads_every_field);
  RUN_TEST(test_set_broker_and_force_are_optional);
  RUN_TEST(test_set_rejects_bad_values);
  RUN_TEST(test_device_id_rule_matches_backend);
  RUN_TEST(test_provisioned_board_needs_force);
  RUN_TEST(test_replies_are_one_prefixed_json_line);
  RUN_TEST(test_line_buffer_splits_lines_and_drops_overlong_ones);
  return UNITY_END();
}
