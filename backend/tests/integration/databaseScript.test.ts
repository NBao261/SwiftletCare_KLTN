/**
 * Database script (SDD §6.5): with the generated `$jsonSchema` validators enforced
 * (strict, error), documents written through the models are accepted and a document
 * missing a required field is rejected — the script and the models describe the same data.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CameraNode } from '@/models/device.model'
import { Notification } from '@/models/notification.model'
import { Telemetry } from '@/models/telemetry.model'
import { ALL_MODELS, schemaToJson } from '@/utils/dbScript.util'
import { seedOwnerFarm } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all(ALL_MODELS.map(m => m.init()))
  const db = mongoose.connection.db!
  for (const m of ALL_MODELS) {
    await db.command({
      collMod: m.collection.collectionName,
      validator: { $jsonSchema: schemaToJson(m.schema) },
      validationLevel: 'strict',
      validationAction: 'error',
    })
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('database script validators', () => {
  it('accept documents written through the models', async () => {
    const { owner, farm, zone, node } = await seedOwnerFarm()
    await Telemetry.create({ node_id: node._id, zone_id: zone._id, timestamp: new Date(), temperature: 29.5, humidity: 81, nh3_ppm: 4 })
    const alert = await Alert.create({
      farm_id: farm._id, zone_id: zone._id, node_id: node._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 't', message: 'm',
    })
    await Alert.updateOne({ _id: alert._id }, { expert_verdict: { result: 'REJECTED', note: 'n', by: owner._id, at: new Date() } })
    const camera = await CameraNode.create({ device_id: 'CAM-1', house_id: zone.house_id })
    await BirdCountRecord.create({
      camera_node_id: camera._id, house_id: zone.house_id, timestamp: new Date(), session_date: '2026-10-21',
      session_type: 'MORNING_EXIT', entry_count: 12, exit_count: 340,
    })
    await Notification.create({ user_id: owner._id, title: 't', body: 'b', ref: { kind: 'alert', id: alert._id } })

    expect(await Alert.countDocuments()).toBe(1)
  })

  it('reject a document missing a required field', async () => {
    await expect(mongoose.connection.db!.collection('zones').insertOne({ name: 'no house' }))
      .rejects.toMatchObject({ code: 121 })
  })
})
