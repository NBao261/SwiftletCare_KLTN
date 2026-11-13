/**
 * EXPERT-FR-014, 015; Report 3 §6.23 — hồ sơ cấu hình: Domain Expert soạn và duyệt (Farm Owner khi farm chưa
 * có chuyên gia, BR-22), Farm Owner áp cho nhiều nhà; mỗi zone nhận giá trị với lịch sử nguồn PROFILE và một
 * phiên bản cấu hình mới.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import profileRoutes from '@/routes/profiles.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { ConfigProfile } from '@/models/configProfile.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import { DEFAULT_DETECTION_TUNING } from '@/utils/detectionTuning.util'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/profiles', profileRoutes)
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
afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([AuditLog, ConfigProfile, Farm, House, Zone, SensorNode, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  const tech = await User.create({ email: `t${seq}@test.vn`, password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true },
      { user_id: tech._id, role: 'FARM_TECHNICIAN' },
      ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : []),
    ],
  })
  const houses = await House.create([{ farm_id: farm._id, name: 'H1' }, { farm_id: farm._id, name: 'H2' }])
  const zones = await Zone.create([
    { house_id: houses[0]._id, name: 'Z1' }, { house_id: houses[0]._id, name: 'Z2', floor: 2 }, { house_id: houses[1]._id, name: 'Z3' },
  ])
  await SensorNode.create({ device_id: `ESP-CP-${seq}`, zone_id: zones[0]._id, status: 'ONLINE', speaker_schedule: { enabled: true, windows: [{ start: '05:00', end: '07:00' }] } })
  const t = { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'), tech: tokenFor(tech._id, 'FARM_TECHNICIAN') }
  const call = (method: 'get' | 'post' | 'put', path: string, token: string, body?: object) =>
    request(app)[method](`/profiles${path}`).set('Authorization', `Bearer ${token}`).send(body)
  return { farm, houses, zones, t, call }
}

const PROFILE = {
  name: 'Mùa khô',
  stage: 'OCCUPIED',
  thresholds: { ...DEFAULT_THRESHOLDS, humidity_min: 80 },
  fuzzy_tuning: { ...DEFAULT_FUZZY_TUNING, fuzzy_humidity_band: 10 },
  detection_tuning: { ...DEFAULT_DETECTION_TUNING, noise_margin_db: 12 },
  speaker_schedule: { enabled: true, windows: [{ start: '04:00', end: '06:00' }, { start: '17:00', end: '19:00' }] },
}

describe('EXPERT-FR-014 — prepare and approve a configuration profile', () => {
  it('TC-F28-01: expert creates (DRAFT) then approves (APPROVED); humidity_min out of range → 400; Farm Owner approving a draft → 403', async () => {
    const { farm, t, call } = await seed()

    const created = await call('post', '', t.expert, { farm_id: farm._id, ...PROFILE })
    expect(created.status).toBe(201)
    expect(created.body.data.status).toBe('DRAFT')

    const bad = await call('post', '', t.expert, { farm_id: farm._id, ...PROFILE, thresholds: { ...PROFILE.thresholds, humidity_min: 120 } })
    expect(bad.status).toBe(400)

    const draft = await call('post', '', t.expert, { farm_id: farm._id, name: 'Nháp' , thresholds: PROFILE.thresholds })
    expect((await call('post', `/${draft.body.data._id}/approve`, t.owner)).status).toBe(403)

    const approved = await call('post', `/${created.body.data._id}/approve`, t.expert)
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('APPROVED')
    // Đã duyệt thì không sửa, không duyệt lại
    expect((await call('put', `/${created.body.data._id}`, t.expert, PROFILE)).status).toBe(409)
    expect((await call('post', `/${created.body.data._id}/approve`, t.expert)).status).toBe(409)
  })

  it('rejects an incomplete group and an empty profile with 400', async () => {
    const { farm, t, call } = await seed()
    expect((await call('post', '', t.expert, { farm_id: farm._id, name: 'x', thresholds: { temp_min: 26 } })).status).toBe(400)
    expect((await call('post', '', t.expert, { farm_id: farm._id, name: 'x' })).status).toBe(400)
    expect((await call('post', '', t.expert, { farm_id: farm._id, name: 'x', speaker_schedule: { enabled: true, windows: [{ start: '07:00', end: '05:00' }] } })).status).toBe(400)
  })

  it('lets the Farm Owner prepare and approve on a farm without an expert (BR-22); the technician gets 403', async () => {
    const { farm, t, call } = await seed({ withExpert: false })
    const created = await call('post', '', t.owner, { farm_id: farm._id, ...PROFILE })
    expect(created.status).toBe(201)
    expect((await call('post', `/${created.body.data._id}/approve`, t.owner)).status).toBe(200)
    expect((await call('get', `?farmId=${farm._id}`, t.tech)).status).toBe(403)
  })

  it('edits a DRAFT by replacing its content, and lists the profiles of the farm', async () => {
    const { farm, t, call } = await seed()
    const created = await call('post', '', t.expert, { farm_id: farm._id, ...PROFILE })
    const edited = await call('put', `/${created.body.data._id}`, t.expert, { name: 'Chỉ ngưỡng', thresholds: PROFILE.thresholds })
    expect(edited.status).toBe(200)
    expect(edited.body.data.fuzzy_tuning).toBeUndefined()
    const list = await call('get', `?farmId=${farm._id}&status=DRAFT`, t.owner)
    expect(list.body.data.map((p: { name: string }) => p.name)).toEqual(['Chỉ ngưỡng'])
  })
})

describe('EXPERT-FR-015 — apply an approved profile', () => {
  async function approved(over: object = {}) {
    const s = await seed()
    const created = await s.call('post', '', s.t.expert, { farm_id: s.farm._id, ...PROFILE, ...over })
    await s.call('post', `/${created.body.data._id}/approve`, s.t.expert)
    return { ...s, profileId: created.body.data._id as string }
  }

  it('TC-F28-02: every zone of both houses holds the values with history source PROFILE and a new configuration version; a DRAFT → 409', async () => {
    const { farm, houses, zones, t, call, profileId } = await approved()
    const before = await Zone.find().lean()

    const res = await call('post', `/${profileId}/apply`, t.owner, { house_ids: houses.map(h => h._id) })
    expect(res.status).toBe(200)
    expect(res.body.data.zones).toHaveLength(3)

    for (const zone of await Zone.find().lean()) {
      const old = before.find(z => String(z._id) === String(zone._id))!
      expect(zone.config_version).toBeGreaterThan(old.config_version)
      expect(zone.thresholds.humidity_min).toBe(80)
      expect(zone.fuzzy_tuning.fuzzy_humidity_band).toBe(10)
      expect(zone.detection_tuning.noise_margin_db).toBe(12)
      expect(zone.threshold_history.at(-1)?.source).toBe('PROFILE')
      expect(zone.fuzzy_tuning_history.at(-1)?.source).toBe('PROFILE')
      expect(zone.detection_tuning_history.at(-1)?.source).toBe('PROFILE')
    }
    // Lịch loa chép vào controller và đi xuống thiết bị cùng config mới
    const node = await SensorNode.findOne({ zone_id: zones[0]._id }).lean()
    expect(node!.speaker_schedule.windows).toEqual(PROFILE.speaker_schedule.windows.map(w => expect.objectContaining(w)))
    expect(jest.mocked(publishDeviceConfig)).toHaveBeenCalledWith(node!.device_id, expect.objectContaining({ humidity_min: 80, speaker_window1_start_hour: 4 }))
    expect((await ConfigProfile.findById(profileId).lean())!.applications).toHaveLength(1)
    expect(await AuditLog.countDocuments({ action: 'CONFIG_PROFILE_APPLIED', farm_id: farm._id })).toBe(1)

    const draft = await call('post', '', t.expert, { farm_id: farm._id, ...PROFILE })
    expect((await call('post', `/${draft.body.data._id}/apply`, t.owner, { house_ids: [houses[0]._id] })).status).toBe(409)
  })

  it('applies only the groups the profile holds', async () => {
    const { houses, t, call, profileId } = await approved({ fuzzy_tuning: null, detection_tuning: null, speaker_schedule: null })
    await call('post', `/${profileId}/apply`, t.owner, { house_ids: [houses[1]._id] })
    const zone = (await Zone.findOne({ house_id: houses[1]._id }).lean())!
    expect(zone.thresholds.humidity_min).toBe(80)
    expect(zone.fuzzy_tuning.fuzzy_humidity_band).toBe(DEFAULT_FUZZY_TUNING.fuzzy_humidity_band)
    expect(zone.fuzzy_tuning_history).toHaveLength(0)
  })

  it('archived profile → 409; expert applying → 403; house of another farm → 400', async () => {
    const { houses, t, call, profileId } = await approved()
    expect((await call('post', `/${profileId}/apply`, t.expert, { house_ids: [houses[0]._id] })).status).toBe(403)
    const other = await seed()
    expect((await call('post', `/${profileId}/apply`, t.owner, { house_ids: [other.houses[0]._id] })).status).toBe(400)

    expect((await call('post', `/${profileId}/archive`, t.expert)).status).toBe(200)
    expect((await call('post', `/${profileId}/apply`, t.owner, { house_ids: [houses[0]._id] })).status).toBe(409)
  })
})
