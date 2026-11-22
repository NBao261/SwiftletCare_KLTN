import cron from 'node-cron'
import { runWeatherCompensation } from '@/services/weatherCompensation.service'
import logger from '@/utils/logger.util'

/** Không phụ thuộc weather.job ở phút 5 */
const CRON_EXPRESSION = '0 10 * * * *'

export function startWeatherCompensationJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    runWeatherCompensation()
      .then(count => { if (count > 0) logger.info(`Bù phun sương theo thời tiết ở ${count} nhà (ENV-FR-028)`) })
      .catch((err: Error) => logger.error('weatherCompensation.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Weather compensation job scheduled (hourly at :10)')
}
