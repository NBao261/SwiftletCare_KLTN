import cron from 'node-cron'
import { accumulateRelayUsage } from '@/services/relayUsage.service'
import logger from '@/utils/logger.util'

const CRON_EXPRESSION = '0 0 * * * *'

export function startRelayUsageJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    accumulateRelayUsage()
      .then(({ alerts }) => {
        if (alerts > 0) logger.info(`Đã báo ${alerts} cảnh báo đến hạn bảo trì bơm/quạt (ALERT-FR-016)`)
      })
      .catch((err: Error) => logger.error('relayUsage.job failed', { err }))
  })
  logger.info('Relay usage job scheduled (hourly)')
}
