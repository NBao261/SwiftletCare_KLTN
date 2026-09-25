import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole } from '@/types'

/** Invitation – SRS §8.2, AUTH-FR-010, Flow 12 */
export interface IInvitation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  invited_email: string
  invited_role: FarmMemberRole
  /** Phạm vi của Farm Operator — rỗng = cả farm (AUTH-FR-005/010) */
  zone_ids: Types.ObjectId[]
  invited_by: Types.ObjectId
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  expires_at: Date
  created_at: Date
  responded_at?: Date
}

const invitationSchema = new Schema<IInvitation>(
  {
    farm_id:       { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    invited_email: { type: String, required: true, lowercase: true, trim: true },
    invited_role:  { type: String, enum: ['FARM_OWNER', 'FARM_OPERATOR'] satisfies FarmMemberRole[], required: true },
    zone_ids:      { type: [{ type: Schema.Types.ObjectId, ref: 'Zone' }], default: [] },
    invited_by:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token:         { type: String, required: true, unique: true },
    status:        { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'], default: 'PENDING' },
    expires_at:    { type: Date, required: true },
    responded_at:  { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
)

invitationSchema.index({ farm_id: 1, invited_email: 1, status: 1 })

export const Invitation = model<IInvitation>('Invitation', invitationSchema)
