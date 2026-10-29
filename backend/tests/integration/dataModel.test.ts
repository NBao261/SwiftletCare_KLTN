/**
 * Data model sau đợt rà soát DB (SRS v1.23.0 §8.2): refresh token lưu hash + dọn token
 * hết hạn, Zone.farm_id, soft-delete phủ mọi truy vấn,
 * xoá farm huỷ lời mời còn chờ, threshold_history có giới hạn, migration chạy lại an toàn.
 */
import crypto from 'crypto'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import { loginUser, logoutUser, refreshAccessToken } from '@/services/auth.service'
import { createAccountFromInvitation, removeFarm, updateZoneThresholds } from '@/services/farm.service'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import { migrateDataModel } from '@/scripts/migrate-data-model.script'
import type { CurrentUser } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

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
  await Promise.all([
    AuditLog, Farm, HarvestBatch, House, Zone, Invitation, User,
  ].map(m => (m as typeof User).deleteMany({ is_deleted: { $in: [true, false, null] } })))
})

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
let seq = 0
const mkOwner = () => User.create({ email: `o${++seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
const asUser = (u: { _id: unknown; email: string }): CurrentUser => ({ _id: String(u._id), email: u.email, role: 'FARM_OWNER' })

async function mkFarm() {
  const owner = await mkOwner()
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  return { owner, farm, house, zone }
}

describe('refresh token', () => {
  it('chỉ lưu hash, mỗi lần đăng nhập 1 token riêng, dọn token hết hạn', async () => {
    const user = await mkOwner()
    await User.updateOne({ _id: user._id }, { $push: { refresh_tokens: { token_hash: 'old', expires: new Date(Date.now() - 1000) } } })

    const a = await loginUser({ email: user.email, password: 'password123' })
    const b = await loginUser({ email: user.email, password: 'password123' })
    expect(a.refreshToken).not.toBe(b.refreshToken)

    const saved = (await User.findById(user._id))!.refresh_tokens.map(t => t.token_hash)
    expect(saved).toEqual([sha256(a.refreshToken), sha256(b.refreshToken)])

    await expect(refreshAccessToken(a.refreshToken)).resolves.toHaveProperty('accessToken')
    await logoutUser(String(user._id), a.refreshToken)
    await expect(refreshAccessToken(a.refreshToken)).rejects.toThrow('thu hồi')
    await expect(refreshAccessToken(b.refreshToken)).resolves.toHaveProperty('accessToken')
  })
})

describe('schema', () => {
  it('Zone tự lấy farm_id từ House và không đổi được', async () => {
    const { farm, zone } = await mkFarm()
    expect(String(zone.farm_id)).toBe(String(farm._id))
    zone.farm_id = new mongoose.Types.ObjectId()
    await zone.save()
    expect(String((await Zone.findById(zone._id))!.farm_id)).toBe(String(farm._id))
  })

  it('soft-delete phủ findByIdAndUpdate/countDocuments, vẫn tra được khi ghi rõ is_deleted', async () => {
    const { farm, zone, owner } = await mkFarm()
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })

    expect(await Farm.findByIdAndUpdate(farm._id, { name: 'X' })).toBeNull()
    expect(await Farm.countDocuments({ _id: farm._id })).toBe(0)
    expect(await Farm.findOne({ _id: farm._id, is_deleted: true })).not.toBeNull()

    const batch = await HarvestBatch.create({
      farm_id: farm._id, zone_id: zone._id, created_by: owner._id, trace_code: `T${seq}`,
      harvest_date: new Date(), nest_count: 1, weight_grams: 1, nest_type: 'RAW', is_deleted: true,
    })
    expect(await HarvestBatch.findOne({ _id: batch._id })).toBeNull()
    expect(await HarvestBatch.findById(batch._id)).toBeNull()
  })
})

describe('xoá farm', () => {
  it('huỷ lời mời còn chờ — người được mời không tạo được tài khoản từ link nữa', async () => {
    const { farm, owner } = await mkFarm()
    await Invitation.create({
      farm_id: farm._id, invited_email: 'op@test.vn', invited_role: 'DOMAIN_EXPERT', invited_by: owner._id,
      token: 'tok', expires_at: new Date(Date.now() + 86400_000),
    })
    await removeFarm(String(farm._id), asUser(owner))

    expect((await Invitation.findOne({ token: 'tok' }))!.status).toBe('EXPIRED')
    await expect(createAccountFromInvitation('tok', { full_name: 'Op', password: 'password123' })).rejects.toMatchObject({ statusCode: 409 })
    expect(await User.exists({ email: 'op@test.vn' })).toBeNull()
  })
})

describe('threshold_history', () => {
  it(`giữ tối đa ${THRESHOLD_HISTORY_LIMIT} bản gần nhất`, async () => {
    const { owner, zone } = await mkFarm()
    const entry = { changed_by: owner._id, changed_at: new Date(), old_values: {}, new_values: {}, source: 'MANUAL' }
    await Zone.updateOne({ _id: zone._id }, { $push: { threshold_history: { $each: Array(THRESHOLD_HISTORY_LIMIT).fill(entry) } } })

    await updateZoneThresholds(String(zone._id), asUser(owner), { temp_max: 32 })
    const history = (await Zone.findById(zone._id))!.threshold_history
    expect(history).toHaveLength(THRESHOLD_HISTORY_LIMIT)
    expect(history[history.length - 1].new_values).toEqual({ temp_max: 32 })
  })
})

describe('migrate:data-model', () => {
  it('sửa dữ liệu cũ và chạy lại lần 2 không đổi gì', async () => {
    const { farm, house, owner } = await mkFarm()
    const db = mongoose.connection.db!
    const oldZone = await db.collection('zones').insertOne({ house_id: house._id, name: 'cũ' })
    const future = new Date(Date.now() + 86400_000)
    await db.collection('users').updateOne({ _id: owner._id }, {
      $set: { refresh_tokens: [{ token: 'raw.jwt.token', expires: future }, { token: 'x.y.z', expires: new Date(0) }] },
    })
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })
    await db.collection('invitations').insertOne({ farm_id: farm._id, status: 'PENDING', token: 'mig' })

    const first1 = await migrateDataModel()
    expect(first1).toMatchObject({ zones: 1, tokenUsers: 1, invitationsExpired: 1 })
    expect(String((await db.collection('zones').findOne({ _id: oldZone.insertedId }))!.farm_id)).toBe(String(farm._id))
    expect((await db.collection('users').findOne({ _id: owner._id }))!.refresh_tokens)
      .toEqual([{ token_hash: sha256('raw.jwt.token'), expires: future }])

    expect(await migrateDataModel()).toEqual({ zones: 0, tokenUsers: 0, tokensPruned: 0, invitationsExpired: 0 })
  })
})
