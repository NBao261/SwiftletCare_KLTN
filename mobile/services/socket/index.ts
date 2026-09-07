/**
 * Socket.io client for realtime updates – SRS §9.3
 * PERF-NFR-001: <=2s telemetry latency
 */
import { io, Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import { WS_BASE_URL } from '@/constants/api'
import type { WsTelemetryUpdate, WsAlertNew, WsBirdCountUpdate, WsRelayUpdate } from '@/types'

let socket: Socket | null = null

export function connectSocket(): Socket {
  if (socket?.connected) return socket

  socket = io(WS_BASE_URL, {
    transports: ['websocket'],
    auth: async (cb: (data: { token: string }) => void) => {
      const token = await SecureStore.getItemAsync('accessToken')
      cb({ token: token ?? '' })
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

export function joinZone(zoneId: string): void {
  socket?.emit('JOIN_ZONE', { zoneId })
}

export function leaveZone(zoneId: string): void {
  socket?.emit('LEAVE_ZONE', { zoneId })
}

export function onTelemetryUpdate(handler: (data: WsTelemetryUpdate) => void): void {
  socket?.on('TELEMETRY_UPDATE', handler)
}

export function onAlertNew(handler: (data: WsAlertNew) => void): void {
  socket?.on('ALERT_NEW', handler)
}

export function onBirdCountUpdate(handler: (data: WsBirdCountUpdate) => void): void {
  socket?.on('BIRD_COUNT_UPDATE', handler)
}

export function onRelayUpdate(handler: (data: WsRelayUpdate) => void): void {
  socket?.on('RELAY_UPDATE', handler)
}

export function getSocket(): Socket | null {
  return socket
}
