/**
 * RemoteCommand – đọc lệnh từ xa trong `config/update` (TICKET-FR-008, Flow 15)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Backend (`device.service#sendRemoteCommand`) gửi chung topic `config/update` với gói
 * ngưỡng, phân biệt bằng trường `command`:
 *   {"deviceId":"…","command":"RESTART"}
 *   {"deviceId":"…","command":"OTA","ota":{"version":"1.4.1","url":"https://…","sha256":"<64 hex>"}}
 * Không có `command` = gói cấu hình thường (PUSH_CONFIG, ngưỡng, lịch loa) → NONE.
 */
#pragma once
#include <stddef.h>
#include <stdint.h>

struct RemoteCommand {
  enum Type { NONE, RESTART, OTA, INVALID };
  Type type = NONE;
  char version[32] = "";
  char url[256] = "";
  char sha256[65] = "";
  const char *error = ""; // lý do khi INVALID — chỉ để log
};

/** `runningVersion`: FIRMWARE_VERSION đang chạy — OTA trùng bản bị từ chối như backend */
RemoteCommand parseRemoteCommand(const char *json, const char *runningVersion);

/** `hex` (64 ký tự, hoa/thường đều được) có đúng là `digest` 32 byte không */
bool sha256HexMatches(const char *hex, const uint8_t digest[32]);

/**
 * Flow 15 bước 5a — bản mới vừa OTA (bootloader để ở trạng thái chờ xác nhận) mà quá
 * `timeoutMs` từ lúc khởi động chưa kết nối được MQTT lần nào thì trả true: thiết bị
 * phải quay về bản cũ, nếu không sẽ không bao giờ nhận được lệnh OTA tiếp theo.
 */
bool otaShouldRollback(bool pendingVerify, bool everConnected, uint32_t uptimeMs, uint32_t timeoutMs);
