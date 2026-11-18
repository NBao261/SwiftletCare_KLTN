import * as telemetryService from '@/services/telemetry.service'
import type { TelemetryPayload } from '@/types'
import logger from '@/utils/logger.util'

/** telemetry.handler – adapter mỏng: parse MQTT message rồi giao cho telemetryService xử lý */
export async function handleTelemetry(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    // ENV-FR-024 — mẫu buffer gửi trên `telemetry/buffered`; topic quyết định, không tin cờ trong tin
    const buffered = topicParts[topicParts.length - 1] === 'buffered'
    await telemetryService.ingestTelemetry({ ...(message as unknown as TelemetryPayload), buffered })
  } catch (err) {
    logger.warn('telemetry.handler: could not ingest', { topicParts, err: (err as Error).message })
  }
}
