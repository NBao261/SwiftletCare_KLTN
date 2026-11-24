/**
 * ResetReason – khởi động lại nào là bất thường và báo với lý do gì (THREAT-FR-012)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * main.cpp đổi `esp_reset_reason_t` của ESP-IDF sang BootReset rồi hỏi hàm này. Cảnh báo
 * `UNEXPECTED_RESTART` mang lý do theo SRS 3.1.0: POWER_ON | WATCHDOG | BROWNOUT | CRASH.
 * Khởi động lại chủ động (RESTART/OTA từ xa đều là ESP_RST_SW), nút reset và deep sleep
 * không phải bất thường.
 */
#pragma once

enum class BootReset { PowerOn, External, Software, Panic, IntWdt, TaskWdt, Wdt, DeepSleep, Brownout, Sdio, Unknown };

/**
 * Lý do gửi kèm `UNEXPECTED_RESTART`, hoặc nullptr nếu không báo.
 * `everConnected`: thiết bị đã từng kết nối MQTT — lần cấp điện đầu tiên lúc lắp đặt (MF-10)
 * không phải mất điện nên không báo POWER_ON.
 */
const char *unexpectedRestartReason(BootReset reset, bool everConnected);
