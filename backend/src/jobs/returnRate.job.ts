/**
 * VISION-FR-011 — mỗi tối, sau khi phiên chiều (17:30–19:00, VISION-FR-012) kết thúc, so tỷ lệ
 * chim về hôm nay với trung bình 7 ngày trước và sinh cảnh báo LOW_RETURN_RATE.
 */
import cron from 'node-cron'
import { checkReturnRateDrops } from '@/services/birdCount.service'
import logger from '@/utils/logger.util'

/** ponytail: 19:15 = hết phiên chiều + 15 phút chờ tin cuối, chọn tay (SRS §0.5); đổi cùng khung giờ phiên */
const CRON_EXPRESSION = '0 15 19 * * *'

export function startReturnRateJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    checkReturnRateDrops()
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} cảnh báo LOW_RETURN_RATE (VISION-FR-011)`) })
      .catch((err: Error) => logger.error('returnRate.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Return-rate drop job scheduled (19:15 Asia/Ho_Chi_Minh)')
}
