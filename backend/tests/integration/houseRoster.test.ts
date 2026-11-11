/**
 * AUTH-FR-014 — lịch trực theo tuần của nhà: Farm Owner đặt, chỉ thợ đang được giao nhà, ca cùng vai không
 * chồng giờ; thợ chỉ xem ca của mình; bỏ gán thì mất ca. technicianOnDuty: trong ca thợ phụ thì thợ phụ, nhà
 * không có lịch thì thợ chính (tiêu chí của AUTH-FR-014), ca qua nửa đêm, nhà chưa có thợ thì null.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'
import { technicianOnDuty } from '@/utils/roster.util'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()

let seq = 0
async function tokenOf(role: Role) {
  seq++
  const user = await User.create({ email: `roster${seq}@test.vn`, password_hash: 'password123', full_name: role, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

/** Farm có 1 nhà với 2 thợ được giao (A chính, B phụ) và 1 thợ của farm chưa được giao (C) */
async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const [a, b, c] = [await tokenOf('FARM_TECHNICIAN'), await tokenOf('FARM_TECHNICIAN'), await tokenOf('FARM_TECHNICIAN')]
  for (const t of [a, b, c]) ctx.farm.members.push({ user_id: t.user._id, role: 'FARM_TECHNICIAN' } as never)
  await ctx.farm.save()
  const owner = as(ctx.token)
  await owner.put(`/farms/houses/${house._id}/technicians/${a.user._id}`, { primary: true }).expect(200)
  await owner.put(`/farms/houses/${house._id}/technicians/${b.user._id}`).expect(200)
  return { ...ctx, house, a, b, c, owner, path: `/farms/houses/${house._id}/roster` }
}

const WEEKDAYS = [1, 2, 3, 4, 5]
const shift = (technicianId: unknown, role: 'PRIMARY' | 'BACKUP', start: string, end: string, weekdays = WEEKDAYS) =>
  ({ technician_id: String(technicianId), role, weekdays, start, end })
/** Thời điểm theo giờ VN (UTC+7) */
const vn = (iso: string) => new Date(`${iso}+07:00`)

describe('PUT/GET /farms/houses/:houseId/roster (AUTH-FR-014)', () => {
  it('the Farm Owner sets a weekly roster of assigned technicians and it is audited', async () => {
    const { a, b, owner, path, farm } = await seed()
    const res = await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'BACKUP', '18:00', '06:00')] }).expect(200)
    expect(res.body.data.roster).toHaveLength(2)
    expect(res.body.data.roster[1]).toEqual({ technician_id: String(b.user._id), role: 'BACKUP', weekdays: WEEKDAYS, start: '18:00', end: '06:00' })
    expect(await AuditLog.countDocuments({ action: 'HOUSE_ROSTER_UPDATED', farm_id: farm._id })).toBe(1)
    // Mảng rỗng = bỏ lịch
    expect((await owner.put(path, { shifts: [] }).expect(200)).body.data.roster).toEqual([])
  })

  it('refuses a technician not assigned to the house (409), overlapping shifts of one role and bad hours (400/422)', async () => {
    const { a, b, c, owner, path } = await seed()
    await owner.put(path, { shifts: [shift(c.user._id, 'PRIMARY', '06:00', '18:00')] }).expect(409)
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'PRIMARY', '17:00', '20:00')] }).expect(400)
    // Ca qua nửa đêm thứ Hai chồng sang sáng thứ Ba của ca khác
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '22:00', '02:00', [1]), shift(b.user._id, 'PRIMARY', '01:00', '05:00', [2])] }).expect(400)
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '06:00')] }).expect(400)
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00', [1, 1])] }).expect(400)
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '6:00', '18:00')] }).expect(422)
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00', [7])] }).expect(422)
    await owner.put(path, { shifts: [{ ...shift(a.user._id, 'PRIMARY', '06:00', '18:00'), role: 'LEAD' }] }).expect(422)
    // Thợ chính và thợ phụ cùng giờ thì được
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'BACKUP', '06:00', '18:00')] }).expect(200)
  })

  it('a technician reads only their own shifts and cannot set the roster; others are refused', async () => {
    const { a, b, c, owner, path } = await seed()
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'BACKUP', '18:00', '06:00')] }).expect(200)

    const mine = (await as(b.token).get(path).expect(200)).body.data.roster
    expect(mine.map((s: { technician_id: string }) => s.technician_id)).toEqual([String(b.user._id)])
    expect((await owner.get(path).expect(200)).body.data.roster).toHaveLength(2)

    await as(b.token).put(path, { shifts: [] }).expect(403)
    await as(c.token).get(path).expect(403)
    // Report 3 §2.4: Domain Expert không có quyền với lịch trực, kể cả xem
    const expert = await tokenOf('DOMAIN_EXPERT')
    await as(expert.token).get(path).expect(403)
    await as(expert.token).put(path, { shifts: [] }).expect(403)
    const admin = await tokenOf('ADMIN')
    await as(admin.token).get(path).expect(403)
    const other = await seedOwnerFarm()
    await as(other.token).put(path, { shifts: [] }).expect(403)
  })

  it('the house list carries the whole roster for the Farm Owner, only own shifts for a technician, none for the expert', async () => {
    const { a, b, owner, path, farm, token } = await seed()
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'BACKUP', '18:00', '06:00')] }).expect(200)
    const expert = await tokenOf('DOMAIN_EXPERT')
    farm.members.push({ user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const houseOf = async (userToken: string) => (await as(userToken).get(`/farms/${farm._id}/houses`).expect(200)).body.data[0]
    const technicianIds = (house: { roster: Array<{ technician_id: string }> }) => house.roster.map(s => s.technician_id)

    expect(technicianIds(await houseOf(token))).toEqual([String(a.user._id), String(b.user._id)])
    expect(technicianIds(await houseOf(b.token))).toEqual([String(b.user._id)])
    const seenByExpert = await houseOf(expert.token)
    expect(seenByExpert).not.toHaveProperty('roster')
    expect(seenByExpert.technicians).toHaveLength(2)
  })

  it('unassigning a technician or removing them from the farm drops their shifts', async () => {
    const { a, b, owner, path, house, farm } = await seed()
    await owner.put(path, { shifts: [shift(a.user._id, 'PRIMARY', '06:00', '18:00'), shift(b.user._id, 'BACKUP', '18:00', '06:00')] }).expect(200)

    await owner.delete(`/farms/houses/${house._id}/technicians/${b.user._id}`).expect(200)
    expect((await House.findById(house._id).lean())!.roster.map(s => String(s.technician_id))).toEqual([String(a.user._id)])
    await owner.delete(`/farms/${farm._id}/members/${a.user._id}`).expect(200)
    expect((await House.findById(house._id).lean())!.roster).toEqual([])
  })
})

describe('technicianOnDuty (AUTH-FR-014, ALERT-FR-017)', () => {
  const A = 'tech-a'
  const B = 'tech-b'
  const technicians = [{ user_id: A, primary: true }, { user_id: B, primary: false }]
  const roster = [
    { technician_id: A, role: 'PRIMARY' as const, weekdays: WEEKDAYS, start: '06:00', end: '18:00' },
    { technician_id: B, role: 'BACKUP' as const, weekdays: WEEKDAYS, start: '18:00', end: '06:00' },
  ]

  it('gives the backup in the backup shift and the primary in the primary shift', () => {
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-10T20:00:00'))).toBe(B) // thứ Ba 20:00
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-10T09:00:00'))).toBe(A)
  })

  it('counts an overnight shift on the next morning and falls back to the primary outside every shift', () => {
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-11T05:59:00'))).toBe(B) // ca tối thứ Ba kéo tới 06:00 thứ Tư
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-15T10:00:00'))).toBe(A) // Chủ nhật: không có ca → thợ chính
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-15T03:00:00'))).toBe(A) // ca tối thứ Sáu đã hết lúc 06:00 thứ Bảy
    expect(technicianOnDuty({ technicians, roster }, vn('2026-11-14T03:00:00'))).toBe(B) // 03:00 thứ Bảy vẫn trong ca tối thứ Sáu
  })

  it('uses the primary technician when the house has no roster, and null without technicians', () => {
    expect(technicianOnDuty({ technicians, roster: [] }, vn('2026-11-10T20:00:00'))).toBe(A)
    expect(technicianOnDuty({ technicians: [], roster: [] })).toBeNull()
  })
})
