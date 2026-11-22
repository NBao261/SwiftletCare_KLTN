import * as deviceService from '@/services/device.service'
import type { HeartbeatPayload } from '@/types'
import logger from '@/utils/logger.util'

export async function handleHeartbeat(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await deviceService.recordHeartbeat(message as unknown as HeartbeatPayload)
  } catch (err) {
    logger.warn('heartbeat.handler: could not process', { topicParts, err: (err as Error).message })
  }
}
