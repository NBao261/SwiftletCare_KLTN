import { Schema, model, Document, Types } from 'mongoose'

/** OPS-FR-005 — loại thiết bị và cách tính chu kỳ */
export const MAINTENANCE_EQUIPMENT = ['PUMP', 'FAN', 'SENSOR', 'NOZZLE', 'CALIBRATION'] as const
export type MaintenanceEquipment = typeof MAINTENANCE_EQUIPMENT[number]
export const MAINTENANCE_BASES = ['RUN_HOURS', 'SWITCHES', 'CALENDAR'] as const
export type MaintenanceBasis = typeof MAINTENANCE_BASES[number]
/** Report 3 §6.20 (SM-20) */
export const MAINTENANCE_PLAN_STATES = ['SCHEDULED', 'DUE', 'OVERDUE', 'RETIRED'] as const
export type MaintenancePlanState = typeof MAINTENANCE_PLAN_STATES[number]

export interface MaintenanceRecord {
  work_order_id: Types.ObjectId
  /** Kế hoạch theo giờ chạy: controller đã được bảo trì */
  node_id?: Types.ObjectId
  kind: 'MAINTENANCE' | 'CALIBRATION'
  by: Types.ObjectId
  at: Date
  next_due_at?: Date
}

/** Report 4 ERD `MAINTENANCE_PLAN` — mẫu checklist nhúng; bộ đếm nằm ở `sensornodes.relay_usage` */
export interface IMaintenancePlan extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  equipment: MaintenanceEquipment
  basis: MaintenanceBasis
  /** Giờ chạy, số lần đóng cắt, hoặc số ngày (CALENDAR) — Farm Owner nhập, hệ thống không tự đặt */
  interval: number
  checklist_template: string[]
  state: MaintenancePlanState
  /** CALENDAR: điểm đến hạn kế tiếp (CALIBRATION: ngày hiệu chuẩn kế tiếp, OPS-FR-008) */
  next_due_at?: Date
  due_since?: Date
  /** OPS-FR-006 — đã báo Farm Owner vì quá maintenance_grace_days */
  overdue_notified_at?: Date
  last_done_at?: Date
  /** Nguồn của chu kỳ: khuyến cáo nhà sản xuất hoặc người nuôi */
  source: string
  note?: string
  comments: Array<{ by: Types.ObjectId; text: string; at: Date }>
  records: MaintenanceRecord[]
  created_by: Types.ObjectId
  created_at: Date
}

const maintenancePlanSchema = new Schema<IMaintenancePlan>(
  {
    farm_id:            { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id:           { type: Schema.Types.ObjectId, ref: 'House', required: true },
    equipment:          { type: String, enum: MAINTENANCE_EQUIPMENT, required: true },
    basis:              { type: String, enum: MAINTENANCE_BASES, required: true },
    interval:           { type: Number, required: true, min: 0 },
    checklist_template: { type: [String], default: [] },
    state:              { type: String, enum: MAINTENANCE_PLAN_STATES, default: 'SCHEDULED' },
    next_due_at:        { type: Date },
    due_since:          { type: Date },
    overdue_notified_at: { type: Date },
    last_done_at:       { type: Date },
    source:             { type: String, required: true },
    note:               { type: String },
    comments: [{
      by:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, required: true },
      at:   { type: Date, required: true },
      _id: false,
    }],
    records: [{
      work_order_id: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
      node_id:       { type: Schema.Types.ObjectId },
      kind:          { type: String, enum: ['MAINTENANCE', 'CALIBRATION'], required: true },
      by:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
      at:            { type: Date, required: true },
      next_due_at:   { type: Date },
      _id: false,
    }],
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

// Report 4 §6.4 — kế hoạch theo nhà và loại thiết bị; job đến hạn tìm theo trạng thái và điểm đến hạn
maintenancePlanSchema.index({ house_id: 1, equipment: 1 })
maintenancePlanSchema.index({ state: 1, next_due_at: 1 })

export const MaintenancePlan = model<IMaintenancePlan>('MaintenancePlan', maintenancePlanSchema)
