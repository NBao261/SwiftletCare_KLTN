import { Schema, model, Document, Types } from 'mongoose'

/**
 * Farm + Member Document – SRS §8.2, FARM-FR-001
 */
export interface IFarmMember {
  user_id:    Types.ObjectId
  is_primary: boolean // true = người tạo Farm (AUTH-FR-005); mọi member đều role FARM_OWNER
  joined_at:  Date
}

export interface IFarm extends Document {
  _id: Types.ObjectId
  name: string
  address: string
  /**
   * Khu vực địa lý cấp tỉnh/thành (VD: 'HCMC', 'Long An') — khớp với
   * `users.assigned_regions` của Technician để giới hạn Technician chỉ lắp đặt
   * / xử lý ticket cho Farm thuộc khu vực mình phụ trách (AUTH-FR-005c,
   * TICKET-FR-004, RACI mục 4.4 ghi chú ¹).
   */
  region?: string
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
    region:      { type: String, trim: true, index: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    owner_id:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
      user_id:    { type: Schema.Types.ObjectId, ref: 'User' },
      is_primary: { type: Boolean, default: false },
      joined_at:  { type: Date, default: Date.now },
    }],
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at' } }
)

// Soft-delete scope
farmSchema.pre('find', function () {
  this.where({ is_deleted: false })
})
farmSchema.pre('findOne', function () {
  this.where({ is_deleted: false })
})

export const Farm = model<IFarm>('Farm', farmSchema)
