import { io, Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import { WEBSOCKET_BASE_URL } from '@/constants/apiEndpoints'
import type {
  SocketAlertNew,
  SocketBirdCountUpdate,
  SocketRelayUpdate,
  SocketTelemetryUpdate,
} from '@/types'

let socket: Socket | null = null

// Kết nối Socket.io — mỗi lần kết nối lại đọc lại token, tự kết nối lại 1–5s
export function connectSocket(): Socket {
  if (socket?.connected) return socket

  socket = io(WEBSOCKET_BASE_URL, {
    transports: ['websocket'],
    auth: async (sendAuth: (data: { token: string }) => void) => {
      const accessToken = await SecureStore.getItemAsync('accessToken')
      sendAuth({ token: accessToken ?? '' })
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}

// Vào/ra phòng của Zone để nhận số đo realtime
export function joinZone(zoneId: string): void {
  socket?.emit('JOIN_ZONE', { zoneId })
}

export function leaveZone(zoneId: string): void {
  socket?.emit('LEAVE_ZONE', { zoneId })
}

// Đăng ký sự kiện — chưa làm: hàm off* tương ứng để huỷ trong cleanup (Known debt)
export function onTelemetryUpdate(handler: (update: SocketTelemetryUpdate) => void): void {
  socket?.on('TELEMETRY_UPDATE', handler)
}

export function onAlertNew(handler: (alert: SocketAlertNew) => void): void {
  socket?.on('ALERT_NEW', handler)
}

export function onBirdCountUpdate(handler: (update: SocketBirdCountUpdate) => void): void {
  socket?.on('BIRD_COUNT_UPDATE', handler)
}

export function onRelayUpdate(handler: (update: SocketRelayUpdate) => void): void {
  socket?.on('RELAY_UPDATE', handler)
}
