/**
 * File loa ru (ENV-FR-013c) + tắt Manual Override sớm (ENV-FR-018) — qua route thật
 * (auth + requireRole + multer + validator), MinIO/MQTT/socket được mock.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AudioTrack } from '@/models/audioTrack.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { putObject, removeObject } from '@/config/minio.config'
import { publishCommand } from '@/mqtt/mqtt.client'
import { emitRelayUpdate } from '@/socket'

jest.mock('@/config/minio.config', () => ({
  putObject: jest.fn().mockResolvedValue(undefined),
  removeObject: jest.fn().mockResolvedValue(undefined),
  presignedGetUrl: jest.fn(async (key: string) => `http://minio.test/${key}?sig=1`),
}))
jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await AudioTrack.init() // unique index {node_id, track_number}
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([
    AudioTrack.deleteMany({}), AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}),
    SensorNode.deleteMany({}), User.deleteMany({}), Zone.deleteMany({}),
  ])
})

const MP3 = Buffer.from('ID3fake-mp3-bytes')
const tokenFor = (id: unknown, role: string) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed(status: 'ONLINE' | 'OFFLINE' = 'ONLINE') {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const tech = await User.create({ email: 'tech@test.vn', password_hash: 'password123', full_name: 'Tech', role: 'TECHNICIAN', assigned_regions: ['HCM'] })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id, region: 'HCM' })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone' })
  const node = await SensorNode.create({ device_id: 'ESP32-A', zone_id: zone._id, status })
  const chain = [String(farm._id), String(house._id), String(zone._id)]
  return { node, chain, ownerToken: tokenFor(owner._id, 'FARM_OWNER'), techToken: tokenFor(tech._id, 'TECHNICIAN') }
}

const base = (nodeId: unknown) => `/devices/sensor-nodes/${nodeId}`

function upload(nodeId: unknown, token: string, fields: { track_number?: string; display_name?: string } = {},
  file: { buffer: Buffer; filename: string; contentType: string } = { buffer: MP3, filename: 'goi-bay.mp3', contentType: 'audio/mpeg' }) {
  return request(app)
    .post(`${base(nodeId)}/audio-tracks`)
    .set('Authorization', `Bearer ${token}`)
    .field('track_number', fields.track_number ?? '2')
    .field('display_name', fields.display_name ?? 'Tiếng chim gọi bầy')
    .attach('file', file.buffer, { filename: file.filename, contentType: file.contentType })
}

async function uploadSynced(ctx: Awaited<ReturnType<typeof seed>>) {
  const { body } = await upload(ctx.node._id, ctx.techToken)
  await request(app).put(`${base(ctx.node._id)}/audio-tracks/${body.data._id}/sync-status`)
    .set('Authorization', `Bearer ${ctx.techToken}`).send({ synced_to_sd: true })
  jest.clearAllMocks()
  return body.data._id as string
}

describe('upload', () => {
  it('stores the file on MinIO and lists it with a signed listening URL', async () => {
    const ctx = await seed()

    const res = await upload(ctx.node._id, ctx.techToken)

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ track_number: 2, display_name: 'Tiếng chim gọi bầy', synced_to_sd: false, file_size_bytes: MP3.length })
    expect(putObject).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^audio-tracks/${ctx.node._id}/.+\\.mp3$`)), expect.any(Buffer), 'audio/mpeg')
    expect(await AuditLog.countDocuments({ action: 'AUDIO_TRACK_UPLOADED' })).toBe(1)

    const list = await request(app).get(`${base(ctx.node._id)}/audio-tracks`).set('Authorization', `Bearer ${ctx.ownerToken}`)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].file_url).toMatch(/^http:\/\/minio\.test\/audio-tracks\//)
  })

  it('rejects a non-mp3 file', async () => {
    const ctx = await seed()
    const res = await upload(ctx.node._id, ctx.techToken, {}, { buffer: MP3, filename: 'song.wav', contentType: 'audio/wav' })
    expect(res.status).toBe(400)
    expect(putObject).not.toHaveBeenCalled()
  })

  it('rejects a file over 10MB', async () => {
    const ctx = await seed()
    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    const res = await upload(ctx.node._id, ctx.techToken, {}, { buffer: big, filename: 'big.mp3', contentType: 'audio/mpeg' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/10MB/)
  })

  it('rejects a track number already used on this device', async () => {
    const ctx = await seed()
    await upload(ctx.node._id, ctx.techToken)
    const res = await upload(ctx.node._id, ctx.techToken)
    expect(res.status).toBe(409)
    expect(await AudioTrack.countDocuments()).toBe(1)
  })

  it('is not allowed for a Farm Owner', async () => {
    const ctx = await seed()
    const res = await upload(ctx.node._id, ctx.ownerToken)
    expect(res.status).toBe(403)
  })
})

describe('select / play-now / stop', () => {
  it('blocks choosing or playing a track that is not on the SD card yet', async () => {
    const ctx = await seed()
    const { body } = await upload(ctx.node._id, ctx.techToken)
    const trackId = body.data._id

    const select = await request(app).put(`${base(ctx.node._id)}/audio-tracks/${trackId}/select`).set('Authorization', `Bearer ${ctx.ownerToken}`)
    const play = await request(app).post(`${base(ctx.node._id)}/audio-tracks/${trackId}/play-now`).set('Authorization', `Bearer ${ctx.ownerToken}`)

    expect(select.status).toBe(400)
    expect(select.body.error.message).toMatch(/chưa được chép vào thẻ SD/)
    expect(play.status).toBe(400)
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('makes a synced track the scheduled default via config/update', async () => {
    const ctx = await seed()
    const trackId = await uploadSynced(ctx)

    const res = await request(app).put(`${base(ctx.node._id)}/audio-tracks/${trackId}/select`).set('Authorization', `Bearer ${ctx.ownerToken}`)

    expect(res.status).toBe(200)
    expect((await SensorNode.findById(ctx.node._id))!.audio.current_track).toBe(2)
    expect(publishCommand).toHaveBeenCalledWith(...ctx.chain, 'config/update', expect.objectContaining({ speaker_track: 2 }))
  })

  it('plays and stops a synced track on an online device', async () => {
    const ctx = await seed()
    const trackId = await uploadSynced(ctx)

    const play = await request(app).post(`${base(ctx.node._id)}/audio-tracks/${trackId}/play-now`).set('Authorization', `Bearer ${ctx.ownerToken}`)
    const stop = await request(app).post(`${base(ctx.node._id)}/audio/stop`).set('Authorization', `Bearer ${ctx.ownerToken}`)

    expect(play.status).toBe(200)
    expect(stop.status).toBe(200)
    expect(publishCommand).toHaveBeenNthCalledWith(1, ...ctx.chain, 'audio/command', { deviceId: ctx.node.device_id, action: 'play', track: 2 })
    expect(publishCommand).toHaveBeenNthCalledWith(2, ...ctx.chain, 'audio/command', { deviceId: ctx.node.device_id, action: 'stop' })
  })

  it('refuses to play on an offline device', async () => {
    const ctx = await seed('OFFLINE')
    const trackId = await uploadSynced(ctx)

    const res = await request(app).post(`${base(ctx.node._id)}/audio-tracks/${trackId}/play-now`).set('Authorization', `Bearer ${ctx.ownerToken}`)

    expect(res.status).toBe(409)
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('does not let a Technician play (operation belongs to the Farm Owner)', async () => {
    const ctx = await seed()
    const trackId = await uploadSynced(ctx)
    const res = await request(app).post(`${base(ctx.node._id)}/audio-tracks/${trackId}/play-now`).set('Authorization', `Bearer ${ctx.techToken}`)
    expect(res.status).toBe(403)
  })
})

describe('delete', () => {
  it('removes the record and the MinIO object', async () => {
    const ctx = await seed()
    const { body } = await upload(ctx.node._id, ctx.techToken)

    const res = await request(app).delete(`${base(ctx.node._id)}/audio-tracks/${body.data._id}`).set('Authorization', `Bearer ${ctx.techToken}`)

    expect(res.status).toBe(200)
    expect(await AudioTrack.countDocuments()).toBe(0)
    expect(removeObject).toHaveBeenCalledWith(expect.stringMatching(/^audio-tracks\//))
  })
})

describe('DELETE /relay-override', () => {
  it('returns a MANUAL device to AUTO and tells the firmware', async () => {
    const ctx = await seed()
    await SensorNode.updateOne({ _id: ctx.node._id }, { control_mode: 'MANUAL', override_expiry: new Date(Date.now() + 60_000) })

    const res = await request(app).delete(`${base(ctx.node._id)}/relay-override`).set('Authorization', `Bearer ${ctx.ownerToken}`)

    expect(res.status).toBe(200)
    const after = (await SensorNode.findById(ctx.node._id))!
    expect(after.control_mode).toBe('AUTO')
    expect(after.override_expiry).toBeUndefined()
    expect(publishCommand).toHaveBeenCalledWith(...ctx.chain, 'relay/command', { deviceId: ctx.node.device_id, action: 'clear_override' })
    expect(emitRelayUpdate).toHaveBeenCalledTimes(4)
    expect(await AuditLog.countDocuments({ action: 'RELAY_OVERRIDE_CLEARED' })).toBe(1)
  })

  it('does nothing when the device is already AUTO', async () => {
    const ctx = await seed()
    const res = await request(app).delete(`${base(ctx.node._id)}/relay-override`).set('Authorization', `Bearer ${ctx.ownerToken}`)
    expect(res.status).toBe(200)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})
