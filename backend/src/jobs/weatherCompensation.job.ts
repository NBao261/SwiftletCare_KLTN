/**
 * ENV-FR-028, BR-38, Report 4 DF-12 — mỗi giờ: dự báo 2 giờ tới × luật của nhà → offset phun sương có hạn,
 * gửi retained cho mọi controller.
 */
import cron from 'node-cron'
import { runWeatherCompensation } from '@/services/weatherCompensation.service'
import logger from '@/utils/logger.util'

/** Phút 10 mỗi giờ: sau job thời tiết (phút 5) để cùng một lượt số của Open-Meteo */
const CRON_EXPRESSION = '0 10 * * * *'

export function startWeatherCompensationJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    runWeatherCompensation()
      .then(count => { if (count > 0) logger.info(`Bù phun sương theo thời tiết ở ${count} nhà (ENV-FR-028)`) })
      .catch((err: Error) => logger.error('weatherCompensation.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Weather compensation job scheduled (hourly at :10)')
}
