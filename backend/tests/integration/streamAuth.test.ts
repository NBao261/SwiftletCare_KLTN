/**
 * VISION-FR-013 — token xem live stream và MediaMTX hỏi quyền đẩy/xem (docs/bird-counting-plan.md §8.6, §18.3).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import internalRoutes from '@/routes/internal.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { STREAM_TOKEN_TTL_SEC } from '@/services/stream.service'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const STREAM_ENV = {
  STREAM_TOKEN_SECRET: 'test-stream-token-secret',
  STREAM_AUTH_KEY: 'test-auth-key',
  STREAM_PUBLISH_SECRET: 'test-publish-secret',
}

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use('/internal', internalRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
beforeEach(() => { Object.assign(process.env, STREAM_ENV) })
afterEach(async () => {
  await Promise.all([CameraNode, Farm, House, Zone, User].map(m => (m as typeof User).deleteMany({})))
})

let seq = 0
const tokenFor = (id: unknown, role: string) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed(deviceId?: string) {
  seq++
  const mk = (name: string, role: string) =>
    User.create({ email: `${name}${seq}@test.vn`, password_hash: 'password123', full_name: name, role })
  const [owner, expert, technician, stranger] = await Promise.all([
    mk('owner', 'FARM_OWNER'), mk('expert', 'DOMAIN_EXPERT'), mk('tech', 'TECHNICIAN'), mk('stranger', 'FARM_OWNER'),
  ])
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const camera = await CameraNode.create({ device_id: deviceId ?? `cam-zone${seq}`, zone_id: zone._id })
  return {
    camera,
    t: {
      owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
      technician: tokenFor(technician._id, 'TECHNICIAN'), stranger: tokenFor(stranger._id, 'FARM_OWNER'),
    },
  }
}

const getToken = (cameraId: unknown, bearer: string) =>
  request(app).get(`/devices/camera-nodes/${cameraId}/stream-token`).set('Authorization', `Bearer ${bearer}`)

const auth = (body: Record<string, unknown>, key = STREAM_ENV.STREAM_AUTH_KEY) =>
  request(app).post(`/internal/stream-auth?key=${encodeURIComponent(key)}`).send(body)

describe('GET /devices/camera-nodes/:id/stream-token', () => {
  it('Farm Owner và Domain Expert của farm nhận token 60 giây cho đúng đường cam-<device_id>', async () => {
    const { camera, t } = await seed()
    for (const bearer of [t.owner, t.expert]) {
      const res = await getToken(camera._id, bearer).expect(200)
      expect(res.body.data).toMatchObject({ path: `cam-${camera.device_id}`, expires_in: STREAM_TOKEN_TTL_SEC })
      const payload = jwt.verify(res.body.data.token, STREAM_ENV.STREAM_TOKEN_SECRET) as jwt.JwtPayload
      expect(payload.path).toBe(`cam-${camera.device_id}`)
      expect(payload.exp! - payload.iat!).toBe(STREAM_TOKEN_TTL_SEC)
    }
  })

  it('token xem stream không dùng được làm access token', async () => {
    const { camera, t } = await seed()
    const res = await getToken(camera._id, t.owner).expect(200)
    await getToken(camera._id, res.body.data.token).expect(401)
  })

  it('Technician (SRS §4.4) và Farm Owner của farm khác bị chặn', async () => {
    const { camera, t } = await seed()
    await getToken(camera._id, t.technician).expect(403)
    await getToken(camera._id, t.stranger).expect(403)
  })

  it('camera không tồn tại hoặc đã gỡ → 404', async () => {
    const { camera, t } = await seed()
    await getToken(new mongoose.Types.ObjectId(), t.owner).expect(404)
    await CameraNode.updateOne({ _id: camera._id }, { decommissioned_at: new Date() })
    await getToken(camera._id, t.owner).expect(404)
  })

  it('device_id kết thúc bằng -raw hoặc có ký tự lạ thì không cấp token', async () => {
    for (const id of ['x-raw', 'cam 1', 'cam/../x']) {
      const { camera, t } = await seed(id)
      await getToken(camera._id, t.owner).expect(400)
    }
  })

  it('chưa cấu hình máy chủ video → 503', async () => {
    const { camera, t } = await seed()
    delete process.env.STREAM_TOKEN_SECRET
    await getToken(camera._id, t.owner).expect(503)
  })
})

describe('POST /internal/stream-auth', () => {
  const viewerToken = (path: string, opts: jwt.SignOptions = { expiresIn: 60 }) =>
    jwt.sign({ path }, STREAM_ENV.STREAM_TOKEN_SECRET, opts)

  it('sai khóa hoặc chưa cấu hình khóa thì từ chối mọi việc', async () => {
    const ok = { action: 'publish', path: 'cam-a', password: STREAM_ENV.STREAM_PUBLISH_SECRET }
    await auth(ok, 'wrong').expect(401)
    delete process.env.STREAM_AUTH_KEY
    await auth(ok, '').expect(401)
  })

  it('chỉ pipeline (mật khẩu dịch vụ) được đẩy video', async () => {
    await auth({ action: 'publish', path: 'cam-a', user: 'pipeline', password: STREAM_ENV.STREAM_PUBLISH_SECRET }).expect(200)
    await auth({ action: 'publish', path: 'cam-a', user: 'pipeline', password: 'wrong' }).expect(401)
    await auth({ action: 'publish', path: 'cam-a', token: viewerToken('cam-a') }).expect(401)   // token người xem không đẩy được
    await auth({ action: 'publish', path: 'other', password: STREAM_ENV.STREAM_PUBLISH_SECRET }).expect(401)
  })

  it('người xem đọc được bằng token qua header Bearer, ?token= hoặc ô mật khẩu', async () => {
    const token = viewerToken('cam-a')
    await auth({ action: 'read', path: 'cam-a', token }).expect(200)
    await auth({ action: 'read', path: 'cam-a', query: `token=${token}` }).expect(200)
    await auth({ action: 'read', path: 'cam-a', user: 'x', password: token }).expect(200)
  })

  it('token của camera khác, hết hạn hoặc sai chữ ký bị từ chối', async () => {
    await auth({ action: 'read', path: 'cam-a', token: viewerToken('cam-b') }).expect(401)
    await auth({ action: 'read', path: 'cam-a', token: viewerToken('cam-a', { expiresIn: -10 }) }).expect(401)
    await auth({ action: 'read', path: 'cam-a', token: jwt.sign({ path: 'cam-a' }, 'other-secret') }).expect(401)
    await auth({ action: 'read', path: 'cam-a', user: '', password: '' }).expect(401)   // RTSP hỏi lần đầu chưa kèm mật khẩu
  })

  it('hình gốc -raw chỉ pipeline đọc được, token người xem thì không', async () => {
    await auth({ action: 'read', path: 'cam-a-raw', password: STREAM_ENV.STREAM_PUBLISH_SECRET }).expect(200)
    await auth({ action: 'read', path: 'cam-a-raw', token: viewerToken('cam-a-raw') }).expect(401)
  })

  it('các hành động khác (api, playback…) bị từ chối', async () => {
    for (const action of ['api', 'metrics', 'playback']) {
      await auth({ action, path: 'cam-a', password: STREAM_ENV.STREAM_PUBLISH_SECRET }).expect(401)
    }
  })
})
