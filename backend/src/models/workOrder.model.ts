import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType } from '@/types'

/** Report 3 §6.19 (SM-19) */
export const WORK_ORDER_STATUSES = ['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL', 'CLOSED', 'CANCELLED'] as const
export type WorkOrderStatus = typeof WORK_ORDER_STATUSES[number]
/** Chưa đóng, chưa huỷ — BR-39: mỗi cảnh báo chỉ có 1 Work Order ở các trạng thái này */
export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL']

/** ALERT-FR-018 — nguyên nhân tìm thấy tại chỗ */
export const SITE_CAUSES = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER'] as const
export type SiteCause = typeof SITE_CAUSES[number]

/** Nguồn mở Work Order (BR-39, OPS-FR-001) */
export const WORK_ORDER_ORIGINS = ['ALERT', 'OUTAGE', 'EXPERT', 'ONSITE_CHECK', 'MANUAL'] as const
export type WorkOrderOrigin = typeof WORK_ORDER_ORIGINS[number]

export interface WorkOrderHistoryEntry {
  from?: WorkOrderStatus
  to: WorkOrderStatus
  /** Không có = hệ thống (mở tự động, kiểm phục hồi) */
  by?: Types.ObjectId
  note?: string
  at: Date
}

/** Report 4 ERD `WORK_ORDER` — OPS-FR-001…004 */
export interface IWorkOrder extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  zone_id?: Types.ObjectId
  node_id?: Types.ObjectId
  alert_id?: Types.ObjectId
  /** Loại cảnh báo lúc mở — so sự cố lặp lại và nguyên nhân bắt buộc (ALERT-FR-018) */
  alert_type?: AlertType
  /** PREVENTIVE dành cho bảo trì phòng ngừa (G-22) */
  kind: 'REPAIR' | 'PREVENTIVE'
  origin: WorkOrderOrigin
  title: string
  description?: string
  status: WorkOrderStatus
  /**
   * true khi chưa đóng/huỷ. Index unique một phần trên `alert_id` lọc theo cờ này thay vì `status: {$in}`
   * vì partialFilterExpression của MongoDB trước 6.0 không nhận `$in`.
   */
  is_open: boolean
  /** Thợ được giao; không có = nhà không có thợ, Farm Owner xử lý (ALERT-FR-017) */
  assignee_id?: Types.ObjectId
  /** Không có = hệ thống mở */
  opened_by?: Types.ObjectId
  cause?: SiteCause
  work_note?: string
  /** Khoá object trên MinIO */
  photos: string[]
  result?: 'REPAIRED' | 'SELF_RECOVERED'
  cancel_reason?: string
  opened_at: Date
  started_at?: Date
  done_at?: Date
  verified_at?: Date
  closed_at?: Date
  /** BR-40 — đã báo Farm Owner vì chưa ai bắt đầu sau escalation_min */
  escalated_at?: Date
  history: WorkOrderHistoryEntry[]
}

const workOrderSchema = new Schema<IWorkOrder>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id:    { type: Schema.Types.ObjectId, ref: 'House', required: true },
    zone_id:     { type: Schema.Types.ObjectId, ref: 'Zone' },
    node_id:     { type: Schema.Types.ObjectId },
    alert_id:    { type: Schema.Types.ObjectId, ref: 'Alert' },
    alert_type:  { type: String },
    kind:        { type: String, enum: ['REPAIR', 'PREVENTIVE'], default: 'REPAIR' },
    origin:      { type: String, enum: WORK_ORDER_ORIGINS, required: true },
    title:       { type: String, required: true },
    description: { type: String },
    status:      { type: String, enum: WORK_ORDER_STATUSES, default: 'OPEN' },
    is_open:     { type: Boolean, default: true },
    assignee_id: { type: Schema.Types.ObjectId, ref: 'User' },
    opened_by:   { type: Schema.Types.ObjectId, ref: 'User' },
    cause:       { type: String, enum: SITE_CAUSES },
    work_note:   { type: String },
    photos:      { type: [String], default: [] },
    result:      { type: String, enum: ['REPAIRED', 'SELF_RECOVERED'] },
    cancel_reason: { type: String },
    opened_at:   { type: Date, default: Date.now },
    started_at:  { type: Date },
    done_at:     { type: Date },
    verified_at: { type: Date },
    closed_at:   { type: Date },
    escalated_at: { type: Date },
    history: [{
      from: { type: String, enum: WORK_ORDER_STATUSES },
      to:   { type: String, enum: WORK_ORDER_STATUSES, required: true },
      by:   { type: Schema.Types.ObjectId, ref: 'User' },
      note: { type: String },
      at:   { type: Date, required: true },
      _id: false,
    }],
  },
  { versionKey: false },
)

// Report 4 §6.4 — danh sách theo nhà và theo người được giao
workOrderSchema.index({ house_id: 1, status: 1 })
workOrderSchema.index({ assignee_id: 1, status: 1 })
// BR-39 — một cảnh báo chỉ có 1 Work Order chưa đóng (hai lần mở đồng thời: lần sau gặp lỗi trùng khoá)
workOrderSchema.index(
  { alert_id: 1 },
  { unique: true, partialFilterExpression: { is_open: true, alert_id: { $exists: true } } },
)

export const WorkOrder = model<IWorkOrder>('WorkOrder', workOrderSchema)
