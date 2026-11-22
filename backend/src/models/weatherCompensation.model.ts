import { Schema, model, Document, Types } from 'mongoose'

// chỉ ghi offset khác 0, giờ không có bản ghi là giờ không bù
export interface IWeatherCompensation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  // Luật có |offset| lớn nhất
  rule_id: Types.ObjectId
  offset_pct: number
  sent_at: Date
  expires_at: Date
  forecast: { temperature_max: number | null; humidity_max: number | null; rain_mm: number | null }
  controllers: number
}

const weatherCompensationSchema = new Schema<IWeatherCompensation>(
  {
    farm_id:    { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id:   { type: Schema.Types.ObjectId, ref: 'House', required: true },
    rule_id:    { type: Schema.Types.ObjectId, required: true },
    offset_pct: { type: Number, required: true },
    sent_at:    { type: Date, required: true },
    expires_at: { type: Date, required: true },
    forecast: {
      temperature_max: { type: Number, default: null },
      humidity_max:    { type: Number, default: null },
      rain_mm:         { type: Number, default: null },
    },
    controllers: { type: Number, required: true },
  },
  { versionKey: false },
)

weatherCompensationSchema.index({ house_id: 1, sent_at: -1 })

export const WeatherCompensation = model<IWeatherCompensation>('WeatherCompensation', weatherCompensationSchema)
