import * as telemetryService from '@/services/telemetry.service'
import type { TelemetryPayload } from '@/types'
import logger from '@/utils/logger.util'

export async function handleTelemetry(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    // ENV-FR-024: tin buffer nhận theo topic, không tin cờ trong payload
    const buffered = topicParts[topicParts.length - 1] === 'buffered'
    await telemetryService.ingestTelemetry({ ...(message as unknown as TelemetryPayload), buffered })
  } catch (err) {
    logger.warn('telemetry.handler: could not ingest', { topicParts, err: (err as Error).message })
  }
}
