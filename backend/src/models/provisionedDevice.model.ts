import { Schema, model, Document, Types } from 'mongoose'

export type ProvisionedDeviceKind = 'SENSOR' | 'CAMERA'

// chỉ giữ hash của secretKey; biết device_id (lộ trên topic) không đủ để chiếm thiết bị
export interface IProvisionedDevice extends Document {
  _id: Types.ObjectId
  device_id: string
  kind: ProvisionedDeviceKind
  secret_key_hash: string
  // Hash; flash cùng device ID, không in lên nhãn
  broker_secret_hash?: string
  // MAC của chip khi nạp từ màn Kho thiết bị qua USB: biết bo mạch nào mang mã nào, một chip một mã
  chip_mac?: string
  claimed_at?: Date
  revoked_at?: Date
  revoke_reason?: string
  simulated: boolean
  created_by?: Types.ObjectId
  created_at: Date
}

const provisionedDeviceSchema = new Schema<IProvisionedDevice>(
  {
    device_id:       { type: String, required: true, unique: true, trim: true },
    kind:            { type: String, enum: ['SENSOR', 'CAMERA'] satisfies ProvisionedDeviceKind[], required: true },
    secret_key_hash: { type: String, required: true, select: false },
    broker_secret_hash: { type: String, select: false },
    chip_mac:        { type: String, uppercase: true, trim: true, unique: true, sparse: true },
    claimed_at:      { type: Date },
    revoked_at:      { type: Date },
    revoke_reason:   { type: String, trim: true },
    simulated:       { type: Boolean, default: false },
    created_by:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

export const ProvisionedDevice = model<IProvisionedDevice>('ProvisionedDevice', provisionedDeviceSchema)
