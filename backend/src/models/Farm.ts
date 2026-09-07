import { Schema, model, Document, Types } from 'mongoose'

/**
 * Farm + Member Document – SRS §8.2, FARM-FR-001
 */
export interface IFarmMember {
  user_id:   Types.ObjectId
  role:      'OPERATOR'
  joined_at: Date
}

export interface IFarm extends Document {
  _id: Types.ObjectId
  name: string
  address: string
  coordinates?: { lat: number; lng: number }
  owner_id: Types.ObjectId
  members: IFarmMember[]
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
      user_id:   { type: Schema.Types.ObjectId, ref: 'User' },
      role:      { type: String, enum: ['OPERATOR'], default: 'OPERATOR' },
      joined_at: { type: Date, default: Date.now },
    }],
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at' } }
)

// Soft-delete scope
farmSchema.pre(/^find/, function (this: ReturnType<typeof farmSchema.query>, next) {
  void (this as { where: Function }).where({ is_deleted: false })
  next()
})

export const Farm = model<IFarm>('Farm', farmSchema)
