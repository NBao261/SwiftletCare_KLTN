/**
 * AUTH-FR-011 — kết nối Socket.io của tài khoản bị khoá/xoá phải bị từ chối dù JWT còn hạn.
 */
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '@/models/user.model'
import { disconnectUser, verifySocketToken } from '@/socket'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

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
