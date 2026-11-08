/**
 * migrate-relay-overrides (G-06 phần 2, BR-20): controller đang MANUAL từ trước khi có `relays` được
 * đặt hạn cho từng relay, ưu tiên lịch sử can thiệp còn mở rồi tới `override_expiry` cũ; không có gì thì
 * về AUTO; node đã có relay MANUAL giữ nguyên; chạy lại không đổi gì; job hết hạn tìm thấy node đã chuyển.
 */
import mongoose, { Types } from 'mongoose'
import { migrateRelayOverrides } from '@/scripts/migrate-relay-overrides.script'
import { expireManualOverrides } from '@/services/device.service'
import { publishDeviceCommand } from '@/mqtt/mqtt.client'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))

useTestDb()

const db = () => mongoose.connection.db!
const nodes = () => db().collection('sensornodes')
const log = (nodeId: Types.ObjectId, relay: string, expires: Date, by: Types.ObjectId, ended: Date | null = null) => ({
  node_id: nodeId, relay, state: true, started_by: by, started_by_role: 'FARM_OWNER',
  started_at: new Date(expires.getTime() - 600_000), expires_at: expires, ended_at: ended,
})

describe('migrateRelayOverrides', () => {
  it('gives every old manual controller a per-relay expiry and is safe to re-run', async () => {
    const owner = new Types.ObjectId()
    const later = new Date(Date.now() + 20 * 60_000)
    const sooner = new Date(Date.now() + 5 * 60_000)
    const past = new Date(Date.now() - 60_000)
    const [withLogs, withExpiry, empty, current, auto] = [1, 2, 3, 4, 5].map(() => new Types.ObjectId())

    await nodes().insertMany([
      { _id: withLogs, device_id: 'logs', status: 'ONLINE', control_mode: 'MANUAL', override_expiry: later },
      { _id: withExpiry, device_id: 'expiry', status: 'ONLINE', control_mode: 'MANUAL', override_expiry: past, override_by: owner },
      { _id: empty, device_id: 'empty', status: 'ONLINE', control_mode: 'MANUAL',
        relays: { misting: { mode: 'AUTO' }, speaker: { mode: 'AUTO' }, ventilation: { mode: 'AUTO' } } },
      { _id: current, device_id: 'current', status: 'ONLINE', control_mode: 'MANUAL', override_expiry: later,
        relays: { misting: { mode: 'AUTO' }, speaker: { mode: 'AUTO' }, ventilation: { mode: 'MANUAL', override_expiry: later } } },
      { _id: auto, device_id: 'auto', status: 'ONLINE', control_mode: 'AUTO' },
    ])
    await db().collection('relayoverridelogs').insertMany([
      log(withLogs, 'misting', sooner, owner),
      log(withLogs, 'ventilation', later, owner),
      log(withLogs, 'speaker', past, owner, past),   // đã đóng: không tính
    ])

    await expect(migrateRelayOverrides()).resolves.toEqual({ fromLogs: 1, fromExpiry: 1, toAuto: 1 })

    const byLogs = (await nodes().findOne({ _id: withLogs }))!
    expect(byLogs.relays.misting).toEqual({ mode: 'MANUAL', override_expiry: sooner, override_by: owner })
    expect(byLogs.relays.ventilation).toEqual({ mode: 'MANUAL', override_expiry: later, override_by: owner })
    expect(byLogs.relays.speaker).toBeUndefined()
    expect(byLogs.override_expiry).toEqual(later)

    const byExpiry = (await nodes().findOne({ _id: withExpiry }))!
    for (const relay of ['misting', 'speaker', 'ventilation']) {
      expect(byExpiry.relays[relay]).toEqual({ mode: 'MANUAL', override_expiry: past, override_by: owner })
    }

    const toAuto = (await nodes().findOne({ _id: empty }))!
    expect(toAuto.control_mode).toBe('AUTO')
    expect(toAuto.override_expiry).toBeUndefined()

    const untouched = (await nodes().findOne({ _id: current }))!
    expect(untouched.relays.ventilation).toEqual({ mode: 'MANUAL', override_expiry: later })
    expect(untouched.relays.misting).toEqual({ mode: 'AUTO' })
    expect((await nodes().findOne({ _id: auto }))!.relays).toBeUndefined()

    await expect(migrateRelayOverrides()).resolves.toEqual({ fromLogs: 0, fromExpiry: 0, toAuto: 0 })
  })

  it('lets the expiry job find an old manual controller once it is migrated', async () => {
    const { node } = await seedOwnerFarm()
    await nodes().updateOne({ _id: node._id }, {
      $set: { control_mode: 'MANUAL', override_expiry: new Date(Date.now() - 60_000) }, $unset: { relays: '' },
    })
    await expect(expireManualOverrides()).resolves.toBe(0)   // trước khi chuyển: job không thấy node

    await migrateRelayOverrides()
    await expect(expireManualOverrides()).resolves.toBe(3)

    const sent = jest.mocked(publishDeviceCommand).mock.calls
    expect(sent.map(call => call[1])).toEqual(['CLEAR_OVERRIDE', 'CLEAR_OVERRIDE', 'CLEAR_OVERRIDE'])
    expect(sent.map(call => (call[2] as { relayName: string }).relayName).sort()).toEqual(['misting', 'speaker', 'ventilation'])
    expect((await nodes().findOne({ _id: node._id }))!.control_mode).toBe('AUTO')
  })
})
