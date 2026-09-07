'use strict';
const mongoose = require('mongoose');
const logger   = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  mongoose.connection.on('connected',    () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error',        (err) => logger.error('MongoDB error:', err));

  await mongoose.connect(uri, { maxPoolSize: 10 });
}

module.exports = { connectDB };
