/**
 * TICKET-FR-005 — lưới an toàn cho hàng đợi ticket chung: các thao tác làm Technician
 * có thêm suất (đóng ticket, mở khoá, thêm vùng...) đã tự chia lại ngay, job này bắt
 * những trường hợp còn sót (lần chia trước lỗi, ticket vào hàng đợi lúc chưa ai rảnh).
 */
import cron from 'node-cron'
import { drainUnassignedQueue } from '@/services/ticket.service'
import logger from '@/utils/logger.util'

/** Mỗi 5 phút — hạn phản hồi ngắn nhất (P1) là 30 phút */
const CRON_EXPRESSION = '0 */5 * * * *'

export function startTicketQueueJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    drainUnassignedQueue()
      .then(ids => {
        if (ids.length > 0) logger.info(`Đã tự phân công ${ids.length} ticket từ hàng đợi chung (TICKET-FR-005)`)
      })
      .catch((err: Error) => logger.error('ticketQueue.job failed', { err }))
  })
  logger.info('Ticket queue job scheduled (every 5 minutes)')
}
