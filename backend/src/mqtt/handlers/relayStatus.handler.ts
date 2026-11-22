import * as deviceService from '@/services/device.service'
import type { RelayStatusPayload } from '@/types'
import logger from '@/utils/logger.util'

export async function handleRelayStatus(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await deviceService.confirmRelayStatus(message as unknown as RelayStatusPayload)
  } catch (err) {
    logger.warn('relayStatus.handler: could not process', { topicParts, err: (err as Error).message })
  }
}
