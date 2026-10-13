/**
 * npm run migrate:scope-v2 — dữ liệu theo phạm vi cũ (Farm Operator, BIRD_PANIC, relay
 * sưởi, Marketplace) được đưa về SRS v2.0.0; chạy lại lần 2 không đổi gì.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import { migrateScopeV2 } from '@/scripts/migrate-scope-v2.script'

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

it('đổi dữ liệu cũ về phạm vi v2 và chạy lại lần 2 không đổi gì', async () => {
  const db = mongoose.connection.db!
  const id = () => new mongoose.Types.ObjectId()
  const [ownerId, operatorId, farmId, zoneId, nodeId, listedId, draftId] = [id(), id(), id(), id(), id(), id(), id()]

  // Ghi thẳng collection như DB chạy bản v1.24.0 — model mới sẽ từ chối các giá trị này
  await db.collection('users').insertMany([
    { _id: ownerId, email: 'owner@test.vn', role: 'FARM_OWNER', password_hash: 'x', full_name: 'O' },
    { _id: operatorId, email: 'op@test.vn', role: 'FARM_OPERATOR', password_hash: 'x', full_name: 'Op' },
  ])
  await db.collection('farms').insertOne({
    _id: farmId, name: 'F', address: 'x', owner_id: ownerId, is_deleted: false,
    members: [
      { user_id: ownerId, role: 'FARM_OWNER', is_primary: true, zone_ids: [] },
      { user_id: operatorId, role: 'FARM_OPERATOR', is_primary: false, zone_ids: [zoneId] },
    ],
  })
  await db.collection('invitations').insertOne({
    farm_id: farmId, invited_email: 'new@test.vn', invited_role: 'FARM_OPERATOR', zone_ids: [zoneId],
    invited_by: ownerId, token: 't1', status: 'PENDING', expires_at: new Date(Date.now() + 86400_000),
  })
  await db.collection('ticketmessages').insertOne({ ticket_id: id(), sender_id: operatorId, sender_role: 'FARM_OPERATOR', content: 'hi' })
  await db.collection('alerts').insertMany([
    { farm_id: farmId, zone_id: zoneId, type: 'BIRD_PANIC', severity: 'MEDIUM', title: 't', message: 'm', status: 'ACTIVE' },
    { farm_id: farmId, zone_id: zoneId, type: 'PUMP_DRY', severity: 'MEDIUM', title: 't', message: 'm', status: 'ACTIVE' },
  ])
  await db.collection('sensornodes').insertOne({
    _id: nodeId, device_id: 'ESP-1', zone_id: zoneId, status: 'ONLINE',
    relay_states: { misting: true, speaker: false, ventilation: false, heating: false },
  })
  await db.collection('harvestbatches').insertMany([
    { _id: listedId, farm_id: farmId, zone_id: zoneId, trace_code: 'L1', status: 'LISTED', listing_id: id(), is_deleted: false },
    { _id: draftId, farm_id: farmId, zone_id: zoneId, trace_code: 'D1', status: 'DRAFT', is_deleted: false },
  ])
  await db.collection('nestlistings').insertOne({ harvest_batch_id: listedId, title: 'x' })
  await db.collection('contactinquiries').insertOne({ message: 'hi' })

  expect(await migrateScopeV2()).toEqual({
    users: 1, farms: 1, invitations: 1, ticketMessages: 1, zoneScopesRemoved: 2,
    alerts: 1, heatingRemoved: 1, harvests: 1, collectionsDropped: 2,
  })

  // Sau migration, model mới đọc và save được mọi bản ghi
  const operator = (await User.findById(operatorId))!
  expect(operator.role).toBe('DOMAIN_EXPERT')
  const farm = (await Farm.findById(farmId))!
  expect(farm.members.map(m => m.role)).toEqual(['FARM_OWNER', 'DOMAIN_EXPERT'])
  expect((await db.collection('farms').findOne({ _id: farmId }))!.members.every((m: object) => !('zone_ids' in m))).toBe(true)
  await expect(farm.save()).resolves.toBeDefined()

  const invitation = (await Invitation.findOne({ token: 't1' }))!
  expect(invitation.invited_role).toBe('DOMAIN_EXPERT')
  expect(await db.collection('invitations').findOne({ token: 't1' })).not.toHaveProperty('zone_ids')
  expect((await db.collection('ticketmessages').findOne({}))!.sender_role).toBe('DOMAIN_EXPERT')

  expect((await Alert.find().sort({ type: 1 }).lean()).map(a => a.type)).toEqual(['NOISE_ANOMALY', 'PUMP_DRY'])
  expect((await db.collection('sensornodes').findOne({ _id: nodeId }))!.relay_states).toEqual({ misting: true, speaker: false, ventilation: false })
  await expect((await SensorNode.findById(nodeId))!.save()).resolves.toBeDefined()

  const listed = (await HarvestBatch.findById(listedId).lean())!
  expect(listed.status).toBe('DRAFT')
  expect(listed).not.toHaveProperty('listing_id')
  expect((await HarvestBatch.findById(draftId).lean())!.status).toBe('DRAFT')
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name)
  expect(collections).not.toEqual(expect.arrayContaining(['nestlistings']))
  expect(collections).not.toEqual(expect.arrayContaining(['contactinquiries']))

  expect(await migrateScopeV2()).toEqual({
    users: 0, farms: 0, invitations: 0, ticketMessages: 0, zoneScopesRemoved: 0,
    alerts: 0, heatingRemoved: 0, harvests: 0, collectionsDropped: 0,
  })
})
