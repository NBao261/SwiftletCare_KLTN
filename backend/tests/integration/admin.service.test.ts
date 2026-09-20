/**
 * admin.service — khoá tài khoản, xoá tài khoản theo yêu cầu (cascade, ticket dở, chạy lại),
 * tạo Sales Staff, duyệt đề xuất Sales Staff. Chạy trên MongoDB in-memory.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { SalesAssignmentRequest } from '@/models/salesAssignmentRequest.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import {
  completeDeletionRequest, createSalesStaff, decideSalesStaffRequest, setUserStatus, unassignSalesStaff,
} from '@/services/admin.service'
import { forgotPassword } from '@/services/auth.service'
import { notifyUser } from '@/services/notification.service'
import { disconnectUser } from '@/socket'

jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/socket', () => ({
  ...jest.requireActual('@/socket'),
  disconnectUser: jest.fn(),
}))
jest.mock('@/services/auth.service', () => ({
  ...jest.requireActual('@/services/auth.service'),
  forgotPassword: jest.fn().mockResolvedValue(undefined),
}))

let mongod: MongoMemoryServer
const oid = () => new mongoose.Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([User.init(), SalesAssignment.init()])
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), SalesAssignment.deleteMany({}),
    SalesAssignmentRequest.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}),
  ])
})

const mkUser = (email: string, role: 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN' | 'SALES_STAFF' = 'FARM_OWNER', extra: object = {}) =>
  User.create({ email, password_hash: 'password123', full_name: email, role, ...extra })

const mkFarm = (owner: { _id: unknown }, others: Array<{ user: { _id: unknown }; joined: string }> = [], extra: object = {}) =>
  Farm.create({
    name: 'Farm', address: 'HCMC', owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true, joined_at: new Date('2026-01-01') },
      ...others.map(o => ({ user_id: o.user._id, is_primary: false, joined_at: new Date(o.joined) })),
    ],
    ...extra,
  })

const mkTicket = (farmId: unknown, extra: object = {}) =>
  Ticket.create({ farm_id: farmId, type: 'OTHER', priority: 'P3', ...extra })

const auditActions = async (action: string) => AuditLog.find({ action }).lean()

// ── setUserStatus ──────────────────────────────────────────────────────────────
describe('setUserStatus', () => {
  it('locks with a trimmed reason, revokes refresh tokens, drops live sockets and audits', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const target = await mkUser('victim@test.vn', 'FARM_OWNER', { refresh_tokens: [{ token: 't', expires: new Date(Date.now() + 1e6) }] })

    const { user } = await setUserStatus(String(admin._id), String(target._id), false, '  Spam đơn hàng  ')

    expect(user.is_active).toBe(false)
    expect(user.deactivated_reason).toBe('Spam đơn hàng')
    expect(user.deactivated_at).toBeInstanceOf(Date)
    expect(user.refresh_tokens).toHaveLength(0)
    expect(disconnectUser).toHaveBeenCalledWith(String(target._id))
    expect(await auditActions('ACCOUNT_LOCKED')).toHaveLength(1)
  })

  it('requires a reason to lock', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const target = await mkUser('victim@test.vn')
    await expect(setUserStatus(String(admin._id), String(target._id), false, '   ')).rejects.toMatchObject({ statusCode: 400 })
    expect(disconnectUser).not.toHaveBeenCalled()
  })

  it('unlocks without a reason, clears lock fields and keeps sockets alone', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const target = await mkUser('victim@test.vn', 'FARM_OWNER', { is_active: false, deactivated_reason: 'x', deactivated_at: new Date() })

    const { user } = await setUserStatus(String(admin._id), String(target._id), true)

    expect(user.is_active).toBe(true)
    expect(user.deactivated_reason).toBeUndefined()
    expect(disconnectUser).not.toHaveBeenCalled()
    expect(await auditActions('ACCOUNT_UNLOCKED')).toHaveLength(1)
  })

  it('refuses self-lock', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    await expect(setUserStatus(String(admin._id), String(admin._id), false, 'x')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('reports open tickets when locking a technician that still has assigned work', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'TECHNICIAN')
    const owner = await mkUser('owner@test.vn')
    const farm = await mkFarm(owner)
    await mkTicket(farm._id, { assigned_to: tech._id, status: 'IN_PROGRESS' })
    await mkTicket(farm._id, { assigned_to: tech._id, status: 'NEW' })
    await mkTicket(farm._id, { assigned_to: tech._id, status: 'CLOSED' })

    const result = await setUserStatus(String(admin._id), String(tech._id), false, 'Nghỉ việc')

    expect(result.openTickets).toBe(2)
  })

  it('omits openTickets when the technician has none', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'TECHNICIAN')
    const result = await setUserStatus(String(admin._id), String(tech._id), false, 'Nghỉ việc')
    expect(result.openTickets).toBeUndefined()
  })
})

// ── completeDeletionRequest ───────────────────────────────────────────────────
describe('completeDeletionRequest', () => {
  const requested = { deletion_requested_at: new Date() }

  it('rejects when the user never asked for deletion', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const user = await mkUser('user@test.vn')
    await expect(completeDeletionRequest(String(admin._id), String(user._id))).rejects.toMatchObject({ statusCode: 400 })
  })

  it("refuses to process an admin's own deletion request", async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN', requested)
    await expect(completeDeletionRequest(String(admin._id), String(admin._id))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('transfers a shared farm to the member who joined earliest and audits it', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    const late = await mkUser('late@test.vn')
    const early = await mkUser('early@test.vn')
    const farm = await mkFarm(leaver, [{ user: late, joined: '2026-03-01' }, { user: early, joined: '2026-02-01' }])

    await completeDeletionRequest(String(admin._id), String(leaver._id))

    const after = (await Farm.findById(farm._id))!
    expect(String(after.owner_id)).toBe(String(early._id))
    expect(after.members.map(m => String(m.user_id)).sort()).toEqual([String(early._id), String(late._id)].sort())
    expect(after.members.find(m => String(m.user_id) === String(early._id))!.is_primary).toBe(true)
    expect(after.members.find(m => String(m.user_id) === String(late._id))!.is_primary).toBe(false)

    const [audit] = await auditActions('FARM_OWNERSHIP_TRANSFERRED')
    expect(audit.metadata).toMatchObject({ fromUserId: String(leaver._id), toUserId: String(early._id) })
    expect(notifyUser).toHaveBeenCalledWith(String(early._id), expect.objectContaining({ title: expect.stringContaining('chủ sở hữu') }))
  })

  it('soft-deletes a farm nobody else belongs to and counts each outcome separately', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    const other = await mkUser('other@test.vn')
    const soleFarm = await mkFarm(leaver)
    const sharedFarm = await mkFarm(leaver, [{ user: other, joined: '2026-02-01' }])

    await completeDeletionRequest(String(admin._id), String(leaver._id))

    expect((await Farm.collection.findOne({ _id: soleFarm._id }))!.is_deleted).toBe(true)
    expect(String((await Farm.findById(sharedFarm._id))!.owner_id)).toBe(String(other._id))
    expect(await auditActions('FARM_SOFT_DELETED')).toHaveLength(1)

    const [done] = await auditActions('ACCOUNT_DELETED')
    expect(done.metadata).toMatchObject({ farmsTransferred: 1, farmsDeleted: 1, forced: false })
  })

  it('removes the user from farms they only belong to as a plain member', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    const owner = await mkUser('owner@test.vn')
    const farm = await mkFarm(owner, [{ user: leaver, joined: '2026-02-01' }])

    await completeDeletionRequest(String(admin._id), String(leaver._id))

    const after = (await Farm.findById(farm._id))!
    expect(String(after.owner_id)).toBe(String(owner._id))
    expect(after.members.some(m => String(m.user_id) === String(leaver._id))).toBe(false)
  })

  it('anonymizes PII, closes the request, revokes sessions and drops sockets', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', {
      ...requested, phone: '0900000000', avatar_url: 'http://x/y.png',
      refresh_tokens: [{ token: 't', expires: new Date(Date.now() + 1e6) }],
    })

    const user = await completeDeletionRequest(String(admin._id), String(leaver._id))

    expect(user.email).toBe(`deleted-${String(leaver._id)}@swiftletcare.local`)
    expect(user.phone).toBeUndefined()
    expect(user.avatar_url).toBeUndefined()
    expect(user.full_name).toBe('Tài khoản đã xoá')
    expect(user.is_active).toBe(false)
    expect(user.refresh_tokens).toHaveLength(0)
    expect(user.deletion_requested_at).toBeUndefined()
    expect(disconnectUser).toHaveBeenCalledWith(String(leaver._id))

    // đã rời hàng đợi: xử lý lần 2 bị từ chối thay vì chạy lại cascade
    await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sends the final notice to the old email only after the anonymization has been saved', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)

    await completeDeletionRequest(String(admin._id), String(leaver._id))

    expect(notifyUser).toHaveBeenCalledWith(
      String(leaver._id),
      expect.objectContaining({ title: 'Tài khoản của bạn đã được xoá' }),
      { email: 'leaver@test.vn', emailOnly: true },
    )
  })

  it('does not announce the deletion when saving the anonymization fails, and announces exactly once after a re-run', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    const finalNotices = () =>
      (notifyUser as jest.Mock).mock.calls.filter(c => c[1].title === 'Tài khoản của bạn đã được xoá')

    const saveSpy = jest.spyOn(User.prototype, 'save').mockImplementationOnce((() => Promise.reject(new Error('DB blip'))) as never)
    await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).rejects.toThrow('DB blip')

    expect(finalNotices()).toHaveLength(0)
    expect((await User.findById(leaver._id))!.email).toBe('leaver@test.vn')
    expect((await User.findById(leaver._id))!.deletion_requested_at).toBeInstanceOf(Date)

    saveSpy.mockRestore()
    await completeDeletionRequest(String(admin._id), String(leaver._id))
    expect(finalNotices()).toHaveLength(1)
  })

  describe('open tickets (Flow 19 bước 7c)', () => {
    it('answers 409 HAS_OPEN_TICKETS with the count and changes nothing', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const tech = await mkUser('tech@test.vn', 'TECHNICIAN', requested)
      const owner = await mkUser('owner@test.vn')
      const farm = await mkFarm(owner)
      await mkTicket(farm._id, { assigned_to: tech._id, status: 'IN_PROGRESS' })

      await expect(completeDeletionRequest(String(admin._id), String(tech._id))).rejects.toMatchObject({
        statusCode: 409, code: 'HAS_OPEN_TICKETS', details: { openTickets: 1 },
      })

      const still = (await User.findById(tech._id))!
      expect(still.email).toBe('tech@test.vn')
      expect(still.deletion_requested_at).toBeInstanceOf(Date)
      expect(await auditActions('ACCOUNT_DELETED')).toHaveLength(0)
    })

    it('counts tickets the user created and tickets of a farm that would be soft-deleted', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
      const soleFarm = await mkFarm(leaver)
      await mkTicket(soleFarm._id, { status: 'NEW' })                        // farm sẽ bị xoá mềm
      await mkTicket(oid(), { created_by: leaver._id, status: 'IN_PROGRESS' }) // ticket do user tạo

      await expect(completeDeletionRequest(String(admin._id), String(leaver._id)))
        .rejects.toMatchObject({ code: 'HAS_OPEN_TICKETS', details: { openTickets: 2 } })
    })

    it('does not block on closed tickets or on tickets of a farm that survives the transfer', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
      const other = await mkUser('other@test.vn')
      const sharedFarm = await mkFarm(leaver, [{ user: other, joined: '2026-02-01' }])
      await mkTicket(sharedFarm._id, { status: 'NEW' })
      await mkTicket(oid(), { created_by: leaver._id, status: 'CLOSED' })

      await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).resolves.toBeDefined()
    })

    it('proceeds with force and records it in the audit log', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const tech = await mkUser('tech@test.vn', 'TECHNICIAN', requested)
      await mkTicket(oid(), { assigned_to: tech._id, status: 'IN_PROGRESS' })

      await completeDeletionRequest(String(admin._id), String(tech._id), { force: true })

      expect((await User.findById(tech._id))!.email).toBe(`deleted-${String(tech._id)}@swiftletcare.local`)
      const [done] = await auditActions('ACCOUNT_DELETED')
      expect(done.metadata).toMatchObject({ forced: true })
    })
  })

  it('can be re-run after failing midway without repeating finished farms', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    const other = await mkUser('other@test.vn')
    await mkFarm(leaver, [{ user: other, joined: '2026-02-01' }])
    await mkFarm(leaver, [{ user: other, joined: '2026-02-01' }])

    const realSave = Farm.prototype.save
    let calls = 0
    jest.spyOn(Farm.prototype, 'save').mockImplementation(function (this: unknown, ...args: never[]) {
      calls++
      if (calls === 2) return Promise.reject(new Error('DB blip'))
      return realSave.apply(this as never, args as never)
    } as never)

    await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).rejects.toThrow('DB blip')

    // Sau lần lỗi: 1 farm đã chuyển, tài khoản vẫn còn trong hàng đợi và chưa bị ẩn danh
    expect(await auditActions('FARM_OWNERSHIP_TRANSFERRED')).toHaveLength(1)
    expect((await User.findById(leaver._id))!.deletion_requested_at).toBeInstanceOf(Date)
    expect((await User.findById(leaver._id))!.email).toBe('leaver@test.vn')

    jest.restoreAllMocks()
    await completeDeletionRequest(String(admin._id), String(leaver._id))

    expect(await auditActions('FARM_OWNERSHIP_TRANSFERRED')).toHaveLength(2)
    const [done] = await auditActions('ACCOUNT_DELETED')
    expect(done.metadata).toMatchObject({ farmsTransferred: 2, farmsDeleted: 0 }) // tổng qua cả 2 lần chạy, lấy từ audit từng farm
    expect(await Farm.countDocuments({ owner_id: leaver._id })).toBe(0)
  })
})

// ── createSalesStaff ──────────────────────────────────────────────────────────
describe('createSalesStaff', () => {
  const input = { email: 'sales@test.vn', password: 'password123', full_name: 'Sales' }

  it('creates the account and one assignment per distinct farm', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const owner = await mkUser('owner@test.vn')
    const farm = await mkFarm(owner)
    const farm2 = await mkFarm(owner)

    const user = await createSalesStaff(String(admin._id), {
      ...input, farm_ids: [String(farm._id), String(farm2._id), String(farm._id)],
    })

    expect(user.role).toBe('SALES_STAFF')
    expect(await SalesAssignment.countDocuments({ sales_staff_id: user._id })).toBe(2)
  })

  it('fails with 404 for a well-formed but unknown farm id and creates nothing', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const owner = await mkUser('owner@test.vn')
    const farm = await mkFarm(owner)
    const ghost = String(oid())

    await expect(createSalesStaff(String(admin._id), { ...input, farm_ids: [String(farm._id), ghost] }))
      .rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining(ghost) })

    expect(await User.countDocuments({ email: 'sales@test.vn' })).toBe(0)
    expect(await SalesAssignment.countDocuments()).toBe(0)
  })

  it('rejects a soft-deleted farm', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const owner = await mkUser('owner@test.vn')
    const deleted = await mkFarm(owner, [], { is_deleted: true })

    await expect(createSalesStaff(String(admin._id), { ...input, farm_ids: [String(deleted._id)] }))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(await User.countDocuments({ email: 'sales@test.vn' })).toBe(0)
  })

  it('rejects an email that is already registered', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    await mkUser('sales@test.vn')
    await expect(createSalesStaff(String(admin._id), { ...input, farm_ids: [String(oid())] })).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ── unassignSalesStaff ────────────────────────────────────────────────────────
describe('unassignSalesStaff', () => {
  it('removes only the assignment for that farm and audits it', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const sales = await mkUser('sales@test.vn', 'SALES_STAFF')
    const farmA = oid()
    const farmB = oid()
    await SalesAssignment.create([
      { farm_id: farmA, sales_staff_id: sales._id, invited_by: admin._id },
      { farm_id: farmB, sales_staff_id: sales._id, invited_by: admin._id },
    ])

    await unassignSalesStaff(String(admin._id), String(farmA), String(sales._id))

    expect(await SalesAssignment.countDocuments({ farm_id: farmA })).toBe(0)
    expect(await SalesAssignment.countDocuments({ farm_id: farmB })).toBe(1)
    expect(await User.findById(sales._id)).not.toBeNull()
    expect(await auditActions('SALES_STAFF_UNASSIGNED')).toHaveLength(1)
  })

  it('answers 404 when there is no such assignment', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    await expect(unassignSalesStaff(String(admin._id), String(oid()), String(oid()))).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── decideSalesStaffRequest ───────────────────────────────────────────────────
describe('decideSalesStaffRequest', () => {
  async function seed(email = 'newsales@test.vn') {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const owner = await mkUser('owner@test.vn')
    const farm = await mkFarm(owner)
    const request = await SalesAssignmentRequest.create({ farm_id: farm._id, requested_by: owner._id, sales_staff_email: email })
    return { admin, owner, farm, request }
  }

  it('approving creates the Sales Staff, the traced assignment, sends a reset code and notifies the requester', async () => {
    const { admin, owner, farm, request } = await seed()

    const done = await decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED')

    expect(done.status).toBe('APPROVED')
    expect(String(done.reviewed_by)).toBe(String(admin._id))
    expect(done.reviewed_at).toBeInstanceOf(Date)

    const staff = (await User.findOne({ email: 'newsales@test.vn' }))!
    expect(staff.role).toBe('SALES_STAFF')
    expect(forgotPassword).toHaveBeenCalledWith('newsales@test.vn')

    const assignment = (await SalesAssignment.findOne({ farm_id: farm._id, sales_staff_id: staff._id }))!
    expect(String(assignment.requested_via)).toBe(String(request._id))
    expect(String(assignment.invited_by)).toBe(String(owner._id))

    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: expect.stringContaining('được duyệt') }))
    expect(await auditActions('SALES_STAFF_REQUEST_APPROVED')).toHaveLength(1)
  })

  it('reuses an existing Sales Staff account instead of creating another', async () => {
    const { admin, request } = await seed('existing@test.vn')
    const existing = await mkUser('existing@test.vn', 'SALES_STAFF')

    await decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED')

    expect(await User.countDocuments({ email: 'existing@test.vn' })).toBe(1)
    expect(await SalesAssignment.countDocuments({ sales_staff_id: existing._id })).toBe(1)
    expect(forgotPassword).not.toHaveBeenCalled()
  })

  it('refuses to turn a Farm Owner or Technician into Sales Staff and leaves the request pending', async () => {
    const { admin, request } = await seed('techie@test.vn')
    await mkUser('techie@test.vn', 'TECHNICIAN')

    await expect(decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED')).rejects.toMatchObject({ statusCode: 409 })
    expect((await SalesAssignmentRequest.findById(request._id))!.status).toBe('PENDING')
  })

  it('refuses to approve when the farm no longer exists', async () => {
    const { admin, farm, request } = await seed()
    await Farm.collection.updateOne({ _id: farm._id }, { $set: { is_deleted: true } })

    await expect(decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED')).rejects.toMatchObject({ statusCode: 409 })
    expect(await User.countDocuments({ email: 'newsales@test.vn' })).toBe(0)
  })

  it('rejecting requires a reason and tells the farm owner why', async () => {
    const { admin, owner, request } = await seed()

    await expect(decideSalesStaffRequest(String(admin._id), String(request._id), 'REJECTED', '  ')).rejects.toMatchObject({ statusCode: 400 })

    const done = await decideSalesStaffRequest(String(admin._id), String(request._id), 'REJECTED', 'Email không thuộc công ty')

    expect(done.status).toBe('REJECTED')
    expect(done.review_note).toBe('Email không thuộc công ty')
    expect(await SalesAssignment.countDocuments()).toBe(0)
    expect(await User.countDocuments({ email: 'newsales@test.vn' })).toBe(0)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({
      title: expect.stringContaining('từ chối'), body: expect.stringContaining('Email không thuộc công ty'),
    }))
  })

  it('does not decide the same request twice', async () => {
    const { admin, request } = await seed()
    await decideSalesStaffRequest(String(admin._id), String(request._id), 'REJECTED', 'no')
    await expect(decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('never leaves an approval half-applied when a rejection races it', async () => {
    const { admin, owner, farm } = await seed('unused@test.vn')
    for (let i = 0; i < 6; i++) {
      const email = `racer${i}@test.vn`
      const req = await SalesAssignmentRequest.create({ farm_id: farm._id, requested_by: owner._id, sales_staff_email: email })

      const results = await Promise.allSettled([
        decideSalesStaffRequest(String(admin._id), String(req._id), 'APPROVED'),
        decideSalesStaffRequest(String(admin._id), String(req._id), 'REJECTED', 'no'),
      ])

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      const finalStatus = (await SalesAssignmentRequest.findById(req._id))!.status
      const assignments = await SalesAssignment.countDocuments({ requested_via: req._id })
      const account = await User.findOne({ email })
      if (finalStatus === 'APPROVED') {
        expect(assignments).toBe(1)
        expect(account).not.toBeNull()
      } else {
        expect(finalStatus).toBe('REJECTED')
        expect(assignments).toBe(0)
        expect(account).toBeNull() // người thua không được để lại tài khoản/phân công mồ côi
      }
    }
  })

  it('never removes an assignment for a removal request that was rejected in the race', async () => {
    const { admin, owner, sales, farm } = await (async () => {
      const ctx = await seed('unused@test.vn')
      const sales = await mkUser('sales@test.vn', 'SALES_STAFF')
      await SalesAssignment.create({ farm_id: ctx.farm._id, sales_staff_id: sales._id, invited_by: ctx.admin._id })
      return { ...ctx, sales }
    })()
    for (let i = 0; i < 4; i++) {
      // dựng lại phân công mỗi vòng để vòng sau vẫn có thứ để gỡ
      await SalesAssignment.updateOne(
        { farm_id: farm._id, sales_staff_id: sales._id },
        { $setOnInsert: { invited_by: admin._id } }, { upsert: true },
      )
      const req = await SalesAssignmentRequest.create({
        farm_id: farm._id, type: 'REMOVE', requested_by: owner._id, sales_staff_id: sales._id, sales_staff_email: 'sales@test.vn',
      })

      await Promise.allSettled([
        decideSalesStaffRequest(String(admin._id), String(req._id), 'APPROVED'),
        decideSalesStaffRequest(String(admin._id), String(req._id), 'REJECTED', 'no'),
      ])

      const finalStatus = (await SalesAssignmentRequest.findById(req._id))!.status
      const stillAssigned = await SalesAssignment.countDocuments({ farm_id: farm._id, sales_staff_id: sales._id })
      expect(stillAssigned).toBe(finalStatus === 'APPROVED' ? 0 : 1)
    }
  })

  it('lets exactly one of two concurrent approvals win', async () => {
    const { admin, request } = await seed()

    const results = await Promise.allSettled([
      decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED'),
      decideSalesStaffRequest(String(admin._id), String(request._id), 'APPROVED'),
    ])

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const loser = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')!
    expect(loser.reason).toMatchObject({ statusCode: 409 })
    expect(await User.countDocuments({ email: 'newsales@test.vn' })).toBe(1)
    expect(await SalesAssignment.countDocuments()).toBe(1)
    expect(await auditActions('SALES_STAFF_REQUEST_APPROVED')).toHaveLength(1)
  })
})
