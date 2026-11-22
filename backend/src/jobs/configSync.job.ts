import cron from 'node-cron'
import { syncControllerConfigs } from '@/services/configSync.service'
import logger from '@/utils/logger.util'

/** Heartbeat 30 s, nên 3 lần lệch (BR-24) thấy trong ~1,5 phút */
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
