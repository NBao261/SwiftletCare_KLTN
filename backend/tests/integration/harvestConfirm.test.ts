/**
 * HARVEST-FR-001, 005, 006 — Farm Technician nhập lô ở nhà được giao (DRAFT), chỉ sửa/xoá lô DRAFT của mình,
 * chỉ xem lô của nhà được giao; Farm Owner nhập là CONFIRMED ngay và xác nhận lô của thợ (lần hai → 409,
 * thợ → 403); Domain Expert chỉ xem. migrate:harvest-confirmed xác nhận lô cũ của Farm Owner.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import harvestRoutes from '@/routes/harvests.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { migrateHarvestConfirmed } from '@/scripts/migrate-harvest-confirmed.script'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/harvests', harvestRoutes)
app.use(errorHandler)

useTestDb()

let seq = 0
async function tokenOf(role: Role) {
  seq++
  const user = await User.create({ email: `harvest${seq}@test.vn`, password_hash: 'password123', full_name: role, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

const batch = (zoneId: unknown) => ({ zone_id: String(zoneId), harvest_date: '2026-11-01', nest_count: 120, weight_grams: 950, nest_type: 'RAW' })

/** Farm có nhà H (zone của seedOwnerFarm) giao cho thợ A, nhà H2 không giao; thợ B cũng được giao H; 1 chuyên gia */
async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
  const [a, b, expert] = [await tokenOf('FARM_TECHNICIAN'), await tokenOf('FARM_TECHNICIAN'), await tokenOf('DOMAIN_EXPERT')]
  ctx.farm.members.push(
    { user_id: a.user._id, role: 'FARM_TECHNICIAN' } as never,
    { user_id: b.user._id, role: 'FARM_TECHNICIAN' } as never,
    { user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never,
  )
  await ctx.farm.save()
  house.technicians = [{ user_id: a.user._id, primary: true }, { user_id: b.user._id, primary: false }] as never
  await house.save()
  return { ...ctx, house2, zone2, a, b, expert, owner$: as(ctx.token), a$: as(a.token), b$: as(b.token), expert$: as(expert.token) }
}

describe('lô của Farm Technician và Farm Owner (HARVEST-FR-001, 006)', () => {
  it('a technician batch is DRAFT, only in assigned houses; an owner batch is CONFIRMED at once', async () => {
    const { zone, zone2, owner$, a$, expert$, owner } = await seed()

    const draft = (await a$.post('/harvests', batch(zone._id)).expect(201)).body.data
    expect(draft).toMatchObject({ status: 'DRAFT' })
    expect(draft.confirmed_at).toBeUndefined()
    await a$.post('/harvests', batch(zone2._id)).expect(403)

    const confirmed = (await owner$.post('/harvests', batch(zone._id)).expect(201)).body.data
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', confirmed_by: String(owner._id) })
    await expert$.post('/harvests', batch(zone._id)).expect(403)
  })

  it('the Farm Owner confirms a technician batch once; technicians and experts cannot confirm', async () => {
    const { zone, owner$, a$, expert$, owner, farm } = await seed()
    const draft = (await a$.post('/harvests', batch(zone._id)).expect(201)).body.data

    await a$.post(`/harvests/${draft._id}/confirm`).expect(403)
    await expert$.post(`/harvests/${draft._id}/confirm`).expect(403)
    const res = await owner$.post(`/harvests/${draft._id}/confirm`).expect(200)
    expect(res.body.data).toMatchObject({ status: 'CONFIRMED', confirmed_by: String(owner._id) })
    expect(await AuditLog.countDocuments({ action: 'HARVEST_CONFIRMED', farm_id: farm._id })).toBe(1)
    await owner$.post(`/harvests/${draft._id}/confirm`).expect(409)

    const other = await seedOwnerFarm()
    await as(other.token).post(`/harvests/${draft._id}/confirm`).expect(403)
  })
})

describe('sửa, xoá, xem theo nhà được giao (HARVEST-FR-005, AUTH-FR-013)', () => {
  it('a technician edits and deletes only their own DRAFT batch', async () => {
    const { zone, owner$, a$, b$ } = await seed()
    const mine = (await a$.post('/harvests', batch(zone._id)).expect(201)).body.data
    const theirs = (await b$.post('/harvests', batch(zone._id)).expect(201)).body.data
    const ownerBatch = (await owner$.post('/harvests', batch(zone._id)).expect(201)).body.data

    expect((await a$.put(`/harvests/${mine._id}`, { nest_count: 130 }).expect(200)).body.data.nest_count).toBe(130)
    await a$.put(`/harvests/${theirs._id}`, { nest_count: 1 }).expect(403)
    await a$.put(`/harvests/${ownerBatch._id}`, { nest_count: 1 }).expect(403)
    await a$.delete(`/harvests/${theirs._id}`).expect(403)

    await owner$.post(`/harvests/${mine._id}/confirm`).expect(200)
    await a$.put(`/harvests/${mine._id}`, { nest_count: 1 }).expect(403)
    await a$.delete(`/harvests/${mine._id}`).expect(403)
    // Farm Owner sửa và xoá mọi lô
    await owner$.put(`/harvests/${theirs._id}`, { nest_count: 99 }).expect(200)
    await owner$.delete(`/harvests/${theirs._id}`).expect(200)
  })

  it('a technician sees only the batches of assigned houses; the expert reads every batch of the farm', async () => {
    const { farm, zone, zone2, owner$, a$, expert$ } = await seed()
    const inHouse = (await owner$.post('/harvests', batch(zone._id)).expect(201)).body.data
    const elsewhere = (await owner$.post('/harvests', batch(zone2._id)).expect(201)).body.data

    const listed = (await a$.get(`/harvests?farmId=${farm._id}`).expect(200)).body.data as Array<{ _id: string }>
    expect(listed.map(b => b._id)).toEqual([inHouse._id])
    expect(((await a$.get('/harvests').expect(200)).body.data as unknown[]).length).toBe(1)
    await a$.get(`/harvests/${inHouse._id}`).expect(200)
    await a$.get(`/harvests/${elsewhere._id}`).expect(403)

    expect(((await expert$.get(`/harvests?farmId=${farm._id}`).expect(200)).body.data as unknown[]).length).toBe(2)
    const unassigned = await tokenOf('FARM_TECHNICIAN')
    expect((await as(unassigned.token).get('/harvests').expect(200)).body.data).toEqual([])
  })
})

describe('migrate:harvest-confirmed', () => {
  it('confirms old DRAFT batches entered by Farm Owners, keeps technician batches DRAFT, and is safe to re-run', async () => {
    const { farm, zone, owner, a } = await seed()
    const db = mongoose.connection.db!
    const createdAt = new Date('2026-10-01T00:00:00Z')
    const base = { farm_id: farm._id, zone_id: zone._id, harvest_date: createdAt, nest_count: 1, weight_grams: 1, nest_type: 'RAW', status: 'DRAFT', is_deleted: false, created_at: createdAt }
    const { insertedIds } = await db.collection('harvestbatches').insertMany([
      { ...base, trace_code: 'old-owner', created_by: owner._id },
      { ...base, trace_code: 'old-tech', created_by: a.user._id },
    ])

    expect(await migrateHarvestConfirmed()).toEqual({ batchesConfirmed: 1 })
    const ownerBatch = (await HarvestBatch.findById(insertedIds[0]).lean())!
    expect(ownerBatch).toMatchObject({ status: 'CONFIRMED', confirmed_at: createdAt })
    expect(String(ownerBatch.confirmed_by)).toBe(String(owner._id))
    expect((await HarvestBatch.findById(insertedIds[1]).lean())!.status).toBe('DRAFT')
    expect(await migrateHarvestConfirmed()).toEqual({ batchesConfirmed: 0 })
  })
})
