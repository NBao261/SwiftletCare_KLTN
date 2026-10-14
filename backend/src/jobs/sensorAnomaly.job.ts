/**
 * ALERT-FR-010 — quét cảm biến bất thường (kẹt / nhảy phi vật lý / lệch giữa
 * thiết bị) trên telemetry đã lưu, tạo hoặc tự đóng cảnh báo SENSOR_ANOMALY.
 */
import cron from 'node-cron'
import { scanSensorAnomalies } from '@/services/sensorAnomaly.service'
import logger from '@/utils/logger.util'

/** Mỗi 10 phút — "kẹt" cần 2 giờ dữ liệu mới kết luận, quét dày hơn không phát hiện sớm hơn */
const CRON_EXPRESSION = '0 */10 * * * *'

export function startSensorAnomalyJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    scanSensorAnomalies()
      .then(({ raised, resolved }) => {
        if (raised + resolved > 0) logger.info(`Cảm biến bất thường: ${raised} cảnh báo mới, ${resolved} đã đóng (ALERT-FR-010)`)
      })
      .catch((err: Error) => logger.error('sensorAnomaly.job failed', { err }))
  })
  logger.info('Sensor anomaly job scheduled (every 10 min)')
}
