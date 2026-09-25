/**
 * admin.service — khoá tài khoản, xoá tài khoản theo yêu cầu (cascade, ticket dở, chạy lại).
 * Chạy trên MongoDB in-memory.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { completeDeletionRequest, setUserStatus } from '@/services/admin.service'
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

let mongod: MongoMemoryServer
const oid = () => new mongoose.Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.init()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}),
    Invitation.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}),
  ])
})

const mkUser = (email: string, role: 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN' = 'FARM_OWNER', extra: object = {}) =>
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

  it('stays re-runnable when reading the audit totals fails, because that happens before the anonymization', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
    jest.spyOn(AuditLog, 'countDocuments').mockRejectedValueOnce(new Error('DB blip') as never)

    await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).rejects.toThrow('DB blip')

    const untouched = (await User.findById(leaver._id))!
    expect(untouched.email).toBe('leaver@test.vn')
    expect(untouched.deletion_requested_at).toBeInstanceOf(Date)

    await expect(completeDeletionRequest(String(admin._id), String(leaver._id))).resolves.toBeDefined()
    expect(await auditActions('ACCOUNT_DELETED')).toHaveLength(1)
  })

  describe('clean-up of records pointing at the deleted user', () => {
    it('marks the account deleted so it can no longer be locked or unlocked', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)

      const user = await completeDeletionRequest(String(admin._id), String(leaver._id))

      expect(user.deleted_at).toBeInstanceOf(Date)
      await expect(setUserStatus(String(admin._id), String(leaver._id), true)).rejects.toMatchObject({ statusCode: 409 })
      expect((await User.findById(leaver._id))!.is_active).toBe(false)
    })

    it('expires the pending invitations the deleted user had sent', async () => {
      const admin = await mkUser('admin@test.vn', 'ADMIN')
      const leaver = await mkUser('leaver@test.vn', 'FARM_OWNER', requested)
      const other = await mkUser('other@test.vn')
      const inv = (invitedBy: unknown, token: string) => Invitation.create({
        farm_id: oid(), invited_email: `${token}@test.vn`, invited_role: 'FARM_OWNER', invited_by: invitedBy,
        token, expires_at: new Date(Date.now() + 86_400_000),
      })
      const mine = await inv(leaver._id, 'mine')
      const theirs = await inv(other._id, 'theirs')

      await completeDeletionRequest(String(admin._id), String(leaver._id))

      expect((await Invitation.findById(mine._id))!.status).toBe('EXPIRED')
      expect((await Invitation.findById(theirs._id))!.status).toBe('PENDING')
    })
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
