/**
 * AudioManager.cpp – DFPlayer Mini over UART1 (GPIO32/33)
 * SRS: ENV-FR-013b
 *
 * Lưu ý: việc đóng/ngắt Relay IN2 (nguồn amply, PIN_RELAY_SPEAKER) được thực
 * hiện ở PIDController::RelayState — AudioManager chỉ điều khiển DFPlayer qua
 * UART và quyết định "có nên phát hay không" theo lịch, main.cpp/PIDController
 * chịu trách nhiệm áp lệnh ra relay thật.
 */
#include "AudioManager.h"
#include "config/Config.h"
#include <DFRobotDFPlayerMini.h>
#include <HardwareSerial.h>
#include <time.h>

static HardwareSerial dfSerial(1); // UART1, tách riêng khỏi UART2 (RS485)
static DFRobotDFPlayerMini dfPlayer;
static bool playing = false;
static bool inWindowLastCheck = false;

namespace AudioManager {

void begin() {
  dfSerial.begin(9600, SERIAL_8N1, PIN_DFPLAYER_ESP_RX, PIN_DFPLAYER_ESP_TX);
  if (dfPlayer.begin(dfSerial)) {
    dfPlayer.volume(Config::speakerVolume);
    Serial.println("[Audio] DFPlayer Mini initialized");
  } else {
    Serial.println("[Audio] ✗ DFPlayer Mini not responding (check SD card/wiring)");
  }
}

void play(int track) {
  dfPlayer.play(track);
  playing = true;
}

void stop() {
  dfPlayer.stop();
  playing = false;
}

void setVolume(int volume0to30) {
  dfPlayer.volume(constrain(volume0to30, 0, 30));
}

void loop(bool enable) {
  if (enable) dfPlayer.enableLoop();
  else dfPlayer.disableLoop();
}

bool isPlaying() { return playing; }

bool updateSchedule() {
  if (!Config::speakerScheduleEnabled) {
    if (playing) { stop(); }
    return false;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 100)) {
    // NTP chưa đồng bộ (offline) → giữ nguyên trạng thái hiện tại (ENV-FR-014)
    return inWindowLastCheck;
  }

  int hour = timeinfo.tm_hour;
  bool inWindow =
      (hour >= Config::speakerWindow1StartHour && hour < Config::speakerWindow1EndHour) ||
      (hour >= Config::speakerWindow2StartHour && hour < Config::speakerWindow2EndHour);

  if (inWindow && !inWindowLastCheck) {
    setVolume(Config::speakerVolume);
    loop(true);
    play(Config::speakerTrack);
    Serial.println("[Audio] Speaker schedule window START → play track " + String(Config::speakerTrack));
  } else if (!inWindow && inWindowLastCheck) {
    stop();
    Serial.println("[Audio] Speaker schedule window END → stop");
  }

  inWindowLastCheck = inWindow;
  return inWindow;
}

} // namespace AudioManager
