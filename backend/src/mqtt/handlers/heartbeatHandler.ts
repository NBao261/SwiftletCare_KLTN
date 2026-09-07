import type { HeartbeatPayload } from '@/types'
import logger from '@/utils/logger'

/**
 * heartbeatHandler – processes MQTT messages and persists to MongoDB
 * TODO: Implement full logic in TASK-M3 sprint
 */
export async function handleHeartbeat(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const payload = message as unknown as HeartbeatPayload
    // TODO: validate, upsert device, save to DB, emit Socket.io event
    logger.debug('heartbeatHandler received', { topicParts, payload })
  } catch (err) {
    logger.error('heartbeatHandler error', { err })
  }
}
