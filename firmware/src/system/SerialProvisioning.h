/**
 * SerialProvisioning – nhận mã thiết bị và mật khẩu broker qua cổng USB từ màn Kho thiết bị
 * (Web Serial, FARM-FR-010, Report 4 D9). Giao thức: docs/reports/todo-device-flashing-1124.md §2.
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 *   SC INFO
 *   SC SET {"deviceId":"ctl-a1b2c3","brokerSecret":"…","broker":"mqtt.swiftletcare.io.vn","force":false}
 *
 * Trả lời một dòng `SC> {json}` để trang web tách khỏi log thường.
 */
#pragma once
#include <stddef.h>

// Dòng dài nhất nhận: lệnh SET ~200 ký tự, chừa chỗ
static const size_t SERIAL_LINE_MAX = 384;

struct SerialRequest {
  enum Type { NONE, INFO, SET, INVALID };
  Type type = NONE;
  char deviceId[41] = "";
  char brokerSecret[65] = "";
  char broker[101] = ""; // rỗng: giữ địa chỉ broker biên dịch sẵn
  bool force = false;
  const char *error = ""; // mã lỗi trả về trang khi INVALID
};

/** Dòng không bắt đầu bằng "SC " (log, gõ nhầm) → NONE, bỏ qua không trả lời */
SerialRequest parseSerialLine(const char *line);

/** Cùng bộ ký tự với DEVICE_ID_PATTERN của backend (chữ, số, `_`, `-`); tối đa 40 ký tự cho vừa bộ đệm */
bool isValidDeviceId(const char *id);

/** Đã có danh tính mà không gửi force thì từ chối, tránh ghi nhầm bo mạch đang dùng; nullptr là cho ghi */
const char *setBlockedReason(const SerialRequest &request, bool alreadyProvisioned);

/** `mac`: 6 byte của chip → "A1B2C3D4E5F6" */
void formatMac(const unsigned char mac[6], char out[13]);

/** `deviceId` nullptr hoặc rỗng: chưa có danh tính */
size_t buildInfoReply(char *out, size_t size, const char *mac, const char *firmwareVersion, const char *deviceId);
size_t buildOkReply(char *out, size_t size, const char *deviceId);
size_t buildErrorReply(char *out, size_t size, const char *error);

/** Gom ký tự serial thành dòng; dòng quá dài bị bỏ tới hết dòng */
class SerialLineBuffer {
public:
  /** true khi vừa xong một dòng (đọc bằng line()) */
  bool feed(char c);
  const char *line() const { return buffer; }

private:
  char buffer[SERIAL_LINE_MAX + 1] = "";
  size_t length = 0;
  bool overflow = false;
};
