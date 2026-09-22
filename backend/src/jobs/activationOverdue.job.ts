/**
 * Flow 1 case 8a — thiết bị đã đăng ký qua Web Console nhưng quá 15 phút chưa
 * gửi heartbeat đầu tiên thì Technician phải được báo để kiểm tra lại bước 5–7
 * tại hiện trường trước khi kết luận thiết bị hỏng.
 */
import cron from 'node-cron'
import { markOverdueActivations } from '@/services/device.service'
import logger from '@/utils/logger.util'

/** Mỗi 1 phút — sai số tối đa 1 phút so với mốc 15 phút của SRS */
const CRON_EXPRESSION = '0 * * * * *'

export function startActivationOverdueJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    markOverdueActivations()
      .then(count => {
        if (count > 0) logger.warn(`${count} thiết bị kích hoạt quá hạn (Flow 1 case 8a)`)
      })
      .catch((err: Error) => logger.error('activationOverdue.job failed', { err }))
  })
  logger.info('Activation overdue job scheduled (every 1 min)')
}
