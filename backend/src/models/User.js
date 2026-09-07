'use strict';
/**
 * User Model – SRS §8.2
 * AUTH-FR-001, AUTH-FR-004, SEC-NFR-003
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, trim: true },
  password_hash: { type: String, required: true },
  full_name:     { type: String, required: true, trim: true },
  role:          { type: String, enum: ['ADMIN','FARM_OWNER','OPERATOR'], default: 'FARM_OWNER' },
  avatar_url:    { type: String },
  is_active:     { type: Boolean, default: true },
  notification_preferences: {
    push:  { type: Boolean, default: true },
    zalo:  { type: Boolean, default: true },
    sms:   { type: Boolean, default: false },
    quiet_hours: {
      start: { type: String, default: '22:00' },
      end:   { type: String, default: '06:00' },
    },
  },
  otp_code:      { type: String },
  otp_expires:   { type: Date },
  refresh_tokens: [{ token: String, expires: Date }],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Hash password before save (SEC-NFR-003: bcrypt cost=12)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  this.password_hash = await bcrypt.hash(this.password_hash, 12);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password_hash);
};

// Never return password in JSON responses
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password_hash;
  delete obj.otp_code;
  delete obj.otp_expires;
  delete obj.refresh_tokens;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
