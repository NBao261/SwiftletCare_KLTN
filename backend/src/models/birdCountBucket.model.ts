import { Schema, model, Document, Types } from 'mongoose'

export interface IBirdCountBucket extends Document {
  _id: Types.ObjectId
  camera_node_id: Types.ObjectId
  house_id: Types.ObjectId
  // Nút AI đã làm tròn xuống
  bucket_start: Date
  entry_count: number
  exit_count: number
}

export const BIRD_COUNT_BUCKET_TTL_SECONDS = 90 * 24 * 60 * 60

const birdCountBucketSchema = new Schema<IBirdCountBucket>(
  {
    camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode', required: true },
    house_id:       { type: Schema.Types.ObjectId, ref: 'House', required: true },
    bucket_start:   { type: Date, required: true },
    entry_count:    { type: Number, required: true, min: 0 },
    exit_count:     { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
)

// Nút AI gửi lại cùng khoảng thì upsert, không cộng đôi
birdCountBucketSchema.index({ camera_node_id: 1, bucket_start: 1 }, { unique: true })
birdCountBucketSchema.index({ house_id: 1, bucket_start: -1 })
birdCountBucketSchema.index({ bucket_start: 1 }, { expireAfterSeconds: BIRD_COUNT_BUCKET_TTL_SECONDS })

export const BirdCountBucket = model<IBirdCountBucket>('BirdCountBucket', birdCountBucketSchema)
