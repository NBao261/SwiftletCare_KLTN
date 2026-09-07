/**
 * Unit tests – User Model
 * Tests: password hashing, comparePassword, toJSON masking
 *
 * Uses mongodb-memory-server to run Mongoose without a real DB connection.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User, IUser } from '@/models/User'

let mongod: MongoMemoryServer

// ── Lifecycle ──────────────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  // Clean up between tests to avoid duplicate key errors
  await User.deleteMany({})
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('User Model', () => {
  describe('comparePassword()', () => {
    it('returns true for the correct password', async () => {
      const user = new User({
        email:         'test@swiftletcare.vn',
        password_hash: 'password123',
        full_name:     'Test User',
      })
      // pre-save hook hashes password_hash → bcrypt
      await user.save()

      const result = await (user as unknown as IUser).comparePassword('password123')
      expect(result).toBe(true)
    })

    it('returns false for a wrong password', async () => {
      const user = new User({
        email:         'test2@swiftletcare.vn',
        password_hash: 'password123',
        full_name:     'Test User',
      })
      await user.save()

      const result = await (user as unknown as IUser).comparePassword('wrongpassword')
      expect(result).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('strips password_hash, otp_code, otp_expires, refresh_tokens from output', () => {
      const user = new User({
        email:         'test3@swiftletcare.vn',
        password_hash: 'password123',
        full_name:     'Test User',
      })

      const json = user.toJSON() as Record<string, unknown>

      expect(json.password_hash).toBeUndefined()
      expect(json.otp_code).toBeUndefined()
      expect(json.otp_expires).toBeUndefined()
      expect(json.refresh_tokens).toBeUndefined()
    })

    it('keeps non-sensitive fields in output', () => {
      const user = new User({
        email:         'test4@swiftletcare.vn',
        password_hash: 'password123',
        full_name:     'Full Name',
        role:          'FARM_OWNER',
      })

      const json = user.toJSON() as Record<string, unknown>

      expect(json.email).toBe('test4@swiftletcare.vn')
      expect(json.full_name).toBe('Full Name')
      expect(json.role).toBe('FARM_OWNER')
    })
  })
})
