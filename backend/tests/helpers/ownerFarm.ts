import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import type { CurrentUser } from '@/types'

/**
 * Mongo trong bộ nhớ cho cả file test; sau mỗi test trả mock về như cũ và xoá sạch dữ liệu
 * (kể cả bản ghi đã xoá mềm). Gọi ở cấp ngoài cùng của file test, sau các `jest.mock`.
 */
export function useTestDb(): void {
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
    jest.restoreAllMocks()
    jest.clearAllMocks()
    await Promise.all([
      Alert, AuditLog, BirdCountRecord, SensorNode, Farm, HarvestBatch, House, Zone, RelayOverrideLog, Telemetry, User,
    ].map(m => (m as typeof User).deleteMany({ is_deleted: { $in: [true, false, null] } })))
  })
}

let seq = 0

/** 1 Farm Owner + Farm/House/Zone + 1 SensorNode ONLINE, kèm token và đường dẫn relay của thiết bị */
export async function seedOwnerFarm() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const user: CurrentUser = { _id: String(owner._id), email: owner.email, role: 'FARM_OWNER' }
  return { owner, user, farm, zone, node, token, relay: `/devices/sensor-nodes/${node._id}` }
}
