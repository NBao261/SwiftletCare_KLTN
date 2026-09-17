import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'
import type { TelemetryUpdateEvent, RelayUpdateEvent, BirdCountUpdateEvent, AlertNewEvent, DeviceStatusChangeEvent } from '@/types'

// Dev: '' = same-origin (localhost:5173) — vite.config.ts proxy '/socket.io' ->
// http://localhost:3000 (ws:true) chuyển tiếp handshake. Production: set VITE_WS_URL
// trỏ thẳng origin backend thật.
const SOCKET_URL = import.meta.env.VITE_WS_URL || ''

let socket: Socket | null = null

/** Lazy-tạo 1 socket duy nhất cho cả app — connect/disconnect do useSocket() hook quản lý */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Dạng hàm — socket.io-client gọi lại trước MỖI lần connect/reconnect nên
      // luôn lấy access token mới nhất, kể cả sau khi client.ts đã refresh token.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export function joinZone(zoneId: string) {
  getSocket().emit('JOIN_ZONE', { zoneId })
}

export function leaveZone(zoneId: string) {
  getSocket().emit('LEAVE_ZONE', { zoneId })
}

export function onTelemetryUpdate(cb: (data: TelemetryUpdateEvent) => void) {
  getSocket().on('TELEMETRY_UPDATE', cb)
  return () => getSocket().off('TELEMETRY_UPDATE', cb)
}

export function onRelayUpdate(cb: (data: RelayUpdateEvent) => void) {
  getSocket().on('RELAY_UPDATE', cb)
  return () => getSocket().off('RELAY_UPDATE', cb)
}

export function onBirdCountUpdate(cb: (data: BirdCountUpdateEvent) => void) {
  getSocket().on('BIRD_COUNT_UPDATE', cb)
  return () => getSocket().off('BIRD_COUNT_UPDATE', cb)
}

export function onAlertNew(cb: (data: AlertNewEvent) => void) {
  getSocket().on('ALERT_NEW', cb)
  return () => getSocket().off('ALERT_NEW', cb)
}

export function onDeviceStatusChange(cb: (data: DeviceStatusChangeEvent) => void) {
  getSocket().on('DEVICE_STATUS_CHANGE', cb)
  return () => getSocket().off('DEVICE_STATUS_CHANGE', cb)
}
