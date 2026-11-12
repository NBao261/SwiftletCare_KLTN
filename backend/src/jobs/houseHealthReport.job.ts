/**
 * EXPERT-FR-005, BR-33 — báo cáo sức khỏe theo nhà: tuần (thứ Hai 06:00) và tháng (ngày 1 lúc 06:00), giờ
 * Việt Nam. Báo cáo ngày chạy ngay sau đánh giá ngày, trong jobs/returnRate.job.ts.
 */
import cron from 'node-cron'
import { generateMonthlyHouseReports, generateWeeklyHouseReports } from '@/services/houseHealthReport.service'
import logger from '@/utils/logger.util'

const WEEKLY_CRON = '0 0 6 * * 1'
const MONTHLY_CRON = '0 0 6 1 * *'

export function startHouseHealthReportJob(): void {
  cron.schedule(WEEKLY_CRON, () => {
    generateWeeklyHouseReports()
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} báo cáo tuần theo nhà (EXPERT-FR-005)`) })
      .catch((err: Error) => logger.error('houseHealthReport weekly job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  cron.schedule(MONTHLY_CRON, () => {
    generateMonthlyHouseReports()
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} báo cáo tháng theo nhà (EXPERT-FR-005)`) })
      .catch((err: Error) => logger.error('houseHealthReport monthly job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('House health report jobs scheduled (weekly Mon 06:00, monthly 1st 06:00 Asia/Ho_Chi_Minh)')
}
