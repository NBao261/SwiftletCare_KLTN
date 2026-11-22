import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { migrateAlertIncidents } from '@/scripts/migrate-alert-incidents.script'

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

describe('migrateAlertIncidents', () => {
  it('đặt lại mức, gộp bản trùng còn mở, tạo được chỉ mục và chạy lại an toàn', async () => {
    const farm = new mongoose.Types.ObjectId()
    const zone = new mongoose.Types.ObjectId()
    const node = new mongoose.Types.ObjectId()
    const at = (minutes: number) => new Date(Date.UTC(2026, 10, 20, 0, minutes))
    // Ghi thẳng vào collection như dữ liệu cũ: chưa có khoá, mức do firmware gửi
    await db().collection('alerts').insertMany([
      { farm_id: farm, zone_id: zone, node_id: node, type: 'SPEAKER_FAILURE', severity: 'CRITICAL', status: 'ACKNOWLEDGED', occurrence_count: 2, created_at: at(0) },
      { farm_id: farm, zone_id: zone, node_id: node, type: 'SPEAKER_FAILURE', severity: 'CRITICAL', status: 'ACTIVE', occurrence_count: 1, created_at: at(5) },
      { farm_id: farm, zone_id: zone, node_id: node, type: 'SPEAKER_FAILURE', severity: 'CRITICAL', status: 'RESOLVED', occurrence_count: 1, created_at: at(1) },
      { farm_id: farm, zone_id: zone, node_id: node, type: 'SENSOR_FAULT', severity: 'MEDIUM', status: 'ACTIVE', occurrence_count: 1, created_at: at(2) },
    ])

    expect(await migrateAlertIncidents()).toEqual({ open: 3, reseverity: 2, keyed: 3, merged: 1 })

    const speaker = await Alert.find({ type: 'SPEAKER_FAILURE' }).sort({ created_at: 1 }).lean()
    // Bản cũ nhất giữ xác nhận và cộng dồn; bản đã đóng giữ nguyên
    expect(speaker.map(a => [a.status, a.severity, a.occurrence_count])).toEqual([
      ['ACKNOWLEDGED', 'HIGH', 3],
      ['RESOLVED', 'CRITICAL', 1],
      ['RESOLVED', 'HIGH', 1],
    ])
    expect((await Alert.collection.indexes()).some(index => index.name === 'incident_key_1')).toBe(true)

    expect(await migrateAlertIncidents()).toEqual({ open: 2, reseverity: 0, keyed: 0, merged: 0 })
  })
})
