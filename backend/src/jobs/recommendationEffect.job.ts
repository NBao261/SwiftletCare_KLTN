/**
 * EXPERT-FR-017, 019, BR-42, Report 3 §6.21 — mỗi ngày: khuyến nghị mở quá 7 ngày thành EXPIRED; khuyến nghị đã chấp
 * nhận đủ 7 ngày được đo hiệu quả (MEASURED). Việc xét luật chạy sau đánh giá ngày, trong jobs/returnRate.job.ts.
 */
import cron from 'node-cron'
import { expireRecommendations, measureRecommendationEffects } from '@/services/recommendation.service'
import logger from '@/utils/logger.util'

/** 06:30 giờ VN: sau báo cáo tuần/tháng (06:00), đủ dữ liệu của ngày thứ 7 sau khi chấp nhận */
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
