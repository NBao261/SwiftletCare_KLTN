import { Schema, model, Document, Types } from 'mongoose'

/** Inventory – SRS §8.2, Module SALES (Giai đoạn 2) */
export interface IInventory extends Document {
  _id: Types.ObjectId
  product_id: Types.ObjectId
  quantity_available: number
  quantity_reserved: number
  low_stock_threshold: number
  updated_at: Date
}

const inventorySchema = new Schema<IInventory>(
  {
    product_id:          { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    quantity_available:  { type: Number, default: 0 },
    quantity_reserved:   { type: Number, default: 0 },
    low_stock_threshold: { type: Number, default: 10 },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false }
)

export const Inventory = model<IInventory>('Inventory', inventorySchema)
