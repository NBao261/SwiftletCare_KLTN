import { Schema, model, Document, Types } from 'mongoose'

/** OrderItem – SRS §8.2, Module SALES (Giai đoạn 2) */
export interface IOrderItem extends Document {
  _id: Types.ObjectId
  order_id: Types.ObjectId
  product_id: Types.ObjectId
  farm_id: Types.ObjectId
  quantity: number
  unit_price_vnd: number
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    order_id:   { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    farm_id:    { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    quantity:   { type: Number, required: true, min: 1 },
    unit_price_vnd: { type: Number, required: true },
  },
  { timestamps: false, versionKey: false }
)

export const OrderItem = model<IOrderItem>('OrderItem', orderItemSchema)
