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
// true chỉ khi DFPlayer báo có thẻ SD/USB lúc khởi động. Chưa sẵn sàng thì mọi
// lệnh play/stop/volume/loop bị bỏ qua, không gửi gì xuống module.
static bool dfReady = false;

namespace AudioManager {

void begin() {
  dfSerial.begin(9600, SERIAL_8N1, PIN_DFPLAYER_ESP_RX, PIN_DFPLAYER_ESP_TX);
  // isACK=false là BẮT BUỘC. Với isACK=true, mỗi lệnh gửi đi thư viện chờ khung
  // ACK 0x41 bằng `while (_isSending) waitAvailable()` mà chỉ thoát khi ACK về
  // hoặc waitAvailable() báo timeout. Nếu DFPlayer trả về một khung khác (vd
  // lỗi 0x40 "không có thẻ SD"), _isAvailable bị kẹt true nên waitAvailable()
  // return ngay không bao giờ timeout — vòng lặp quay vô hạn trong pidTask
  // (ưu tiên cao hơn sensorTask, lại đang giữ dataMutex), làm sensorTask đói
  // CPU và Task WDT reset cả board. isACK=false thì sendStack() chỉ delay 10ms.
  dfPlayer.begin(dfSerial, /*isACK=*/false, /*doReset=*/true);

  // begin() với isACK=false luôn trả true nên không dùng để biết module có sẵn
  // sàng không — đọc loại thông báo cuối cùng module gửi (TimeOut nếu im lặng).
  uint8_t type = dfPlayer.readType();
  dfReady = (type == DFPlayerCardOnline || type == DFPlayerUSBOnline);

  if (dfReady) {
    dfPlayer.volume(Config::speakerVolume);
    Serial.println("[Audio] DFPlayer Mini initialized");
  } else {
    Serial.println("[Audio] ✗ DFPlayer Mini chưa sẵn sàng (thiếu thẻ SD / sai dây) "
                   "— bỏ qua phát nhạc, relay amply vẫn chạy theo lịch");
  }
}

void play(int track) {
  if (!dfReady) return;
  dfPlayer.play(track);
  playing = true;
}

void stop() {
  if (dfReady) dfPlayer.stop();
  playing = false;
}

void setVolume(int volume0to30) {
  if (!dfReady) return;
  dfPlayer.volume(constrain(volume0to30, 0, 30));
}

void loop(bool enable) {
  if (!dfReady) return;
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
    Serial.println(dfReady ? "[Audio] Speaker schedule window START → play track " + String(Config::speakerTrack)
                           : "[Audio] Speaker schedule window START — DFPlayer chưa sẵn sàng, không phát nhạc");
  } else if (!inWindow && inWindowLastCheck) {
    stop();
    Serial.println("[Audio] Speaker schedule window END → stop");
  }

  inWindowLastCheck = inWindow;
  return inWindow;
}

} // namespace AudioManager
