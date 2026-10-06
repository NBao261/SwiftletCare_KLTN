/**
 * TICKET-FR-013 — tự tạo ticket MAINTENANCE khi lịch bảo trì định kỳ đến hạn.
 * TICKET-FR-018 — cùng nhịp: cộng dồn giờ chạy/số lần đóng cắt bơm-quạt, vượt mốc
 * thì tạo ticket bảo trì theo thời gian chạy.
 */
import cron from 'node-cron'
import { generateDueMaintenanceTickets } from '@/services/maintenanceSchedule.service'
import { accumulateRelayUsage } from '@/services/relayUsage.service'
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
    accumulateRelayUsage()
      .then(({ tickets }) => {
        if (tickets > 0) logger.info(`Đã tạo ${tickets} ticket bảo trì theo thời gian chạy (TICKET-FR-018)`)
      })
      .catch((err: Error) => logger.error('accumulateRelayUsage failed', { err }))
  })
  logger.info('Maintenance schedule job scheduled (hourly)')
}
