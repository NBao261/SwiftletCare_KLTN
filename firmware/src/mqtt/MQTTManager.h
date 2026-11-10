/**
 * MQTTManager – ESP-IDF esp-mqtt, topic và tài khoản riêng từng thiết bị (Report 4 D3, §7.2).
 * Bản dev nối 1883 không TLS; `esp32prod` nối 8883 với CA ISRG Root X1 (Config.h, MQTT_PORT).
 * SRS: ENV-FR-001, ENV-FR-015, BR-35, NFR-06 c, NFR-10 d
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

// Xử lý lệnh và cấu hình đang chờ, trong task đang gọi (mqttTask)
void processInbound();

// Publish (topics Report 4 §7.2: swiftletcare/dev/{deviceId}/...)
void publishTelemetry(const SensorData &data, const RelayState &relay);
// publish* trả true khi đã gửi được (false: mất kết nối/buffer đầy) để caller thử lại
bool publishHeartbeat();
bool publishRelayState(const RelayState &relay);
// Vào hàng đợi NVS, gửi QoS 1, xoá khi có PUBACK. resetReason: chỉ cho UNEXPECTED_RESTART
// (THREAT-FR-012) — POWER_ON | WATCHDOG | BROWNOUT | CRASH
bool publishAlert(const char *alertType, const char *severity,
                  const char *payload, const char *resetReason = nullptr);
// Gửi 1 dòng telemetry đã buffer, nguyên văn, QoS 1; true khi broker đã xác nhận (ENV-FR-024)
bool publishBufferedLine(const String &jsonLine);
} // namespace MQTTManager
