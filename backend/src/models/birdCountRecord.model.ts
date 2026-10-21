import { Schema, model, Document, Types } from 'mongoose'
import type { SessionType } from '@/types'

/** Bird counting session record – SRS §8.2, VISION-FR-008 */
export interface IBirdCountRecord extends Document {
  _id: Types.ObjectId
  camera_node_id: Types.ObjectId
  /** House của camera — số đếm chim là của cả nhà (SRS v2.1.8) */
  house_id: Types.ObjectId
  timestamp: Date
  /** 'YYYY-MM-DD' theo giờ Việt Nam — phiên sáng 05:30 VN là 22:30 UTC hôm trước nên không gom theo ngày UTC */
  session_date: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  confidence_avg?: number
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
    // Không lưu return_rate theo camera: tỷ lệ chim về tính cho cả House lúc đọc (birdCount.service#houseDailyCounts)
  },
  { timestamps: false }
)

// Mọi truy vấn đọc theo House + ngày giờ VN (houseDailyCounts)
birdCountSchema.index({ house_id: 1, session_date: 1 })
// VISION-FR-006: nút AI gửi số cộng dồn mỗi 30 giây — mỗi (camera, phiên, ngày) chỉ là 1 bản ghi, upsert theo khoá này
birdCountSchema.index({ camera_node_id: 1, session_type: 1, session_date: 1 }, { unique: true })

export const BirdCountRecord = model<IBirdCountRecord>('BirdCountRecord', birdCountSchema)
