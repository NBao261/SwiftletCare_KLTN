import { Schema, model, Document, Types } from 'mongoose'
import type { DeviceStatus, ControlMode, RelayStates } from '@/types'

/**
 * SensorNode + CameraNode Documents – SRS §8.2
 */
export interface ISensorNode extends Document {
  _id: Types.ObjectId
  device_id: string
  zone_id: Types.ObjectId
  firmware_version: string
  last_heartbeat?: Date
  status: DeviceStatus
  rssi?: number
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: Date
  registered_at: Date
}

export interface ICameraNode extends Document {
  _id: Types.ObjectId
  device_id: string
  zone_id: Types.ObjectId
  rtsp_url?: string
  status: DeviceStatus
  last_heartbeat?: Date
  model_version?: string
  registered_at: Date
}

const sensorNodeSchema = new Schema<ISensorNode>(
  {
    device_id:        { type: String, required: true, unique: true },
    zone_id:          { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    firmware_version: { type: String, default: '1.0.0' },
    last_heartbeat:   { type: Date },
    status:           { type: String, enum: ['ONLINE','OFFLINE','ERROR','DEGRADED'] as DeviceStatus[], default: 'OFFLINE' },
    rssi:             { type: Number },
    relay_states: {
      misting:     { type: Boolean, default: false },
      ventilation: { type: Boolean, default: false },
      heating:     { type: Boolean, default: false },
      light:       { type: Boolean, default: false },
    },
    control_mode:    { type: String, enum: ['AUTO','MANUAL'] as ControlMode[], default: 'AUTO' },
    override_expiry: { type: Date },
    registered_at:   { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const cameraNodeSchema = new Schema<ICameraNode>(
  {
    device_id:      { type: String, required: true, unique: true },
    zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    rtsp_url:       { type: String },
    status:         { type: String, enum: ['ONLINE','OFFLINE','ERROR','DEGRADED'] as DeviceStatus[], default: 'OFFLINE' },
    last_heartbeat: { type: Date },
    model_version:  { type: String },
    registered_at:  { type: Date, default: Date.now },
  },
  { timestamps: false }
)

export const SensorNode = model<ISensorNode>('SensorNode', sensorNodeSchema)
export const CameraNode = model<ICameraNode>('CameraNode', cameraNodeSchema)
