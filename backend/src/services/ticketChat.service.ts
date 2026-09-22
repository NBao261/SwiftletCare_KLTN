import { Ticket, ITicket } from '@/models/ticket.model'
import { TicketMessage, ITicketMessage } from '@/models/ticketMessage.model'
import { findFarmOrThrow, hasFarmAccess } from '@/utils/farmAccess.util'
import { emitTicketMessage } from '@/socket'
import { paginate } from '@/utils/helpers.util'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

const DUPLICATE_KEY = 11000
export const MAX_MESSAGE_LENGTH = 2000

/** Shape client dùng để hiển thị (khớp TicketChat.tsx bên frontend) */
export interface TicketMessageDto {
  _id: string
  ticket_id: string
  content: string
  author_id: string | null
  author_name: string | null
  role: string
  is_system: boolean
  client_message_id: string | null
  created_at: Date
}

type PopulatedMessage = Omit<ITicketMessage, 'sender_id'> & { sender_id?: { _id: unknown; full_name?: string } | null }

function toDto(m: PopulatedMessage): TicketMessageDto {
  return {
    _id: String(m._id),
    ticket_id: String(m.ticket_id),
    content: m.content,
    author_id: m.sender_id ? String(m.sender_id._id) : null,
    author_name: m.sender_id?.full_name ?? null,
    role: m.is_system ? 'SYSTEM' : (m.sender_role ?? 'SYSTEM'),
    is_system: m.is_system,
    client_message_id: m.client_message_id ?? null,
    created_at: m.created_at,
  }
}

const currentAssignee = (ticket: Pick<ITicket, 'assigned_to'>) => (ticket.assigned_to ? String(ticket.assigned_to) : null)

/**
 * TICKET-FR-014 — ai được VÀO kênh chat (đọc lịch sử):
 * - Admin: luôn được (TICKET-FR-005b)
 * - Farm Owner/thành viên của farm sở hữu ticket (không tính Technician/Sales cùng farm)
 * - Technician đang phụ trách, hoặc từng phụ trách (TICKET-FR-017: người cũ vẫn xem lại được)
 * Technician khác cùng vùng thì KHÔNG — khác quyền xem ticket (Flow 23 case 6a).
 */
async function canRead(ticket: ITicket, user: CurrentUser): Promise<boolean> {
  if (user.role === 'ADMIN') return true
  if (user.role === 'TECHNICIAN') {
    return currentAssignee(ticket) === user._id
      || (ticket.previous_assignees ?? []).some(id => String(id) === user._id)
  }
  if (user.role === 'FARM_OWNER') {
    const farm = await findFarmOrThrow(String(ticket.farm_id))
    return hasFarmAccess(farm, user)
  }
  return false
}

async function loadTicketForChat(ticketId: string, user: CurrentUser): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId)
  if (!ticket) throw NotFoundError('Không tìm thấy ticket')
  // Cùng thông báo cho "không có quyền" — không xác nhận ticket tồn tại với người ngoài
  if (!(await canRead(ticket, user))) throw ForbiddenError('Không có quyền tham gia trò chuyện của ticket này')
  return ticket
}

/** Flow 23 bước 2 — gọi khi client JOIN_TICKET_CHAT */
export async function assertCanJoin(ticketId: string, user: CurrentUser): Promise<void> {
  await loadTicketForChat(ticketId, user)
}

/**
 * TICKET-FR-015 — lịch sử có phân trang, trang 1 là tin mới nhất. Mỗi trang
 * trả theo thứ tự cũ → mới để client nối thẳng vào khung chat.
 */
export async function listMessages(ticketId: string, user: CurrentUser, query: { page?: string | number; limit?: string | number }) {
  await loadTicketForChat(ticketId, user)
  const { page, skip, limit } = paginate(query.page, query.limit, { defaultLimit: 50, maxLimit: 100 })
  const [records, total] = await Promise.all([
    TicketMessage.find({ ticket_id: ticketId }).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit)
      .populate('sender_id', 'full_name').lean<PopulatedMessage[]>(),
    TicketMessage.countDocuments({ ticket_id: ticketId }),
  ])
  return { records: records.reverse().map(toDto), total, page, limit }
}

/**
 * Flow 23 bước 3 — lưu + phát tin. Quyền GỬI kiểm lại theo `assigned_to` hiện
 * tại ở mỗi lần gửi (Flow 23 case 4a: không cache quyền cũ) — Technician đã bị
 * chuyển ticket chỉ còn đọc. Ticket đã đóng thì kênh chỉ đọc (TICKET-FR-016).
 */
export async function sendMessage(
  ticketId: string, user: CurrentUser, input: { content: string; client_message_id?: string },
): Promise<TicketMessageDto> {
  const content = (input.content ?? '').trim()
  if (!content) throw BadRequestError('Nội dung tin nhắn không được để trống')
  if (content.length > MAX_MESSAGE_LENGTH) throw BadRequestError(`Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự`)

  const ticket = await loadTicketForChat(ticketId, user)
  if (ticket.status === 'CLOSED') {
    throw ConflictError('Ticket đã đóng — trò chuyện chỉ còn xem lại, muốn trao đổi tiếp hãy tạo ticket mới')
  }
  if (user.role === 'TECHNICIAN' && currentAssignee(ticket) !== user._id) {
    throw ForbiddenError('Ticket đã chuyển cho Technician khác — bạn chỉ còn xem lại lịch sử')
  }

  const clientMessageId = input.client_message_id?.trim() || undefined
  let message: ITicketMessage
  try {
    message = await TicketMessage.create({
      ticket_id: ticket._id, sender_id: user._id, sender_role: user.role, content, client_message_id: clientMessageId,
    })
  } catch (err) {
    // Flow 23 case 5a — client gửi lại cùng clientMessageId sau khi mất ack: trả lại tin đã lưu, không phát lại
    if ((err as { code?: number }).code !== DUPLICATE_KEY || !clientMessageId) throw err
    const existing = await TicketMessage.findOne({ sender_id: user._id, client_message_id: clientMessageId })
      .populate('sender_id', 'full_name').lean<PopulatedMessage>()
    return toDto(existing!)
  }

  await Ticket.updateOne({ _id: ticket._id }, { last_message_at: message.created_at })
  const dto = toDto(await message.populate('sender_id', 'full_name') as unknown as PopulatedMessage)
  emitTicketMessage(ticketId, dto)
  return dto
}

/**
 * TICKET-FR-017 — tin hệ thống khi đổi người phụ trách. Gọi từ ticket.service
 * (Admin override / Technician xin gán lại); không kiểm quyền vì không do người dùng gửi.
 */
export async function postSystemMessage(ticketId: string, content: string): Promise<TicketMessageDto> {
  const message = await TicketMessage.create({ ticket_id: ticketId, content, is_system: true })
  await Ticket.updateOne({ _id: ticketId }, { last_message_at: message.created_at })
  const dto = toDto(message.toObject() as unknown as PopulatedMessage)
  emitTicketMessage(ticketId, dto)
  return dto
}
