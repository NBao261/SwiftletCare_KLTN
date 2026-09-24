/**
 * TICKET-FR-009, SLA-NFR-002 — ticket quá hạn xử lý mà chưa đóng phải được
 * đánh dấu trong vòng ≤5 phút. Xem ghi chú trong ticket.service.markBreachedTickets
 * về lý do không thể chỉ dựa vào escalate thủ công.
 */
import cron from 'node-cron'
import { markBreachedTickets, markResponseBreachedTickets } from '@/services/ticket.service'
import logger from '@/utils/logger.util'

/** Mỗi 2 phút — nằm trong ngưỡng 5 phút của SLA-NFR-002, tải không đáng kể */
const CRON_EXPRESSION = '0 */2 * * * *'

export function startSlaBreachJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    markBreachedTickets()
      .then(count => {
        if (count > 0) logger.warn(`${count} ticket vượt hạn xử lý SLA (TICKET-FR-009)`)
      })
      .catch((err: Error) => logger.error('slaBreach.job failed', { err }))
    // TICKET-FR-004b — cùng nhịp quét, riêng cho hạn phản hồi (ticket NEW chưa ai tiếp nhận)
    markResponseBreachedTickets()
      .then(count => {
        if (count > 0) logger.warn(`${count} ticket vượt hạn phản hồi SLA (TICKET-FR-004b)`)
      })
      .catch((err: Error) => logger.error('slaBreach.job (response) failed', { err }))
  })
  logger.info('SLA breach detection job scheduled (every 2 min)')
}
