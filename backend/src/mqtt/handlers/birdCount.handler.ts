import type { BirdCountPayload } from '@/types'
import { ingestBirdCount } from '@/services/birdCount.service'
import { recomputeHouseDayIfAssessed } from '@/services/healthAssessment.service'
import logger from '@/utils/logger.util'

export async function handleBirdCount(_topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const session = await ingestBirdCount(message as unknown as BirdCountPayload)
    // số đếm về trễ cho ngày đã đánh giá thì tính lại
    if (session) await recomputeHouseDayIfAssessed(session.houseId, session.sessionDate)
  } catch (err) {
    logger.error('birdCountHandler error', { err })
  }
}
