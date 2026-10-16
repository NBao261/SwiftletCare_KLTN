/**
 * Ghi nhận mẻ thu hoạch (harvest.service): ảnh chụp môi trường và đàn chim lấy đúng Zone.
 */
import mongoose from 'mongoose'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Telemetry } from '@/models/telemetry.model'
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

describe('ảnh chụp của mẻ thu hoạch (MARKET-FR-002/003)', () => {
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
    await BirdCountRecord.create([
      { camera_node_id: new mongoose.Types.ObjectId(), zone_id: zone._id, timestamp: new Date(now - 2 * DAY), session_date: '2026-01-01', session_type: 'EVENING_ENTRY', entry_count: 120, return_rate: 90 },
      { camera_node_id: new mongoose.Types.ObjectId(), zone_id: zone._id, timestamp: new Date(now - DAY), session_date: '2026-01-02', session_type: 'EVENING_ENTRY', entry_count: 100, return_rate: 80 },
    ])

    const batch = await createHarvest(user, {
      zone_id: String(zone._id), harvest_date: new Date(now).toISOString(), nest_count: 10, weight_grams: 100, nest_type: 'RAW',
    })

    expect(batch.toObject().env_snapshot).toMatchObject({ avg_temperature: 29, avg_humidity: 82, avg_nh3_ppm: 6, insufficient_data: false })
    expect(batch.toObject().flock_snapshot).toMatchObject({ avg_return_rate_30d: 85, estimated_population: 120 })
  })
})
