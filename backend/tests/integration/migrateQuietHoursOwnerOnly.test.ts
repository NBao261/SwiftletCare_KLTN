/**
 * migrate-quiet-hours-owner-only (G-32): giờ im lặng của người không phải Farm Owner bị gỡ, kênh giữ nguyên; giờ im lặng
 * của Farm Owner giữ nguyên; chạy lại không đổi gì.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateQuietHoursOwnerOnly } from '@/scripts/migrate-quiet-hours-owner-only.script'

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

const users = () => mongoose.connection.db!.collection('users')

describe('migrateQuietHoursOwnerOnly', () => {
  it('gỡ giờ im lặng của thợ và chuyên gia, giữ của Farm Owner, chạy lại an toàn', async () => {
    const quiet = { start: '22:00', end: '06:00' }
    await users().insertMany([
      { email: 'o@x.vn', role: 'FARM_OWNER', notification_preferences: { push: true, quiet_hours: quiet } },
      { email: 't@x.vn', role: 'FARM_TECHNICIAN', notification_preferences: { push: false, quiet_hours: quiet } },
      { email: 'e@x.vn', role: 'DOMAIN_EXPERT', notification_preferences: { quiet_hours: quiet } },
    ])
    expect(await migrateQuietHoursOwnerOnly()).toBe(2)
    expect((await users().findOne({ email: 'o@x.vn' }))!.notification_preferences).toEqual({ push: true, quiet_hours: quiet })
    expect((await users().findOne({ email: 't@x.vn' }))!.notification_preferences).toEqual({ push: false })
    expect(await migrateQuietHoursOwnerOnly()).toBe(0)
  })
})
