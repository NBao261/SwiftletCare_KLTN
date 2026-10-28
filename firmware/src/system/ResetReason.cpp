#include "system/ResetReason.h"

const char *unexpectedRestartReason(BootReset reset, bool everConnected) {
  switch (reset) {
  case BootReset::PowerOn: return everConnected ? "POWER_ON" : nullptr;
  case BootReset::IntWdt:
  case BootReset::TaskWdt:
  case BootReset::Wdt: return "WATCHDOG";
  case BootReset::Brownout: return "BROWNOUT";
  case BootReset::Panic: return "CRASH";
  default: return nullptr; // Software (RESTART/OTA), External, DeepSleep, Sdio, Unknown
  }
}
