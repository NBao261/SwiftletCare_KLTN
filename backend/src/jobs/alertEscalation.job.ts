/** ALERT-FR-017 leo thang, ALERT-FR-015 gửi lại; cùng nhịp tự đóng cảnh báo đã hết (ALERT-FR-008) */
import cron from 'node-cron'
import {
  renotifyStaleAlerts, resolveNodeOfflineAlertsOfOnlineNodes, resolveStaleEpisodeAlerts, resolveStaleThresholdAlerts,
} from '@/services/alert.service'
import { escalateUnacknowledgedAlerts } from '@/services/alertRouting.service'
import logger from '@/utils/logger.util'

/** NFR-15 a: <= 60 s sau hạn leo thang */
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
