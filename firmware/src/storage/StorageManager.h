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

// SPIFFS – offline telemetry buffer
void bufferTelemetry(const SensorData &data);
void flushBuffer(); // Upload all buffered records via MQTT
int getBufferCount();
void clearBuffer();
} // namespace StorageManager
