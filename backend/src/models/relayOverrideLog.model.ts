import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

export type OverrideRelay = 'misting' | 'ventilation' | 'speaker'
export type OverrideEndReason = 'EXPIRED' | 'CLEARED_EARLY' | 'REPLACED'

/**
 * RelayOverrideLog – SRS §8.2, ENV-FR-019. Mỗi lần can thiệp tay 1 relay là 1 bản ghi:
 * ai, role gì, lúc nào, ép trạng thái gì, kết thúc lúc nào và vì sao. Đây là nguồn
 * tính tỷ lệ thời gian tự động (ANALYTICS-FR-011) — `sensor_nodes` chỉ giữ trạng thái
 * hiện tại, `audit_logs` không ghi lúc override hết hạn.
 */
export interface IRelayOverrideLog extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  zone_id: Types.ObjectId
  farm_id: Types.ObjectId
  relay: OverrideRelay
  /** Trạng thái được ép */
  state: boolean
  started_by: Types.ObjectId
  started_by_role: Role
  started_at: Date
  expires_at: Date
  /** null khi đang override */
  ended_at?: Date | null
  end_reason?: OverrideEndReason
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
  },
  { versionKey: false },
)

// Lịch sử của 1 thiết bị (mới nhất trước) + tìm bản ghi đang mở để đóng
relayOverrideLogSchema.index({ node_id: 1, started_at: -1 })
// Tỷ lệ thời gian tự động theo Zone trong 1 khoảng
relayOverrideLogSchema.index({ zone_id: 1, started_at: -1 })

export const RelayOverrideLog = model<IRelayOverrideLog>('RelayOverrideLog', relayOverrideLogSchema)
