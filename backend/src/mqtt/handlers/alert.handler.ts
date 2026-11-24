import * as alertService from '@/services/alert.service'
import logger from '@/utils/logger.util'

export async function handleAlert(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await alertService.ingestDeviceAlert(message)
  } catch (err) {
    logger.warn('alert.handler: could not process', { topicParts, err: (err as Error).message })
  }
}
