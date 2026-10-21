/**
 * migrate-bird-count-house (SRS v2.1.8): camera, số đếm, cảnh báo camera và mức giảm tỷ lệ chim về
 * chuyển từ Zone sang House chứa Zone; chạy lại không đổi gì thêm.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateBirdCountHouse } from '@/scripts/migrate-bird-count-house.script'

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
  await mongoose.connection.db!.dropDatabase()
})

const db = () => mongoose.connection.db!
const id = () => new mongoose.Types.ObjectId()

/** Dữ liệu theo schema cũ (trước v2.1.8), ghi thẳng vào collection */
async function legacy() {
  const [farm, house, otherHouse] = [id(), id(), id()]
  const [camZone, upperZone, mixedA, mixedB] = [id(), id(), id(), id()]
  await db().collection('houses').insertMany([
    { _id: house, farm_id: farm, name: 'Nhà 1' },
    { _id: otherHouse, farm_id: farm, name: 'Nhà 2' },
  ])
  await db().collection('zones').insertMany([
    { _id: camZone, house_id: house, farm_id: farm, name: 'Phòng lượn', detection_tuning: { noise_margin_db: 15, return_rate_drop_pct: 30 } },
    { _id: upperZone, house_id: house, farm_id: farm, name: 'Tầng 2', detection_tuning: { noise_margin_db: 15, return_rate_drop_pct: 25 } },
    { _id: mixedA, house_id: otherHouse, farm_id: farm, name: 'A', detection_tuning: { return_rate_drop_pct: 10 } },
    { _id: mixedB, house_id: otherHouse, farm_id: farm, name: 'B', detection_tuning: { return_rate_drop_pct: 40 } },
  ])
  const camera = id()
  await db().collection('cameranodes').insertOne({ _id: camera, device_id: 'cam-1', zone_id: camZone, status: 'ONLINE' })
  await db().collection('birdcountrecords').insertOne({
    camera_node_id: camera, zone_id: camZone, session_type: 'EVENING_ENTRY', session_date: '2026-10-15',
    timestamp: new Date(), entry_count: 90, exit_count: 0, return_rate: 90,
  })
  await db().collection('birdcountbuckets').insertOne({ camera_node_id: camera, zone_id: camZone, bucket_start: new Date(), entry_count: 1, exit_count: 0 })
  await db().collection('alerts').insertMany([
    { farm_id: farm, zone_id: camZone, node_id: camera, type: 'EDGE_AI_DEGRADED', status: 'ACTIVE', title: 't', message: 'm', severity: 'MEDIUM' },
    { farm_id: farm, zone_id: upperZone, type: 'THRESHOLD_BREACH', status: 'ACTIVE', title: 't', message: 'm', severity: 'MEDIUM' },
  ])
  return { farm, house, otherHouse, camZone, camera }
}

it('chuyển camera, số đếm, cảnh báo camera và mức giảm sang House; chạy lại an toàn', async () => {
  const { house, otherHouse, camera } = await legacy()

  const first = await migrateBirdCountHouse()
  expect(first).toMatchObject({ moved: { cameranodes: 1, birdcountrecords: 1, birdcountbuckets: 1 }, alertsMoved: 1, housesTuned: 1 })

  const cam = (await db().collection('cameranodes').findOne({ _id: camera }))!
  expect(cam.house_id).toEqual(house)
  expect(cam).not.toHaveProperty('zone_id')
  const record = (await db().collection('birdcountrecords').findOne({}))!
  expect(record.house_id).toEqual(house)
  expect(record).not.toHaveProperty('zone_id')
  expect(record).not.toHaveProperty('return_rate')        // tỷ lệ cũ theo camera bị bỏ
  expect((await db().collection('birdcountbuckets').findOne({}))!.house_id).toEqual(house)

  const edge = (await db().collection('alerts').findOne({ type: 'EDGE_AI_DEGRADED' }))!
  expect(edge.house_id).toEqual(house)
  expect(edge).not.toHaveProperty('zone_id')
  expect((await db().collection('alerts').findOne({ type: 'THRESHOLD_BREACH' }))!.zone_id).toBeDefined()  // cảnh báo Zone giữ nguyên

  // Nhà 1: 2 Zone khác nhau (30/25) → lấy của Zone từng lắp camera (30)
  expect((await db().collection('houses').findOne({ _id: house }))!.bird_count_tuning).toEqual({ return_rate_drop_pct: 30 })
  // Nhà 2: khác nhau và không có camera → không đoán, để Domain Expert đặt lại
  expect((await db().collection('houses').findOne({ _id: otherHouse }))!.bird_count_tuning).toBeUndefined()
  expect(first.needsExpert).toEqual([expect.stringContaining('Nhà 2')])
  expect(await db().collection('zones').countDocuments({ 'detection_tuning.return_rate_drop_pct': { $exists: true } })).toBe(0)

  const second = await migrateBirdCountHouse()
  expect(second).toMatchObject({ moved: { cameranodes: 0, birdcountrecords: 0, birdcountbuckets: 0 }, alertsMoved: 0, housesTuned: 0, zonesCleaned: 0 })
  expect((await db().collection('houses').findOne({ _id: house }))!.bird_count_tuning).toEqual({ return_rate_drop_pct: 30 })
})

it('các Zone của nhà cùng 1 mức thì House nhận mức đó; Expert đã đặt ở House thì không ghi đè', async () => {
  const farm = id(), house = id(), tuned = id()
  await db().collection('houses').insertMany([
    { _id: house, farm_id: farm, name: 'Nhà A' },
    { _id: tuned, farm_id: farm, name: 'Nhà B', bird_count_tuning: { return_rate_drop_pct: 45 }, bird_count_tuning_history: [{ changed_at: new Date() }] },
  ])
  await db().collection('zones').insertMany([
    { house_id: house, farm_id: farm, name: 'Z1', detection_tuning: { return_rate_drop_pct: 35 } },
    { house_id: house, farm_id: farm, name: 'Z2', detection_tuning: { return_rate_drop_pct: 35 } },
    { house_id: tuned, farm_id: farm, name: 'Z3', detection_tuning: { return_rate_drop_pct: 10 } },
  ])

  await migrateBirdCountHouse()
  expect((await db().collection('houses').findOne({ _id: house }))!.bird_count_tuning).toEqual({ return_rate_drop_pct: 35 })
  expect((await db().collection('houses').findOne({ _id: tuned }))!.bird_count_tuning).toEqual({ return_rate_drop_pct: 45 })
})
