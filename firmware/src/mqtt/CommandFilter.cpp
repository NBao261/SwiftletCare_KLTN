#include "CommandFilter.h"
#include <string.h>

bool CommandFilter::known(const char *commandId) const {
  for (uint8_t i = 0; i < COMMAND_ID_MEMORY; i++)
    if (strncmp(ids[i], commandId, COMMAND_ID_SIZE - 1) == 0) return true;
  return false;
}

void CommandFilter::remember(const char *commandId) {
  if (commandId == nullptr || commandId[0] == '\0' || known(commandId)) return;
  strncpy(ids[next], commandId, COMMAND_ID_SIZE - 1);
  ids[next][COMMAND_ID_SIZE - 1] = '\0';
  next = (next + 1) % COMMAND_ID_MEMORY;
}

CommandFilter::Result CommandFilter::check(const char *commandId, uint64_t issuedAtMs, uint64_t nowEpochMs, AgePolicy policy) {
  if (known(commandId)) return DUPLICATE;
  remember(commandId);

  if (policy == ANY_AGE) return APPLY;
  bool ageKnown = issuedAtMs > 0 && nowEpochMs > 0;
  if (!ageKnown) return policy == FRESH_REQUIRED ? STALE : APPLY;
  return nowEpochMs > issuedAtMs && nowEpochMs - issuedAtMs > COMMAND_MAX_AGE_MS ? STALE : APPLY;
}
