/**
 * G-07 — topic theo thiết bị, xác thực broker, chống trùng (Report 4 D3, §7.2; NFR-06 c, NFR-10 d).
 * Không cần broker thật: quyền theo topic nằm ở EMQX, script mqtt-isolation kiểm phần đó.
 */
import express from 'express'
import request from 'supertest'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { Telemetry } from '@/models/telemetry.model'
import { handleHeartbeat } from '@/mqtt/handlers/heartbeat.handler'
import { handleTelemetry } from '@/mqtt/handlers/telemetry.handler'
import { routeDeviceMessage } from '@/mqtt/mqtt.client'
import internalRoutes from '@/routes/internal.route'
import { ingestDeviceAlert } from '@/services/alert.service'
import { createProvisionedDevice, revokeProvisionedDevice, rotateBrokerSecret } from '@/services/provisionedDevice.service'
import { ingestTelemetry } from '@/services/telemetry.service'
import { commandEnvelope, parseDeviceTopic } from '@/utils/deviceCommand.util'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/handlers/heartbeat.handler', () => ({ handleHeartbeat: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/mqtt/handlers/telemetry.handler', () => ({ handleTelemetry: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

useTestDb()
beforeEach(async () => {
  process.env.JWT_ACCESS_SECRET = 'test-secret'
  await Promise.all([ProvisionedDevice.deleteMany({}), SensorNode.deleteMany({}), Alert.deleteMany({}), Telemetry.deleteMany({})])
})

const app = express()
app.use(express.json())
app.use('/internal', internalRoutes)
app.use(errorHandler)

const KEY = 'broker-key'
const adminId = '507f1f77bcf86cd799439011'

describe('POST /internal/mqtt-auth (NFR-10 d)', () => {
  beforeEach(() => {
    process.env.MQTT_AUTH_KEY = KEY
    process.env.MQTT_USERNAME = 'backend-service'
    process.env.MQTT_PASSWORD = 'backend-password'
  })
  const auth = (username: string, password: string, key = KEY) =>
    request(app).post(`/internal/mqtt-auth?key=${key}`).send({ username, password })

  it('thiết bị đúng mật khẩu thì allow, không bao giờ là superuser', async () => {
    const { device_id, broker_secret } = await createProvisionedDevice(adminId, { device_id: 'node_1', kind: 'SENSOR' })
    const res = await auth(device_id, broker_secret).expect(200)
    expect(res.body).toEqual({ result: 'allow', is_superuser: false })
  })

  it('sai mật khẩu và thiết bị không có trong kho trả cùng một kết quả', async () => {
    await createProvisionedDevice(adminId, { device_id: 'node_1', kind: 'SENSOR' })
    expect((await auth('node_1', 'sai').expect(200)).body.result).toBe('deny')
    expect((await auth('node_khong_co', 'sai').expect(200)).body.result).toBe('deny')
  })

  it('activation key trên nhãn không dùng được làm mật khẩu broker', async () => {
    const { secret_key } = await createProvisionedDevice(adminId, { device_id: 'node_1', kind: 'SENSOR' })
    expect((await auth('node_1', secret_key).expect(200)).body.result).toBe('deny')
  })

  it('thiết bị đã thu hồi bị từ chối', async () => {
    const { broker_secret } = await createProvisionedDevice(adminId, { device_id: 'node_1', kind: 'SENSOR' })
    const stock = (await ProvisionedDevice.findOne({ device_id: 'node_1' }))!
    await revokeProvisionedDevice(adminId, String(stock._id), 'mất')
    expect((await auth('node_1', broker_secret).expect(200)).body.result).toBe('deny')
  })

  it('thiết bị nhập kho trước G-07 chưa có mật khẩu thì bị từ chối, cấp mới thì nối được', async () => {
    const created = await createProvisionedDevice(adminId, { device_id: 'node_1', kind: 'SENSOR' })
    await ProvisionedDevice.updateOne({ device_id: 'node_1' }, { $unset: { broker_secret_hash: 1 } })
    expect((await auth('node_1', '').expect(200)).body.result).toBe('deny')

    const stock = (await ProvisionedDevice.findOne({ device_id: 'node_1' }))!
    const { broker_secret } = await rotateBrokerSecret(adminId, String(stock._id))
    expect((await auth('node_1', broker_secret).expect(200)).body.result).toBe('allow')
    expect((await auth('node_1', created.broker_secret).expect(200)).body.result).toBe('deny')
  })

  it('service account theo biến môi trường', async () => {
    expect((await auth('backend-service', 'backend-password').expect(200)).body.result).toBe('allow')
    expect((await auth('backend-service', 'sai').expect(200)).body.result).toBe('deny')
  })

  it('device ID có ký tự đại diện của MQTT không nhập kho được và không bao giờ được vào broker', async () => {
    // Luật ACL `swiftletcare/dev/${username}/#`: username `+` sẽ chạm được cây topic của mọi thiết bị
    for (const bad of ['+', '#', 'a/b', 'node 1', '']) {
      await expect(createProvisionedDevice(adminId, { device_id: bad, kind: 'SENSOR' })).rejects.toMatchObject({ statusCode: 400 })
    }
    // Bản ghi lỡ có từ trước (nhập thẳng vào DB) vẫn bị từ chối dù đúng mật khẩu
    const { broker_secret } = await createProvisionedDevice(adminId, { device_id: 'node_tam', kind: 'SENSOR' })
    await ProvisionedDevice.updateOne({ device_id: 'node_tam' }, { device_id: '+' })
    expect((await auth('+', broker_secret).expect(200)).body.result).toBe('deny')
    expect((await auth('a/#', broker_secret).expect(200)).body.result).toBe('deny')
  })

  it('sai key là bên gọi không phải EMQX: 401', async () => {
    await auth('node_1', 'x', 'sai').expect(401)
    await request(app).post('/internal/mqtt-auth').send({ username: 'a', password: 'b' }).expect(422)
  })
})

describe('topic và tin của thiết bị (Report 4 §7.2)', () => {
  const message = (deviceId: string) => Buffer.from(JSON.stringify({ deviceId }))
  beforeEach(() => jest.clearAllMocks())

  it('chỉ nhận cây swiftletcare/dev/{deviceId} và các đường đã khai báo', () => {
    expect(parseDeviceTopic('swiftletcare/dev/node_1/telemetry/buffered')).toEqual({ deviceId: 'node_1', uplink: 'telemetry/buffered' })
    expect(parseDeviceTopic('swiftletcare/dev/cam_1/vision/bird-count')).toEqual({ deviceId: 'cam_1', uplink: 'vision/bird-count' })
    expect(parseDeviceTopic('swiftletcare/f1/h1/z1/telemetry')).toBeNull()
    expect(parseDeviceTopic('swiftletcare/dev/node_1/cmd')).toBeNull()
    expect(parseDeviceTopic('swiftletcare/dev//telemetry')).toBeNull()
  })

  it('chuyển tin đúng về handler, tin buffer dùng đường ingest thường', () => {
    routeDeviceMessage('swiftletcare/dev/node_1/heartbeat', message('node_1'), false)
    routeDeviceMessage('swiftletcare/dev/node_1/telemetry/buffered', message('node_1'), false)
    expect(handleHeartbeat).toHaveBeenCalledTimes(1)
    expect(handleTelemetry).toHaveBeenCalledTimes(1)
  })

  it('bỏ tin có deviceId khác topic: thiết bị không nói thay được thiết bị khác', () => {
    routeDeviceMessage('swiftletcare/dev/node_1/heartbeat', message('node_2'), false)
    routeDeviceMessage('swiftletcare/dev/node_1/heartbeat', Buffer.from('{}'), false)
    expect(handleHeartbeat).not.toHaveBeenCalled()
  })

  it('không ingest tin retained và không làm hỏng khi JSON sai', () => {
    routeDeviceMessage('swiftletcare/dev/node_1/heartbeat', message('node_1'), true)
    routeDeviceMessage('swiftletcare/dev/node_1/heartbeat', Buffer.from('{oops'), false)
    expect(handleHeartbeat).not.toHaveBeenCalled()
  })

  it('phong bì lệnh có mã riêng và giờ phát (BR-35)', () => {
    const before = Date.now()
    const first = commandEnvelope('RELAY', { relayName: 'misting' })
    const second = commandEnvelope('RESTART', {})
    expect(first).toMatchObject({ type: 'RELAY', payload: { relayName: 'misting' } })
    expect(first.commandId).not.toBe(second.commandId)
    expect(first.issuedAt).toBeGreaterThanOrEqual(before)
  })
})

describe('chống trùng khi QoS 1 giao lại (NFR-06 c, ENV-FR-024)', () => {
  it('cùng eventId chỉ tính 1 lần, kể cả sau khi cảnh báo đã đóng', async () => {
    const { node } = await seed()
    const alert = { deviceId: node.device_id, type: 'SENSOR_FAULT', eventId: 'e1', message: 'x' }

    expect(await ingestDeviceAlert(alert)).not.toBeNull()
    expect(await ingestDeviceAlert(alert)).toBeNull()
    await Alert.updateMany({}, { status: 'RESOLVED', resolved_at: new Date() })
    expect(await ingestDeviceAlert(alert)).toBeNull()
    expect(await Alert.countDocuments()).toBe(1)

    expect(await ingestDeviceAlert({ ...alert, eventId: 'e2' })).not.toBeNull()
    expect(await Alert.countDocuments()).toBe(2)
  })

  it('mẫu buffer giao lại không ghi 2 lần', async () => {
    const { node } = await seed()
    await Telemetry.init()
    const sample = { deviceId: node.device_id, temperature: 28, humidity: 75, timestamp: Date.now() - 3_600_000 } as never

    await ingestTelemetry(sample)
    await ingestTelemetry(sample)
    expect(await Telemetry.countDocuments({ node_id: node._id })).toBe(1)
  })
})
