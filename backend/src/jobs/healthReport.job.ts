/**
 * EXPERT-FR-005 — tổng hợp báo cáo sức khỏe Zone theo chu kỳ (mặc định hàng tuần),
 * báo cho Farm Owner và Domain Expert (EXPERT-FR-007).
 */
import cron from 'node-cron'
import { generateWeeklyReports } from '@/services/healthReport.service'
import logger from '@/utils/logger.util'

/**
 * Mặc định 06:00 thứ Hai hàng tuần (giờ máy chủ). Chu kỳ cấu hình được qua
 * HEALTH_REPORT_CRON; độ dài kỳ báo cáo qua HEALTH_REPORT_DAYS (mặc định 7).
 */
const CRON_EXPRESSION = process.env.HEALTH_REPORT_CRON || '0 0 6 * * 1'

export function startHealthReportJob(): void {
  if (!cron.validate(CRON_EXPRESSION)) {
    logger.error(`HEALTH_REPORT_CRON không hợp lệ ("${CRON_EXPRESSION}") — không lên lịch báo cáo sức khỏe Zone`)
    return
  }
  cron.schedule(CRON_EXPRESSION, () => {
    generateWeeklyReports()
      .then(count => { if (count > 0) logger.info(`Đã tạo ${count} báo cáo sức khỏe Zone (EXPERT-FR-005)`) })
      .catch((err: Error) => logger.error('healthReport.job failed', { err }))
  })
  logger.info(`Zone health report job scheduled (${CRON_EXPRESSION})`)
}
