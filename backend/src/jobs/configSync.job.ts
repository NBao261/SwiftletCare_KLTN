/**
 * ENV-FR-027, BR-24 — controller còn chạy cấu hình cũ: gửi lại, và mở/đóng `CONFIG_MISMATCH`
 * (Report 4 §5.3, job `configSync`).
 */
import cron from 'node-cron'
import { syncControllerConfigs } from '@/services/configSync.service'
import logger from '@/utils/logger.util'

/** Mỗi phút — heartbeat 30 giây một lần, nên 3 heartbeat lệch (BR-24) được thấy trong khoảng 1,5 phút */
const CRON_EXPRESSION = '30 * * * * *'

export function startConfigSyncJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    syncControllerConfigs()
      .then(({ republished, raised, resolved }) => {
        if (raised + resolved > 0) logger.info(`configSync: gửi lại ${republished}, mở ${raised}, đóng ${resolved} CONFIG_MISMATCH (ENV-FR-027)`)
      })
      .catch((err: Error) => logger.error('configSync.job failed', { err }))
  })
  logger.info('Config sync job scheduled (every 1 min)')
}
