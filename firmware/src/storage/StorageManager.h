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
bool loadWifiCredentials(String &ssid, String &password); // false nếu chưa từng lưu
void saveWifiCredentials(const String &ssid, const String &password);

// NVS – IP MQTT broker nhập qua captive portal (cùng form với WiFi, xem
// WiFiProvisioner) — tách riêng vì đổi độc lập với WiFi (WiFi có thể đúng
// nhưng IP broker sai/đổi mạng khác).
bool loadMqttBroker(String &broker); // false nếu chưa từng lưu
void saveMqttBroker(const String &broker);

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
