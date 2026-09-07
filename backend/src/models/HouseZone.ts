import { Schema, model, Document, Types } from 'mongoose'
import type { Thresholds } from '@/types'

/**
 * House + Zone Documents – SRS §8.2, FARM-FR-002
 */
export interface IHouse extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  name: string
  floors: number
  description?: string
}

export interface IThresholdHistoryEntry {
  changed_by: Types.ObjectId
  changed_at: Date
  old_values: Partial<Thresholds>
  new_values: Partial<Thresholds>
}

export interface IZone extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  name: string
  floor: number
  thresholds: Thresholds
  threshold_history: IThresholdHistoryEntry[]
}

const houseSchema = new Schema<IHouse>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    name:        { type: String, required: true, trim: true },
    floors:      { type: Number, default: 1 },
    description: { type: String },
  },
  { timestamps: { createdAt: 'created_at' } }
)

const zoneSchema = new Schema<IZone>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    name:     { type: String, required: true },
    floor:    { type: Number, default: 1 },
    thresholds: {
      temp_min:     { type: Number, default: 26.0 },
      temp_max:     { type: Number, default: 31.0 },
      humidity_min: { type: Number, default: 75.0 },
      humidity_max: { type: Number, default: 95.0 },
      light_max:    { type: Number, default: 0.2 },
      co2_max:      { type: Number, default: 1500 },
    },
    threshold_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
    }],
  },
  { timestamps: { createdAt: 'created_at' } }
)

export const House = model<IHouse>('House', houseSchema)
export const Zone  = model<IZone>('Zone', zoneSchema)
