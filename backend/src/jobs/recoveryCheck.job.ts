import cron from 'node-cron'
import { openWorkOrdersForOutages, verifyWorkOrders } from '@/services/workOrder.service'
import logger from '@/utils/logger.util'

// Giây 15 để lệch các job khác
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
