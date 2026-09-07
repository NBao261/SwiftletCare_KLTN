'use strict';
/** Farm Model – SRS §8.2, FARM-FR-001 */
const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  address:    { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number,
  },
  owner_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role:      { type: String, enum: ['OPERATOR'], default: 'OPERATOR' },
    joined_at: { type: Date, default: Date.now },
  }],
  is_deleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at' } });

// Soft-delete scope
farmSchema.pre(/^find/, function() {
  this.where({ is_deleted: false });
});

module.exports = mongoose.model('Farm', farmSchema);
