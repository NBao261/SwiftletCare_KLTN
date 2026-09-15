import * as telemetryService from '@/services/telemetry.service'
import type { TelemetryPayload } from '@/types'
import logger from '@/utils/logger.util'

/** telemetry.handler – adapter mỏng: parse MQTT message rồi giao cho telemetryService xử lý */
export async function handleTelemetry(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await telemetryService.ingestTelemetry(message as unknown as TelemetryPayload)
  } catch (err) {
    logger.warn('telemetry.handler: could not ingest', { topicParts, err: (err as Error).message })
  }
}
