import * as telemetryService from '@/services/telemetryService'
import type { TelemetryPayload } from '@/types'
import logger from '@/utils/logger'

/** telemetryHandler – adapter mỏng: parse MQTT message rồi giao cho telemetryService xử lý */
export async function handleTelemetry(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await telemetryService.ingestTelemetry(message as unknown as TelemetryPayload)
  } catch (err) {
    logger.warn('telemetryHandler: could not ingest', { topicParts, err: (err as Error).message })
  }
}
