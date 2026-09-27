import { Schema, model, Document, Types } from 'mongoose'

/**
 * AudioTrack – SRS §8.2 `audio_tracks`, ENV-FR-013c. Danh mục file loa ru đã
 * upload cho 1 thiết bị — KHÔNG phải nguồn DFPlayer phát (DFPlayer chỉ đọc thẻ
 * SD vật lý). File trên MinIO chỉ để nghe lại trên web; `synced_to_sd` do
 * Technician tự đánh dấu sau khi chép tay file vào thẻ.
 */
export interface IAudioTrack extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  /** Khớp tên file trên thẻ SD: 2 = 0002.mp3 (Technician tự nhập) */
  track_number: number
  display_name: string
  /** Key object trên MinIO — URL nghe thử được ký tạm lúc đọc, không lưu cứng */
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

// 1 số thứ tự = 1 file trên thẻ SD của thiết bị đó
audioTrackSchema.index({ node_id: 1, track_number: 1 }, { unique: true })

export const AudioTrack = model<IAudioTrack>('AudioTrack', audioTrackSchema)
