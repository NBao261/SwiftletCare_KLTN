import * as deviceService from '@/services/deviceService'
import type { HeartbeatPayload } from '@/types'
import logger from '@/utils/logger'

/** heartbeatHandler – adapter mỏng: parse MQTT message rồi giao cho deviceService xử lý (FARM-FR-005) */
export async function handleHeartbeat(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await deviceService.recordHeartbeat(message as unknown as HeartbeatPayload)
  } catch (err) {
    logger.warn('heartbeatHandler: could not process', { topicParts, err: (err as Error).message })
  }
}
