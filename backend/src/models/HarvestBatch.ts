import { Schema, model, Document, Types } from 'mongoose'
import type { HarvestStatus, NestType } from '@/types'

/** HarvestBatch – SRS §8.2, MARKET-FR-001..003 */
export interface IHarvestBatch extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id: Types.ObjectId
  created_by: Types.ObjectId
  trace_code: string
  harvest_date: Date
  nest_count: number
  weight_grams: number
  nest_type: NestType
  product_images: string[]
  env_snapshot: {
    avg_temperature?: number
    avg_humidity?: number
    avg_light_lux?: number
    avg_nh3_ppm?: number
    avg_co2_ppm?: number
    telemetry_range?: { from: Date; to: Date }
  }
  flock_snapshot: {
    avg_return_rate_30d?: number
    estimated_population?: number
  }
  status: HarvestStatus
  created_at: Date
  updated_at: Date
  is_deleted: boolean
}

const harvestBatchSchema = new Schema<IHarvestBatch>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:     { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    created_by:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trace_code:  { type: String, required: true, unique: true },
    harvest_date:{ type: Date, required: true },
    nest_count:  { type: Number, required: true },
    weight_grams:{ type: Number, required: true },
    nest_type:   { type: String, enum: ['RAW','CLEANED','PREMIUM'] as NestType[], required: true },
    product_images: [{ type: String }],
    env_snapshot: {
      avg_temperature: { type: Number },
      avg_humidity:    { type: Number },
      avg_light_lux:   { type: Number },
      avg_nh3_ppm:     { type: Number },
      avg_co2_ppm:     { type: Number },
      telemetry_range: { from: Date, to: Date },
    },
    flock_snapshot: {
      avg_return_rate_30d: { type: Number },
      estimated_population: { type: Number },
    },
    status: { type: String, enum: ['DRAFT','LISTED','ARCHIVED'] as HarvestStatus[], default: 'DRAFT' },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

harvestBatchSchema.pre('find', function () { this.where({ is_deleted: false }) })

export const HarvestBatch = model<IHarvestBatch>('HarvestBatch', harvestBatchSchema)
