/**
 * CommandFilter – chặn lệnh trùng và lệnh trễ (BR-35)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Mỗi `commandId` chỉ áp 1 lần (QoS 1 có thể giao lại); nhớ trong RAM nên khởi động lại là
 * quên — G-07 lưu RESTART/OTA vào NVS. Lệnh relay, audio, RESTART tới trễ hơn
 * COMMAND_MAX_AGE_MS thì bỏ; clear_override và OTA chỉ chặn trùng (requireFresh = false).
 *
 * Trường hợp vẫn áp, có chủ ý:
 * - lệnh không có `commandId`: backend cũ, tới G-07 mới bắt buộc;
 * - thiết bị chưa có giờ NTP (nowEpochMs = 0) hoặc lệnh không có `issuedAt`: không kiểm được
 *   tuổi lệnh, nhưng không được khoá chủ nhà khỏi điều khiển tay (Report 3 §8.1);
 * - `issuedAt` ở tương lai: đồng hồ hai bên lệch, không phải lệnh cũ.
 */
#pragma once
#include <stdint.h>

constexpr uint64_t COMMAND_MAX_AGE_MS = 60000; // BR-35
constexpr uint8_t COMMAND_ID_MEMORY = 16;
constexpr uint8_t COMMAND_ID_SIZE = 40; // UUID 36 ký tự + kết thúc chuỗi

class CommandFilter {
public:
  enum Result { APPLY, DUPLICATE, STALE };

  /** Mã đã xét thì được ghi nhớ, kể cả khi lệnh bị bỏ vì cũ: bản giao lại sẽ là DUPLICATE */
  Result check(const char *commandId, uint64_t issuedAtMs, uint64_t nowEpochMs, bool requireFresh);

private:
  char ids[COMMAND_ID_MEMORY][COMMAND_ID_SIZE] = {};
  uint8_t next = 0;
};
