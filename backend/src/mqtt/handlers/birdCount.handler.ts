import type { BirdCountPayload } from '@/types'
import { ingestBirdCount } from '@/services/birdCount.service'
import logger from '@/utils/logger.util'

/** VISION-FR-006/017 — `vision/bird-count` của nút AI (tin của phiên và tin BUCKET 5 phút) */
export async function handleBirdCount(_topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    await ingestBirdCount(message as unknown as BirdCountPayload)
  } catch (err) {
    logger.error('birdCountHandler error', { err })
  }
}
