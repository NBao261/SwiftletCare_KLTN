// Quá 15 phút chưa có heartbeat đầu tiên thì báo người đăng ký
import cron from 'node-cron'
import { markOverdueActivations, markOtaTimeouts } from '@/services/device.service'
import { sweepRollouts } from '@/services/firmwareRollout.service'
import logger from '@/utils/logger.util'

const CRON_EXPRESSION = '0 * * * * *'

export function startActivationOverdueJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    markOverdueActivations()
      .then(count => {
        if (count > 0) logger.warn(`${count} thiết bị kích hoạt quá hạn (Flow 1 case 8a)`)
      })
      .catch((err: Error) => logger.error('activationOverdue.job failed', { err }))
    // Cùng nhịp: OTA quá 30 phút chưa xác nhận là thất bại
    markOtaTimeouts()
      .then(count => {
        if (count > 0) logger.warn(`${count} lệnh OTA quá hạn xác nhận (Flow 15)`)
      })
      .catch((err: Error) => logger.error('activationOverdue.job (OTA) failed', { err }))
      // Sau khi ghi máy lỗi: gửi cho máy đang chờ mà heartbeat chưa kịp gửi
      .then(() => sweepRollouts())
      .catch((err: Error) => logger.error('activationOverdue.job (rollouts) failed', { err }))
  })
  logger.info('Activation overdue job scheduled (every 1 min)')
}
