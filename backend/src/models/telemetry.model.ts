import { Schema, model, Document, Types } from 'mongoose'

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
  // Để đo hiệu quả điều khiển
  misting_pct?: number
  ventilation_pct?: number
  misting_on?: boolean
  ventilation_on?: boolean
  // A, chỉ controller đo dòng mới có
  pump_current_a?: number
  fan_current_a?: number
  is_anomaly: boolean
  stale_fields?: string[]
  anomaly_fields?: string[]
  buffered?: boolean
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
    misting_pct:     { type: Number },
    ventilation_pct: { type: Number },
    misting_on:      { type: Boolean },
    ventilation_on:  { type: Boolean },
    pump_current_a:  { type: Number, min: 0 },
    fan_current_a:   { type: Number, min: 0 },
    is_anomaly:  { type: Boolean, default: false },
    // Cảm biến gửi null: lưu là thiếu
    stale_fields:   { type: [String], default: undefined },
    anomaly_fields: { type: [String], default: undefined },
    buffered:    { type: Boolean },
  },
  { timestamps: false, versionKey: false }
)

telemetrySchema.index({ zone_id: 1, timestamp: -1 })
// QoS 1 giao lại không ghi 2 lần. DB có bản trùng thì chạy migrate:telemetry-unique trước
telemetrySchema.index({ node_id: 1, timestamp: 1 }, { unique: true })
// Đổi số này phải chạy lại migrate:retention (Mongoose không sửa TTL cũ)
export const TELEMETRY_TTL_SECONDS = 90 * 24 * 60 * 60
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: TELEMETRY_TTL_SECONDS })

export const Telemetry = model<ITelemetry>('Telemetry', telemetrySchema)
