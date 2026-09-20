/**
 * Flow 16 bước 1e — Farm Owner yêu cầu gỡ Sales Staff, Admin duyệt/từ chối.
 * Kèm kiểm tra tương thích với request "thêm" cũ chưa có field `type`.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { SalesAssignmentRequest } from '@/models/salesAssignmentRequest.model'
import { User } from '@/models/user.model'
import { decideSalesStaffRequest, listSalesStaffRequests } from '@/services/admin.service'
import { requestSalesStaff, requestSalesStaffRemoval } from '@/services/farm.service'
import { notifyUser } from '@/services/notification.service'
import type { Role } from '@/types'

jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use('/farms', farmRoutes)
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
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), SalesAssignment.deleteMany({}),
    SalesAssignmentRequest.deleteMany({}), User.deleteMany({}),
  ])
})

const mkUser = (email: string, role: Role = 'FARM_OWNER') =>
  User.create({ email, password_hash: 'password123', full_name: email, role })
const asCurrent = (u: { _id: unknown; role: Role }) => ({ _id: String(u._id), role: u.role }) as never
const token = (u: { _id: unknown; role: Role }) =>
  jwt.sign({ sub: String(u._id), role: u.role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed() {
  const admin = await mkUser('admin@test.vn', 'ADMIN')
  const owner = await mkUser('owner@test.vn')
  const member = await mkUser('member@test.vn')
  const sales = await mkUser('sales@test.vn', 'SALES_STAFF')
  const farm = await Farm.create({
    name: 'Farm', address: 'HCMC', owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true, joined_at: new Date('2026-01-01') },
      { user_id: member._id, is_primary: false, joined_at: new Date('2026-02-01') },
    ],
  })
  await SalesAssignment.create({ farm_id: farm._id, sales_staff_id: sales._id, invited_by: admin._id })
  return { admin, owner, member, sales, farm }
}

describe('requestSalesStaffRemoval', () => {
  it('creates a PENDING REMOVE request carrying the staff id and email', async () => {
    const { owner, sales, farm } = await seed()

    const req = await requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id))

    expect(req.type).toBe('REMOVE')
    expect(req.status).toBe('PENDING')
    expect(String(req.sales_staff_id)).toBe(String(sales._id))
    expect(req.sales_staff_email).toBe('sales@test.vn')
    expect(String(req.requested_by)).toBe(String(owner._id))
    // chưa gỡ gì cả — chỉ Admin duyệt mới xoá
    expect(await SalesAssignment.countDocuments({ farm_id: farm._id })).toBe(1)
  })

  it('is limited to the Primary Owner', async () => {
    const { member, sales, farm } = await seed()
    await expect(requestSalesStaffRemoval(String(farm._id), asCurrent(member), String(sales._id)))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('answers 404 when that Sales Staff is not assigned to the farm', async () => {
    const { owner, farm } = await seed()
    const stranger = await mkUser('stranger@test.vn', 'SALES_STAFF')
    await expect(requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(stranger._id)))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not allow a second pending request for the same Sales Staff', async () => {
    const { owner, sales, farm } = await seed()
    await requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id))
    await expect(requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id)))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not collide with a pending ADD request for the same email', async () => {
    const { owner, sales, farm } = await seed()
    await SalesAssignmentRequest.create({ farm_id: farm._id, requested_by: owner._id, sales_staff_email: 'someone@test.vn' })
    await expect(requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id))).resolves.toBeDefined()
  })
})

describe('requestSalesStaff (ADD) stays compatible with requests created before `type` existed', () => {
  it('treats a legacy pending request without a type as an ADD duplicate', async () => {
    const { owner, farm } = await seed()
    await SalesAssignmentRequest.collection.insertOne({
      farm_id: farm._id, requested_by: owner._id, sales_staff_email: 'newbie@test.vn', status: 'PENDING', created_at: new Date(),
    })
    await expect(requestSalesStaff(String(farm._id), asCurrent(owner), 'newbie@test.vn')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('defaults new requests to ADD', async () => {
    const { owner, farm } = await seed()
    const req = await requestSalesStaff(String(farm._id), asCurrent(owner), 'newbie@test.vn')
    expect(req.type).toBe('ADD')
  })
})

describe('decideSalesStaffRequest — REMOVE', () => {
  async function pendingRemoval() {
    const ctx = await seed()
    const req = await requestSalesStaffRemoval(String(ctx.farm._id), asCurrent(ctx.owner), String(ctx.sales._id))
    return { ...ctx, req }
  }

  it('approving deletes the assignment (not the account), audits it with the request and tells the owner', async () => {
    const { admin, owner, sales, farm, req } = await pendingRemoval()

    const done = await decideSalesStaffRequest(String(admin._id), String(req._id), 'APPROVED')

    expect(done.status).toBe('APPROVED')
    expect(await SalesAssignment.countDocuments({ farm_id: farm._id, sales_staff_id: sales._id })).toBe(0)
    expect(await User.findById(sales._id)).not.toBeNull()

    const [audit] = await AuditLog.find({ action: 'SALES_STAFF_UNASSIGNED' }).lean()
    expect(audit.metadata).toMatchObject({ requestedVia: String(req._id) })
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: expect.stringContaining('gỡ Sales Staff đã được duyệt') }))
  })

  it('approving is fine when the assignment was already removed by an admin', async () => {
    const { admin, sales, farm, req } = await pendingRemoval()
    await SalesAssignment.deleteOne({ farm_id: farm._id, sales_staff_id: sales._id })

    await expect(decideSalesStaffRequest(String(admin._id), String(req._id), 'APPROVED')).resolves.toMatchObject({ status: 'APPROVED' })
  })

  it('does not require the farm to still exist to remove an assignment', async () => {
    const { admin, farm, req } = await pendingRemoval()
    await Farm.collection.updateOne({ _id: farm._id }, { $set: { is_deleted: true } })
    await expect(decideSalesStaffRequest(String(admin._id), String(req._id), 'APPROVED')).resolves.toBeDefined()
  })

  it('rejecting needs a reason, keeps the assignment and explains why to the owner', async () => {
    const { admin, owner, sales, farm, req } = await pendingRemoval()

    await expect(decideSalesStaffRequest(String(admin._id), String(req._id), 'REJECTED')).rejects.toMatchObject({ statusCode: 400 })
    await decideSalesStaffRequest(String(admin._id), String(req._id), 'REJECTED', 'Đang có đơn hàng dở')

    expect(await SalesAssignment.countDocuments({ farm_id: farm._id, sales_staff_id: sales._id })).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ body: expect.stringContaining('Đang có đơn hàng dở') }))
  })
})

describe('listSalesStaffRequests — type filter', () => {
  it('separates ADD (including legacy untyped) from REMOVE', async () => {
    const { owner, sales, farm } = await seed()
    await SalesAssignmentRequest.collection.insertOne({
      farm_id: farm._id, requested_by: owner._id, sales_staff_email: 'legacy@test.vn', status: 'PENDING', created_at: new Date(),
    })
    await requestSalesStaff(String(farm._id), asCurrent(owner), 'newbie@test.vn')
    await requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id))

    const add = await listSalesStaffRequests({ type: 'ADD' })
    const remove = await listSalesStaffRequests({ type: 'REMOVE' })
    const all = await listSalesStaffRequests({})

    expect(add.total).toBe(2)
    expect(remove.total).toBe(1)
    expect(all.total).toBe(3)
  })
})

describe('HTTP', () => {
  it('lets the primary Farm Owner request a removal (201)', async () => {
    const { owner, sales, farm } = await seed()
    const res = await request(app)
      .post(`/farms/${farm._id}/sales-staff/${sales._id}/removal-requests`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(201)
    expect(res.body.data).toMatchObject({ type: 'REMOVE', status: 'PENDING' })
  })

  it('does not let an Admin use the Farm Owner endpoint (403) — Admin removes directly instead', async () => {
    const { admin, sales, farm } = await seed()
    await request(app)
      .post(`/farms/${farm._id}/sales-staff/${sales._id}/removal-requests`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .expect(403)
  })

  it('validates ids (422)', async () => {
    const { owner, farm } = await seed()
    await request(app)
      .post(`/farms/${farm._id}/sales-staff/not-an-id/removal-requests`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(422)
  })

  it('shows the owner the request status via the existing list endpoint', async () => {
    const { owner, sales, farm } = await seed()
    await request(app).post(`/farms/${farm._id}/sales-staff/${sales._id}/removal-requests`).set('Authorization', `Bearer ${token(owner)}`)
    const res = await request(app).get(`/farms/${farm._id}/sales-staff-requests`).set('Authorization', `Bearer ${token(owner)}`).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].type).toBe('REMOVE')
  })

  it('lets an Admin filter the queue by type and validates the value', async () => {
    const { admin, owner, sales, farm } = await seed()
    await requestSalesStaffRemoval(String(farm._id), asCurrent(owner), String(sales._id))

    const res = await request(app).get('/admin/sales-staff-requests?type=REMOVE').set('Authorization', `Bearer ${token(admin)}`).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].sales_staff_id).toMatchObject({ email: 'sales@test.vn' })

    await request(app).get('/admin/sales-staff-requests?type=WHATEVER').set('Authorization', `Bearer ${token(admin)}`).expect(422)
  })
})
