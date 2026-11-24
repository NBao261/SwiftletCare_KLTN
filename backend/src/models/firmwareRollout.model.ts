import { Schema, model, Document, Types } from 'mongoose'

// Đợt cập nhật firmware từ xa: một bản trong kho firmware cho các bộ điều khiển đã chọn.
// Máy offline chờ trong đợt và nhận lệnh khi online lại; máy thử trước (canary) xong thì mới tới các máy còn lại
export type RolloutStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type RolloutStage = 'CANARY' | 'ALL'
export type RolloutTargetState = 'QUEUED' | 'SENT' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'SKIPPED'

export const ROLLOUT_OPEN_STATUSES: RolloutStatus[] = ['ACTIVE', 'PAUSED']
// Máy còn đang trong đợt: không cho vào đợt khác hay nhận lệnh OTA gửi tay
export const TARGET_OPEN_STATES: RolloutTargetState[] = ['QUEUED', 'SENT']

export interface IRolloutTarget {
  node_id: Types.ObjectId
  device_id: string
  from_version: string
  canary: boolean
  state: RolloutTargetState
  attempts: number
  sent_at?: Date
  finished_at?: Date
  // TIMEOUT (quá hạn xác nhận, máy đã quay về bản cũ), NOT_IN_SERVICE (máy bị gỡ trước khi tới lượt)
  reason?: string
  // SHA-256 của token trong link tải; link chỉ dùng cho máy này, hết hạn cùng hạn xác nhận
  token_hash?: string
  token_expires_at?: Date
}

export interface IFirmwareRollout extends Document {
  _id: Types.ObjectId
  image_id: Types.ObjectId
  version: string
  status: RolloutStatus
  stage: RolloutStage
  // FAILURE: tự dừng vì một máy lỗi; ADMIN: Administrator bấm dừng
  paused_reason?: 'FAILURE' | 'ADMIN'
  note?: string
  targets: Types.DocumentArray<IRolloutTarget & Document>
  created_by: Types.ObjectId
  created_at: Date
  updated_at: Date
  finished_at?: Date
}

const targetSchema = new Schema<IRolloutTarget>(
  {
    node_id:          { type: Schema.Types.ObjectId, ref: 'SensorNode', required: true },
    device_id:        { type: String, required: true },
    from_version:     { type: String, required: true },
    canary:           { type: Boolean, default: false },
    state:            { type: String, enum: ['QUEUED', 'SENT', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED'], default: 'QUEUED' },
    attempts:         { type: Number, default: 0 },
    sent_at:          Date,
    finished_at:      Date,
    reason:           String,
    token_hash:       { type: String, select: false },
    token_expires_at: Date,
  },
  { _id: false },
)

const rolloutSchema = new Schema<IFirmwareRollout>(
  {
    image_id:      { type: Schema.Types.ObjectId, ref: 'FirmwareImage', required: true },
    version:       { type: String, required: true },
    status:        { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
    stage:         { type: String, enum: ['CANARY', 'ALL'], default: 'ALL' },
    paused_reason: { type: String, enum: ['FAILURE', 'ADMIN'] },
    note:          { type: String, trim: true, maxlength: 200 },
    targets:       { type: [targetSchema], default: [] },
    created_by:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    finished_at:   Date,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
)

// Heartbeat tìm đợt đang chờ máy này; link tải tìm theo token
rolloutSchema.index({ 'targets.node_id': 1, status: 1 })
rolloutSchema.index({ 'targets.token_hash': 1 }, { sparse: true })

export const FirmwareRollout = model<IFirmwareRollout>('FirmwareRollout', rolloutSchema)
