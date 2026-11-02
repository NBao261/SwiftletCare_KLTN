import { Schema, model, Document, Types } from 'mongoose'

export type ParameterGroup = 'thresholds' | 'fuzzy'
export type ParameterReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED'

/**
 * EXPERT-FR-010, Report 3 §6.10 — mục duyệt thay đổi của Farm Owner trên farm có Domain Expert.
 * Thay đổi đã áp dụng ngay; mục này để chuyên gia chấp nhận, hoàn lại hoặc tự sửa (ADJUSTED).
 * `old_values` là giá trị trước lần sửa đầu tiên — Farm Owner sửa tiếp thì chỉ `new_values` đổi.
 */
export interface IParameterReview extends Document {
  _id: Types.ObjectId
  zone_id: Types.ObjectId
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
    zone_id:     { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    group:       { type: String, enum: ['thresholds', 'fuzzy'] satisfies ParameterGroup[], required: true },
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
// Mỗi Zone, mỗi nhóm tham số chỉ 1 mục đang chờ — Farm Owner sửa tiếp thì cập nhật mục đó
parameterReviewSchema.index({ zone_id: 1, group: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING_REVIEW' } })
// Danh sách mục duyệt của 1 farm, mới nhất trước
parameterReviewSchema.index({ farm_id: 1, created_at: -1 })

export const ParameterReview = model<IParameterReview>('ParameterReview', parameterReviewSchema)
