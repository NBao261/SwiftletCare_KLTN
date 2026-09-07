/**
 * SwiftletCare Backend – Express Application Entry Point
 * SRS: §7.4 — Node.js 20 LTS, Express 4.x
 */
'use strict';

require('dotenv').config();
const app         = require('./config/app');
const { connectDB } = require('./config/db');
const { createServer } = require('http');
const { initSocket } = require('./socket');
const { connectMQTT } = require('./mqtt/client');
const logger      = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Create HTTP server (needed for Socket.io)
  const httpServer = createServer(app);

  // 3. Initialize Socket.io
  initSocket(httpServer);

  // 4. Connect MQTT broker + start subscriptions
  connectMQTT();

  // 5. Start HTTP server
  httpServer.listen(PORT, () => {
    logger.info(`SwiftletCare API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    httpServer.close();
    process.exit(0);
  });
}

bootstrap().catch(err => {
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});
