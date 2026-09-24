import type { ITicket } from '@/models/ticket.model'

/**
 * `assigned_to` có thể còn là ObjectId (findById) hoặc đã populate thành
 * document (getTicket) — `String(doc)` trên bản populate cho ra "[object Object]".
 * Đặt ở utils thay vì trong ticket.service để ticketChat.service dùng chung mà
 * không tạo import vòng giữa hai service.
 */
export function assigneeIdOf(ticket: Pick<ITicket, 'assigned_to'>): string | null {
  const assignee = ticket.assigned_to as unknown as { _id?: unknown } | undefined
  return assignee ? String(assignee._id ?? assignee) : null
}
