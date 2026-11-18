/**
 * migrate-erd-fields (G-14, Report 4 §6.4): `users.is_active` → `status` (SM-14), audit `ip_address` → `source_ip`,
 * `metadata.before/after` chép ra `before`/`after`; chạy lại không đổi gì.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateErdFields } from '@/scripts/migrate-erd-fields.script'

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

const db = () => mongoose.connection.db!

describe('migrateErdFields', () => {
  it('maps every old account state to its status, renames audit fields, and is safe to re-run', async () => {
    const lockedAt = new Date('2026-10-01T00:00:00Z')
    const { insertedIds } = await db().collection('users').insertMany([
      { email: 'a@test.vn', is_active: true },
      { email: 'l@test.vn', is_active: false, deactivated_reason: 'Spam', deactivated_at: lockedAt },
      { email: 'r@test.vn', is_active: true, deletion_requested_at: new Date() },
      { email: 'd@test.vn', is_active: false, deleted_at: new Date() },
      { email: 'new@test.vn', status: 'LOCKED', locked_reason: 'giữ nguyên' },
      // Mã cũ cho Admin khoá tài khoản đang chờ xoá: khoá phải thắng, không thành DELETION_REQUESTED (đăng nhập được)
      { email: 'lr@test.vn', is_active: false, deactivated_reason: 'Gian lận', deletion_requested_at: new Date() },
    ])
    await db().collection('auditlogs').insertMany([
      { action: 'THRESHOLDS_UPDATED', ip_address: '1.2.3.4', metadata: { before: { a: 1 }, after: { a: 2 } } },
      { action: 'LOGIN_FAILED', metadata: { reason: 'x' } },
    ])

    expect(await migrateErdFields()).toEqual({
      usersDeleted: 1, usersDeletionRequested: 1, usersLocked: 2, usersActive: 1, auditIpRenamed: 1, auditBeforeAfter: 1,
    })
    const users = await db().collection('users').find().sort({ _id: 1 }).toArray()
    expect(users.map(u => u.status)).toEqual(['ACTIVE', 'LOCKED', 'DELETION_REQUESTED', 'DELETED', 'LOCKED', 'LOCKED'])
    expect(users[5].locked_reason).toBe('Gian lận')
    expect(users[1]).toMatchObject({ locked_reason: 'Spam', locked_at: lockedAt })
    expect(users[4].locked_reason).toBe('giữ nguyên')
    for (const user of users) {
      expect(user).not.toHaveProperty('is_active')
      expect(user).not.toHaveProperty('deactivated_reason')
    }
    expect(String(users[0]._id)).toBe(String(insertedIds[0]))

    const [changed, other] = await db().collection('auditlogs').find().sort({ _id: 1 }).toArray()
    expect(changed).toMatchObject({ source_ip: '1.2.3.4', before: { a: 1 }, after: { a: 2 } })
    expect(changed).not.toHaveProperty('ip_address')
    expect(other).not.toHaveProperty('before')

    expect(await migrateErdFields()).toEqual({
      usersDeleted: 0, usersDeletionRequested: 0, usersLocked: 0, usersActive: 0, auditIpRenamed: 0, auditBeforeAfter: 0,
    })
  })
})
