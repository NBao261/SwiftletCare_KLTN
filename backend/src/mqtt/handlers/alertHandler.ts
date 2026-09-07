import type { VisionAlertPayload } from '@/types'
import logger from '@/utils/logger'

/**
 * alertHandler – processes MQTT messages and persists to MongoDB
 * TODO: Implement full logic in TASK-M3 sprint
 */
export async function handleAlert(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const payload = message as unknown as VisionAlertPayload
    // TODO: validate, upsert device, save to DB, emit Socket.io event
    logger.debug('alertHandler received', { topicParts, payload })
  } catch (err) {
    logger.error('alertHandler error', { err })
  }
}
