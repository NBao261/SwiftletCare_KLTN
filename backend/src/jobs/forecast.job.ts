import cron from 'node-cron'
import { scanForecastBreaches } from '@/services/forecast.service'
import logger from '@/utils/logger.util'

const CRON_EXPRESSION = '0 5-59/10 * * * *' // Lệch 5 phút với sensorAnomaly.job

export function startForecastJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    scanForecastBreaches()
      .then(({ raised, resolved }) => {
        if (raised + resolved > 0) logger.info(`Dự báo vượt ngưỡng: ${raised} cảnh báo mới, ${resolved} đã đóng (ALERT-FR-011)`)
      })
      .catch((err: Error) => logger.error('forecast.job failed', { err }))
  })
  logger.info('Forecast job scheduled (every 10 min)')
}
