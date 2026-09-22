import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

/**
 * Tin nhắn chat trong ticket – TICKET-FR-014..017, Flow 23. Khác `tickets.notes`
 * (ghi chú 1 chiều theo tiến độ xử lý): đây là hội thoại 2 chiều thời gian thực
 * giữa Farm Owner và Technician đang phụ trách, Admin tham gia được.
 */
export interface ITicketMessage extends Document {
  _id: Types.ObjectId
  ticket_id: Types.ObjectId
  /** Không có với tin nhắn hệ thống (VD: thông báo đổi Technician) */
  sender_id?: Types.ObjectId
  sender_role?: Role
  content: string
  is_system: boolean
  /** Flow 23 case 5a — id do client sinh để gửi lại sau khi mất kết nối không bị lưu trùng */
  client_message_id?: string
  created_at: Date
}

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    ticket_id:   { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    sender_id:   { type: Schema.Types.ObjectId, ref: 'User' },
    sender_role: { type: String, enum: ['ADMIN', 'FARM_OWNER', 'TECHNICIAN', 'SALES_STAFF'] as Role[] },
    content:     { type: String, required: true, maxlength: 2000 },
    is_system:   { type: Boolean, default: false },
    client_message_id: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

// Lịch sử chat luôn đọc theo ticket, mới nhất trước (phân trang ngược)
ticketMessageSchema.index({ ticket_id: 1, created_at: -1 })
// Dedupe gửi lại — chỉ áp cho tin có client_message_id
ticketMessageSchema.index(
  { sender_id: 1, client_message_id: 1 },
  { unique: true, partialFilterExpression: { client_message_id: { $type: 'string' } } },
)

export const TicketMessage = model<ITicketMessage>('TicketMessage', ticketMessageSchema)
