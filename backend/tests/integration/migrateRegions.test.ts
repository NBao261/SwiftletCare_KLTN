/**
 * migrate-regions + các chỗ ghi khu vực: dữ liệu cũ gõ tay được quy về mã danh mục,
 * tạo/sửa farm và vùng Technician chỉ nhận khu vực có trong danh mục.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Farm } from '@/models/farm.model'
import { User } from '@/models/user.model'
import { createTechnician } from '@/services/admin.service'
import { createFarm, updateFarm } from '@/services/farm.service'
import { getHealthOverview } from '@/services/system.service'
import { migrateRegions } from '@/scripts/migrate-regions.script'
import type { CurrentUser } from '@/types'

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  await Promise.all([Farm.deleteMany({}), User.deleteMany({})])
})

const db = () => mongoose.connection.db!
const owner: CurrentUser = { _id: String(new mongoose.Types.ObjectId()), email: 'o@test.vn', role: 'FARM_OWNER' }

describe('migrateRegions', () => {
  it('converts recognisable free text, keeps and reports the rest, and is safe to re-run', async () => {
    const ownerId = new mongoose.Types.ObjectId()
    await db().collection('farms').insertMany([
      { name: 'A', address: 'x', owner_id: ownerId, is_deleted: false, region: 'TP. Hồ Chí Minh' },
      { name: 'B', address: 'x', owner_id: ownerId, is_deleted: false, region: 'Long An' },
      { name: 'C', address: 'x', owner_id: ownerId, is_deleted: false, region: 'Sao Hỏa' },
      { name: 'D', address: 'x', owner_id: ownerId, is_deleted: false },
      { name: 'E', address: 'x', owner_id: ownerId, is_deleted: false, region: 'HCMC' },
    ])
    await db().collection('users').insertMany([
      { email: 't1@test.vn', role: 'TECHNICIAN', assigned_regions: ['hcmc', 'HCMC', 'Kiên Giang'] },
      { email: 't2@test.vn', role: 'TECHNICIAN', assigned_regions: ['Đâu đó'] },
    ])

    const result = await migrateRegions()

    expect(result).toMatchObject({ farmsUpdated: 2, techniciansUpdated: 1 })
    expect(result.unmatchedFarms).toEqual([expect.stringContaining('"Sao Hỏa"')])
    expect(result.missingRegionFarms).toEqual([expect.stringContaining('D')])
    expect(result.unmatchedTechnicians).toEqual([expect.stringContaining('t2@test.vn')])
    const regions = Object.fromEntries((await db().collection('farms').find().toArray()).map(f => [f.name, f.region]))
    expect(regions).toMatchObject({ A: 'HCMC', B: 'TAY_NINH', C: 'Sao Hỏa', E: 'HCMC' })
    expect((await db().collection('users').findOne({ email: 't1@test.vn' }))!.assigned_regions).toEqual(['HCMC', 'AN_GIANG'])

    expect(await migrateRegions()).toMatchObject({ farmsUpdated: 0, techniciansUpdated: 0 })
  })
})

describe('ghi khu vực theo danh mục', () => {
  it('farm creation needs a region and stores its code', async () => {
    await expect(createFarm(owner, { name: 'F', address: 'x' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(createFarm(owner, { name: 'F', address: 'x', region: 'Sao Hỏa' })).rejects.toMatchObject({ statusCode: 400 })

    const farm = await createFarm(owner, { name: 'F', address: 'x', region: 'Bà Rịa - Vũng Tàu' })
    expect(farm.region).toBe('HCMC')

    const moved = await updateFarm(String(farm._id), owner, { region: 'long an' })
    expect(moved.region).toBe('TAY_NINH')
  })

  it('technician regions must be in the catalog', async () => {
    const adminId = String(new mongoose.Types.ObjectId())
    const input = { email: 'tech@test.vn', password: 'password123', full_name: 'T' }
    await expect(createTechnician(adminId, { ...input, assigned_regions: ['Sao Hỏa'] })).rejects.toMatchObject({ statusCode: 400 })
    const tech = await createTechnician(adminId, { ...input, assigned_regions: ['Hà Nội', 'HN'] })
    expect(tech.assigned_regions).toEqual(['HA_NOI'])
  })

  it('the health overview counts farms nobody can be routed to', async () => {
    const ownerId = new mongoose.Types.ObjectId()
    await db().collection('farms').insertMany([
      { name: 'ok', address: 'x', owner_id: ownerId, is_deleted: false, region: 'HCMC' },
      { name: 'free text', address: 'x', owner_id: ownerId, is_deleted: false, region: 'Sao Hỏa' },
      { name: 'none', address: 'x', owner_id: ownerId, is_deleted: false },
      { name: 'deleted', address: 'x', owner_id: ownerId, is_deleted: true },
    ])

    expect((await getHealthOverview()).farms).toEqual({ total: 3, missingRegion: 2 })
  })
})
