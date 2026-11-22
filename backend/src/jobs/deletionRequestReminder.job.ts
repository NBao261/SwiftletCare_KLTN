/** PRIV-NFR-003: xử lý trong 30 ngày; còn 7 ngày thì nhắc Admin */
import cron from 'node-cron'
import { remindPendingDeletionRequests } from '@/services/admin.service'
import logger from '@/utils/logger.util'

const CRON_EXPRESSION = '0 0 8 * * *'

export function startDeletionRequestReminderJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    remindPendingDeletionRequests()
      .then(count => {
        if (count > 0) logger.info(`Đã nhắc Admin ${count} yêu cầu xoá tài khoản sắp quá hạn (AUTH-FR-012)`)
      })
      .catch((err: Error) => logger.error('deletionRequestReminder.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Deletion request reminder job scheduled (daily 08:00)')
}
