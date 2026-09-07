import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'
import type { TelemetryUpdateEvent, RelayUpdateEvent, BirdCountUpdateEvent, AlertNewEvent } from '@/types'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken
    socket = io(import.meta.env.VITE_API_URL || '/', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export function joinZone(zoneId: string) {
  getSocket().emit('JOIN_ZONE', { zoneId })
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
