import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole } from '@/types'
import { applySoftDeleteScope } from '@/utils/softDelete.util'

export interface IFarmMember {
  user_id:    Types.ObjectId
  is_primary: boolean
  /** FARM_TECHNICIAN chỉ các nhà được giao (houses.technicians, AUTH-FR-013) */
  role:       FarmMemberRole
  joined_at:  Date
}

export interface IFarm extends Document {
  _id: Types.ObjectId
  name: string
  address: string
  /** A-5: bắt buộc ở route; farm cũ có thể chưa có */
  coordinates?: { lat: number; lng: number }
  owner_id: Types.ObjectId
  members: Types.DocumentArray<IFarmMember & Document>
  is_deleted: boolean
  created_at: Date
}

const farmSchema = new Schema<IFarm>(
  {
    name:        { type: String, required: true, trim: true },
    address:     { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    owner_id:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
      user_id:    { type: Schema.Types.ObjectId, ref: 'User' },
      is_primary: { type: Boolean, default: false },
      // Member cũ không có field này đều là Farm Owner
      role:       { type: String, enum: ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'] satisfies FarmMemberRole[], default: 'FARM_OWNER' },
      joined_at:  { type: Date, default: Date.now },
    }],
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at' } }
)

applySoftDeleteScope(farmSchema)

farmSchema.index({ owner_id: 1 })
farmSchema.index({ 'members.user_id': 1 })

export const Farm = model<IFarm>('Farm', farmSchema)
