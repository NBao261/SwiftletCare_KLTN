#include "AlertQueue.h"
#include <string.h>

bool AlertQueue::push(const QueuedAlert &alert) {
  for (uint8_t i = 0; i < count; i++)
    if (strcmp(entries[i].alert.type, alert.type) == 0) return true;
  if (count == ALERT_QUEUE_SIZE) return false;
  entries[count].alert = alert;
  entries[count].msgId = 0;
  count++;
  return true;
}

int AlertQueue::nextUnsent() const {
  for (uint8_t i = 0; i < count; i++)
    if (entries[i].msgId == 0) return i;
  return -1;
}

void AlertQueue::markSent(int index, int msgId) { entries[index].msgId = msgId; }

bool AlertQueue::ack(int msgId) {
  for (uint8_t i = 0; i < count; i++) {
    if (entries[i].msgId != msgId) continue;
    for (uint8_t j = i; j + 1 < count; j++) entries[j] = entries[j + 1];
    count--;
    return true;
  }
  return false;
}

void AlertQueue::resetSent() {
  for (uint8_t i = 0; i < count; i++) entries[i].msgId = 0;
}
