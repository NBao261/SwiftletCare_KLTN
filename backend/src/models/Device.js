'use strict';
/** SensorNode + CameraNode Models – SRS §8.2 */
const mongoose = require('mongoose');

const sensorNodeSchema = new mongoose.Schema({
  device_id:        { type: String, required: true, unique: true },  // MAC-based
  zone_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  firmware_version: { type: String, default: '1.0.0' },
  last_heartbeat:   { type: Date },
  status:           { type: String, enum: ['ONLINE','OFFLINE','ERROR'], default: 'OFFLINE' },
  rssi:             { type: Number },
  relay_states: {
    misting:     { type: Boolean, default: false },
    ventilation: { type: Boolean, default: false },
    heating:     { type: Boolean, default: false },
    light:       { type: Boolean, default: false },
  },
  control_mode:     { type: String, enum: ['AUTO','MANUAL'], default: 'AUTO' },
  override_expiry:  { type: Date },
  registered_at:    { type: Date, default: Date.now },
}, { timestamps: false });

const cameraNodeSchema = new mongoose.Schema({
  device_id:      { type: String, required: true, unique: true },
  zone_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  rtsp_url:       { type: String },
  status:         { type: String, enum: ['ONLINE','OFFLINE','DEGRADED'], default: 'OFFLINE' },
  last_heartbeat: { type: Date },
  model_version:  { type: String },
  registered_at:  { type: Date, default: Date.now },
}, { timestamps: false });

module.exports = {
  SensorNode: mongoose.model('SensorNode', sensorNodeSchema),
  CameraNode: mongoose.model('CameraNode', cameraNodeSchema),
};
