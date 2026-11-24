/**
 * CommandFilter – chặn lệnh trùng và lệnh trễ (BR-35)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Mỗi `commandId` chỉ áp 1 lần (QoS 1 và phiên bền có thể giao lại). Nhớ trong RAM; mã RESTART, OTA
 * vừa áp được lưu NVS rồi nạp lại bằng remember() vì chúng khởi động lại thiết bị.
 *
 * Tuổi lệnh so với giờ NTP, tuỳ loại lệnh (Report 4 §7.2, Report 3 §8.1):
 * - FRESH_REQUIRED (RELAY): không biết tuổi thì bỏ, vì phiên bền có thể giao lệnh tồn đọng ngay sau khi
 *   khởi động, lúc chưa có NTP, mà bơm chạy theo lệnh cũ là tác động thật lên nhà yến;
 * - FRESH_IF_KNOWN (AUDIO, RESTART): chưa có NTP thì vẫn áp, để còn khôi phục thiết bị từ xa;
 * - ANY_AGE (CLEAR_OVERRIDE, OTA): về AUTO luôn an toàn, OTA đã có kiểm tra phiên bản.
 * `issuedAt` ở tương lai là đồng hồ hai bên lệch, không phải lệnh cũ.
 */
#pragma once
#include <stdint.h>

constexpr uint64_t COMMAND_MAX_AGE_MS = 60000; // BR-35
constexpr uint8_t COMMAND_ID_MEMORY = 16;
constexpr uint8_t COMMAND_ID_SIZE = 40; // UUID 36 ký tự + kết thúc chuỗi

class CommandFilter {
public:
  enum Result { APPLY, DUPLICATE, STALE };
  enum AgePolicy { ANY_AGE, FRESH_IF_KNOWN, FRESH_REQUIRED };

  /** nowEpochMs = 0: chưa có giờ NTP. Mã đã xét được ghi nhớ, kể cả khi lệnh bị bỏ vì cũ */
  Result check(const char *commandId, uint64_t issuedAtMs, uint64_t nowEpochMs, AgePolicy policy);
  void remember(const char *commandId);

private:
  bool known(const char *commandId) const;

  char ids[COMMAND_ID_MEMORY][COMMAND_ID_SIZE] = {};
  uint8_t next = 0;
};
