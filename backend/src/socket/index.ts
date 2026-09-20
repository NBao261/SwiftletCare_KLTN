import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { User } from '@/models/user.model'
import logger from '@/utils/logger.util'
import type { JwtAccessPayload, WsTelemetryUpdate, WsRelayUpdate, WsBirdCountUpdate, WsAlertNew, WsDeviceStatusChange } from '@/types'

let io: Server | null = null

const userRoom = (userId: string) => `user:${userId}`

/**
 * Xác thực kết nối realtime. Ngoài chữ ký JWT còn phải đọc lại `is_active`:
 * token còn hạn nhưng tài khoản đã bị Admin khoá/xoá thì vẫn phải bị từ chối,
 * giống middleware `authenticate` của REST (AUTH-FR-011).
 */
export async function verifySocketToken(token: string | undefined): Promise<JwtAccessPayload> {
  if (!token) throw new Error('Unauthorized: missing token')

  let payload: JwtAccessPayload
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
  } catch {
    throw new Error('Unauthorized: invalid token')
  }

  const user = await User.findById(payload.sub).select('is_active').lean()
  if (!user?.is_active) throw new Error('Unauthorized: account inactive')
  return payload
}

/** AUTH-FR-011 — ngắt mọi kết nối realtime của 1 user (gọi khi Admin khoá/xoá tài khoản) */
export function disconnectUser(userId: string): void {
  io?.in(userRoom(userId)).disconnectSockets(true)
}

/** Socket event types emitted by the server (§9.3) */
export type ServerEvents = {
  TELEMETRY_UPDATE:     (data: WsTelemetryUpdate) => void
  RELAY_UPDATE:         (data: WsRelayUpdate) => void
  BIRD_COUNT_UPDATE:    (data: WsBirdCountUpdate) => void
  ALERT_NEW:            (data: WsAlertNew) => void
  DEVICE_STATUS_CHANGE: (data: WsDeviceStatusChange) => void
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
    verifySocketToken(socket.handshake.auth?.token as string | undefined)
      .then(payload => {
        socket.data.userId = payload.sub
        socket.data.role   = payload.role
        next()
      })
      // Lỗi hạ tầng (VD mất kết nối DB) không được lộ message thô ra client
      .catch((err: Error) => next(err.message.startsWith('Unauthorized') ? err : new Error('Unauthorized: verification failed')))
  })

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id} [user=${socket.data.userId as string}]`)
    void socket.join(userRoom(socket.data.userId as string))

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

/** Emit DEVICE_STATUS_CHANGE to all clients in a zone (FARM-FR-005) */
export function emitDeviceStatusChange(zoneId: string, data: WsDeviceStatusChange): void {
  io?.to(`zone:${zoneId}`).emit('DEVICE_STATUS_CHANGE', data)
}
