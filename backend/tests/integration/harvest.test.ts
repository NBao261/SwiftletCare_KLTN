/**
 * Ghi nhận mẻ thu hoạch (harvest.service): ảnh chụp môi trường và đàn chim lấy đúng Zone.
 */
import mongoose from 'mongoose'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Telemetry } from '@/models/telemetry.model'
import { vnDate } from '@/services/birdCount.service'
import { createHarvest } from '@/services/harvest.service'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

useTestDb()

const DAY = 86400_000

describe('ảnh chụp của mẻ thu hoạch (HARVEST-FR-002/003)', () => {
  it('lấy được trung bình môi trường 7 ngày và tỷ lệ chim về 30 ngày của đúng Zone', async () => {
    const { user, zone, node } = await seed()
    const other = await seed()
    const now = Date.now()
    const sample = (zoneId: unknown, nodeId: unknown, agoMs: number, temperature: number, humidity: number) =>
      ({ zone_id: zoneId, node_id: nodeId, timestamp: new Date(now - agoMs), temperature, humidity, nh3_ppm: 6, co2_ppm: 800, light_lux: 0.1 })
    await Telemetry.insertMany([
      sample(zone._id, node._id, 6.5 * DAY, 28, 80), sample(zone._id, node._id, 3 * DAY, 30, 84), sample(zone._id, node._id, 60_000, 29, 82),
      sample(other.zone._id, other.node._id, DAY, 40, 10), // Zone khác — không được lẫn vào
    ])
    const camera = new mongoose.Types.ObjectId()
    const session = (daysAgo: number, session_type: string, entry_count: number, exit_count: number) => ({
      camera_node_id: camera, house_id: zone.house_id, timestamp: new Date(now - daysAgo * DAY),
      session_date: vnDate(new Date(now - daysAgo * DAY)), session_type, entry_count, exit_count,
    })
    await BirdCountRecord.create([
      // 2 ngày trước: ròng ra 100, ròng về 95 − 5 = 90 → 90%
      session(2, 'MORNING_EXIT', 0, 100), session(2, 'EVENING_ENTRY', 95, 5),
      // hôm qua: ròng ra 125 − 25 = 100, ròng về 85 − 5 = 80 → 80%
      session(1, 'MORNING_EXIT', 25, 125), session(1, 'EVENING_ENTRY', 85, 5),
    ])

    const batch = await createHarvest(user, {
      zone_id: String(zone._id), harvest_date: new Date(now).toISOString(), nest_count: 10, weight_grams: 100, nest_type: 'RAW',
    })

    expect(batch.toObject().env_snapshot).toMatchObject({ avg_temperature: 29, avg_humidity: 82, avg_nh3_ppm: 6, insufficient_data: false })
    // Ước tính đàn = số ròng về buổi chiều lớn nhất (90), không phải số thô lớn nhất (95)
    expect(batch.toObject().flock_snapshot).toMatchObject({ avg_return_rate_30d: 85, estimated_population: 90 })
  })
})
