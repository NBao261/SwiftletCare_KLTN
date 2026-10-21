/**
 * RemoteOta – tải firmware từ URL rồi ghi vào phân vùng OTA dự phòng (Flow 15 bước 4)
 *
 * Bản mới chỉ được khởi động khi tải đủ và SHA-256 khớp với giá trị backend gửi kèm
 * (case 4a/4b: mất mạng giữa chừng hay file hỏng thì thiết bị vẫn chạy bản cũ).
 * Chạy đồng bộ trong mqttTask (tự reset watchdog); pidTask ở core kia vẫn điều khiển
 * relay trong lúc tải.
 */
#pragma once

namespace RemoteOta {
/** true = đã ghi xong và đặt phân vùng khởi động, caller restart để chạy bản mới */
bool download(const char *url, const char *sha256Hex);
} // namespace RemoteOta
