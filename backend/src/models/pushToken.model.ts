import { Schema, model, Document, Types } from 'mongoose'

export type PushPlatform = 'android' | 'ios'

// token là dữ liệu cá nhân, select: false, không ghi log
export interface IPushToken extends Document {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  token: string
  platform: PushPlatform
  last_seen_at: Date
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    user_id:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token:        { type: String, required: true, unique: true, select: false },
    platform:     { type: String, enum: ['android', 'ios'] satisfies PushPlatform[], required: true },
    last_seen_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

export const PushToken = model<IPushToken>('PushToken', pushTokenSchema)
