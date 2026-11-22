/** BR-13: gửi lại config mỗi đêm để nút AI luôn có khung phiên 7 ngày tới */
import cron from 'node-cron'
import { refreshCameraConfigs } from '@/services/device.service'
import logger from '@/utils/logger.util'

/** ponytail: 00:05 cho mọi nhà cùng lúc; nhiều camera thì rải giờ nếu broker quá tải */
const CRON_EXPRESSION = '0 5 0 * * *'

export function startCameraConfigJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    refreshCameraConfigs()
      .then(count => logger.info(`Đã gửi khung phiên cho ${count} nút AI (VISION-FR-019)`))
      .catch((err: Error) => logger.error('cameraConfig.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('AI node config refresh scheduled (00:05 Asia/Ho_Chi_Minh)')
}
