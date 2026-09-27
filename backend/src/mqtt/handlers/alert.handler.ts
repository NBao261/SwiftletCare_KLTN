import * as alertService from '@/services/alert.service'
import logger from '@/utils/logger.util'

/** alert.handler – adapter mỏng: parse MQTT message rồi giao cho alertService xử lý (THREAT-FR-001/006/007/011/012/013) */
export async function handleAlert(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await alertService.ingestDeviceAlert(message)
  } catch (err) {
    logger.warn('alert.handler: could not process', { topicParts, err: (err as Error).message })
  }
}
