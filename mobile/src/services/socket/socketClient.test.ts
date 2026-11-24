import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import {
  connectSocket,
  disconnectSocket,
  onSocketReconnect,
  subscribeSocketEvent,
} from '@/services/socket/socketClient'

type Listener = (payload?: unknown) => void

// Socket giả: ghi lại listener theo sự kiện và cho test phát sự kiện như server
interface FakeSocket {
  listeners: Map<string, Set<Listener>>
  on: (event: string, listener: Listener) => void
  off: (event: string, listener: Listener) => void
  emit: (event: string, payload?: unknown) => void
  disconnect: () => void
  connect: () => void
  fire: (event: string, payload?: unknown) => void
  active: boolean
  connected: boolean
}

function mockCreateFakeSocket(): FakeSocket {
  const listeners = new Map<string, Set<Listener>>()
  return {
    listeners,
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(event, set)
    },
    off: (event, listener) => {
      listeners.get(event)?.delete(listener)
    },
    emit: () => undefined,
    disconnect: () => undefined,
    connect: () => undefined,
    fire: (event, payload) => listeners.get(event)?.forEach(listener => listener(payload)),
    active: true,
    connected: false,
  }
}

const mockCreatedSockets: FakeSocket[] = []

jest.mock('socket.io-client', () => ({
  io: () => {
    const fakeSocket = mockCreateFakeSocket()
    mockCreatedSockets.push(fakeSocket)
    return fakeSocket
  },
}))
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ accessToken: 'token' }) } }))

describe('subscribeSocketEvent', () => {
  // Mỗi test bắt đầu khi chưa có socket
  beforeEach(() => {
    disconnectSocket()
    mockCreatedSockets.length = 0
  })

  it('đăng ký trước khi có socket vẫn nhận sự kiện khi socket được tạo; huỷ thì thôi nhận', () => {
    const handler = jest.fn()
    const unsubscribe = subscribeSocketEvent('NOTIFICATION_NEW', handler)
    connectSocket()
    mockCreatedSockets[0].fire('NOTIFICATION_NEW', { _id: 'n1' })
    expect(handler).toHaveBeenCalledWith({ _id: 'n1' })
    unsubscribe()
    mockCreatedSockets[0].fire('NOTIFICATION_NEW', { _id: 'n2' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('đăng xuất rồi đăng nhập lại (socket mới) vẫn nhận sự kiện', () => {
    const handler = jest.fn()
    const unsubscribe = subscribeSocketEvent('ALERT_NEW', handler)
    connectSocket()
    disconnectSocket()
    connectSocket()
    expect(mockCreatedSockets).toHaveLength(2)
    mockCreatedSockets[1].fire('ALERT_NEW', { alertId: 'a1' })
    expect(handler).toHaveBeenCalledWith({ alertId: 'a1' })
    unsubscribe()
  })

  it('báo nối lại từ lần nối thứ hai, không báo ở lần nối đầu', () => {
    const handleReconnect = jest.fn()
    const unsubscribe = onSocketReconnect(handleReconnect)
    connectSocket()
    mockCreatedSockets[0].fire('connect')
    expect(handleReconnect).not.toHaveBeenCalled()
    mockCreatedSockets[0].fire('connect')
    expect(handleReconnect).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
