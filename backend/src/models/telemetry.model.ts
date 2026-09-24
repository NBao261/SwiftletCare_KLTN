import { Schema, model, Document, Types } from 'mongoose'

/** Telemetry time-series document – SRS §8.2, ENV-FR-004, TTL: 90 ngày */
export interface ITelemetry extends Document {
  _id: Types.ObjectId
  node_id: Types.ObjectId
  zone_id: Types.ObjectId
  timestamp: Date
  temperature?: number
  humidity?: number
  light_lux?: number
  nh3_ppm?: number
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
    nh3_ppm:     { type: Number },
    co2_ppm:     { type: Number },
    sound_db:    { type: Number },
    is_anomaly:  { type: Boolean, default: false },
  },
  { timestamps: false, versionKey: false }
)

// Mọi truy vấn (latest/history/analytics/market) lọc theo zone_id + khoảng thời gian (ANALYTICS-FR-001)
telemetrySchema.index({ zone_id: 1, timestamp: -1 })
// TTL: tự xoá sau 90 ngày (§8.2) — analytics xem tối đa 30 ngày, market lấy 30 ngày
// trước ngày thu hoạch. Đổi số này phải chạy lại `npm run migrate:retention`
// (Mongoose không tự sửa TTL của index đã tồn tại).
export const TELEMETRY_TTL_SECONDS = 90 * 24 * 60 * 60
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: TELEMETRY_TTL_SECONDS })

export const Telemetry = model<ITelemetry>('Telemetry', telemetrySchema)
