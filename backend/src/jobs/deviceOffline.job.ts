/**
 * FARM-FR-005 — Quét định kỳ các SensorNode mất heartbeat để tự chuyển ONLINE
 * → OFFLINE (ví dụ khi rút thiết bị hoặc mất nguồn, ESP32 không kịp báo trước).
 */
import cron from 'node-cron'
import { markStaleDevicesOffline } from '@/services/device.service'
import logger from '@/utils/logger.util'

/** Chạy mỗi 10s — đủ dày để phát hiện trong khoảng OFFLINE_THRESHOLD_MS (30s, FARM-FR-005) */
const CRON_EXPRESSION = '*/10 * * * * *'

export function startDeviceOfflineJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    markStaleDevicesOffline().catch((err: Error) => {
      logger.error('deviceOffline.job failed', { err })
    })
  })
  logger.info('Device offline-detection job scheduled (every 10s)')
}
