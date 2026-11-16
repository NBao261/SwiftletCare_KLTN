import { Schema, model, Document, Types } from 'mongoose'
import type { DetectionTuning, FuzzyTuning, Thresholds } from '@/types'

/**
 * Hồ sơ cấu hình — EXPERT-FR-014, 015; Report 3 §6.23 (SM-23); Report 4 ERD `CONFIG_PROFILE`. Domain Expert
 * soạn (DRAFT) rồi duyệt (APPROVED); Farm Owner áp cho nhiều nhà một lần, mỗi zone nhận một phiên bản cấu hình
 * mới. Mỗi nhóm giá trị có thể bỏ trống (áp thì không đổi nhóm đó), nhưng đã có thì đủ mọi khoá.
 */
export type ConfigProfileStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED'
export const CONFIG_PROFILE_STAGES = ['ATTRACTING', 'OCCUPIED'] as const
export type ConfigProfileStage = typeof CONFIG_PROFILE_STAGES[number]

export interface SpeakerScheduleValues {
  enabled: boolean
  windows: Array<{ start: string; end: string }>
}

export interface IConfigProfile extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  author_id: Types.ObjectId
  name: string
  /** FARM-FR-014 — giai đoạn nhà mà hồ sơ dành cho; null = mọi giai đoạn */
  stage: ConfigProfileStage | null
  thresholds?: Thresholds
  fuzzy_tuning?: FuzzyTuning
  detection_tuning?: DetectionTuning
  speaker_schedule?: SpeakerScheduleValues
  status: ConfigProfileStatus
  approved_by?: Types.ObjectId
  approved_at?: Date
  archived_at?: Date
  /** EXPERT-FR-015 — mỗi lần Farm Owner áp hồ sơ */
  applications: Array<{ house_ids: Types.ObjectId[]; zone_count: number; applied_by: Types.ObjectId; applied_at: Date }>
  created_at: Date
  updated_at: Date
}

const configProfileSchema = new Schema<IConfigProfile>(
  {
    farm_id:   { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:      { type: String, required: true, trim: true },
    stage:     { type: String, enum: [...CONFIG_PROFILE_STAGES], default: null },
    // Mixed: nhóm vắng mặt phải là undefined (áp thì giữ nguyên), không phải object mặc định của schema lồng
    thresholds:       { type: Schema.Types.Mixed },
    fuzzy_tuning:     { type: Schema.Types.Mixed },
    detection_tuning: { type: Schema.Types.Mixed },
    speaker_schedule: { type: Schema.Types.Mixed },
    status:      { type: String, enum: ['DRAFT', 'APPROVED', 'ARCHIVED'] satisfies ConfigProfileStatus[], default: 'DRAFT' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    archived_at: { type: Date },
    applications: [{
      house_ids:  [{ type: Schema.Types.ObjectId, ref: 'House' }],
      zone_count: { type: Number, required: true },
      applied_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      applied_at: { type: Date, required: true },
      _id: false,
    }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Report 4 §6 — danh sách hồ sơ của farm theo trạng thái
configProfileSchema.index({ farm_id: 1, status: 1 })

export const ConfigProfile = model<IConfigProfile>('ConfigProfile', configProfileSchema)
