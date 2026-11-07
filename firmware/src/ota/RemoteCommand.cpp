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

static RemoteCommand parseOta(JsonVariantConst payload, const char *runningVersion, RemoteCommand cmd) {
  const char *version = payload["version"] | "";
  const char *url = payload["url"] | "";
  const char *sha = payload["sha256"] | "";
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

RemoteCommand parseRemoteCommand(const char *json, const char *runningVersion) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return invalid("JSON không hợp lệ");

  RemoteCommand cmd;
  const char *commandId = doc["commandId"] | "";
  cmd.issuedAt = doc["issuedAt"] | (uint64_t)0;
  if (strlen(commandId) == 0 || !copyField(cmd.commandId, sizeof cmd.commandId, commandId))
    return invalid("thiếu hoặc sai commandId");
  if (cmd.issuedAt == 0) return invalid("thiếu issuedAt");

  const char *type = doc["type"] | "";
  JsonVariantConst payload = doc["payload"];
  const char *relayName = payload["relayName"] | "";

  if (strcmp(type, "RELAY") == 0) {
    if (strlen(relayName) == 0 || !copyField(cmd.relayName, sizeof cmd.relayName, relayName))
      return invalid("thiếu hoặc sai relayName");
    cmd.state = payload["state"] | false;
    cmd.durationMs = payload["durationMs"] | (uint32_t)0;
    cmd.type = RemoteCommand::RELAY;
    return cmd;
  }
  if (strcmp(type, "CLEAR_OVERRIDE") == 0) {
    if (!copyField(cmd.relayName, sizeof cmd.relayName, relayName)) return invalid("sai relayName");
    cmd.type = RemoteCommand::CLEAR_OVERRIDE;
    return cmd;
  }
  if (strcmp(type, "AUDIO") == 0) {
    const char *action = payload["action"] | "";
    cmd.audioPlay = strcmp(action, "play") == 0;
    cmd.track = payload["track"] | 0;
    if (!cmd.audioPlay && strcmp(action, "stop") != 0) return invalid("action phải là play hoặc stop");
    if (cmd.audioPlay && cmd.track <= 0) return invalid("thiếu track");
    cmd.type = RemoteCommand::AUDIO;
    return cmd;
  }
  if (strcmp(type, "RESTART") == 0) {
    cmd.type = RemoteCommand::RESTART;
    return cmd;
  }
  if (strcmp(type, "OTA") == 0) return parseOta(payload, runningVersion, cmd);
  return invalid("lệnh không hỗ trợ");
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
