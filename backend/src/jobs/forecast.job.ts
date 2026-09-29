/**
 * ALERT-FR-011 — dự báo 60 phút tới cho mọi Zone đang có dữ liệu, cảnh báo sớm
 * FORECAST_BREACH khi độ ẩm/nhiệt độ có thể sắp vượt ngưỡng.
 */
import cron from 'node-cron'
import { scanForecastBreaches } from '@/services/forecast.service'
import logger from '@/utils/logger.util'

/** Mỗi 10 phút — dữ liệu dự báo gom theo 5 phút, quét dày hơn không thêm thông tin */
const CRON_EXPRESSION = '0 5-59/10 * * * *' // lệch 5 phút với sensorAnomaly.job để không cùng lúc truy vấn telemetry

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
