import { Schema, model, Document, Types } from 'mongoose'

/**
 * ANALYTICS-FR-013 — thời tiết ngoài trời theo giờ của 1 farm (Open-Meteo, chỉ gửi toạ độ). Dùng để
 * hiển thị và cho luật mưa BR-30; không bao giờ điều khiển thiết bị (C-6). Giá trị dịch vụ không trả
 * thì để trống, không ghi 0.
 */
export interface IWeatherObservation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  /** Đầu giờ (UTC) */
  hour: Date
  temperature?: number
  humidity?: number
  precipitation_mm?: number
}

const weatherObservationSchema = new Schema<IWeatherObservation>(
  {
    farm_id:          { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    hour:             { type: Date, required: true },
    temperature:      { type: Number },
    humidity:         { type: Number },
    precipitation_mm: { type: Number },
  },
  { versionKey: false }
)

weatherObservationSchema.index({ farm_id: 1, hour: 1 }, { unique: true })
// BR-36 — thời tiết theo giờ giữ 90 ngày
export const WEATHER_TTL_SECONDS = 90 * 24 * 60 * 60
weatherObservationSchema.index({ hour: 1 }, { expireAfterSeconds: WEATHER_TTL_SECONDS })

export const WeatherObservation = model<IWeatherObservation>('WeatherObservation', weatherObservationSchema)
