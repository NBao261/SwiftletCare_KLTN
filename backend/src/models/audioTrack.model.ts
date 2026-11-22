import { Schema, model, Document, Types } from 'mongoose'

/** ENV-FR-013c: DFPlayer chỉ đọc thẻ SD; file MinIO chỉ để nghe lại, synced_to_sd do người dùng tự đánh dấu */
export interface IAudioTrack extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  /** 2 = 0002.mp3 trên thẻ SD */
  track_number: number
  display_name: string
  /** URL nghe thử ký tạm lúc đọc */
  file_key: string
  file_size_bytes: number
  synced_to_sd: boolean
  uploaded_by: Types.ObjectId
  uploaded_at: Date
}

const audioTrackSchema = new Schema<IAudioTrack>(
  {
    node_id:         { type: Schema.Types.ObjectId, ref: 'SensorNode', required: true },
    track_number:    { type: Number, required: true, min: 1 },
    display_name:    { type: String, required: true, trim: true },
    file_key:        { type: String, required: true },
    file_size_bytes: { type: Number, required: true },
    synced_to_sd:    { type: Boolean, default: false },
    uploaded_by:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploaded_at:     { type: Date, default: Date.now },
  },
  { timestamps: false }
)

audioTrackSchema.index({ node_id: 1, track_number: 1 }, { unique: true })

export const AudioTrack = model<IAudioTrack>('AudioTrack', audioTrackSchema)
