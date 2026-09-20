/**
 * AUTH-FR-011 — kết nối Socket.io của tài khoản bị khoá/xoá phải bị từ chối dù JWT còn hạn.
 */
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '@/models/user.model'
import { disconnectUser, initSocket, verifySocketToken } from '@/socket'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

// Thay socket.io bằng bản giả ghi lại middleware/handler mà initSocket đăng ký — kiểm tra phần nối dây
// (io.use, phòng user:<id>, disconnectUser) mà không cần mở cổng thật hay thêm socket.io-client.
const mockHandlers: { use?: (socket: unknown, next: (err?: Error) => void) => void; connection?: (socket: unknown) => void } = {}
const mockRoom = { disconnectSockets: jest.fn() }
const mockIn = jest.fn(() => mockRoom)
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: (fn: never) => { mockHandlers.use = fn },
    on: (event: string, fn: never) => { if (event === 'connection') mockHandlers.connection = fn },
    in: mockIn,
  })),
}))

let mongod: MongoMemoryServer

const sign = (sub: string, secret = process.env.JWT_ACCESS_SECRET!, opts: jwt.SignOptions = { expiresIn: '15m' }) =>
  jwt.sign({ sub, role: 'FARM_OWNER' }, secret, opts)

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await User.deleteMany({})
})

describe('verifySocketToken', () => {
  it('accepts a valid token of an active user', async () => {
    const user = await User.create({ email: 'ok@test.vn', password_hash: 'password123', full_name: 'Ok', role: 'FARM_OWNER' })
    const payload = await verifySocketToken(sign(String(user._id)))
    expect(payload.sub).toBe(String(user._id))
  })

  it('rejects a missing token', async () => {
    await expect(verifySocketToken(undefined)).rejects.toThrow('missing token')
  })

  it('rejects a token with a bad signature', async () => {
    const user = await User.create({ email: 'ok@test.vn', password_hash: 'password123', full_name: 'Ok', role: 'FARM_OWNER' })
    await expect(verifySocketToken(sign(String(user._id), 'wrong-secret'))).rejects.toThrow('invalid token')
  })

  it('rejects an expired token', async () => {
    const user = await User.create({ email: 'ok@test.vn', password_hash: 'password123', full_name: 'Ok', role: 'FARM_OWNER' })
    await expect(verifySocketToken(sign(String(user._id), undefined, { expiresIn: -10 }))).rejects.toThrow('invalid token')
  })

  it('rejects a still-valid token once the account is locked', async () => {
    const user = await User.create({ email: 'locked@test.vn', password_hash: 'password123', full_name: 'Locked', role: 'FARM_OWNER' })
    const token = sign(String(user._id))
    await verifySocketToken(token) // hợp lệ trước khi khoá

    user.is_active = false
    await user.save()

    await expect(verifySocketToken(token)).rejects.toThrow('account inactive')
  })

  it('rejects a token whose user no longer exists', async () => {
    await expect(verifySocketToken(sign(String(new mongoose.Types.ObjectId())))).rejects.toThrow('account inactive')
  })
})

describe('disconnectUser', () => {
  it('is a no-op when the socket server has not been started', () => {
    expect(() => disconnectUser('any-user-id')).not.toThrow()
  })
})

describe('initSocket wiring (socket.io mocked)', () => {
  beforeAll(() => initSocket({} as never))
  afterEach(() => { jest.clearAllMocks() })

  const socketWith = (token?: string) => ({ handshake: { auth: { token } }, data: {} as Record<string, unknown> })
  const authenticate = (socket: ReturnType<typeof socketWith>) =>
    new Promise<Error | undefined>(resolve => mockHandlers.use!(socket, err => resolve(err)))

  it('registers an auth middleware that admits an active user and stamps identity on the socket', async () => {
    const user = await User.create({ email: 'ok@test.vn', password_hash: 'password123', full_name: 'Ok', role: 'FARM_OWNER' })
    const socket = socketWith(sign(String(user._id)))

    expect(await authenticate(socket)).toBeUndefined()
    expect(socket.data).toMatchObject({ userId: String(user._id), role: 'FARM_OWNER' })
  })

  it('the auth middleware refuses a locked account even though the token is still valid', async () => {
    const user = await User.create({ email: 'locked@test.vn', password_hash: 'password123', full_name: 'L', role: 'FARM_OWNER', is_active: false })
    const err = await authenticate(socketWith(sign(String(user._id))))
    expect(err?.message).toBe('Unauthorized: account inactive')
  })

  it('the auth middleware refuses a missing or forged token', async () => {
    expect((await authenticate(socketWith(undefined)))?.message).toBe('Unauthorized: missing token')
    expect((await authenticate(socketWith(sign('x', 'wrong-secret'))))?.message).toBe('Unauthorized: invalid token')
  })

  it('hides infrastructure errors behind a generic message', async () => {
    const user = await User.create({ email: 'ok@test.vn', password_hash: 'password123', full_name: 'Ok', role: 'FARM_OWNER' })
    jest.spyOn(User, 'findById').mockImplementationOnce((() => { throw new Error('mongo exploded at secret-host:27017') }) as never)

    const err = await authenticate(socketWith(sign(String(user._id))))

    expect(err?.message).toBe('Unauthorized: verification failed')
    expect(err?.message).not.toContain('secret-host')
  })

  it('puts every connected socket into its user:<id> room', () => {
    const socket = { id: 's1', data: { userId: 'u-123' }, join: jest.fn(), leave: jest.fn(), on: jest.fn() }

    mockHandlers.connection!(socket)

    expect(socket.join).toHaveBeenCalledWith('user:u-123')
    expect(socket.on).toHaveBeenCalledWith('JOIN_ZONE', expect.any(Function))
  })

  it('disconnectUser drops every socket in the user room', () => {
    disconnectUser('u-123')

    expect(mockIn).toHaveBeenCalledWith('user:u-123')
    expect(mockRoom.disconnectSockets).toHaveBeenCalledWith(true)
  })
})
