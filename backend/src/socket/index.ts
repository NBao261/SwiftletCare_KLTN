import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { User, canSignIn } from '@/models/user.model'
import type { NotificationDto } from '@/services/notification.service'
import { assertHouseAccess, assertZoneAccess } from '@/utils/farmAccess.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, JwtAccessPayload, WsTelemetryUpdate, WsRelayUpdate, WsBirdCountUpdate, WsAlertNew, WsDeviceStatusChange } from '@/types'

let io: Server | null = null

const userRoom = (userId: string) => `user:${userId}`

// Đọc lại status: token còn hạn nhưng tài khoản đã khoá thì từ chối
export async function verifySocketToken(token: string | undefined): Promise<CurrentUser> {
  if (!token) throw new Error('Unauthorized: missing token')

  let payload: JwtAccessPayload
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
  } catch {
    throw new Error('Unauthorized: invalid token')
  }

  const user = await User.findById(payload.sub).select('status email role').lean()
  if (!user || !canSignIn(user)) throw new Error('Unauthorized: account inactive')
  return { _id: String(user._id), email: user.email, role: user.role }
}

export function disconnectUser(userId: string): void {
  io?.in(userRoom(userId)).disconnectSockets(true)
}

export type ServerEvents = {
  TELEMETRY_UPDATE:     (data: WsTelemetryUpdate) => void
  RELAY_UPDATE:         (data: WsRelayUpdate) => void
  BIRD_COUNT_UPDATE:    (data: WsBirdCountUpdate) => void
  ALERT_NEW:            (data: WsAlertNew) => void
  DEVICE_STATUS_CHANGE: (data: WsDeviceStatusChange) => void
  NOTIFICATION_NEW:     (data: NotificationDto) => void
  RECOMMENDATION_NEW:   (data: WsRecommendationNew) => void
}

export interface WsRecommendationNew { _id: string; house_id: string; rule_name: string; raised_for: string }

export type ClientEvents = {
  JOIN_ZONE:  (data: { zoneId: string }) => void
  LEAVE_ZONE: (data: { zoneId: string }) => void
  JOIN_HOUSE:  (data: { houseId: string }) => void
  LEAVE_HOUSE: (data: { houseId: string }) => void
}

export function initSocket(httpServer: HttpServer): void {
  io = new Server<ClientEvents, ServerEvents>(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? '*' },
    transports: ['websocket', 'polling'],
  })

  io.use((socket: Socket, next: (err?: Error) => void) => {
    verifySocketToken(socket.handshake.auth?.token as string | undefined)
      .then(user => {
        socket.data.userId = user._id
        socket.data.role   = user.role
        socket.data.user   = user
        next()
      })
      // Không lộ lỗi hạ tầng ra client
      .catch((err: Error) => next(err.message.startsWith('Unauthorized') ? err : new Error('Unauthorized: verification failed')))
  })

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id} [user=${socket.data.userId as string}]`)
    void socket.join(userRoom(socket.data.userId as string))

    // Kiểm quyền như REST, không thì join được zone farm khác (IDOR)
    socket.on('JOIN_ZONE', ({ zoneId }: { zoneId: string }) => {
      const currentUser = socket.data.user as CurrentUser
      void assertZoneAccess(zoneId, currentUser)
        .then(() => {
          void socket.join(`zone:${zoneId}`)
          logger.debug(`Socket ${socket.id} joined zone:${zoneId}`)
        })
        .catch(() => {
          logger.warn(`Socket ${socket.id} [user=${currentUser._id}] denied JOIN_ZONE for zone:${zoneId}`)
        })
    })

    socket.on('LEAVE_ZONE', ({ zoneId }: { zoneId: string }) => {
      void socket.leave(`zone:${zoneId}`)
    })

    // Kiểm quyền như JOIN_ZONE
    socket.on('JOIN_HOUSE', ({ houseId }: { houseId: string }) => {
      const currentUser = socket.data.user as CurrentUser
      void assertHouseAccess(String(houseId), currentUser)
        .then(() => {
          void socket.join(`house:${houseId}`)
          logger.debug(`Socket ${socket.id} joined house:${houseId}`)
        })
        .catch(() => {
          logger.warn(`Socket ${socket.id} [user=${currentUser._id}] denied JOIN_HOUSE for house:${houseId}`)
        })
    })

    socket.on('LEAVE_HOUSE', ({ houseId }: { houseId: string }) => {
      void socket.leave(`house:${houseId}`)
    })

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`)
    })
  })

  logger.info('Socket.io initialized')
}

export function emitTelemetryUpdate(zoneId: string, data: WsTelemetryUpdate): void {
  io?.to(`zone:${zoneId}`).emit('TELEMETRY_UPDATE', data)
}

export function emitRelayUpdate(zoneId: string, data: WsRelayUpdate): void {
  io?.to(`zone:${zoneId}`).emit('RELAY_UPDATE', data)
}

export function emitBirdCountUpdate(houseId: string, data: WsBirdCountUpdate): void {
  io?.to(`house:${houseId}`).emit('BIRD_COUNT_UPDATE', data)
}

export function emitAlertNew(zoneId: string, data: WsAlertNew): void {
  io?.to(`zone:${zoneId}`).emit('ALERT_NEW', data)
}

export function emitDeviceStatusChange(zoneId: string, data: WsDeviceStatusChange): void {
  io?.to(`zone:${zoneId}`).emit('DEVICE_STATUS_CHANGE', data)
}

export function emitHouseDeviceStatusChange(houseId: string, data: WsDeviceStatusChange): void {
  io?.to(`house:${houseId}`).emit('DEVICE_STATUS_CHANGE', data)
}

export function emitHouseAlertNew(houseId: string, data: WsAlertNew): void {
  io?.to(`house:${houseId}`).emit('ALERT_NEW', data)
}

export function emitRecommendationNew(houseId: string, data: WsRecommendationNew): void {
  io?.to(`house:${houseId}`).emit('RECOMMENDATION_NEW', data)
}

export function emitNotificationNew(userId: string, data: NotificationDto): void {
  io?.to(userRoom(userId)).emit('NOTIFICATION_NEW', data)
}

