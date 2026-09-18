import * as deviceService from '@/services/device.service'
import type { HeartbeatPayload } from '@/types'
import logger from '@/utils/logger.util'

/** heartbeat.handler – adapter mỏng: parse MQTT message rồi giao cho deviceService xử lý (FARM-FR-005) */
export async function handleHeartbeat(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await deviceService.recordHeartbeat(message as unknown as HeartbeatPayload, topicParts)
  } catch (err) {
    logger.warn('heartbeat.handler: could not process', { topicParts, err: (err as Error).message })
  }
}
