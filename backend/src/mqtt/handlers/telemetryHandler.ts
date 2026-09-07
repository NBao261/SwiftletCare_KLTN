import type { TelemetryPayload } from '@/types'
import logger from '@/utils/logger'

/**
 * telemetryHandler – processes MQTT messages and persists to MongoDB
 * TODO: Implement full logic in TASK-M3 sprint
 */
export async function handleTelemetry(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const payload = message as unknown as TelemetryPayload
    // TODO: validate, upsert device, save to DB, emit Socket.io event
    logger.debug('telemetryHandler received', { topicParts, payload })
  } catch (err) {
    logger.error('telemetryHandler error', { err })
  }
}
