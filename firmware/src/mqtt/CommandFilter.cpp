#include "CommandFilter.h"
#include <string.h>

CommandFilter::Result CommandFilter::check(const char *commandId, uint64_t issuedAtMs, uint64_t nowEpochMs, bool requireFresh) {
  if (commandId == nullptr || commandId[0] == '\0') return APPLY;

  for (uint8_t i = 0; i < COMMAND_ID_MEMORY; i++)
    if (strncmp(ids[i], commandId, COMMAND_ID_SIZE - 1) == 0) return DUPLICATE;

  strncpy(ids[next], commandId, COMMAND_ID_SIZE - 1);
  ids[next][COMMAND_ID_SIZE - 1] = '\0';
  next = (next + 1) % COMMAND_ID_MEMORY;

  bool ageKnown = issuedAtMs > 0 && nowEpochMs > 0;
  if (requireFresh && ageKnown && nowEpochMs > issuedAtMs && nowEpochMs - issuedAtMs > COMMAND_MAX_AGE_MS) return STALE;
  return APPLY;
}
