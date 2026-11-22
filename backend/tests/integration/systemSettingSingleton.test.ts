// 2 upsert đồng thời vào collection trống không được tạo 2 document
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { SystemSetting } from '@/models/systemSetting.model'
import { getDefaultThresholds, updateDefaultThresholds } from '@/services/system.service'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await SystemSetting.init() // chờ unique index được tạo xong
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await SystemSetting.deleteMany({})
})

describe('system_settings singleton', () => {
  const adminId = new mongoose.Types.ObjectId().toString()

  it('chỉ tạo 1 document dù nhiều request lưu đồng thời', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => updateDefaultThresholds(adminId, { temp_min: 20 + (i % 5), source: 'TL-101' })),
    )

    expect(await SystemSetting.countDocuments()).toBe(1)
  })

  it('trả về cùng một giá trị qua nhiều lần đọc sau khi lưu đồng thời', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => updateDefaultThresholds(adminId, { co2_max: 1000 + i, source: 'TL-101' })),
    )

    const reads = await Promise.all(Array.from({ length: 5 }, () => getDefaultThresholds()))
    expect(new Set(reads.map(r => r.co2_max)).size).toBe(1)
  })

  it('chặn insert document thứ 2 ở tầng DB', async () => {
    await updateDefaultThresholds(adminId, { temp_min: 27, source: 'TL-101' })

    await expect(SystemSetting.create({ default_thresholds: await getDefaultThresholds() }))
      .rejects.toMatchObject({ code: 11000 })
  })

  it('dùng giá trị gốc khi chưa từng cấu hình', async () => {
    expect(await getDefaultThresholds()).toMatchObject({ temp_min: 26, co2_max: 1500 })
  })
})
