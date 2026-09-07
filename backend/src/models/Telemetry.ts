import { Schema, model, Document, Types } from 'mongoose'

/** Telemetry time-series document – SRS §8.2, ENV-FR-004, TTL: 1 year */
export interface ITelemetry extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  zone_id: Types.ObjectId
  timestamp: Date
  temperature?: number
  humidity?: number
  light_lux?: number
  co2_ppm?: number
  sound_db?: number
  is_anomaly: boolean
}

const telemetrySchema = new Schema<ITelemetry>(
  {
    node_id:     { type: Schema.Types.ObjectId, ref: 'SensorNode', required: true },
    zone_id:     { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    timestamp:   { type: Date, required: true },
    temperature: { type: Number },
    humidity:    { type: Number },
    light_lux:   { type: Number },
    co2_ppm:     { type: Number },
    sound_db:    { type: Number },
    is_anomaly:  { type: Boolean, default: false },
  },
  { timestamps: false, versionKey: false }
)

// Compound indexes for time-range queries (ANALYTICS-FR-001)
telemetrySchema.index({ node_id: 1, timestamp: -1 })
telemetrySchema.index({ zone_id: 1, timestamp: -1 })
// TTL: auto-delete after 1 year (§8.2)
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 31_536_000 })

export const Telemetry = model<ITelemetry>('Telemetry', telemetrySchema)
