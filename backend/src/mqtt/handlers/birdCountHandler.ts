import type { BirdCountPayload } from '@/types'
import logger from '@/utils/logger'

/**
 * birdCountHandler – processes MQTT messages and persists to MongoDB
 * TODO: Implement full logic in TASK-M3 sprint
 */
export async function handleBirdCount(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const payload = message as unknown as BirdCountPayload
    // TODO: validate, upsert device, save to DB, emit Socket.io event
    logger.debug('birdCountHandler received', { topicParts, payload })
  } catch (err) {
    logger.error('birdCountHandler error', { err })
  }
}
