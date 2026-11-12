import { io, Socket } from 'socket.io-client'
import { WEBSOCKET_BASE_URL } from '@/constants/apiEndpoints'
import { useAuthStore } from '@/stores/authStore'
import type {
  InAppNotification,
  SocketAlertNew,
  SocketBirdCountUpdate,
  SocketDeviceStatusChange,
  SocketRelayUpdate,
  SocketTelemetryUpdate,
} from '@/types'

let socket: Socket | null = null
// Phòng đang theo dõi — backend quên phòng khi mất kết nối nên nối lại xong phải vào lại
// Số màn đang theo dõi từng phòng: nhiều màn cùng vào một phòng (chi tiết nhà, Cảnh báo) thì chỉ rời phòng khi màn cuối rời
const joinedZoneIds = new Map<string, number>()
const joinedHouseIds = new Map<string, number>()

// Listener sống qua mọi socket: hook gắn ở layout vẫn sống khi đăng xuất rồi đăng nhập lại (socket mới), nên bảng này giữ
// listener và gắn lại vào mỗi socket được tạo; còn nghe khi socket chưa tạo (đăng ký trước lúc connectSocket)
type SocketListener = (payload: unknown) => void
const persistentListeners = new Map<string, Set<SocketListener>>()
// Chạy sau mỗi lần socket nối lại (không phải lần nối đầu) và đã vào lại các phòng: màn tải lại số để bù tin lọt lúc mất mạng
const reconnectListeners = new Set<() => void>()

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
  // Lần nối đầu của socket này: dữ liệu vừa được tải qua REST nên chưa cần báo "nối lại"
  let hasConnectedBefore = false
  socket.on('connect', () => {
    hasRefreshedForThisConnection = false
    joinedZoneIds.forEach((_count, zoneId) => socket?.emit('JOIN_ZONE', { zoneId }))
    joinedHouseIds.forEach((_count, houseId) => socket?.emit('JOIN_HOUSE', { houseId }))
    if (hasConnectedBefore) reconnectListeners.forEach(listener => listener())
    hasConnectedBefore = true
  })
  socket.on('connect_error', handleConnectError)
  persistentListeners.forEach((listeners, event) => listeners.forEach(listener => socket?.on(event, listener)))

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

// Nghe một sự kiện trên mọi socket (hiện tại và các socket tạo sau); trả hàm huỷ cho cleanup của effect.
// Payload server gửi đã đúng kiểu của sự kiện (api-spec), chỉ ép kiểu ở đây
export function subscribeSocketEvent<Payload>(event: string, handler: (payload: Payload) => void): () => void {
  const listener: SocketListener = payload => handler(payload as Payload)
  const listeners = persistentListeners.get(event) ?? new Set<SocketListener>()
  listeners.add(listener)
  persistentListeners.set(event, listeners)
  socket?.on(event, listener)
  return () => {
    listeners.delete(listener)
    socket?.off(event, listener)
  }
}

// Thông báo mới trong hộp thư của chính người dùng (NOTIFICATION_NEW, room user:<id> backend tự cho vào khi kết nối)
export function onNotificationNew(handler: (notification: InAppNotification) => void): () => void {
  return subscribeSocketEvent<InAppNotification>('NOTIFICATION_NEW', handler)
}

// Cảnh báo mới ở các phòng nhà/tầng đang theo dõi, sống qua mọi socket như onNotificationNew
export function subscribeAlertNew(handler: (alert: SocketAlertNew) => void): () => void {
  return subscribeSocketEvent<SocketAlertNew>('ALERT_NEW', handler)
}

// Socket vừa nối lại sau khi mất kết nối (đổi mạng, mất sóng, app quay lại từ nền); trả hàm huỷ
export function onSocketReconnect(handler: () => void): () => void {
  reconnectListeners.add(handler)
  return () => {
    reconnectListeners.delete(handler)
  }
}

// Vào/ra phòng của Zone để nhận số đo realtime
export function joinZone(zoneId: string): void {
  const count = joinedZoneIds.get(zoneId) ?? 0
  joinedZoneIds.set(zoneId, count + 1)
  if (count === 0) socket?.emit('JOIN_ZONE', { zoneId })
}

export function leaveZone(zoneId: string): void {
  const count = joinedZoneIds.get(zoneId) ?? 0
  if (count > 1) {
    joinedZoneIds.set(zoneId, count - 1)
    return
  }
  joinedZoneIds.delete(zoneId)
  socket?.emit('LEAVE_ZONE', { zoneId })
}

// Vào/ra phòng của nhà yến để nhận số đếm chim realtime (BIRD_COUNT_UPDATE, VISION-FR-012)
export function joinHouse(houseId: string): void {
  const count = joinedHouseIds.get(houseId) ?? 0
  joinedHouseIds.set(houseId, count + 1)
  if (count === 0) socket?.emit('JOIN_HOUSE', { houseId })
}

export function leaveHouse(houseId: string): void {
  const count = joinedHouseIds.get(houseId) ?? 0
  if (count > 1) {
    joinedHouseIds.set(houseId, count - 1)
    return
  }
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

export function onDeviceStatusChange(handler: (change: SocketDeviceStatusChange) => void): void {
  socket?.on('DEVICE_STATUS_CHANGE', handler)
}

export function offDeviceStatusChange(handler: (change: SocketDeviceStatusChange) => void): void {
  socket?.off('DEVICE_STATUS_CHANGE', handler)
}

// Socket đang nối được không — chưa tạo socket thì coi như chưa nối
export function isSocketConnected(): boolean {
  return socket?.connected ?? false
}

// Nghe nối/mất kết nối để báo trên màn; trả hàm huỷ đăng ký cho cleanup của effect
export function onConnectionChange(handler: (isConnected: boolean) => void): () => void {
  const handleConnect = () => handler(true)
  const handleDisconnect = () => handler(false)
  socket?.on('connect', handleConnect)
  socket?.on('disconnect', handleDisconnect)
  return () => {
    socket?.off('connect', handleConnect)
    socket?.off('disconnect', handleDisconnect)
  }
}
