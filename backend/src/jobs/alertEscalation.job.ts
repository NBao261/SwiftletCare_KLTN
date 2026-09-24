/**
 * TICKET-FR-002 — Cảnh báo CRITICAL/HIGH không được Farm Owner xác nhận trong
 * 15 phút thì tự sinh ticket để Technician vào cuộc (Flow 4 case 9b, Flow 8
 * bước 7). Chạy nền vì Farm Owner có thể đang ngủ/không mở app — không thể chờ
 * họ bấm mới xử lý sự cố nghiêm trọng.
 *
 * Cùng nhịp này cũng tự đóng THRESHOLD_BREACH đã hết (ALERT-FR-008).
 */
import cron from 'node-cron'
import { createTicketsFromStaleAlerts } from '@/services/ticket.service'
import { resolveStaleThresholdAlerts } from '@/services/alert.service'
import logger from '@/utils/logger.util'

/** Mỗi 2 phút — đủ dày để không trễ quá ngưỡng 15 phút, không tạo tải đáng kể */
const CRON_EXPRESSION = '0 */2 * * * *'

export function startAlertEscalationJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    createTicketsFromStaleAlerts()
      .then(count => {
        if (count > 0) logger.info(`Tự tạo ${count} ticket từ cảnh báo chưa xác nhận (TICKET-FR-002)`)
      })
      .catch((err: Error) => logger.error('alertEscalation.job failed', { err }))
    resolveStaleThresholdAlerts()
      .then(count => {
        if (count > 0) logger.info(`Tự đóng ${count} cảnh báo vượt ngưỡng đã trở lại bình thường (ALERT-FR-008)`)
      })
      .catch((err: Error) => logger.error('resolveStaleThresholdAlerts failed', { err }))
  })
  logger.info('Alert escalation job scheduled (every 2 min)')
}
