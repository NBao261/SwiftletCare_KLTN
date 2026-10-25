import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole } from '@/types'
import { applySoftDeleteScope } from '@/utils/softDelete.util'

/**
 * Farm + Member Document – SRS §8.2, FARM-FR-001
 */
export interface IFarmMember {
  user_id:    Types.ObjectId
  is_primary: boolean // true = người tạo Farm (AUTH-FR-005)
  /** FARM_OWNER = đồng sở hữu (quyền vận hành đầy đủ); DOMAIN_EXPERT = chuyên gia nuôi yến, cả farm (AUTH-FR-005) */
  role:       FarmMemberRole
  joined_at:  Date
}

export interface IFarm extends Document {
  _id: Types.ObjectId
  name: string
  address: string
  /** FARM-FR-001, A-5 — bắt buộc khi tạo (route); farm tạo trước đó có thể chưa có, nên schema không bắt buộc */
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
      // Member cũ (trước v1.23.0) không có field này — đều là Farm Owner
      role:       { type: String, enum: ['FARM_OWNER', 'DOMAIN_EXPERT'] satisfies FarmMemberRole[], default: 'FARM_OWNER' },
      joined_at:  { type: Date, default: Date.now },
    }],
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at' } }
)

applySoftDeleteScope(farmSchema)

// listFarms / listAccessibleFarmIds / notification.findRecipients tra farm theo chủ và thành viên
farmSchema.index({ owner_id: 1 })
farmSchema.index({ 'members.user_id': 1 })

export const Farm = model<IFarm>('Farm', farmSchema)
