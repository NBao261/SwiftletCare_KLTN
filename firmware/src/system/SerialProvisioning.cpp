#include "SerialProvisioning.h"
#include <ArduinoJson.h>
#include <stdio.h>
#include <string.h>

static bool startsWith(const char *text, const char *prefix) { return strncmp(text, prefix, strlen(prefix)) == 0; }

bool isValidDeviceId(const char *id) {
  size_t length = strlen(id);
  if (length == 0 || length > 40) return false;
  for (size_t i = 0; i < length; i++) {
    char c = id[i];
    bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-';
    if (!ok) return false;
  }
  return true;
}

static SerialRequest invalid(const char *error) {
  SerialRequest request;
  request.type = SerialRequest::INVALID;
  request.error = error;
  return request;
}

// Chép có giới hạn; dài hơn chỗ chứa thì coi là sai (cắt mật khẩu thì không đăng nhập được broker)
static bool copyField(char *dst, size_t size, const char *src) {
  if (strlen(src) >= size) return false;
  strcpy(dst, src);
  return true;
}

static SerialRequest parseSet(const char *json) {
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok || !doc.is<JsonObject>()) return invalid("BAD_JSON");
  SerialRequest request;
  request.type = SerialRequest::SET;
  const char *deviceId = doc["deviceId"] | "";
  const char *secret = doc["brokerSecret"] | "";
  const char *broker = doc["broker"] | "";
  if (!isValidDeviceId(deviceId)) return invalid("BAD_DEVICE_ID");
  strcpy(request.deviceId, deviceId);
  if (strlen(secret) == 0 || !copyField(request.brokerSecret, sizeof request.brokerSecret, secret)) return invalid("BAD_SECRET");
  // Địa chỉ broker là tên miền hoặc IP: có khoảng trắng là gõ nhầm
  if (!copyField(request.broker, sizeof request.broker, broker) || strchr(broker, ' ') != nullptr) return invalid("BAD_BROKER");
  request.force = doc["force"] | false;
  return request;
}

SerialRequest parseSerialLine(const char *line) {
  if (!startsWith(line, "SC ")) return SerialRequest();
  const char *rest = line + 3;
  if (strcmp(rest, "INFO") == 0) {
    SerialRequest request;
    request.type = SerialRequest::INFO;
    return request;
  }
  if (startsWith(rest, "SET ")) return parseSet(rest + 4);
  return invalid("UNKNOWN_COMMAND");
}

const char *setBlockedReason(const SerialRequest &request, bool alreadyProvisioned) {
  return alreadyProvisioned && !request.force ? "PROVISIONED" : nullptr;
}

void formatMac(const unsigned char mac[6], char out[13]) {
  snprintf(out, 13, "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

// Dòng trả lời một lần ghi: log của task khác không chen vào giữa
static size_t writeReply(char *out, size_t size, JsonDocument &doc) {
  size_t prefix = (size_t)snprintf(out, size, "SC> ");
  if (prefix >= size) return 0;
  return prefix + serializeJson(doc, out + prefix, size - prefix);
}

size_t buildInfoReply(char *out, size_t size, const char *mac, const char *firmwareVersion, const char *deviceId) {
  JsonDocument doc;
  doc["ok"] = true;
  doc["mac"] = mac;
  doc["fw"] = firmwareVersion;
  // Firmware này chỉ chạy trên bộ điều khiển; camera là máy tính AI, không nạp qua đây
  doc["kind"] = "SENSOR";
  if (deviceId != nullptr && deviceId[0] != '\0') doc["deviceId"] = deviceId;
  else doc["deviceId"] = nullptr;
  return writeReply(out, size, doc);
}

size_t buildOkReply(char *out, size_t size, const char *deviceId) {
  JsonDocument doc;
  doc["ok"] = true;
  doc["deviceId"] = deviceId;
  return writeReply(out, size, doc);
}

size_t buildErrorReply(char *out, size_t size, const char *error) {
  JsonDocument doc;
  doc["ok"] = false;
  doc["error"] = error;
  return writeReply(out, size, doc);
}

bool SerialLineBuffer::feed(char c) {
  if (c == '\r') return false;
  if (c == '\n') {
    bool complete = !overflow;
    buffer[overflow ? 0 : length] = '\0';
    length = 0;
    overflow = false;
    return complete;
  }
  if (overflow) return false;
  if (length >= SERIAL_LINE_MAX) {
    overflow = true;
    length = 0;
    return false;
  }
  buffer[length++] = c;
  return false;
}
