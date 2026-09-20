import { Schema, model, Document, Types } from 'mongoose'
import type { TicketType, TicketPriority, TicketStatus } from '@/types'

/** Ticket – SRS §8.2, Module TICKET (§5.9) */
export interface ITicketNote {
  author_id: Types.ObjectId
  content: string
  created_at: Date
}

export interface ITicket extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  alert_id?: Types.ObjectId
  created_by?: Types.ObjectId
  type: TicketType
  priority: TicketPriority
  status: TicketStatus
  assigned_to?: Types.ObjectId
  /**
   * Chỉ dùng cho type=INSTALLATION/MAINTENANCE. Farm Owner chọn thẳng ngày giờ
   * hẹn ngay lúc tạo ticket (TICKET-FR-001/004b, Flow 9b bước 1) — không có bước
   * liên hệ qua lại; Technician/Admin chỉ sửa lại khi không sắp xếp được.
   */
  scheduled_visit_at?: Date
  sla_response_due_at?: Date
  sla_resolve_due_at?: Date
  is_sla_breached: boolean
  sat_checklist: {
    modbus_addresses_ok: boolean
    camera_rtsp_ok: boolean
    lte_connection_ok: boolean
    relay_test_ok: boolean
  }
  notes: ITicketNote[]
  satisfaction_rating?: number
  created_at: Date
  closed_at?: Date
  /**
   * TICKET-FR-012 — ticket bị huỷ cũng chuyển sang CLOSED, nhưng không phải là
   * việc đã được xử lý. Không tách ra thì KPI tính chúng như ticket hoàn thành
   * sau vài phút, kéo thời gian xử lý trung bình xuống giả tạo.
   */
  cancelled_at?: Date
}

const ticketSchema = new Schema<ITicket>(
  {
    farm_id:    { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:    { type: Schema.Types.ObjectId, ref: 'Zone' },
    alert_id:   { type: Schema.Types.ObjectId, ref: 'Alert' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'SENSOR_FAULT','RS485_BUS_FAILURE','ACTUATOR_FAILURE','NODE_OFFLINE',
        'EDGE_AI_DEGRADED','POWER_OUTAGE','SPEAKER_FAILURE','PREDATOR_DETECTED',
        'INSTALLATION','MAINTENANCE','OTHER',
      ] as TicketType[],
      required: true,
    },
    priority: { type: String, enum: ['P1','P2','P3'] as TicketPriority[], required: true },
    status:   { type: String, enum: ['NEW','IN_PROGRESS','AWAITING_FIELD_CONFIRMATION','CLOSED'] as TicketStatus[], default: 'NEW' },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduled_visit_at:  { type: Date },
    sla_response_due_at: { type: Date },
    sla_resolve_due_at:  { type: Date },
    is_sla_breached:     { type: Boolean, default: false },
    sat_checklist: {
      modbus_addresses_ok: { type: Boolean, default: false },
      camera_rtsp_ok:      { type: Boolean, default: false },
      lte_connection_ok:   { type: Boolean, default: false },
      relay_test_ok:       { type: Boolean, default: false },
    },
    notes: [{
      author_id:  { type: Schema.Types.ObjectId, ref: 'User' },
      content:    { type: String },
      created_at: { type: Date, default: Date.now },
    }],
    satisfaction_rating: { type: Number, min: 1, max: 5 },
    closed_at: { type: Date },
    cancelled_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false }
)

ticketSchema.index({ farm_id: 1, status: 1 })
ticketSchema.index({ assigned_to: 1, status: 1 })

export const Ticket = model<ITicket>('Ticket', ticketSchema)
