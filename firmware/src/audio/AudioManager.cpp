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
// true khi DFPlayer báo có thẻ SD/USB (lúc khởi động hoặc cắm sau đó — xem
// pollModule()). Chưa sẵn sàng thì mọi lệnh play/stop/volume/loop bị bỏ qua.
static bool dfReady = false;

// Thư viện chỉ chờ 2s sau reset cho thông báo "online", nhưng thẻ lớn (32GB) có
// thể cần 3-4s để module đọc xong hệ thống file → chờ thêm trước khi kết luận.
static const unsigned long DF_EXTRA_WAIT_MS = 4000;

static bool isStorageOnline(uint8_t type) {
  return type == DFPlayerCardOnline || type == DFPlayerUSBOnline || type == DFPlayerCardUSBOnline ||
         type == DFPlayerCardInserted || type == DFPlayerUSBInserted;
}

// Nghe thử (ENV-FR-013c(c)) — ghi từ mqttTask, đọc/xoá trong pidTask
static volatile int pendingPlayTrack = 0; // >0 = có yêu cầu phát bài này
static volatile bool pendingStop = false;
static bool forcedPlaying = false;
static unsigned long forcedSince = 0;

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
  int param = dfPlayer.read();
  unsigned long deadline = millis() + DF_EXTRA_WAIT_MS;
  while (!isStorageOnline(type) && millis() < deadline) {
    if (dfPlayer.available()) {
      type = dfPlayer.readType();
      param = dfPlayer.read();
    } else {
      delay(50);
    }
  }
  // Luôn hỏi số file: (1) một số module clone không tự gửi thông báo "online";
  // (2) thông báo "online" chỉ chứng minh chiều DFPlayer → ESP32 — có câu trả lời
  // cho câu hỏi này mới chứng minh module NHẬN được lệnh (dây GPIO33 → RX).
  int files = dfPlayer.readFileCounts();
  if (files < 0) files = dfPlayer.readFileCounts(); // thử lại 1 lần, module vừa reset có thể còn bận
  dfReady = isStorageOnline(type) || files > 0;

  if (dfReady) {
    dfPlayer.volume(Config::speakerVolume);
    Serial.println("[Audio] DFPlayer Mini initialized (type=" + String(type) + " files=" + String(files) + ")");
    if (files < 0) {
      Serial.println("[Audio] ⚠ Module báo có thẻ nhưng KHÔNG trả lời câu hỏi của ESP32 — nhiều khả năng dây "
                     "GPIO33 → RX của DFPlayer (qua trở 1kΩ) hở hoặc sai chân: lệnh phát sẽ không tới module, "
                     "amply chỉ kêu è. (Một số module clone không hỗ trợ câu hỏi này — khi đó bỏ qua cảnh báo.)");
    } else if (files == 0) {
      Serial.println("[Audio] ⚠ Thẻ không có file nhạc nào module đọc được (cần 0001.mp3 ở thư mục gốc, FAT32)");
    }
  } else {
    // type: 0 = module im lặng hoàn toàn (dây TX/RX, nguồn 5V, module hỏng);
    //       6 = module trả lỗi, param = mã lỗi (vd 1 = đang bận/không thấy thẻ);
    //       khác = có phản hồi nhưng không báo có thẻ.
    Serial.println("[Audio] ✗ DFPlayer Mini chưa sẵn sàng — type=" + String(type) + " param=" + String(param) +
                   " files=" + String(files) +
                   (type == TimeOut ? " → module KHÔNG phản hồi: kiểm tra dây GPIO32/33 và nguồn 5V"
                                    : " → module có phản hồi nhưng không thấy thẻ: kiểm tra thẻ SD (FAT32, cắm sát)") +
                   ". Bỏ qua phát nhạc, relay amply vẫn chạy theo lịch; sẽ tự nhận khi cắm thẻ.");
  }
}

// Module tự gửi thông báo khi cắm/rút thẻ lúc đang chạy — đọc không chặn (gọi
// mỗi chu kỳ từ updateSchedule) để không phải khởi động lại board mới nhận thẻ.
static void pollModule() {
  if (!dfPlayer.available()) return;
  uint8_t type = dfPlayer.readType();
  dfPlayer.read();
  if (isStorageOnline(type) && !dfReady) {
    dfReady = true;
    dfPlayer.volume(Config::speakerVolume);
    inWindowLastCheck = false; // đang trong khung giờ thì phát ngay ở chu kỳ này
    Serial.println("[Audio] DFPlayer Mini đã nhận thẻ → sẵn sàng phát");
  } else if ((type == DFPlayerCardRemoved || type == DFPlayerUSBRemoved) && dfReady) {
    dfReady = false;
    playing = false;
    Serial.println("[Audio] ✗ Thẻ SD bị rút — dừng phát nhạc");
  }
}

// Thư viện chỉ chờ 10ms giữa 2 lệnh, nhưng nhiều đời chip MP3-TF-16P bỏ lệnh thứ
// hai nếu tới quá sát (đã gặp thật: module trả lời truy vấn nhưng không chịu phát).
// ponytail: chạy trong pidTask đang giữ dataMutex — 150ms mỗi lần BẮT ĐẦU phát là
// chấp nhận được; nếu cần gửi lệnh dày hơn thì chuyển sang hàng đợi không chặn.
static const unsigned long DF_CMD_GAP_MS = 150;

/**
 * Đặt âm lượng rồi phát. looped = phát lặp bài đó bằng MỘT lệnh (0x08) — không
 * dùng enableLoop()/disableLoop() (0x19): lệnh đó chỉ có nghĩa khi đang phát, gửi
 * trước lệnh play làm một số module bỏ luôn lệnh play.
 */
static void startPlayback(int track, bool looped) {
  if (!dfReady) return;
  dfPlayer.volume(constrain((int)Config::speakerVolume, 0, 30));
  delay(DF_CMD_GAP_MS);
  if (looped) dfPlayer.loop(track);
  else dfPlayer.play(track);
  playing = true;
}

void play(int track) { startPlayback(track, false); }

void stop() {
  if (dfReady) {
    dfPlayer.stop();
    delay(DF_CMD_GAP_MS); // để lệnh phát ngay sau đó (hết nghe thử → về lịch) không bị bỏ
  }
  playing = false;
}

void setVolume(int volume0to30) {
  if (!dfReady) return;
  dfPlayer.volume(constrain(volume0to30, 0, 30));
}

bool isPlaying() { return playing; }

void requestPlay(int track) {
  if (track > 0) pendingPlayTrack = track;
}

void requestStop() { pendingStop = true; }

bool updateSchedule() {
  pollModule();

  // ── Nghe thử: ưu tiên hơn lịch và bỏ qua speakerScheduleEnabled ─────────
  int track = pendingPlayTrack;
  if (track > 0) {
    pendingPlayTrack = 0;
    pendingStop = false;
    startPlayback(track, false);
    forcedPlaying = true;
    forcedSince = millis();
    Serial.println("[Audio] Nghe thử track " + String(track) +
                   (dfReady ? "" : " — DFPlayer chưa sẵn sàng, chỉ bật nguồn amply"));
  }
  if (forcedPlaying) {
    if (!pendingStop && millis() - forcedSince < FORCE_PLAY_MAX_MS) return true;
    pendingStop = false;
    forcedPlaying = false;
    stop();
    // Đang trong khung giờ thì phần dưới phát lại bài theo lịch ngay chu kỳ này
    inWindowLastCheck = false;
    Serial.println("[Audio] Kết thúc nghe thử → quay về lịch");
  }
  pendingStop = false; // lệnh dừng khi không nghe thử gì → bỏ qua

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
    startPlayback(Config::speakerTrack, true);
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
