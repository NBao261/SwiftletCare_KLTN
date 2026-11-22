import { Schema, model, Document, Types } from 'mongoose'

export const PARAMETER_GROUPS = [
  'thresholds', 'fuzzy', 'detection', 'return_rate_drop', 'health_levels', 'counting_schedule', 'counting_ring',
] as const
export type ParameterGroup = typeof PARAMETER_GROUPS[number]
export type ParameterReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED'

/** BR-22: thay đổi đã áp ngay; old_values là giá trị trước lần sửa đầu tiên */
export interface IParameterReview extends Document {
  _id: Types.ObjectId
  // Khoá "một mục đang chờ"
  target_id: Types.ObjectId
  zone_id?: Types.ObjectId
  house_id?: Types.ObjectId
  camera_node_id?: Types.ObjectId
  farm_id: Types.ObjectId
  group: ParameterGroup
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  status: ParameterReviewStatus
  changed_by: Types.ObjectId
  reviewed_by?: Types.ObjectId
  reviewed_at?: Date
  created_at: Date
  updated_at: Date
}

const parameterReviewSchema = new Schema<IParameterReview>(
  {
    target_id:      { type: Schema.Types.ObjectId, required: true },
    zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone' },
    house_id:       { type: Schema.Types.ObjectId, ref: 'House' },
    camera_node_id: { type: Schema.Types.ObjectId, ref: 'CameraNode' },
    farm_id:        { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    group:          { type: String, enum: PARAMETER_GROUPS, required: true },
    old_values:  { type: Schema.Types.Mixed, required: true },
    new_values:  { type: Schema.Types.Mixed, required: true },
    status:      {
      type: String, enum: ['PENDING_REVIEW', 'ACCEPTED', 'REVERTED', 'ADJUSTED'] satisfies ParameterReviewStatus[],
      default: 'PENDING_REVIEW',
    },
    changed_by:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
)

parameterReviewSchema.index({ zone_id: 1, group: 1, status: 1 })
// Mỗi đối tượng, mỗi nhóm chỉ 1 mục đang chờ
parameterReviewSchema.index({ target_id: 1, group: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING_REVIEW' } })
parameterReviewSchema.index({ farm_id: 1, created_at: -1 })

export const ParameterReview = model<IParameterReview>('ParameterReview', parameterReviewSchema)
