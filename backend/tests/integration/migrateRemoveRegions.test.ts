/**
 * migrate-remove-regions: `users.assigned_regions`, `farms.region` và index `region_1` bị gỡ,
 * farm chưa có tọa độ được liệt kê; chạy lại không lỗi.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateRemoveRegions } from '@/scripts/migrate-remove-regions.script'

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

describe('migrateRemoveRegions', () => {
  it('unsets regions, drops the region index, lists farms without coordinates, and is safe to re-run', async () => {
    await db().collection('farms').createIndex({ region: 1 })
    const { insertedIds } = await db().collection('farms').insertMany([
      { name: 'A', region: 'HCMC', coordinates: { lat: 10, lng: 106 }, is_deleted: false },
      { name: 'B', region: 'HA_NOI', is_deleted: false },
      { name: 'C', region: 'HCMC', is_deleted: true },
    ])
    await db().collection('users').insertMany([
      { email: 't@test.vn', role: 'TECHNICIAN', assigned_regions: ['HCMC'] },
      { email: 'o@test.vn', role: 'FARM_OWNER' },
    ])

    const first = await migrateRemoveRegions()
    expect(first).toEqual({ usersUpdated: 1, farmsUpdated: 3, droppedIndex: true, withoutCoordinates: [`B (${String(insertedIds[1])})`] })
    expect(await db().collection('farms').countDocuments({ region: { $exists: true } })).toBe(0)
    expect(await db().collection('users').countDocuments({ assigned_regions: { $exists: true } })).toBe(0)
    expect((await db().collection('farms').indexes()).map(i => i.name)).not.toContain('region_1')

    expect(await migrateRemoveRegions()).toMatchObject({ usersUpdated: 0, farmsUpdated: 0, droppedIndex: false })
  })
})
