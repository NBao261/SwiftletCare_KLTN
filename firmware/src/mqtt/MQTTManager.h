/**
 * MQTTManager – PubSubClient qua WiFiClient thường (cleartext), dev-only ở
 * port 1883 (xem MQTT_PORT trong Config.h). Lên production cần đổi sang
 * WiFiClientSecure + port 8883 + CA cert thật (SEC-NFR-001) — CHƯA implement;
 * xem cờ SWIFTLETCARE_PRODUCTION_BUILD ở Config.h.
 * Pub/Sub telemetry, commands, heartbeat
 * SRS: ENV-FR-001, ENV-FR-015, §9.2, SEC-NFR-001
 */
#pragma once
#include "pid/PIDController.h"
#include "sensors/SensorManager.h"
#include <Arduino.h>

namespace MQTTManager {
void begin();
void loop();
bool isConnected();
// true khi connect thất bại liên tiếp quá ngưỡng dù WiFi vẫn lên — dấu hiệu
// IP broker sai/đổi mạng. main.cpp dùng cờ này để tự bật lại captive portal
// (giống lúc WiFi fail) cho phép nhập lại IP broker qua điện thoại.
bool isBrokerUnreachable();

// Publish (topics §9.2: swiftletcare/{farmId}/{houseId}/{zoneId}/...)
void publishTelemetry(const SensorData &data, const RelayState &relay);
// publish* trả true khi đã gửi được (false: mất kết nối/buffer đầy) để caller thử lại
bool publishHeartbeat();
bool publishRelayState(const RelayState &relay);
bool publishAlert(const char *alertType, const char *severity,
                  const char *payload);
// Publish 1 dòng JSON telemetry NGUYÊN VĂN (không build lại từ SensorData
// sống) — dùng làm callback cho StorageManager::flushBuffer() khi re-publish
// dữ liệu buffer offline (REL-NFR-003). Trả về true nếu publish thành công.
bool publishRawTelemetryLine(const String &jsonLine);

// Subscribe callbacks
void onRelayCommand(const char *payload);
void onConfigUpdate(const char *payload);
// ENV-FR-013c(c): nghe thử ngay bài trên thẻ SD, bỏ qua lịch
void onAudioCommand(const char *payload);
// Flow 21 Nhánh A (FARM-FR-007b): dời thiết bị sang Zone/Farm khác lúc
// đang ONLINE. Lưu farmId/houseId/zoneId mới vào NVS rồi ESP.restart().
void onConfigReassign(const char *payload);
} // namespace MQTTManager
