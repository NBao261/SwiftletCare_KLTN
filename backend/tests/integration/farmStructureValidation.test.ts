/**
 * FARM-FR-001, 002, Report 3 §4.5 — tên farm, nhà, zone tối đa 50 ký tự; nhà 1–10 tầng; tầng của zone
 * không vượt số tầng của nhà; tên nhà/zone không trùng (bỏ qua hoa thường) → 409 DUPLICATE_NAME.
 * AUTH-FR-005, 010 — Primary Owner xem lời mời của farm, không có token.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { House } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => { await Invitation.deleteMany({}) })

let seq = 0
async function tokenOf(role: Role) {
  seq++
  const user = await User.create({ email: `fsv${seq}@test.vn`, password_hash: 'password123', full_name: role, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

const coordinates = { lat: 10.77, lng: 106.7 }
const name = (length: number) => 'N'.repeat(length)

describe('tên tối đa 50 ký tự (Report 3 §4.5)', () => {
  it('refuses 51 characters for a farm, a house, a zone and a farm rename, and accepts 50', async () => {
    const { farm, token } = await seedOwnerFarm()
    const owner = as(token)
    const house = (await House.findOne({ farm_id: farm._id }))!

    await owner.post('/farms', { name: name(51), address: 'x', coordinates }).expect(422)
    await owner.post('/farms', { name: name(50), address: 'x', coordinates }).expect(201)
    await owner.post(`/farms/${farm._id}/houses`, { name: name(51) }).expect(422)
    await owner.post(`/farms/${farm._id}/houses`, { name: name(50) }).expect(201)
    await owner.post(`/farms/houses/${house._id}/zones`, { name: name(51) }).expect(422)
    await owner.post(`/farms/houses/${house._id}/zones`, { name: name(50) }).expect(201)
    await owner.put(`/farms/${farm._id}`, { name: name(51) }).expect(422)
    await owner.put(`/farms/${farm._id}`, { name: '   ' }).expect(422)
    await owner.put(`/farms/${farm._id}`, { name: name(50) }).expect(200)
  })
})

describe('số tầng (FARM-FR-002)', () => {
  it('takes a house of 1 to 10 floors', async () => {
    const { farm, token } = await seedOwnerFarm()
    const owner = as(token)

    for (const floors of [0, 11, 'abc', 2.5]) {
      await owner.post(`/farms/${farm._id}/houses`, { name: `H ${String(floors)}`, floors }).expect(422)
    }
    expect((await owner.post(`/farms/${farm._id}/houses`, { name: 'Một tầng', floors: 1 }).expect(201)).body.data.floors).toBe(1)
    expect((await owner.post(`/farms/${farm._id}/houses`, { name: 'Mười tầng', floors: '10' }).expect(201)).body.data.floors).toBe(10)
  })

  it('keeps a zone within the floors of its house', async () => {
    const { farm, token } = await seedOwnerFarm()
    const owner = as(token)
    const house = (await owner.post(`/farms/${farm._id}/houses`, { name: 'Ba tầng', floors: 3 }).expect(201)).body.data

    const above = await owner.post(`/farms/houses/${house._id}/zones`, { name: 'Tầng 4', floor: 4 }).expect(400)
    expect(above.body.error.message).toContain('3 tầng')
    await owner.post(`/farms/houses/${house._id}/zones`, { name: 'Tầng 0', floor: 0 }).expect(422)
    await owner.post(`/farms/houses/${house._id}/zones`, { name: 'Tầng 3', floor: 3 }).expect(201)
    // Nhà cũ không có floors (mặc định 1) chỉ nhận zone tầng 1
    const legacy = (await House.findOne({ farm_id: farm._id, name: 'H' }))!
    await owner.post(`/farms/houses/${legacy._id}/zones`, { name: 'Tầng 2', floor: 2 }).expect(400)
  })
})

describe('tên trùng → 409 DUPLICATE_NAME (FARM-FR-002)', () => {
  it('refuses a house name already used in the farm, ignoring case but not accents', async () => {
    const a = await seedOwnerFarm()
    const owner = as(a.token)
    const b = await seedOwnerFarm()

    await owner.post(`/farms/${a.farm._id}/houses`, { name: 'Nhà A' }).expect(201)
    const duplicate = await owner.post(`/farms/${a.farm._id}/houses`, { name: '  nhà a ' }).expect(409)
    expect(duplicate.body.error.code).toBe('DUPLICATE_NAME')
    await owner.post(`/farms/${a.farm._id}/houses`, { name: 'Nha A' }).expect(201)
    await as(b.token).post(`/farms/${b.farm._id}/houses`, { name: 'Nhà A' }).expect(201)
  })

  it('refuses a zone name already used in the house, not in another house', async () => {
    const { farm, token } = await seedOwnerFarm()
    const owner = as(token)
    const house = (await owner.post(`/farms/${farm._id}/houses`, { name: 'Nhà B', floors: 2 }).expect(201)).body.data
    const other = (await owner.post(`/farms/${farm._id}/houses`, { name: 'Nhà C', floors: 2 }).expect(201)).body.data

    await owner.post(`/farms/houses/${house._id}/zones`, { name: 'Tầng trệt' }).expect(201)
    expect((await owner.post(`/farms/houses/${house._id}/zones`, { name: 'TẦNG TRỆT' }).expect(409)).body.error.code).toBe('DUPLICATE_NAME')
    await owner.post(`/farms/houses/${other._id}/zones`, { name: 'Tầng trệt' }).expect(201)
  })

  it('ignores a farm_id sent in the house body', async () => {
    const mine = await seedOwnerFarm()
    const other = await seedOwnerFarm()
    const created = await as(mine.token).post(`/farms/${mine.farm._id}/houses`, { name: 'Nhà D', farm_id: String(other.farm._id) }).expect(201)
    expect(created.body.data.farm_id).toBe(String(mine.farm._id))
  })
})

describe('GET /farms/:id/invitations (AUTH-FR-005, 010)', () => {
  async function seedInvitations() {
    const ctx = await seedOwnerFarm()
    const base = { farm_id: ctx.farm._id, invited_by: ctx.owner._id, invited_role: 'DOMAIN_EXPERT' }
    const day = 86400_000
    const pending = await Invitation.create({ ...base, invited_email: 'p@test.vn', token: `t-p-${seq}`, status: 'PENDING', expires_at: new Date(Date.now() + day) })
    const overdue = await Invitation.create({ ...base, invited_email: 'o@test.vn', token: `t-o-${seq}`, status: 'PENDING', expires_at: new Date(Date.now() - day) })
    const accepted = await Invitation.create({ ...base, invited_email: 'a@test.vn', token: `t-a-${seq}`, status: 'ACCEPTED', expires_at: new Date(Date.now() + day) })
    return { ...ctx, pending, overdue, accepted }
  }

  it('lists the pending invitations still valid by default, without their token', async () => {
    const { farm, token, pending, overdue } = await seedInvitations()

    const listed = (await as(token).get(`/farms/${farm._id}/invitations`).expect(200)).body.data as Array<Record<string, unknown>>
    expect(listed.map(row => row._id)).toEqual([String(pending._id)])
    expect(listed[0]).not.toHaveProperty('token')
    expect(listed[0]).toMatchObject({ invited_email: 'p@test.vn', invited_role: 'DOMAIN_EXPERT', status: 'PENDING' })

    const res = await as(token).get(`/farms/${farm._id}/invitations`).expect(200)
    expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 20 })

    const expired = (await as(token).get(`/farms/${farm._id}/invitations?status=EXPIRED`).expect(200)).body.data as Array<Record<string, unknown>>
    expect(expired.map(row => [row._id, row.status])).toEqual([[String(overdue._id), 'EXPIRED']])
    await as(token).get(`/farms/${farm._id}/invitations?status=ALL`).expect(422)
    await as(token).get(`/farms/${farm._id}/invitations?page=0`).expect(422)
  })

  it('pages the invitations newest first with meta', async () => {
    const ctx = await seedOwnerFarm()
    const day = 86400_000
    await Invitation.insertMany(Array.from({ length: 3 }, (_, i) => ({
      farm_id: ctx.farm._id, invited_by: ctx.owner._id, invited_role: 'DOMAIN_EXPERT', invited_email: `d${i}@test.vn`,
      token: `t-page-${seq}-${i}`, status: 'DECLINED', expires_at: new Date(Date.now() + day), created_at: new Date(Date.now() - i * day),
    })))
    const first = await as(ctx.token).get(`/farms/${ctx.farm._id}/invitations?status=DECLINED&limit=2`).expect(200)
    expect(first.body.meta).toEqual({ total: 3, page: 1, limit: 2 })
    expect(first.body.data.map((row: { invited_email: string }) => row.invited_email)).toEqual(['d0@test.vn', 'd1@test.vn'])
    const second = await as(ctx.token).get(`/farms/${ctx.farm._id}/invitations?status=DECLINED&limit=2&page=2`).expect(200)
    expect(second.body.data.map((row: { invited_email: string }) => row.invited_email)).toEqual(['d2@test.vn'])
  })

  it('is only for the Primary Owner of the farm', async () => {
    const { farm } = await seedInvitations()
    const coOwner = await tokenOf('FARM_OWNER')
    const expert = await tokenOf('DOMAIN_EXPERT')
    farm.members.push({ user_id: coOwner.user._id, role: 'FARM_OWNER' } as never, { user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const stranger = await seedOwnerFarm()

    await as(coOwner.token).get(`/farms/${farm._id}/invitations`).expect(403)
    await as(expert.token).get(`/farms/${farm._id}/invitations`).expect(403)
    await as(stranger.token).get(`/farms/${farm._id}/invitations`).expect(403)
  })
})
