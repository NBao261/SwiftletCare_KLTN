/**
 * Lời mời thành viên farm (Flow 12, AUTH-FR-005/010).
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import { registerUser } from '@/services/auth.service'
import { acceptInvitation, inviteMember } from '@/services/farm.service'

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

describe('registerUser with a pending invitation', () => {
  it('auto-accepts a FARM_OWNER invitation and adds the new user to the farm', async () => {
    const { farm, invitation } = await seed('FARM_OWNER')

    const user = await registerUser({ email: 'Invitee@Test.vn', password: 'password123', full_name: 'Invitee' })

    expect(user.role).toBe('FARM_OWNER')
    expect((await Invitation.findById(invitation._id))!.status).toBe('ACCEPTED')
    const after = (await Farm.findById(farm._id))!
    expect(after.members.some(m => String(m.user_id) === String(user._id))).toBe(true)
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
    await expect(inviteMember(String(farm._id), { _id: String(owner._id), role: 'FARM_OWNER' } as never, 'invitee@test.vn'))
      .rejects.toMatchObject({ statusCode: 409 })
  })
})
