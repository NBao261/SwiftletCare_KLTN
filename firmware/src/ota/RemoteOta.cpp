#include "RemoteOta.h"
#include "RemoteCommand.h"
#include "config/Config.h"
#include <HTTPClient.h>
#include <Update.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>
#include <mbedtls/sha256.h>

namespace RemoteOta {

bool download(const char *url, const char *sha256Hex) {
  // ponytail: không kiểm chứng chỉ máy chủ — tính toàn vẹn dựa vào SHA-256 đi kèm lệnh
  // MQTT (file bị tráo trên đường thì hash lệch, không flash). Có CA của MinIO thì
  // thay bằng setCACert() để chặn luôn việc tải từ máy chủ giả.
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(OTA_READ_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    Serial.println("[OTA] URL không hợp lệ");
    return false;
  }
  int code = http.GET();
  int total = http.getSize();
  if (code != HTTP_CODE_OK || total <= 0) {
    // Cần Content-Length để biết đã tải đủ chưa (case 4a)
    Serial.printf("[OTA] Tải thất bại: HTTP %d, size %d\n", code, total);
    http.end();
    return false;
  }
  if (!Update.begin(total)) {
    Serial.printf("[OTA] Không đủ chỗ cho %d byte: %s\n", total, Update.errorString());
    http.end();
    return false;
  }

  mbedtls_sha256_context sha;
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts(&sha, 0);
  static uint8_t buf[1024]; // static: stack mqttTask còn phải gánh TLS
  WiFiClient *stream = http.getStreamPtr();
  int written = 0;
  while (written < total) {
    esp_task_wdt_reset();
    int n = stream->readBytes(buf, min((int)sizeof buf, total - written));
    if (n <= 0) break; // hết thời gian chờ đọc = mất mạng giữa chừng
    mbedtls_sha256_update(&sha, buf, n);
    if (Update.write(buf, n) != (size_t)n) break;
    written += n;
  }
  uint8_t digest[32];
  mbedtls_sha256_finish(&sha, digest);
  mbedtls_sha256_free(&sha);
  http.end();

  if (written != total) {
    Serial.printf("[OTA] Dừng ở %d/%d byte — giữ firmware cũ\n", written, total);
    Update.abort();
    return false;
  }
  if (!sha256HexMatches(sha256Hex, digest)) {
    Serial.println("[OTA] SHA-256 không khớp — giữ firmware cũ");
    Update.abort();
    return false;
  }
  if (!Update.end()) {
    Serial.printf("[OTA] Ghi phân vùng thất bại: %s\n", Update.errorString());
    return false;
  }
  return true;
}

} // namespace RemoteOta
