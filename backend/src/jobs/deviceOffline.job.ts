import cron from 'node-cron'
import { markStaleDevicesOffline } from '@/services/device.service'
import logger from '@/utils/logger.util'

// OFFLINE_THRESHOLD_MS là 30 s
const CRON_EXPRESSION = '*/10 * * * * *'

export function startDeviceOfflineJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    markStaleDevicesOffline().catch((err: Error) => {
      logger.error('deviceOffline.job failed', { err })
    })
  })
  logger.info('Device offline-detection job scheduled (every 10s)')
}
