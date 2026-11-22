import cron from 'node-cron'
import { fetchAllFarmsWeather } from '@/services/weather.service'
import logger from '@/utils/logger.util'

/** Open-Meteo cần vài phút sau đầu giờ mới có số */
const CRON_EXPRESSION = '0 5 * * * *'

export function startWeatherJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    fetchAllFarmsWeather()
      .catch((err: Error) => logger.error('weather.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Weather job scheduled (hourly at :05)')
}
