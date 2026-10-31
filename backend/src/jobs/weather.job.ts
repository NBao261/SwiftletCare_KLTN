/**
 * ANALYTICS-FR-013 — lấy thời tiết theo giờ của mọi farm có toạ độ (Open-Meteo).
 */
import cron from 'node-cron'
import { fetchAllFarmsWeather } from '@/services/weather.service'
import logger from '@/utils/logger.util'

/** Phút 5 mỗi giờ: Open-Meteo cần vài phút sau đầu giờ mới có số của giờ vừa qua */
const CRON_EXPRESSION = '0 5 * * * *'

export function startWeatherJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    fetchAllFarmsWeather()
      .catch((err: Error) => logger.error('weather.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Weather job scheduled (hourly at :05)')
}
