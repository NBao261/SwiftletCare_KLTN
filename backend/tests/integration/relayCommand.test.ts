/**
 * Lệnh relay và can thiệp tay: lịch sử override không bao giờ chặn lệnh, thời hạn hợp lệ,
 * dời thiết bị sang Zone khác thì override cũ kết thúc.
 */
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { SensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { expireManualOverrides, reassignZone } from '@/services/device.service'
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

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use(errorHandler)

useTestDb()

describe('lịch sử can thiệp tay không được chặn lệnh điều khiển (ENV-FR-019)', () => {
  it('ghi lịch sử lỗi: relay vẫn nhận lệnh và API vẫn trả 200', async () => {
    const { relay, token } = await seed()
    jest.spyOn(RelayOverrideLog, 'create').mockRejectedValue(new Error('db down') as never)

    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    expect(publishCommand).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'relay/command',
      expect.objectContaining({ relayName: 'misting', state: true }))
  })

  it('đóng lịch sử lỗi: thiết bị vẫn nhận clear_override', async () => {
    const { relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    jest.clearAllMocks()
    jest.spyOn(RelayOverrideLog, 'updateMany').mockRejectedValue(new Error('db down') as never)

    await request(app).delete(`${relay}/relay-override`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(publishCommand).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'relay/command',
      expect.objectContaining({ action: 'clear_override' }))
  })

  it('override hết hạn: lịch sử đóng tại đúng hạn, không phải lúc job chạy', async () => {
    const { node, relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    const expiry = new Date(Date.now() - 45_000) // job chạy trễ 45 giây sau hạn
    await SensorNode.updateOne({ _id: node._id }, { override_expiry: expiry })
    // Override bật trước hạn của nó (như thật) — ended_at không bao giờ sớm hơn started_at
    await RelayOverrideLog.updateOne({}, { started_at: new Date(expiry.getTime() - 60_000) })

    expect(await expireManualOverrides()).toBe(1)
    const log = (await RelayOverrideLog.findOne().lean())!
    expect(log.end_reason).toBe('EXPIRED')
    expect(log.ended_at!.getTime()).toBe(expiry.getTime())
  })
})

describe('thời hạn của lệnh can thiệp tay (ENV-FR-018)', () => {
  it('durationMs của lệnh relay phải là số nguyên trong khoảng cho phép', async () => {
    const { node, relay, token } = await seed()
    const post = (durationMs: unknown) =>
      request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true, durationMs })

    await post(10 * 365 * 24 * 3600_000).expect(422) // 10 năm
    await post(-5000).expect(422)
    await post(5000).expect(422) // ngắn hơn cửa sổ bỏ qua bản tin AUTO cũ
    await post('abc').expect(422)
    expect(await RelayOverrideLog.countDocuments()).toBe(0)
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('AUTO')
    await post(600_000).expect(200)
  })
})

describe('dời thiết bị sang Zone khác', () => {
  it('dời thiết bị sang Zone khác: override đang chạy kết thúc ở Zone cũ', async () => {
    const { farm, node, relay, token } = await seed()
    const house2 = await House.create({ farm_id: farm._id, name: 'H2' })
    const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    jest.clearAllMocks()

    await reassignZone(String(node._id), { _id: String(new mongoose.Types.ObjectId()), email: 'tech@test.vn', role: 'TECHNICIAN' }, { newZoneId: String(zone2._id) })

    const after = (await SensorNode.findById(node._id))!
    expect(String(after.zone_id)).toBe(String(zone2._id))
    expect(after.control_mode).toBe('AUTO')
    expect(after.override_expiry).toBeUndefined()
    expect((await RelayOverrideLog.findOne().lean())!).toMatchObject({ end_reason: 'CLEARED_EARLY' })
    expect(publishCommand).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'config/reassign',
      expect.objectContaining({ newZoneId: String(zone2._id) }))
  })
})
