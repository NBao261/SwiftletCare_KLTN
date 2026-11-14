/**
 * StorageManager – NVS config + SPIFFS offline buffer
 * SRS: REL-NFR-003, ENV-FR-014
 */
#pragma once
#include "sensors/SensorManager.h"

namespace StorageManager {
void begin();

// NVS – config persistence
void saveConfig();
void loadConfig();

// NVS – WiFi credentials nhập qua captive portal (WiFiProvisioner). Tách khỏi
// saveConfig()/loadConfig() vì vòng đời khác hẳn: chỉ ghi khi người dùng chủ
// động đổi WiFi, không phải mỗi lần đổi ngưỡng cảm biến.
bool loadWifiCredentials(String &ssid,
                         String &password); // false nếu chưa từng lưu
void saveWifiCredentials(const String &ssid, const String &password);

// NVS – IP MQTT broker nhập qua captive portal (cùng form với WiFi, xem
// WiFiProvisioner) — tách riêng vì đổi độc lập với WiFi (WiFi có thể đúng
// nhưng IP broker sai/đổi mạng khác).
bool loadMqttBroker(String &broker); // false nếu chưa từng lưu
void saveMqttBroker(const String &broker);

// NVS – thiết bị đã từng kết nối MQTT (THREAT-FR-012): lần cấp điện đầu tiên lúc lắp đặt
// không phải mất điện nên không báo UNEXPECTED_RESTART. Chỉ ghi 1 lần trong đời thiết bị.
bool loadEverConnected();
void markEverConnected();

// NVS – device ID và mật khẩu broker do tools/flash_identity.py ghi (namespace `identity`). false nếu chưa flash
bool loadDeviceIdentity(String &deviceId, String &brokerSecret);
// NVS – địa chỉ broker nạp lúc flash (`flash_identity.py --broker`, namespace `identity`, FARM-FR-003c). false nếu không nạp
bool loadFlashedBroker(String &broker);

// NVS – hàng đợi cảnh báo chờ PUBACK (Report 4 §7.2, NFR-06 c), lưu nguyên khối
void saveAlertQueue(const void *data, size_t size);
void loadAlertQueue(void *data, size_t size); // kích thước lệch (đổi firmware) thì giữ nguyên hàng đợi rỗng

// NVS – mã lệnh RESTART/OTA vừa áp (BR-35): bản giao lại sau khi khởi động không được áp lần nữa
void saveLastRestartCommand(const char *commandId);
String loadLastRestartCommand();

// NVS – dấu của `config` đã áp, `config` retained về lại mỗi lần kết nối
uint32_t loadConfigHash();
void saveConfigHash(uint32_t hash);

// SPIFFS – offline telemetry buffer
void bufferTelemetry(const SensorData &data);

// Callback dùng để publish 1 dòng JSON đã buffer — tách khỏi MQTTManager để
// StorageManager (lớp thấp hơn) không phải include/phụ thuộc ngược lên
// MQTTManager (MQTTManager.cpp đã include StorageManager.h). Trả về true
// nếu publish thành công.
typedef bool (*PublishLineFn)(const String &jsonLine);

// Đọc từng dòng JSONL trong buffer, gọi publishLine() cho từng dòng. Chỉ xoá
// buffer nếu TẤT CẢ dòng trong lượt này publish thành công; nếu 1 dòng lỗi
// giữa chừng, dừng lại và GIỮ NGUYÊN file để lần flush kế tiếp thử lại từ
// đầu (chấp nhận khả năng publish trùng — dashboard/telemetry consumer chịu
// được dữ liệu trùng — còn hơn mất vĩnh viễn dữ liệu offline).
void flushBuffer(PublishLineFn publishLine);
int getBufferCount();
void clearBuffer();
} // namespace StorageManager
