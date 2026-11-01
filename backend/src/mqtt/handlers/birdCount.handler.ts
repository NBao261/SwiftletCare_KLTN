import type { BirdCountPayload } from '@/types'
import { ingestBirdCount } from '@/services/birdCount.service'
import { recomputeHouseDayIfAssessed } from '@/services/healthAssessment.service'
import logger from '@/utils/logger.util'

/** VISION-FR-006/017 — `vision/bird-count` của nút AI (tin của phiên và tin BUCKET 5 phút) */
export async function handleBirdCount(_topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const session = await ingestBirdCount(message as unknown as BirdCountPayload)
    // SM-17 — số đếm về trễ cho một ngày đã đánh giá: tính lại trạng thái hiện tại (ảnh chụp giữ nguyên)
    if (session) await recomputeHouseDayIfAssessed(session.houseId, session.sessionDate)
  } catch (err) {
    logger.error('birdCountHandler error', { err })
  }
}
