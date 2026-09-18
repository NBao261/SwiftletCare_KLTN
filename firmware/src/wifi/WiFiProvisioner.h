/**
 * WiFiProvisioner – tự phục vụ đổi WiFi không cần cắm USB/nạp lại firmware.
 *
 * Vấn đề: mỗi lần farm đổi router/đổi nhà mạng, hoặc thiết bị bị mang đi chỗ
 * khác, ESP32 sẽ không kết nối được WiFi cũ và trước đây phải sửa Secrets.h
 * rồi nạp lại qua USB — việc này đúng ra không cần Technician (không đụng
 * phần cứng), nên không nên bắt Farm Owner chờ Technician chỉ vì đổi WiFi.
 *
 * Giải pháp: nếu WiFi đã lưu (NVS hoặc mặc định Secrets.h) kết nối thất bại —
 * HOẶC WiFi vẫn lên nhưng MQTT broker không connect được quá lâu dù đã thử
 * mDNS tự tìm ("swiftletcare-broker.local", xem
 * MQTTManager::resolveBrokerViaMdns()/isBrokerUnreachable()) — ESP32 tự phát
 * 1 mạng WiFi tạm ("SwiftletCare-Setup-<deviceId>"). Ai đó (Farm Owner, không
 * cần kỹ thuật) lấy điện thoại kết nối vào, trình duyệt tự mở trang nhập lại
 * WiFi và/hoặc IP MQTT broker (captive portal, chỉ cần dùng khi mDNS không
 * hoạt động được, VD mạng chặn multicast) — nhập xong, ESP32 lưu vào NVS và
 * khởi động lại. Không cần Web Dashboard, không cần Technician, không đổi
 * farmId/houseId/zoneId/mqttUsername/mqttPassword (những thứ đó vẫn của
 * Technician lúc lắp máy mới — xem Flow 1, FARM-FR-003b).
 */
#pragma once
#include <Arduino.h>
#include <ESPAsyncWebServer.h>

namespace WiFiProvisioner {

/**
 * Nạp WiFi đã lưu (NVS, hoặc mặc định Secrets.h nếu chưa từng cấu hình qua
 * portal) và thử kết nối trong tối đa ~10s. Trả về true nếu kết nối được.
 */
bool tryConnect();

/**
 * Gọi khi tryConnect() thất bại. Chuyển ESP32 sang AP-mode, phát WiFi tạm,
 * gắn route vào `server` (dùng chung AsyncWebServer với OTA — chỉ 1 instance
 * được nghe cổng 80) để phục vụ trang nhập WiFi mới. Không block — các task
 * cảm biến/relay/PID vẫn chạy bình thường (REL-NFR-001, offline resilience).
 */
void startCaptivePortal(AsyncWebServer &server);

/** Gọi trong loop() để DNS server xử lý captive-portal redirect. No-op nếu portal không chạy. */
void handleDnsLoop();

/** true nếu đang ở AP-mode chờ người dùng nhập WiFi mới */
bool isPortalActive();

} // namespace WiFiProvisioner
