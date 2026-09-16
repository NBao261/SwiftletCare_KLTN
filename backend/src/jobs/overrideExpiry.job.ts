/**
 * ENV-FR-018 — Manual Override hết hạn thì trả relay về chế độ AUTO.
 * Xem ghi chú trong device.service.expireManualOverrides về lý do backend phải
 * tự làm việc này thay vì tin tưởng hoàn toàn vào firmware.
 */
import cron from 'node-cron'
import { expireManualOverrides } from '@/services/device.service'
import logger from '@/utils/logger.util'

/** Mỗi phút — override tính bằng phút nên không cần dày hơn */
const CRON_EXPRESSION = '0 * * * * *'

export function startOverrideExpiryJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    expireManualOverrides()
      .then(count => {
        if (count > 0) logger.info(`Đã trả ${count} relay về chế độ AUTO do hết hạn override (ENV-FR-018)`)
      })
      .catch((err: Error) => logger.error('overrideExpiry.job failed', { err }))
  })
  logger.info('Manual override expiry job scheduled (every 1 min)')
}
