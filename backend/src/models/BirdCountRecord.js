'use strict';
/** BirdCountRecord Model – SRS §8.2, VISION-FR-008, VISION-FR-009 */
const mongoose = require('mongoose');

const birdCountSchema = new mongoose.Schema({
  camera_node_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CameraNode', required: true },
  zone_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  timestamp:      { type: Date, required: true },
  session_type:   { type: String, enum: ['MORNING_EXIT','EVENING_ENTRY'], required: true },
  entry_count:    { type: Number, default: 0 },
  exit_count:     { type: Number, default: 0 },
  return_rate:    { type: Number },   // percentage (VISION-FR-009)
  confidence_avg: { type: Number },
}, { timestamps: false });

birdCountSchema.index({ zone_id: 1, timestamp: -1 });

module.exports = mongoose.model('BirdCountRecord', birdCountSchema);
