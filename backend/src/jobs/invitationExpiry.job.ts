/**
 * AUTH-FR-010, Flow 12 case 3d — Invitation quá 7 ngày không phản hồi thì
 * tự động chuyển EXPIRED để không còn accept/decline được nữa.
 */
import cron from 'node-cron'
import { expireStaleInvitations } from '@/services/farm.service'
import logger from '@/utils/logger.util'

/** Mỗi giờ — hạn 7 ngày nên không cần chạy dày */
const CRON_EXPRESSION = '0 0 * * * *'

export function startInvitationExpiryJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    expireStaleInvitations()
      .then(count => {
        if (count > 0) logger.info(`Đã chuyển ${count} lời mời quá hạn sang EXPIRED (AUTH-FR-010)`)
      })
      .catch((err: Error) => logger.error('invitationExpiry.job failed', { err }))
  })
  logger.info('Invitation expiry job scheduled (every 1 hour)')
}
