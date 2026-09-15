import { Schema, model, Document, Types } from 'mongoose'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types'

/** Order – SRS §8.2, Module SALES (Giai đoạn 2, hỗ trợ guest checkout AUTH-FR-008) */
export interface IOrder extends Document {
  _id: Types.ObjectId
  order_code: string
  buyer_id?: Types.ObjectId
  buyer_name: string
  buyer_phone: string
  buyer_email?: string
  shipping_address: string
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  total_amount_vnd: number
  handled_by?: Types.ObjectId
  created_at: Date
  updated_at: Date
}

const orderSchema = new Schema<IOrder>(
  {
    order_code: { type: String, required: true, unique: true },
    buyer_id:   { type: Schema.Types.ObjectId, ref: 'User' },
    buyer_name: { type: String, required: true },
    buyer_phone:{ type: String, required: true },
    buyer_email:{ type: String },
    shipping_address: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING_CONFIRMATION','CONFIRMED','PACKED','SHIPPING','DELIVERED','DELIVERY_FAILED','CANCELLED'] as OrderStatus[],
      default: 'PENDING_CONFIRMATION',
    },
    payment_method: { type: String, enum: ['COD','VNPAY','MOMO','ZALOPAY'] as PaymentMethod[], default: 'COD' },
    payment_status: { type: String, enum: ['UNPAID','PAID','REFUNDED'] as PaymentStatus[], default: 'UNPAID' },
    total_amount_vnd: { type: Number, required: true },
    handled_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export const Order = model<IOrder>('Order', orderSchema)
