#include "RelayOverride.h"
#include <string.h>

static const char *const CHANNEL_NAMES[RELAY_CHANNEL_COUNT] = {"misting", "speaker", "ventilation"};

bool relayChannelFromName(const char *name, RelayChannel &channel) {
  for (uint8_t i = 0; i < RELAY_CHANNEL_COUNT; i++) {
    if (strcmp(name, CHANNEL_NAMES[i]) == 0) {
      channel = static_cast<RelayChannel>(i);
      return true;
    }
  }
  return false;
}

const char *relayChannelName(RelayChannel channel) { return CHANNEL_NAMES[channel]; }

void RelayOverrides::set(RelayChannel channel, uint32_t nowMs, uint32_t durationMs) {
  slots[channel].active = true;
  slots[channel].startMs = nowMs;
  slots[channel].durationMs = durationMs;
}

void RelayOverrides::clear(RelayChannel channel) { slots[channel] = Slot(); }

void RelayOverrides::clearAll() {
  for (uint8_t i = 0; i < RELAY_CHANNEL_COUNT; i++) slots[i] = Slot();
}

bool RelayOverrides::active(RelayChannel channel) const { return slots[channel].active; }

bool RelayOverrides::any() const {
  for (uint8_t i = 0; i < RELAY_CHANNEL_COUNT; i++)
    if (slots[i].active) return true;
  return false;
}

bool RelayOverrides::expired(RelayChannel channel, uint32_t nowMs) const {
  const Slot &slot = slots[channel];
  return slot.active && nowMs - slot.startMs >= slot.durationMs;
}

uint32_t RelayOverrides::remainingMs(RelayChannel channel, uint32_t nowMs) const {
  const Slot &slot = slots[channel];
  if (!slot.active || expired(channel, nowMs)) return 0;
  return slot.durationMs - (nowMs - slot.startMs);
}
