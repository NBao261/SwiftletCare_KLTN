import { Schema, model, Document, Types } from 'mongoose'

export type ProvisionedDeviceKind = 'SENSOR' | 'CAMERA'

/**
 * Kho thiết bị công ty đã chuẩn bị sẵn — FARM-FR-003, Flow 1 bước 3–4.
 * Mỗi thiết bị xuất xưởng có cặp `{device_id, secretKey}` in trên vỏ. Backend chỉ
 * giữ hash của secretKey (giống OTP), bản rõ chỉ trả về đúng 1 lần lúc Admin tạo
 * để in nhãn. Technician onboarding phải nhập đúng cặp này — biết mỗi device_id
 * (vốn lộ trên topic MQTT) không đủ để chiếm thiết bị.
 */
export interface IProvisionedDevice extends Document {
  _id: Types.ObjectId
  device_id: string
  kind: ProvisionedDeviceKind
  secret_key_hash: string
  /** Lần đầu kích hoạt thành công qua Web Console Onboarding */
  claimed_at?: Date
  created_by?: Types.ObjectId
  created_at: Date
}

const provisionedDeviceSchema = new Schema<IProvisionedDevice>(
  {
    device_id:       { type: String, required: true, unique: true, trim: true },
    kind:            { type: String, enum: ['SENSOR', 'CAMERA'] as ProvisionedDeviceKind[], required: true },
    secret_key_hash: { type: String, required: true, select: false },
    claimed_at:      { type: Date },
    created_by:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

export const ProvisionedDevice = model<IProvisionedDevice>('ProvisionedDevice', provisionedDeviceSchema)
