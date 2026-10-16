import { Schema, model, Document, Types } from 'mongoose'

/** VISION-FR-017 — số chim qua vạch đếm theo khoảng 5 phút, cả ngoài 2 phiên sáng/chiều */
export interface IBirdCountBucket extends Document {
  _id: Types.ObjectId
  camera_node_id: Types.ObjectId
  zone_id: Types.ObjectId
  /** Đầu khoảng, đã được nút AI làm tròn xuống theo độ dài khoảng */
  bucket_start: Date
  entry_count: number
  exit_count: number
}

/** Giữ 90 ngày như telemetry (SRS §8.2 `bird_count_buckets`) */
export const BIRD_COUNT_BUCKET_TTL_SECONDS = 90 * 24 * 60 * 60

const birdCountBucketSchema = new Schema<IBirdCountBucket>(
  {
    camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode', required: true },
    zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    bucket_start:   { type: Date, required: true },
    entry_count:    { type: Number, required: true, min: 0 },
    exit_count:     { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
)

// Nút AI gửi lại cùng khoảng (khởi động lại, mạng chập chờn) → upsert, không cộng đôi
birdCountBucketSchema.index({ camera_node_id: 1, bucket_start: 1 }, { unique: true })
birdCountBucketSchema.index({ zone_id: 1, bucket_start: -1 })
birdCountBucketSchema.index({ bucket_start: 1 }, { expireAfterSeconds: BIRD_COUNT_BUCKET_TTL_SECONDS })

export const BirdCountBucket = model<IBirdCountBucket>('BirdCountBucket', birdCountBucketSchema)
