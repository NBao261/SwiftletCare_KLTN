/**
 * TICKET-FR-013 — tự tạo ticket MAINTENANCE khi lịch bảo trì định kỳ đến hạn.
 */
import cron from 'node-cron'
import { generateDueMaintenanceTickets } from '@/services/maintenanceSchedule.service'
import logger from '@/utils/logger.util'

/** Đầu mỗi giờ — lịch bảo trì tính theo ngày, không cần quét dày hơn */
const CRON_EXPRESSION = '0 0 * * * *'

export function startMaintenanceScheduleJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    generateDueMaintenanceTickets()
      .then(count => {
        if (count > 0) logger.info(`Đã tạo ${count} ticket bảo trì định kỳ (TICKET-FR-013)`)
      })
      .catch((err: Error) => logger.error('maintenanceSchedule.job failed', { err }))
  })
  logger.info('Maintenance schedule job scheduled (hourly)')
}
