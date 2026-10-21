#include "RemoteCommand.h"
#include <ArduinoJson.h>
#include <string.h>

static int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

static bool isSha256Hex(const char *s) {
  if (strlen(s) != 64) return false;
  for (int i = 0; i < 64; i++)
    if (hexValue(s[i]) < 0) return false;
  return true;
}

// Chép có giới hạn; chuỗi dài hơn chỗ chứa thì coi là sai (cắt bớt URL thì tải nhầm file)
static bool copyField(char *dst, size_t size, const char *src) {
  if (strlen(src) >= size) return false;
  strcpy(dst, src);
  return true;
}

static RemoteCommand invalid(const char *why) {
  RemoteCommand cmd;
  cmd.type = RemoteCommand::INVALID;
  cmd.error = why;
  return cmd;
}

RemoteCommand parseRemoteCommand(const char *json, const char *runningVersion) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return invalid("JSON không hợp lệ");

  const char *command = doc["command"] | "";
  RemoteCommand cmd;
  if (strlen(command) == 0) return cmd;
  if (strcmp(command, "RESTART") == 0) {
    cmd.type = RemoteCommand::RESTART;
    return cmd;
  }
  if (strcmp(command, "OTA") != 0) return invalid("lệnh không hỗ trợ");

  const char *version = doc["ota"]["version"] | "";
  const char *url = doc["ota"]["url"] | "";
  const char *sha = doc["ota"]["sha256"] | "";
  if (strlen(version) == 0 || !copyField(cmd.version, sizeof cmd.version, version))
    return invalid("thiếu hoặc sai version");
  if (strcmp(version, runningVersion) == 0) return invalid("đang chạy đúng bản này");
  // Backend chỉ cho https; kiểm lại ở thiết bị vì đây là file sẽ được ghi vào flash
  if (strncmp(url, "https://", 8) != 0 || !copyField(cmd.url, sizeof cmd.url, url))
    return invalid("url phải là https://");
  if (!isSha256Hex(sha)) return invalid("sha256 phải là 64 ký tự hex");
  copyField(cmd.sha256, sizeof cmd.sha256, sha);
  cmd.type = RemoteCommand::OTA;
  return cmd;
}

bool sha256HexMatches(const char *hex, const uint8_t digest[32]) {
  if (!isSha256Hex(hex)) return false;
  for (int i = 0; i < 32; i++)
    if ((hexValue(hex[2 * i]) << 4 | hexValue(hex[2 * i + 1])) != digest[i]) return false;
  return true;
}

bool otaShouldRollback(bool pendingVerify, bool everConnected, uint32_t uptimeMs, uint32_t timeoutMs) {
  return pendingVerify && !everConnected && uptimeMs >= timeoutMs;
}
