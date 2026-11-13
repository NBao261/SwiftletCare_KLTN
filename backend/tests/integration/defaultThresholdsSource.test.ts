/**
 * ENV-FR-007 — đổi ngưỡng mặc định phải kèm nguồn là một mục của REF-5; audit giữ giá trị cũ, mới và nguồn;
 * zone đang có không đổi và không gửi cấu hình. ENV-FR-026 — báo chuyên gia (Farm Owner khi farm chưa có
 * chuyên gia, BR-22) các zone khác mặc định mới. SYSTEM-FR-002 — GET kèm nguồn và lịch sử.
 */
jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import systemRoutes from '@/routes/system.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { User } from '@/models/user.model'
import { createZone } from '@/services/farm.service'
import { notifyZonesDifferingFromDefaults, updateDefaultThresholds } from '@/services/system.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/system', systemRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([Notification.deleteMany({}), SystemSetting.deleteMany({})])
})

let seq = 0
const makeUser = (role: 'ADMIN' | 'FARM_OWNER' | 'DOMAIN_EXPERT', extra: Record<string, unknown> = {}) => {
  seq++
  return User.create({ email: `u${seq}@test.vn`, password_hash: 'password123', full_name: `U${seq}`, role, ...extra })
}
const tokenOf = (u: { _id: unknown; role: string }) =>
  jwt.sign({ sub: String(u._id), role: u.role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

/** Farm có 1 zone mang ngưỡng `thresholds`; `expert` thêm 1 Domain Expert vào farm */
async function seedFarm(name: string, thresholds: Partial<typeof DEFAULT_THRESHOLDS>, opts: { expert?: boolean; expertActive?: boolean } = {}) {
  const owner = await makeUser('FARM_OWNER')
  const expert = opts.expert ? await makeUser('DOMAIN_EXPERT', { is_active: opts.expertActive ?? true }) : undefined
  const farm = await Farm.create({
    name, address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, ...(expert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: `${name}-H` })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: `${name}-Z`, thresholds: { ...DEFAULT_THRESHOLDS, ...thresholds } })
  return { owner, expert, farm, house, zone }
}

const put = (token: string, body: Record<string, unknown>) =>
  request(app).put('/system/settings/default-thresholds').set('Authorization', `Bearer ${token}`).send(body)

/** Thông báo ENV-FR-026 chạy nền sau khi lưu: chờ tới khi đủ số thông báo hoặc hết hạn */
async function waitForNotifications(count: number) {
  for (let i = 0; i < 50 && (await Notification.countDocuments()) < count; i++) {
    await new Promise(r => setTimeout(r, 20))
  }
}

describe('ENV-FR-007 — nguồn của ngưỡng mặc định', () => {
  it('lưu khi có nguồn REF-5: audit giữ cũ, mới, nguồn; zone cũ giữ nguyên, không gửi config; zone mới lấy mặc định mới', async () => {
    const admin = await makeUser('ADMIN')
    const { owner, house, zone } = await seedFarm('A', {})

    const res = await put(tokenOf(admin), { humidity_min: 78, source: 'TL-421 §3.2' }).expect(200)

    expect(res.body.data).toMatchObject({ ...DEFAULT_THRESHOLDS, humidity_min: 78 })
    const [log] = await AuditLog.find({ action: 'DEFAULT_THRESHOLDS_UPDATED' }).lean()
    expect(log.metadata).toMatchObject({
      before: { humidity_min: DEFAULT_THRESHOLDS.humidity_min }, after: { humidity_min: 78 }, source: 'TL-421 §3.2',
    })
    expect((await Zone.findById(zone._id).lean())?.thresholds.humidity_min).toBe(DEFAULT_THRESHOLDS.humidity_min)
    expect(publishDeviceConfig).not.toHaveBeenCalled()

    const created = await createZone(String(house._id), { _id: String(owner._id), email: owner.email, role: 'FARM_OWNER' }, { name: 'Z-new' })
    expect(created.thresholds.humidity_min).toBe(78)
  })

  it.each([
    ['thiếu nguồn', { humidity_min: 78 }],
    ['nguồn không có mã REF-5', { humidity_min: 78, source: 'sách nuôi yến' }],
    ['mã sai dạng', { humidity_min: 78, source: 'KD-12' }],
    ['nguồn không phải chuỗi', { humidity_min: 78, source: ['TL-421'] }],
    ['chỉ có nguồn, không đổi ngưỡng nào', { source: 'TL-421' }],
  ])('422 khi %s và không lưu gì', async (_label, body) => {
    const admin = await makeUser('ADMIN')
    await put(tokenOf(admin), body).expect(422)
    expect(await SystemSetting.countDocuments()).toBe(0)
    expect(await AuditLog.countDocuments({ action: 'DEFAULT_THRESHOLDS_UPDATED' })).toBe(0)
  })

  it('service cũng từ chối khi gọi thẳng không có nguồn (422)', async () => {
    const admin = await makeUser('ADMIN')
    await expect(updateDefaultThresholds(String(admin._id), { humidity_min: 78 })).rejects.toMatchObject({ statusCode: 422 })
  })

  it.each(['FARM_OWNER', 'DOMAIN_EXPERT'] as const)('%s không đổi được ngưỡng mặc định (403)', async role => {
    const user = await makeUser(role)
    await put(tokenOf(user), { humidity_min: 78, source: 'TL-421' }).expect(403)
  })

  it('GET trả nguồn, người đổi và lịch sử mới nhất trước (SYSTEM-FR-002)', async () => {
    const admin = await makeUser('ADMIN')
    const empty = await request(app).get('/system/settings/default-thresholds').set('Authorization', `Bearer ${tokenOf(admin)}`).expect(200)
    expect(empty.body.data).toMatchObject({ ...DEFAULT_THRESHOLDS, source: null, history: [] })

    await put(tokenOf(admin), { temp_max: 32, source: 'TL-421' }).expect(200)
    await put(tokenOf(admin), { temp_max: 33, source: 'MC-501' }).expect(200)

    const res = await request(app).get('/system/settings/default-thresholds').set('Authorization', `Bearer ${tokenOf(admin)}`).expect(200)
    expect(res.body.data).toMatchObject({ temp_max: 33, source: 'MC-501', updated_by: String(admin._id) })
    expect(res.body.data.history.map((h: { source: string }) => h.source)).toEqual(['MC-501', 'TL-421'])
    expect(res.body.data.history[0]).toMatchObject({ by: String(admin._id), before: { temp_max: 32 }, after: { temp_max: 33 } })
  })
})

describe('ENV-FR-026 — báo các zone khác mặc định mới', () => {
  it('đổi humidity_min qua HTTP: chuyên gia của farm có zone khác nhận đúng 1 thông báo, zone giữ nguyên', async () => {
    const admin = await makeUser('ADMIN')
    const differing = await seedFarm('Lệch', { humidity_min: 80 }, { expert: true })
    await seedFarm('Khớp', { humidity_min: 78 }, { expert: true })

    await put(tokenOf(admin), { humidity_min: 78, source: 'TL-421' }).expect(200)
    await waitForNotifications(1)

    const notes = await Notification.find().lean()
    expect(notes).toHaveLength(1)
    expect(String(notes[0].user_id)).toBe(String(differing.expert!._id))
    expect(notes[0].title).toContain('Lệch')
    expect(notes[0].body).toContain('Lệch-Z')
    expect(notes[0].body).toContain('humidity_min 80')
    expect((await Zone.findById(differing.zone._id).lean())?.thresholds.humidity_min).toBe(80)
  })

  it('farm chưa có chuyên gia còn hoạt động thì Farm Owner nhận (BR-22)', async () => {
    const { owner, expert } = await seedFarm('NoExpert', { co2_max: 1200 }, { expert: true, expertActive: false })

    await notifyZonesDifferingFromDefaults(['co2_max'], { ...DEFAULT_THRESHOLDS, co2_max: 1800 })

    const notes = await Notification.find().lean()
    expect(notes.map(n => String(n.user_id))).toEqual([String(owner._id)])
    expect(notes.map(n => String(n.user_id))).not.toContain(String(expert!._id))
  })

  it('chỉ xét trường vừa đổi: zone khác ở trường khác không bị báo', async () => {
    await seedFarm('Other', { temp_max: 35 }, { expert: true })

    await notifyZonesDifferingFromDefaults(['humidity_min'], { ...DEFAULT_THRESHOLDS })

    expect(await Notification.countDocuments()).toBe(0)
  })

  it('farm đã xoá mềm không nhận thông báo', async () => {
    const { farm } = await seedFarm('Gone', { humidity_min: 80 }, { expert: true })
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })

    await notifyZonesDifferingFromDefaults(['humidity_min'], { ...DEFAULT_THRESHOLDS, humidity_min: 78 })

    expect(await Notification.countDocuments()).toBe(0)
  })
})
