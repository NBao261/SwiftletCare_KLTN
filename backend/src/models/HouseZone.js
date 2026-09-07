'use strict';
/** House + Zone Models – SRS §8.2, FARM-FR-002 */
const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  farm_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  name:        { type: String, required: true, trim: true },
  floors:      { type: Number, default: 1 },
  description: { type: String },
}, { timestamps: { createdAt: 'created_at' } });

const zoneSchema = new mongoose.Schema({
  house_id: { type: mongoose.Schema.Types.ObjectId, ref: 'House', required: true },
  name:     { type: String, required: true },
  floor:    { type: Number, default: 1 },
  thresholds: {
    temp_min:     { type: Number, default: 26.0 },   // ENV-FR-007
    temp_max:     { type: Number, default: 31.0 },
    humidity_min: { type: Number, default: 75.0 },
    humidity_max: { type: Number, default: 95.0 },
    light_max:    { type: Number, default: 0.2 },
    co2_max:      { type: Number, default: 1500 },
  },
  threshold_history: [{
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changed_at: { type: Date },
    old_values: Object,
    new_values: Object,
  }],
}, { timestamps: { createdAt: 'created_at' } });

module.exports = {
  House: mongoose.model('House', houseSchema),
  Zone:  mongoose.model('Zone',  zoneSchema),
};
