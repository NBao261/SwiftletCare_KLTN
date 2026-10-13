import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/authStore'
import type { TelemetryUpdateEvent, RelayUpdateEvent, AlertNewEvent, DeviceStatusChangeEvent, TicketChatMessage, TicketChatAssigneeChangedEvent } from '@/types'

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


export function onAlertNew(cb: (data: AlertNewEvent) => void) {
  getSocket().on('ALERT_NEW', cb)
  return () => getSocket().off('ALERT_NEW', cb)
}

export function onDeviceStatusChange(cb: (data: DeviceStatusChangeEvent) => void) {
  getSocket().on('DEVICE_STATUS_CHANGE', cb)
  return () => getSocket().off('DEVICE_STATUS_CHANGE', cb)
}

// ── Chat ticket (Flow 23, TICKET-FR-014..017) ───────────────────────────────────────────────────────

export type TicketChatAck = { ok: true } | { ok: false; error: string }

/**
 * Vào room `ticket:<id>` để nhận TICKET_MESSAGE_NEW. BE trả lỗi qua ack (không throw) — VD Technician
 * không phụ trách, hoặc đã bị chuyển ticket (chỉ còn đọc lịch sử qua REST). Timeout 5s để UI không treo
 * khi mất kết nối — lúc đó caller rơi về polling REST.
 */
export function joinTicketChat(ticketId: string): Promise<TicketChatAck> {
  return new Promise(resolve => {
    getSocket().timeout(5000).emit('JOIN_TICKET_CHAT', { ticketId }, (err: Error | null, res?: TicketChatAck) => {
      if (err || !res) resolve({ ok: false, error: 'Hết thời gian chờ máy chủ' })
      else resolve(res)
    })
  })
}

export function leaveTicketChat(ticketId: string) {
  getSocket().emit('LEAVE_TICKET_CHAT', { ticketId })
}

export function onTicketMessage(cb: (data: TicketChatMessage) => void) {
  getSocket().on('TICKET_MESSAGE_NEW', cb)
  return () => getSocket().off('TICKET_MESSAGE_NEW', cb)
}

export function onTicketAssigneeChanged(cb: (data: TicketChatAssigneeChangedEvent) => void) {
  getSocket().on('TICKET_CHAT_ASSIGNEE_CHANGED', cb)
  return () => getSocket().off('TICKET_CHAT_ASSIGNEE_CHANGED', cb)
}
