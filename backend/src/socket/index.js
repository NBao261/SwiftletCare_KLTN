'use strict';
/** Socket.io Initialization – SRS §9.3 */
const { Server }  = require('socket.io');
const logger      = require('../utils/logger');
const jwt         = require('jsonwebtoken');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  // JWT auth for Socket.io connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Client subscribes to a zone (§9.3 JOIN_ZONE)
    socket.on('JOIN_ZONE', ({ zoneId }) => {
      socket.join(`zone:${zoneId}`);
      logger.debug(`Socket ${socket.id} joined zone:${zoneId}`);
    });

    socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
  });

  logger.info('Socket.io initialized');
}

// Emit to all clients watching a zone (PERF-NFR-001: <= 2s latency)
function emitToZone(zoneId, event, data) {
  io?.to(`zone:${zoneId}`).emit(event, data);
}

module.exports = { initSocket, emitToZone };
