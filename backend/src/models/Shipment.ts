import { Schema, model, Document, Types } from 'mongoose'

/** Shipment – SRS §8.2, Module SALES (Giai đoạn 2+) */
export interface IShipment extends Document {
  _id: Types.ObjectId
  order_id: Types.ObjectId
  carrier?: string
  tracking_code?: string
  shipped_at?: Date
  delivered_at?: Date
  delivery_note?: string
}

const shipmentSchema = new Schema<IShipment>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    carrier:  { type: String },
    tracking_code: { type: String },
    shipped_at:    { type: Date },
    delivered_at:  { type: Date },
    delivery_note: { type: String },
  },
  { timestamps: false, versionKey: false }
)

export const Shipment = model<IShipment>('Shipment', shipmentSchema)
