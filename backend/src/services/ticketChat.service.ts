import { Ticket, ITicket } from '@/models/ticket.model'
import { TicketMessage, ITicketMessage } from '@/models/ticketMessage.model'
import { findFarmOrThrow, hasFarmAccess } from '@/utils/farmAccess.util'
import { emitTicketMessage } from '@/socket'
import { paginate } from '@/utils/helpers.util'
import { assigneeIdOf } from '@/utils/ticket.util'
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

// Dùng chung helper với ticket.service — bản cũ ở đây không xử lý `assigned_to`
// đã populate, đổi `loadTicketForChat` sang truy vấn có populate là Technician
// đang phụ trách lập tức bị 403 khi chat.
const currentAssignee = assigneeIdOf

/** TICKET-FR-017 — mốc Technician này bị chuyển khỏi ticket (null nếu chưa từng phụ trách) */
function removedAt(ticket: ITicket, userId: string): Date | null {
  return ticket.previous_assignees?.find(p => String(p.user_id) === userId)?.until ?? null
}

/**
 * TICKET-FR-014 — ai được đọc kênh chat:
 * - Admin: luôn được (TICKET-FR-005b)
 * - Farm Owner/thành viên của farm sở hữu ticket (không tính Technician/Sales cùng farm)
 * - Technician đang phụ trách; người TỪNG phụ trách chỉ đọc lịch sử cũ (`limitedUntil`)
 * Technician khác cùng vùng thì KHÔNG — khác quyền xem ticket (Flow 23 case 6a).
 */
async function readScope(ticket: ITicket, user: CurrentUser): Promise<{ allowed: boolean; limitedUntil?: Date }> {
  if (user.role === 'ADMIN') return { allowed: true }
  if (user.role === 'TECHNICIAN') {
    if (currentAssignee(ticket) === user._id) return { allowed: true }
    const until = removedAt(ticket, user._id)
    return until ? { allowed: true, limitedUntil: until } : { allowed: false }
  }
  if (user.role === 'FARM_OWNER') {
    const farm = await findFarmOrThrow(String(ticket.farm_id))
    return { allowed: hasFarmAccess(farm, user) }
  }
  return { allowed: false }
}

async function loadTicketForChat(
  ticketId: string, user: CurrentUser,
): Promise<{ ticket: ITicket; limitedUntil?: Date }> {
  const ticket = await Ticket.findById(ticketId)
  if (!ticket) throw NotFoundError('Không tìm thấy ticket')
  const scope = await readScope(ticket, user)
  // Cùng thông báo cho "không có quyền" — không xác nhận ticket tồn tại với người ngoài
  if (!scope.allowed) throw ForbiddenError('Không có quyền tham gia trò chuyện của ticket này')
  return { ticket, limitedUntil: scope.limitedUntil }
}

/**
 * Flow 23 bước 2 — gọi khi client JOIN_TICKET_CHAT. Người từng phụ trách KHÔNG
 * vào room được: vào room là nhận tin realtime, trong khi họ chỉ được xem lại
 * lịch sử cũ qua REST (TICKET-FR-017).
 */
export async function assertCanJoin(ticketId: string, user: CurrentUser): Promise<void> {
  const { limitedUntil } = await loadTicketForChat(ticketId, user)
  if (limitedUntil) throw ForbiddenError('Ticket đã chuyển cho Technician khác — bạn chỉ xem lại được lịch sử cũ')
}

/**
 * TICKET-FR-015 — lịch sử chat, mới nhất trước; mỗi trang trả theo thứ tự cũ →
 * mới để client nối thẳng vào khung chat.
 *
 * Cuộn ngược lên nên dùng `before` (cursor = `created_at` của tin cũ nhất đang
 * hiển thị): tin mới liên tục chèn vào ĐẦU luồng, nên phân trang bằng `page`
 * (offset) sẽ trả lại những tin đã hiển thị ở trang trước mỗi khi có tin mới
 * chen vào giữa 2 lần gọi. `page` vẫn dùng được cho client cũ.
 */
export async function listMessages(
  ticketId: string, user: CurrentUser,
  query: { page?: string | number; limit?: string | number; before?: string },
) {
  const { limitedUntil } = await loadTicketForChat(ticketId, user)

  // Technician cũ chỉ thấy tin tới lúc bị chuyển (TICKET-FR-017)
  const cutoffs: Date[] = []
  if (limitedUntil) cutoffs.push(limitedUntil)
  if (query.before) {
    const before = new Date(query.before)
    if (Number.isNaN(before.getTime())) throw BadRequestError('before phải là thời điểm ISO-8601 hợp lệ')
    cutoffs.push(new Date(before.getTime() - 1)) // loại chính tin đang làm mốc
  }
  const filter = {
    ticket_id: ticketId,
    ...(cutoffs.length ? { created_at: { $lte: new Date(Math.min(...cutoffs.map(d => d.getTime()))) } } : {}),
  }

  // Có cursor thì luôn lấy từ đầu cửa sổ, không cộng offset nữa
  const { page, skip, limit } = paginate(query.before ? 1 : query.page, query.limit, { defaultLimit: 50, maxLimit: 100 })
  const [records, total] = await Promise.all([
    TicketMessage.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit)
      .populate('sender_id', 'full_name').lean<PopulatedMessage[]>(),
    TicketMessage.countDocuments(filter),
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

  const { ticket } = await loadTicketForChat(ticketId, user)
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
    const existing = await TicketMessage.findOne({ ticket_id: ticket._id, sender_id: user._id, client_message_id: clientMessageId })
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
