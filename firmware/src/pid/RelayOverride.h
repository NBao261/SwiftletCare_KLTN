/**
 * RelayOverride – hạn can thiệp tay riêng từng relay (BR-20, ENV-FR-018)
 *
 * C++ thuần (không include Arduino) để chạy unit test trên host: pio test -e native
 *
 * Mỗi relay nhớ lúc bật và thời lượng, so bằng `now - startMs >= durationMs` nên vẫn
 * đúng khi millis() tràn sau 49 ngày. Bật tay relay này không đổi hạn relay khác.
 */
#pragma once
#include <stdint.h>

enum RelayChannel : uint8_t { RELAY_MISTING, RELAY_SPEAKER, RELAY_VENTILATION, RELAY_CHANNEL_COUNT };

/** Tên trong lệnh relay/command → kênh; tên sai thì trả false */
bool relayChannelFromName(const char *name, RelayChannel &channel);
const char *relayChannelName(RelayChannel channel);

class RelayOverrides {
public:
  void set(RelayChannel channel, uint32_t nowMs, uint32_t durationMs);
  void clear(RelayChannel channel);
  void clearAll();
  bool active(RelayChannel channel) const;
  bool any() const;
  bool expired(RelayChannel channel, uint32_t nowMs) const;
  /** 0 khi relay không can thiệp tay hoặc đã hết hạn */
  uint32_t remainingMs(RelayChannel channel, uint32_t nowMs) const;

private:
  struct Slot {
    bool active = false;
    uint32_t startMs = 0;
    uint32_t durationMs = 0;
  };
  Slot slots[RELAY_CHANNEL_COUNT];
};
