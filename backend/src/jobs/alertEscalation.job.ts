/**
 * ALERT-FR-015 — Cảnh báo CRITICAL/HIGH không được Farm Owner xác nhận trong
 * 15 phút (NODE_OFFLINE: 1 giờ) thì gửi lại 1 lần cho Farm Owner. Chạy nền vì
 * Farm Owner có thể đang ngủ/không mở app.
 *
 * Cùng nhịp này cũng tự đóng THRESHOLD_BREACH đã hết (ALERT-FR-008), cảnh báo theo đợt
 * (NOISE_ANOMALY/PUMP_DRY) không còn tái phát, và
 * NODE_OFFLINE của thiết bị đã online lại (lưới an toàn cho race job ↔ heartbeat).
 */
import cron from 'node-cron'
import {
  renotifyStaleAlerts, resolveNodeOfflineAlertsOfOnlineNodes, resolveStaleEpisodeAlerts, resolveStaleThresholdAlerts,
} from '@/services/alert.service'
import logger from '@/utils/logger.util'

/** Mỗi 2 phút — đủ dày để không trễ quá ngưỡng 15 phút, không tạo tải đáng kể */
const CRON_EXPRESSION = '0 */2 * * * *'

export function startAlertEscalationJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    renotifyStaleAlerts()
      .then(count => {
        if (count > 0) logger.info(`Gửi lại ${count} cảnh báo chưa ai xác nhận (ALERT-FR-015)`)
      })
      .catch((err: Error) => logger.error('alertEscalation.job failed', { err }))
    resolveStaleThresholdAlerts()
      .then(count => {
        if (count > 0) logger.info(`Tự đóng ${count} cảnh báo vượt ngưỡng đã trở lại bình thường (ALERT-FR-008)`)
      })
      .catch((err: Error) => logger.error('resolveStaleThresholdAlerts failed', { err }))
    resolveStaleEpisodeAlerts()
      .then(count => {
        if (count > 0) logger.info(`Tự đóng ${count} cảnh báo theo đợt (ồn bất thường/bơm khô) không còn tái phát`)
      })
      .catch((err: Error) => logger.error('resolveStaleEpisodeAlerts failed', { err }))
    resolveNodeOfflineAlertsOfOnlineNodes()
      .then(count => {
        if (count > 0) logger.info(`Đóng ${count} cảnh báo mất kết nối của thiết bị đã online lại`)
      })
      .catch((err: Error) => logger.error('resolveNodeOfflineAlertsOfOnlineNodes failed', { err }))
  })
  logger.info('Alert escalation job scheduled (every 2 min)')
}
