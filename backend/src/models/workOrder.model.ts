import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType } from '@/types'

export const WORK_ORDER_STATUSES = ['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL', 'CLOSED', 'CANCELLED'] as const
export type WorkOrderStatus = typeof WORK_ORDER_STATUSES[number]
// mỗi cảnh báo chỉ 1 Work Order ở các trạng thái này
export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL']

export const SITE_CAUSES = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER'] as const
export type SiteCause = typeof SITE_CAUSES[number]

export const WORK_ORDER_ORIGINS = ['ALERT', 'OUTAGE', 'EXPERT', 'ONSITE_CHECK', 'MANUAL', 'PLAN', 'CHECKLIST', 'RECOMMENDATION'] as const
export type WorkOrderOrigin = typeof WORK_ORDER_ORIGINS[number]

export interface ChecklistItem {
  item: string
  result?: 'OK' | 'DEFECT'
  note?: string
  photo?: string
  by?: Types.ObjectId
  at?: Date
  repair_work_order_id?: Types.ObjectId
}

// Thiết bị của phiếu bị gỡ, thay hay dời: cảnh báo đóng theo nó không phải dữ liệu phục hồi
export const DEVICE_LEFT_KINDS = ['REMOVED', 'REPLACED', 'MOVED'] as const
export type DeviceLeftKind = typeof DEVICE_LEFT_KINDS[number]

export interface WorkOrderHistoryEntry {
  from?: WorkOrderStatus
  to: WorkOrderStatus
  by?: Types.ObjectId
  note?: string
  at: Date
}

export interface IWorkOrder extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  zone_id?: Types.ObjectId
  node_id?: Types.ObjectId
  alert_id?: Types.ObjectId
  alert_type?: AlertType
  kind: 'REPAIR' | 'PREVENTIVE'
  plan_id?: Types.ObjectId
  recommendation_id?: Types.ObjectId
  checklist: ChecklistItem[]
  origin: WorkOrderOrigin
  title: string
  description?: string
  status: WorkOrderStatus
  // Index unique một phần dùng cờ này vì partialFilterExpression trước MongoDB 6.0 không nhận $in
  is_open: boolean
  // Không có = nhà không có thợ, Farm Owner xử lý
  assignee_id?: Types.ObjectId
  opened_by?: Types.ObjectId
  cause?: SiteCause
  work_note?: string
  photos: string[]
  result?: 'REPAIRED' | 'SELF_RECOVERED' | 'DONE'
  cancel_reason?: string
  opened_at: Date
  started_at?: Date
  done_at?: Date
  verified_at?: Date
  closed_at?: Date
  assigned_at?: Date
  escalated_at?: Date
  device_left?: { kind: DeviceLeftKind; at: Date }
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
    plan_id:     { type: Schema.Types.ObjectId, ref: 'MaintenancePlan' },
    recommendation_id: { type: Schema.Types.ObjectId, ref: 'Recommendation' },
    checklist: [{
      item:   { type: String, required: true },
      result: { type: String, enum: ['OK', 'DEFECT'] },
      note:   { type: String },
      photo:  { type: String },
      by:     { type: Schema.Types.ObjectId, ref: 'User' },
      at:     { type: Date },
      repair_work_order_id: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
      _id: false,
    }],
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
    result:      { type: String, enum: ['REPAIRED', 'SELF_RECOVERED', 'DONE'] },
    cancel_reason: { type: String },
    opened_at:   { type: Date, default: Date.now },
    started_at:  { type: Date },
    done_at:     { type: Date },
    verified_at: { type: Date },
    closed_at:   { type: Date },
    assigned_at: { type: Date },
    escalated_at: { type: Date },
    device_left: {
      type: {
        kind: { type: String, enum: DEVICE_LEFT_KINDS, required: true },
        at:   { type: Date, required: true },
        _id: false,
      },
    },
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

workOrderSchema.index({ house_id: 1, status: 1 })
workOrderSchema.index({ assignee_id: 1, status: 1 })
workOrderSchema.index({ plan_id: 1, status: 1 }, { partialFilterExpression: { plan_id: { $exists: true } } })
// lần mở đồng thời thứ hai gặp lỗi trùng khoá
workOrderSchema.index(
  { alert_id: 1 },
  { unique: true, partialFilterExpression: { is_open: true, alert_id: { $exists: true } } },
)

export const WorkOrder = model<IWorkOrder>('WorkOrder', workOrderSchema)
