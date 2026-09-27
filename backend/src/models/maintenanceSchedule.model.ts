import { Schema, model, Document, Types } from 'mongoose'

/**
 * Lịch bảo trì định kỳ theo Farm – TICKET-FR-013. Đến `next_due_at` thì job
 * `maintenanceSchedule.job` tự tạo 1 ticket MAINTENANCE rồi dời hạn sang chu kỳ
 * kế tiếp.
 */
export interface IMaintenanceSchedule extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  description: string
  interval_days: number
  next_due_at: Date
  is_active: boolean
  created_by?: Types.ObjectId
  last_ticket_id?: Types.ObjectId
  last_generated_at?: Date
  created_at: Date
}

const maintenanceScheduleSchema = new Schema<IMaintenanceSchedule>(
  {
    farm_id:       { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:       { type: Schema.Types.ObjectId, ref: 'Zone' },
    description:   { type: String, required: true, trim: true, maxlength: 500 },
    interval_days: { type: Number, required: true, min: 1, max: 365 },
    next_due_at:   { type: Date, required: true },
    is_active:     { type: Boolean, default: true },
    created_by:    { type: Schema.Types.ObjectId, ref: 'User' },
    last_ticket_id:    { type: Schema.Types.ObjectId, ref: 'Ticket' },
    last_generated_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

// Job quét lịch đến hạn mỗi giờ
maintenanceScheduleSchema.index({ is_active: 1, next_due_at: 1 })
maintenanceScheduleSchema.index({ farm_id: 1 })

export const MaintenanceSchedule = model<IMaintenanceSchedule>('MaintenanceSchedule', maintenanceScheduleSchema)
