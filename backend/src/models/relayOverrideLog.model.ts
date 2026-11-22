import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

export type OverrideRelay = 'misting' | 'ventilation' | 'speaker'
export type OverrideEndReason = 'EXPIRED' | 'CLEARED_EARLY' | 'REPLACED'

// Nguồn tính tỷ lệ tự động: sensor_nodes chỉ giữ hiện tại
export interface IRelayOverrideLog extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  zone_id: Types.ObjectId
  farm_id: Types.ObjectId
  relay: OverrideRelay
  state: boolean
  started_by: Types.ObjectId
  started_by_role: Role
  started_at: Date
  expires_at: Date
  // null khi đang override
  ended_at?: Date | null
  end_reason?: OverrideEndReason
  // Farm Owner đã xác nhận bật bơm khi có cảnh báo
  alert_confirmed: boolean
}

const relayOverrideLogSchema = new Schema<IRelayOverrideLog>(
  {
    node_id:  { type: Schema.Types.ObjectId, ref: 'SensorNode', required: true },
    zone_id:  { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    relay:    { type: String, enum: ['misting', 'ventilation', 'speaker'] satisfies OverrideRelay[], required: true },
    state:    { type: Boolean, required: true },
    started_by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    started_by_role: { type: String, required: true },
    started_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    ended_at:   { type: Date, default: null },
    end_reason: { type: String, enum: ['EXPIRED', 'CLEARED_EARLY', 'REPLACED'] satisfies OverrideEndReason[] },
    alert_confirmed: { type: Boolean, default: false },
  },
  { versionKey: false },
)

relayOverrideLogSchema.index({ node_id: 1, started_at: -1 })
relayOverrideLogSchema.index({ zone_id: 1, started_at: -1 })
relayOverrideLogSchema.index({ ended_at: 1, expires_at: 1 })

export const RelayOverrideLog = model<IRelayOverrideLog>('RelayOverrideLog', relayOverrideLogSchema)
