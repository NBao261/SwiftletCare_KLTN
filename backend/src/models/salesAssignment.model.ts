import { Schema, model, Document, Types } from 'mongoose'

/** SalesAssignment – ánh xạ nhiều-nhiều Farm ↔ Sales Staff – SRS §8.2 */
export interface ISalesAssignment extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  sales_staff_id: Types.ObjectId
  invited_by: Types.ObjectId
  assigned_at: Date
}

const salesAssignmentSchema = new Schema<ISalesAssignment>(
  {
    farm_id:        { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    sales_staff_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invited_by:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'assigned_at', updatedAt: false }, versionKey: false }
)

salesAssignmentSchema.index({ farm_id: 1, sales_staff_id: 1 }, { unique: true })

export const SalesAssignment = model<ISalesAssignment>('SalesAssignment', salesAssignmentSchema)
