import { Schema, model, Document, Types } from 'mongoose'

/** ANALYTICS-FR-013: không bao giờ điều khiển thiết bị; thiếu giá trị thì để trống, không ghi 0 */
export interface IWeatherObservation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  /** UTC */
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
// BR-36
export const WEATHER_TTL_SECONDS = 90 * 24 * 60 * 60
weatherObservationSchema.index({ hour: 1 }, { expireAfterSeconds: WEATHER_TTL_SECONDS })

export const WeatherObservation = model<IWeatherObservation>('WeatherObservation', weatherObservationSchema)
