import { Schema, model, Document, Types } from 'mongoose'

// Ảnh cài đặt bộ điều khiển cho trạm nạp ở màn Kho thiết bị; file chứa giá trị Secrets.h nên chỉ ở bucket riêng
export interface IFirmwareImage extends Document {
  _id: Types.ObjectId
  version: string
  object_key: string
  size: number
  sha256: string
  note?: string
  uploaded_by: Types.ObjectId
  created_at: Date
}

const firmwareImageSchema = new Schema<IFirmwareImage>(
  {
    version:     { type: String, required: true, unique: true, trim: true },
    object_key:  { type: String, required: true, select: false },
    size:        { type: Number, required: true },
    sha256:      { type: String, required: true },
    note:        { type: String, trim: true, maxlength: 200 },
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

export const FirmwareImage = model<IFirmwareImage>('FirmwareImage', firmwareImageSchema)
