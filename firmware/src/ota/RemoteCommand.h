/**
 * RemoteCommand – đọc phong bì lệnh trên topic `cmd` (Report 4 §7.2, BR-35, Flow 15)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 *   {"commandId":"…","type":"RELAY","issuedAt":1770000000000,
 *    "payload":{"relayName":"misting","state":true,"durationMs":600000}}
 *
 * type: RELAY, CLEAR_OVERRIDE (`relayName` tuỳ chọn), AUDIO (`action` play|stop, `track`), RESTART,
 * OTA (`version`, `url`, `sha256`). Thiếu `commandId` hoặc `issuedAt` là lệnh sai: bỏ.
 */
#pragma once
#include <stddef.h>
#include <stdint.h>

struct RemoteCommand {
  enum Type { INVALID, RELAY, CLEAR_OVERRIDE, AUDIO, RESTART, OTA };
  Type type = INVALID;
  char commandId[40] = "";
  uint64_t issuedAt = 0;
  // RELAY, CLEAR_OVERRIDE
  char relayName[16] = "";
  bool state = false;
  uint32_t durationMs = 0; // 0: lệnh không nêu thời hạn
  // AUDIO
  bool audioPlay = false;
  int track = 0;
  // OTA
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
