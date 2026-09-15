/**
 * AudioManager – DFPlayer Mini control for hệ thống loa ru dẫn dụ
 * Hardware: Components Guide v3.3 §10-12 (DFPlayer Mini + PAM8403 6W)
 * SRS: ENV-FR-013b, THREAT-FR-006
 */
#pragma once
#include <Arduino.h>

namespace AudioManager {
void begin();

void play(int track);
void stop();
void setVolume(int volume0to30);
void loop(bool enable); // phát lặp bài hiện tại
bool isPlaying();

/**
 * Kiểm tra lịch phát cố định (mặc định 5-7h, 17-19h) và điều khiển
 * Relay IN2 (nguồn amply) + DFPlayer play/stop tương ứng.
 * Gọi định kỳ trong pidTask. Trả về true nếu loa ĐANG trong khung giờ hoạt động.
 */
bool updateSchedule();
} // namespace AudioManager
