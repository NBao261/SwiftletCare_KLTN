// Xét luật chạy trong returnRate.job
import cron from 'node-cron'
import { expireRecommendations, measureRecommendationEffects } from '@/services/recommendation.service'
import logger from '@/utils/logger.util'

// Sau báo cáo 06:00
const CRON_EXPRESSION = '0 30 6 * * *'

export function startRecommendationEffectJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    expireRecommendations()
      .then(count => { if (count > 0) logger.info(`${count} khuyến nghị hết hạn (BR-42)`) })
      .catch((err: Error) => logger.error('expireRecommendations failed', { err }))
      .then(() => measureRecommendationEffects())
      .then(count => { if (count && count > 0) logger.info(`Đã đo hiệu quả ${count} khuyến nghị (EXPERT-FR-019)`) })
      .catch((err: Error) => logger.error('measureRecommendationEffects failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Recommendation effect job scheduled (daily 06:30 Asia/Ho_Chi_Minh)')
}
