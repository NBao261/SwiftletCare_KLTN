/**
 * migrate-farm-technician (G-20): tài khoản role TECHNICIAN cũ thành FARM_TECHNICIAN, mất refresh token,
 * không được thêm vào farm nào; audit cũ giữ nguyên; chạy lại không lỗi.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateFarmTechnician } from '@/scripts/migrate-farm-technician.script'

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

describe('migrateFarmTechnician', () => {
  it('converts legacy technicians without farm membership, keeps audit history, and is safe to re-run', async () => {
    const { insertedIds } = await db().collection('users').insertMany([
      { email: 't@test.vn', role: 'TECHNICIAN', refresh_tokens: [{ token_hash: 'x', expires: new Date() }] },
      { email: 'o@test.vn', role: 'FARM_OWNER', refresh_tokens: [{ token_hash: 'y', expires: new Date() }] },
    ])
    await db().collection('farms').insertOne({ name: 'F', owner_id: insertedIds[1], members: [] })
    await db().collection('audit_logs').insertOne({ actor_id: insertedIds[0], actor_role: 'TECHNICIAN', action: 'DEVICE_COMMAND_SENT' })

    expect(await migrateFarmTechnician()).toEqual({ usersUpdated: 1 })
    const tech = (await db().collection('users').findOne({ _id: insertedIds[0] }))!
    expect(tech.role).toBe('FARM_TECHNICIAN')
    expect(tech.refresh_tokens).toEqual([])
    expect((await db().collection('users').findOne({ _id: insertedIds[1] }))!.refresh_tokens).toHaveLength(1)
    expect((await db().collection('farms').findOne({}))!.members).toEqual([])
    expect(await db().collection('audit_logs').countDocuments({ actor_role: 'TECHNICIAN' })).toBe(1)

    expect(await migrateFarmTechnician()).toEqual({ usersUpdated: 0 })
  })
})
