import { Schema, model, Document, Types } from 'mongoose'
import type { SessionType } from '@/types'

export interface IBirdCountRecord extends Document {
  _id: Types.ObjectId
  camera_node_id: Types.ObjectId
  house_id: Types.ObjectId
  timestamp: Date
  // Giờ VN: phiên sáng 05:30 VN là 22:30 UTC hôm trước
  session_date: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  confidence_avg?: number
  // 'HH:mm' giờ VN; chưa tính thì không có
  window_start?: string
  window_end?: string
  // false khi EDGE_AI_DEGRADED mở trong khung
  complete?: boolean
  // Từ đây tin cộng dồn của nút AI không ghi đè nữa
  computed_at?: Date
}

const birdCountSchema = new Schema<IBirdCountRecord>(
  {
    camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode', required: true },
    house_id:       { type: Schema.Types.ObjectId, ref: 'House', required: true },
    timestamp:      { type: Date, required: true },
    session_date:   { type: String, required: true },
    session_type:   { type: String, enum: ['MORNING_EXIT','EVENING_ENTRY'] satisfies SessionType[], required: true },
    entry_count:    { type: Number, default: 0 },
    exit_count:     { type: Number, default: 0 },
    confidence_avg: { type: Number },
    window_start:   { type: String },
    window_end:     { type: String },
    complete:       { type: Boolean },
    computed_at:    { type: Date },
    // return_rate tính cho cả House lúc đọc (houseDailyCounts)
  },
  { timestamps: false }
)

birdCountSchema.index({ house_id: 1, session_date: 1 })
// Nút AI gửi cộng dồn mỗi 30 s: upsert theo khoá này
birdCountSchema.index({ camera_node_id: 1, session_type: 1, session_date: 1 }, { unique: true })

export const BirdCountRecord = model<IBirdCountRecord>('BirdCountRecord', birdCountSchema)
