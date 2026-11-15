/**
 * ALERT-FR-017, BR-40 — cảnh báo thợ đang trực chưa xác nhận sau escalation_min (15 phút) được báo Farm Owner
 * đúng 1 lần. ALERT-FR-015 — cảnh báo CRITICAL/HIGH chưa ai xác nhận trong 15 phút (NODE_OFFLINE: 1 giờ) được
 * gửi lại 1 lần cho người đã nhận. Chạy nền vì người nhận có thể đang ngủ/không mở app.
 *
 * Cùng nhịp này cũng tự đóng THRESHOLD_BREACH đã hết (ALERT-FR-008), cảnh báo theo đợt
 * (NOISE_ANOMALY/MISTING_INEFFECTIVE) không còn tái phát, và
 * NODE_OFFLINE của thiết bị đã online lại (lưới an toàn cho race job ↔ heartbeat).
 */
import cron from 'node-cron'
import {
  renotifyStaleAlerts, resolveNodeOfflineAlertsOfOnlineNodes, resolveStaleEpisodeAlerts, resolveStaleThresholdAlerts,
} from '@/services/alert.service'
import { escalateUnacknowledgedAlerts } from '@/services/alertRouting.service'
import logger from '@/utils/logger.util'

/** Mỗi phút — NFR-15 a: Farm Owner được báo không quá 60 s sau hạn leo thang (Report 4 §5.4) */
const CRON_EXPRESSION = '0 * * * * *'

export function startAlertEscalationJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    escalateUnacknowledgedAlerts()
      .then(count => {
        if (count > 0) logger.info(`Leo thang ${count} cảnh báo thợ chưa xác nhận lên Farm Owner (BR-40)`)
      })
      .catch((err: Error) => logger.error('escalateUnacknowledgedAlerts failed', { err }))
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
