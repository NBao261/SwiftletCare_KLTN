/**
 * OPS-FR-003, BR-41 — Work Order đã báo xong được chuyển chờ duyệt khi dữ liệu giữ phục hồi recovery_verify_min
 * (10 phút); Work Order chưa bắt đầu mà cảnh báo tự hết thì đóng "self-recovered"; Work Order chưa ai bắt đầu sau
 * escalation_min thì báo Farm Owner (BR-40). BR-39 — NODE_OFFLINE / EDGE_AI_DEGRADED còn mở sau 30 phút mở Work Order.
 */
import cron from 'node-cron'
import { openWorkOrdersForOutages, verifyWorkOrders } from '@/services/workOrder.service'
import logger from '@/utils/logger.util'

/** Mỗi phút (giây 15, lệch các job phút khác) — NFR-15 b: chờ duyệt không quá 60 s sau khi đủ thời gian kiểm */
const CRON_EXPRESSION = '15 * * * * *'

export function startRecoveryCheckJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    verifyWorkOrders()
      .then(({ verified, selfRecovered, escalated }) => {
        if (verified + selfRecovered + escalated > 0) {
          logger.info('Kiểm phục hồi Work Order (BR-41)', { verified, selfRecovered, escalated })
        }
      })
      .catch((err: Error) => logger.error('verifyWorkOrders failed', { err }))
    openWorkOrdersForOutages()
      .then(count => {
        if (count > 0) logger.info(`Mở ${count} Work Order cho thiết bị mất kết nối quá 30 phút (BR-39)`)
      })
      .catch((err: Error) => logger.error('openWorkOrdersForOutages failed', { err }))
  })
}
