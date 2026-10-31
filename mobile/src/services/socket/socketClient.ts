import { io, Socket } from 'socket.io-client'
import { WEBSOCKET_BASE_URL } from '@/constants/apiEndpoints'
import { useAuthStore } from '@/stores/authStore'
import type {
  SocketAlertNew,
  SocketBirdCountUpdate,
  SocketRelayUpdate,
  SocketTelemetryUpdate,
} from '@/types'

let socket: Socket | null = null
// Phòng đang theo dõi — backend quên phòng khi mất kết nối nên nối lại xong phải vào lại
const joinedZoneIds = new Set<string>()
const joinedHouseIds = new Set<string>()

// Hàm làm mới access token, apiClient đăng ký lúc khởi động (socketClient không import apiClient để tránh vòng import)
let refreshAccessToken: (() => Promise<string>) | null = null
// Mỗi lần nối chỉ làm mới token một lần — tài khoản bị khoá thì backend vẫn từ chối, không làm mới mãi
let hasRefreshedForThisConnection = false

export function setSocketTokenRefresher(refresher: () => Promise<string>): void {
  refreshAccessToken = refresher
}

// Backend từ chối kết nối (thường do access token hết hạn khi mở lại app sau > 15 phút): socket.io không tự nối lại
// trong trường hợp này (socket.active = false), nên làm mới token rồi nối lại một lần. Lỗi mạng thì socket.io tự lo.
async function handleConnectError(): Promise<void> {
  if (!socket || socket.active || !refreshAccessToken || hasRefreshedForThisConnection) return
  hasRefreshedForThisConnection = true
  try {
    await refreshAccessToken()
    socket?.connect()
  } catch {
    // Làm mới thất bại: apiClient đã xử lý (backend từ chối refresh token thì về màn đăng nhập)
  }
}

// Kết nối Socket.io — mỗi lần nối (lại) đều lấy token mới nhất, tự nối lại 1–5s khi mất mạng
export function connectSocket(): Socket {
  // Đã có socket (đang nối hoặc đang tự nối lại) thì dùng tiếp — kiểm tra .connected sẽ tạo thêm kết nối thứ hai
  if (socket) {
    // Socket đã dừng hẳn (bị từ chối và lần làm mới token cũng lỗi): nối lại, cho làm mới token thêm một lần
    if (!socket.active) {
      hasRefreshedForThisConnection = false
      socket.connect()
    }
    return socket
  }

  socket = io(WEBSOCKET_BASE_URL, {
    transports: ['websocket'],
    // Token trong bộ nhớ (authStore) — luôn là token mới nhất sau mỗi lần làm mới
    auth: (sendAuth: (data: { token: string }) => void) => {
      sendAuth({ token: useAuthStore.getState().accessToken ?? '' })
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  socket.on('connect', () => {
    hasRefreshedForThisConnection = false
    joinedZoneIds.forEach(zoneId => socket?.emit('JOIN_ZONE', { zoneId }))
    joinedHouseIds.forEach(houseId => socket?.emit('JOIN_HOUSE', { houseId }))
  })
  socket.on('connect_error', handleConnectError)

  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
  hasRefreshedForThisConnection = false
  joinedZoneIds.clear()
  joinedHouseIds.clear()
}

export function getSocket(): Socket | null {
  return socket
}

// Vào/ra phòng của Zone để nhận số đo realtime
export function joinZone(zoneId: string): void {
  joinedZoneIds.add(zoneId)
  socket?.emit('JOIN_ZONE', { zoneId })
}

export function leaveZone(zoneId: string): void {
  joinedZoneIds.delete(zoneId)
  socket?.emit('LEAVE_ZONE', { zoneId })
}

// Vào/ra phòng của nhà yến để nhận số đếm chim realtime (BIRD_COUNT_UPDATE, VISION-FR-012)
export function joinHouse(houseId: string): void {
  joinedHouseIds.add(houseId)
  socket?.emit('JOIN_HOUSE', { houseId })
}

export function leaveHouse(houseId: string): void {
  joinedHouseIds.delete(houseId)
  socket?.emit('LEAVE_HOUSE', { houseId })
}

// Đăng ký sự kiện — màn hình đăng ký trong effect thì gọi off* cùng handler trong cleanup
export function onTelemetryUpdate(handler: (update: SocketTelemetryUpdate) => void): void {
  socket?.on('TELEMETRY_UPDATE', handler)
}

export function offTelemetryUpdate(handler: (update: SocketTelemetryUpdate) => void): void {
  socket?.off('TELEMETRY_UPDATE', handler)
}

export function onAlertNew(handler: (alert: SocketAlertNew) => void): void {
  socket?.on('ALERT_NEW', handler)
}

export function offAlertNew(handler: (alert: SocketAlertNew) => void): void {
  socket?.off('ALERT_NEW', handler)
}

export function onBirdCountUpdate(handler: (update: SocketBirdCountUpdate) => void): void {
  socket?.on('BIRD_COUNT_UPDATE', handler)
}

export function offBirdCountUpdate(handler: (update: SocketBirdCountUpdate) => void): void {
  socket?.off('BIRD_COUNT_UPDATE', handler)
}

export function onRelayUpdate(handler: (update: SocketRelayUpdate) => void): void {
  socket?.on('RELAY_UPDATE', handler)
}

export function offRelayUpdate(handler: (update: SocketRelayUpdate) => void): void {
  socket?.off('RELAY_UPDATE', handler)
}
