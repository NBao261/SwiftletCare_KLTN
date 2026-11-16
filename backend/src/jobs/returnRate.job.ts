/**
 * VISION-FR-011 — mỗi tối, sau khi phiên chiều (17:30–19:00, VISION-FR-012) kết thúc, so tỷ lệ
 * chim về hôm nay với trung bình 7 ngày trước và sinh cảnh báo LOW_RETURN_RATE.
 */
import cron from 'node-cron'
import { checkReturnRateDrops } from '@/services/birdCount.service'
import { assessAllHouses } from '@/services/healthAssessment.service'
import { generateDailyReports } from '@/services/houseHealthReport.service'
import { evaluateRecommendationRules } from '@/services/recommendation.service'
import logger from '@/utils/logger.util'

/** ponytail: 19:15 = hết phiên chiều + 15 phút chờ tin cuối, chọn tay (SRS §0.5); đổi cùng khung giờ phiên */
const CRON_EXPRESSION = '0 15 19 * * *'

export function startReturnRateJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    checkReturnRateDrops()
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} cảnh báo LOW_RETURN_RATE (VISION-FR-011)`) })
      .catch((err: Error) => logger.error('returnRate.job failed', { err }))
      // ANALYTICS-FR-012 — đánh giá sức khỏe ngày chạy sau kiểm tra tỷ lệ chim về (BR-21), kể cả khi kiểm tra lỗi
      .then(() => assessAllHouses())
      .then(count => { if (count > 0) logger.info(`Đã đánh giá sức khỏe ${count} nhà yến (ANALYTICS-FR-012)`) })
      .catch((err: Error) => logger.error('healthAssessment failed', { err }))
      // EXPERT-FR-005, BR-33 — báo cáo ngày theo nhà ngay sau đánh giá ngày
      .then(() => generateDailyReports())
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} báo cáo ngày theo nhà (EXPERT-FR-005)`) })
      .catch((err: Error) => logger.error('house daily reports failed', { err }))
      // EXPERT-FR-017, BR-42 — luật khuyến nghị xét sau đánh giá ngày
      .then(() => evaluateRecommendationRules())
      .then(count => { if (count && count > 0) logger.info(`Đã mở ${count} khuyến nghị (EXPERT-FR-017)`) })
      .catch((err: Error) => logger.error('recommendation rules failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Return-rate drop job scheduled (19:15 Asia/Ho_Chi_Minh)')
}
