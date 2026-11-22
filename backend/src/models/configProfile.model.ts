import { Schema, model, Document, Types } from 'mongoose'
import type { DetectionTuning, FuzzyTuning, Thresholds } from '@/types'

/** EXPERT-FR-014, 015: nhóm bỏ trống thì áp không đổi nhóm đó, đã có thì đủ mọi khoá */
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
  /** null = mọi giai đoạn */
  stage: ConfigProfileStage | null
  thresholds?: Thresholds
  fuzzy_tuning?: FuzzyTuning
  detection_tuning?: DetectionTuning
  speaker_schedule?: SpeakerScheduleValues
  status: ConfigProfileStatus
  approved_by?: Types.ObjectId
  approved_at?: Date
  archived_at?: Date
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
    // Mixed: nhóm vắng phải là undefined, không phải object mặc định
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

configProfileSchema.index({ farm_id: 1, status: 1 })

export const ConfigProfile = model<IConfigProfile>('ConfigProfile', configProfileSchema)
