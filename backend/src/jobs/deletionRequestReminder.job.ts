/**
 * AUTH-FR-012, PRIV-NFR-003 — yêu cầu xoá tài khoản phải xử lý trong ≤ 30 ngày.
 * Admin chỉ được báo 1 lần lúc user gửi yêu cầu, nên còn 7 ngày thì nhắc lại.
 */
import cron from 'node-cron'
import { remindPendingDeletionRequests } from '@/services/admin.service'
import logger from '@/utils/logger.util'

/** 8:00 mỗi ngày — hạn tính theo ngày nên không cần chạy dày */
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
