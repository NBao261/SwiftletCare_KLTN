// Unit test đọc lệnh từ xa RESTART/OTA (TICKET-FR-008, Flow 15) — pio test -e native
#include "ota/RemoteCommand.h"
#include <stdio.h>
#include <string.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static const char *SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // sha256("test")
static const uint8_t SHA_BYTES[32] = {0x9f, 0x86, 0xd0, 0x81, 0x88, 0x4c, 0x7d, 0x65, 0x9a, 0x2f, 0xea,
                                      0xa0, 0xc5, 0x5a, 0xd0, 0x15, 0xa3, 0xbf, 0x4f, 0x1b, 0x2b, 0x0b,
                                      0x82, 0x2c, 0xd1, 0x5d, 0x6c, 0x15, 0xb0, 0xf0, 0x0a, 0x08};

static const char *HEAD = "\"commandId\":\"c1\",\"issuedAt\":1770000000000";

static RemoteCommand parse(const char *type, const char *payload) {
  char json[640];
  snprintf(json, sizeof json, "{%s,\"type\":\"%s\",\"payload\":%s}", HEAD, type, payload);
  return parseRemoteCommand(json, "1.4.0");
}

static RemoteCommand parseOta(const char *version, const char *url, const char *sha) {
  char payload[512];
  snprintf(payload, sizeof payload, "{\"version\":\"%s\",\"url\":\"%s\",\"sha256\":\"%s\"}", version, url, sha);
  return parse("OTA", payload);
}

void test_envelope_needs_id_and_time() {
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseRemoteCommand("{\"type\":\"RESTART\",\"issuedAt\":1}", "1.4.0").type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseRemoteCommand("{\"type\":\"RESTART\",\"commandId\":\"c\"}", "1.4.0").type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parse("HEATING", "{}").type);
}

void test_relay() {
  RemoteCommand cmd = parse("RELAY", "{\"relayName\":\"misting\",\"state\":true,\"durationMs\":600000}");
  TEST_ASSERT_EQUAL(RemoteCommand::RELAY, cmd.type);
  TEST_ASSERT_EQUAL_STRING("misting", cmd.relayName);
  TEST_ASSERT_TRUE(cmd.state);
  TEST_ASSERT_EQUAL_UINT32(600000, cmd.durationMs);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parse("RELAY", "{\"state\":true}").type);
}

void test_clear_override_names_one_relay_or_none() {
  TEST_ASSERT_EQUAL_STRING("speaker", parse("CLEAR_OVERRIDE", "{\"relayName\":\"speaker\"}").relayName);
  RemoteCommand all = parse("CLEAR_OVERRIDE", "{}");
  TEST_ASSERT_EQUAL(RemoteCommand::CLEAR_OVERRIDE, all.type);
  TEST_ASSERT_EQUAL_STRING("", all.relayName);
}

void test_audio() {
  RemoteCommand play = parse("AUDIO", "{\"action\":\"play\",\"track\":2}");
  TEST_ASSERT_TRUE(play.audioPlay);
  TEST_ASSERT_EQUAL(2, play.track);
  TEST_ASSERT_FALSE(parse("AUDIO", "{\"action\":\"stop\"}").audioPlay);
  TEST_ASSERT_EQUAL(RemoteCommand::AUDIO, parse("AUDIO", "{\"action\":\"stop\"}").type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parse("AUDIO", "{\"action\":\"play\"}").type);
}

void test_restart_keeps_its_command_id() {
  RemoteCommand cmd = parse("RESTART", "{}");
  TEST_ASSERT_EQUAL(RemoteCommand::RESTART, cmd.type);
  TEST_ASSERT_EQUAL_STRING("c1", cmd.commandId);
  TEST_ASSERT_TRUE(cmd.issuedAt == 1770000000000ULL);
}

void test_valid_ota_keeps_its_fields() {
  RemoteCommand cmd = parseOta("1.4.1", "https://minio.example/fw/1.4.1.bin", SHA);
  TEST_ASSERT_EQUAL(RemoteCommand::OTA, cmd.type);
  TEST_ASSERT_EQUAL_STRING("1.4.1", cmd.version);
  TEST_ASSERT_EQUAL_STRING("https://minio.example/fw/1.4.1.bin", cmd.url);
  TEST_ASSERT_EQUAL_STRING(SHA, cmd.sha256);
}

void test_ota_is_rejected_when_unsafe_or_incomplete() {
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseOta("1.4.1", "http://minio.example/fw.bin", SHA).type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseOta("1.4.1", "https://minio.example/fw.bin", "abc").type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseOta("", "https://minio.example/fw.bin", SHA).type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseOta("1.4.0", "https://minio.example/fw.bin", SHA).type); // đang chạy đúng bản
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseRemoteCommand("{\"command\":\"OTA\"}", "1.4.0").type);
}

void test_too_long_url_is_rejected_not_truncated() {
  char url[400] = "https://minio.example/";
  memset(url + strlen(url), 'a', 300);
  url[322] = '\0';
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseOta("1.4.1", url, SHA).type);
}

void test_unknown_command_and_bad_json_are_invalid() {
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseRemoteCommand("{\"command\":\"FACTORY_RESET\"}", "1.4.0").type);
  TEST_ASSERT_EQUAL(RemoteCommand::INVALID, parseRemoteCommand("{not json", "1.4.0").type);
}

void test_sha256_hex_compare() {
  TEST_ASSERT_TRUE(sha256HexMatches(SHA, SHA_BYTES));
  char upper[65];
  for (int i = 0; i < 65; i++) upper[i] = (SHA[i] >= 'a' && SHA[i] <= 'f') ? SHA[i] - 32 : SHA[i];
  TEST_ASSERT_TRUE(sha256HexMatches(upper, SHA_BYTES));
  uint8_t other[32];
  memcpy(other, SHA_BYTES, 32);
  other[31] ^= 1;
  TEST_ASSERT_FALSE(sha256HexMatches(SHA, other));
  TEST_ASSERT_FALSE(sha256HexMatches("zz", SHA_BYTES));
}

void test_rollback_only_for_an_unconfirmed_image_that_never_connected() {
  const uint32_t T = 600000;
  TEST_ASSERT_FALSE(otaShouldRollback(true, false, T - 1, T));
  TEST_ASSERT_TRUE(otaShouldRollback(true, false, T, T));
  TEST_ASSERT_FALSE(otaShouldRollback(true, true, T * 2, T));  // đã kết nối = bản mới chạy được
  TEST_ASSERT_FALSE(otaShouldRollback(false, false, T * 2, T)); // nạp USB / bản đã xác nhận
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_envelope_needs_id_and_time);
  RUN_TEST(test_relay);
  RUN_TEST(test_clear_override_names_one_relay_or_none);
  RUN_TEST(test_audio);
  RUN_TEST(test_restart_keeps_its_command_id);
  RUN_TEST(test_valid_ota_keeps_its_fields);
  RUN_TEST(test_ota_is_rejected_when_unsafe_or_incomplete);
  RUN_TEST(test_too_long_url_is_rejected_not_truncated);
  RUN_TEST(test_unknown_command_and_bad_json_are_invalid);
  RUN_TEST(test_sha256_hex_compare);
  RUN_TEST(test_rollback_only_for_an_unconfirmed_image_that_never_connected);
  return UNITY_END();
}
