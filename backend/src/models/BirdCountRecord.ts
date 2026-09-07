import { Schema, model, Document, Types } from 'mongoose'
import type { SessionType } from '@/types'

/** Bird counting session record – SRS §8.2, VISION-FR-008 */
export interface IBirdCountRecord extends Document {
  _id: Types.ObjectId
  camera_node_id: Types.ObjectId
  zone_id: Types.ObjectId
  timestamp: Date
  session_type: SessionType
  entry_count: number
  exit_count: number
  return_rate: number
  confidence_avg?: number
}

const birdCountSchema = new Schema<IBirdCountRecord>(
  {
    camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode', required: true },
    zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    timestamp:      { type: Date, required: true },
    session_type:   { type: String, enum: ['MORNING_EXIT','EVENING_ENTRY'] as SessionType[], required: true },
    entry_count:    { type: Number, default: 0 },
    exit_count:     { type: Number, default: 0 },
    return_rate:    { type: Number },
    confidence_avg: { type: Number },
  },
  { timestamps: false }
)

birdCountSchema.index({ zone_id: 1, timestamp: -1 })

export const BirdCountRecord = model<IBirdCountRecord>('BirdCountRecord', birdCountSchema)
