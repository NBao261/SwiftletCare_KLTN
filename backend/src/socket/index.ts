import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import logger from '@/utils/logger'
import type { JwtAccessPayload, WsTelemetryUpdate, WsRelayUpdate, WsBirdCountUpdate, WsAlertNew } from '@/types'

let io: Server | null = null

/** Socket event types emitted by the server (§9.3) */
export type ServerEvents = {
  TELEMETRY_UPDATE:  (data: WsTelemetryUpdate) => void
  RELAY_UPDATE:      (data: WsRelayUpdate) => void
  BIRD_COUNT_UPDATE: (data: WsBirdCountUpdate) => void
  ALERT_NEW:         (data: WsAlertNew) => void
}

/** Socket event types received from clients */
export type ClientEvents = {
  JOIN_ZONE:  (data: { zoneId: string }) => void
  LEAVE_ZONE: (data: { zoneId: string }) => void
}

export function initSocket(httpServer: HttpServer): void {
  io = new Server<ClientEvents, ServerEvents>(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? '*' },
    transports: ['websocket', 'polling'],
  })

  // JWT authentication for Socket.io connections
  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error('Unauthorized: missing token'))
      return
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
      socket.data.userId = payload.sub
      socket.data.role   = payload.role
      next()
    } catch {
      next(new Error('Unauthorized: invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id} [user=${socket.data.userId as string}]`)

    socket.on('JOIN_ZONE', ({ zoneId }: { zoneId: string }) => {
      void socket.join(`zone:${zoneId}`)
      logger.debug(`Socket ${socket.id} joined zone:${zoneId}`)
    })

    socket.on('LEAVE_ZONE', ({ zoneId }: { zoneId: string }) => {
      void socket.leave(`zone:${zoneId}`)
    })

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`)
    })
  })

  logger.info('Socket.io initialized')
}

/** Emit TELEMETRY_UPDATE to all clients in a zone (PERF-NFR-001: <=2s latency) */
export function emitTelemetryUpdate(zoneId: string, data: WsTelemetryUpdate): void {
  io?.to(`zone:${zoneId}`).emit('TELEMETRY_UPDATE', data)
}

/** Emit RELAY_UPDATE to all clients in a zone */
export function emitRelayUpdate(zoneId: string, data: WsRelayUpdate): void {
  io?.to(`zone:${zoneId}`).emit('RELAY_UPDATE', data)
}

/** Emit BIRD_COUNT_UPDATE to all clients in a zone */
export function emitBirdCountUpdate(zoneId: string, data: WsBirdCountUpdate): void {
  io?.to(`zone:${zoneId}`).emit('BIRD_COUNT_UPDATE', data)
}

/** Emit ALERT_NEW to all clients in a zone */
export function emitAlertNew(zoneId: string, data: WsAlertNew): void {
  io?.to(`zone:${zoneId}`).emit('ALERT_NEW', data)
}
