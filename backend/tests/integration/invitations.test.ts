/**
 * Lời mời thành viên farm (Flow 12, AUTH-FR-005/010) và tạo tài khoản từ link lời mời —
 * không còn đăng ký công khai hay đăng nhập bằng OTP (G-02, Report 3 §1.2).
 */
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import authRoutes from '@/routes/auth.route'
import invitationRoutes from '@/routes/invitations.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { migrateRemoveOtpLogin } from '@/scripts/migrate-remove-otp-login.script'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import { loginUser } from '@/services/auth.service'
import { acceptInvitation, createAccountFromInvitation, inviteMember } from '@/services/farm.service'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/invitations', invitationRoutes)
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
  await Promise.all([Farm.deleteMany({}), Invitation.deleteMany({}), User.deleteMany({})])
})

async function seed(role: 'FARM_OWNER', email = 'invitee@test.vn') {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({
    name: 'Farm', address: 'HCMC', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true, joined_at: new Date('2026-01-01') }],
  })
  const invitation = await Invitation.create({
    farm_id: farm._id, invited_email: email, invited_role: role, invited_by: owner._id,
    token: `tok-${role}`, expires_at: new Date(Date.now() + 86_400_000),
  })
  return { owner, farm, invitation }
}

describe('createAccountFromInvitation (AUTH-FR-010)', () => {
  const input = { full_name: 'Invitee', password: 'password123' }

  it('creates the account with the e-mail and role of the invitation and adds it to the farm', async () => {
    const { farm, invitation } = await seed('FARM_OWNER')

    const user = await createAccountFromInvitation(invitation.token, input)

    expect(user.email).toBe('invitee@test.vn')
    expect(user.role).toBe('FARM_OWNER')
    expect((await Invitation.findById(invitation._id))!.status).toBe('ACCEPTED')
    const member = (await Farm.findById(farm._id))!.members.find(m => String(m.user_id) === String(user._id))!
    expect(member.role).toBe('FARM_OWNER')
    // Đăng nhập được bằng mật khẩu vừa đặt (AUTH-FR-002)
    await expect(loginUser({ email: 'invitee@test.vn', password: 'password123' })).resolves.toMatchObject({ user: { role: 'FARM_OWNER' } })
  })

  it('rejects an expired, used or unknown link and an e-mail that already has an account', async () => {
    const { invitation } = await seed('FARM_OWNER')
    await expect(createAccountFromInvitation('no-such-token', input)).rejects.toMatchObject({ statusCode: 404 })

    await User.create({ email: 'invitee@test.vn', password_hash: 'password123', full_name: 'Has', role: 'FARM_OWNER' })
    await expect(createAccountFromInvitation(invitation.token, input)).rejects.toMatchObject({ statusCode: 409 })
    await User.deleteOne({ email: 'invitee@test.vn' })

    await Invitation.updateOne({ _id: invitation._id }, { expires_at: new Date(Date.now() - 1000) })
    await expect(createAccountFromInvitation(invitation.token, input)).rejects.toMatchObject({ statusCode: 409 })
    expect((await Invitation.findById(invitation._id))!.status).toBe('EXPIRED')
    await expect(createAccountFromInvitation(invitation.token, input)).rejects.toMatchObject({ statusCode: 409 })
    expect(await User.exists({ email: 'invitee@test.vn' })).toBeNull()
  })

  it('creates nothing when the farm of the invitation was deleted', async () => {
    const { farm, invitation } = await seed('FARM_OWNER')
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })

    await expect(createAccountFromInvitation(invitation.token, input)).rejects.toMatchObject({ statusCode: 404 })
    expect(await User.exists({ email: 'invitee@test.vn' })).toBeNull()
    expect((await Invitation.findById(invitation._id))!.status).toBe('PENDING')
  })

  it('POST /invitations/:token/create-account returns 201 without the password hash and validates the body', async () => {
    const { invitation } = await seed('FARM_OWNER')
    await request(app).post(`/invitations/${invitation.token}/create-account`).send({ full_name: 'X', password: 'short' }).expect(422)

    const res = await request(app).post(`/invitations/${invitation.token}/create-account`).send(input).expect(201)
    expect(res.body.data).toMatchObject({ email: 'invitee@test.vn', role: 'FARM_OWNER' })
    expect(res.body.data).not.toHaveProperty('password_hash')
  })
})

describe('no public sign-up and no OTP sign-in (Report 3 §1.2, §8)', () => {
  it.each(['/auth/register', '/auth/otp/send', '/auth/otp/verify'])('%s returns 404', async path => {
    await request(app).post(path).send({ email: 'a@test.vn', password: 'password123', full_name: 'A', otp: '123456' }).expect(404)
    expect(await User.countDocuments()).toBe(0)
  })

  it('migrate:remove-otp-login removes the old OTP fields and is safe to re-run', async () => {
    await mongoose.connection.db!.collection('users').insertOne({ email: 'old@test.vn', otp_code: 'h', otp_expires: new Date() })
    await expect(migrateRemoveOtpLogin()).resolves.toEqual({ usersUpdated: 1 })
    const doc = await mongoose.connection.db!.collection('users').findOne({ email: 'old@test.vn' })
    expect(doc).not.toHaveProperty('otp_code')
    expect(doc).not.toHaveProperty('otp_expires')
    await expect(migrateRemoveOtpLogin()).resolves.toEqual({ usersUpdated: 0 })
  })
})

describe('acceptInvitation', () => {
  it('adds the accepting user to the farm for a FARM_OWNER invitation', async () => {
    const { farm, invitation } = await seed('FARM_OWNER')
    const invitee = await User.create({ email: 'invitee@test.vn', password_hash: 'password123', full_name: 'Invitee', role: 'FARM_OWNER' })

    const result = await acceptInvitation(invitation.token, { _id: String(invitee._id), email: invitee.email, role: 'FARM_OWNER' } as never)

    expect(String(result._id)).toBe(String(farm._id))
    expect(result.members.some(m => String(m.user_id) === String(invitee._id))).toBe(true)
    expect((await Invitation.findById(invitation._id))!.status).toBe('ACCEPTED')
  })

})

describe('inviteMember', () => {
  it('still refuses a second pending FARM_OWNER invitation for the same email', async () => {
    const { owner, farm } = await seed('FARM_OWNER')
    await expect(inviteMember(String(farm._id), { _id: String(owner._id), role: 'FARM_OWNER' } as never, { email: 'invitee@test.vn' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })
})
