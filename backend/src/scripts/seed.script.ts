/** npm run seed: Farm Owner, Farm Technician, Domain Expert, farm, nhà, zone, node_001 (khớp firmware Secrets.h) */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import { ProvisionedDevice, type ProvisionedDeviceKind } from '@/models/provisionedDevice.model'
import { hashBrokerSecret, hashKey } from '@/services/provisionedDevice.service'
import logger from '@/utils/logger.util'

/** Bắt buộc khi tạo farm (A-5) */
const DEMO_COORDINATES = { lat: 10.7769, lng: 106.7009 }

async function seed(): Promise<void> {
  await connectDB()

  let user = await User.findOne({ email: 'owner@swiftletcare.dev' })
  if (!user) {
    user = await User.create({
      email: 'owner@swiftletcare.dev',
      password_hash: 'Test1234!', // pre-save hook tự hash
      full_name: 'Demo Farm Owner',
      role: 'FARM_OWNER',
    })
    logger.info(`[seed] Created user: ${user.email} (password: Test1234!)`)
  } else {
    logger.info(`[seed] User already exists: ${user.email}`)
  }

  let technician = await User.findOne({ email: 'tech@swiftletcare.dev' })
  if (!technician) {
    technician = await User.create({
      email: 'tech@swiftletcare.dev',
      password_hash: 'Test1234!',
      full_name: 'Demo Farm Technician',
      role: 'FARM_TECHNICIAN',
    })
    logger.info(`[seed] Created farm technician: ${technician.email} (password: Test1234!)`)
  } else if ((technician.role as string) === 'TECHNICIAN') {
    // DB seed trước G-20
    technician.role = 'FARM_TECHNICIAN'
    await technician.save()
    logger.info(`[seed] Converted ${technician.email} to FARM_TECHNICIAN`)
  } else {
    logger.info(`[seed] Farm technician already exists: ${technician.email}`)
  }

  let farm = await Farm.findOne({ name: 'Nhà Yến Demo' })
  if (!farm) {
    farm = await Farm.create({
      name: 'Nhà Yến Demo',
      address: '12 Nguyễn Huệ, Quận 1',
      coordinates: DEMO_COORDINATES,
      owner_id: user._id,
    })
    logger.info(`[seed] Created farm: ${farm._id}`)
  } else if (!farm.coordinates?.lat) {
    // Farm cũ chưa có tọa độ
    farm.coordinates = DEMO_COORDINATES
    await farm.save()
    logger.info(`[seed] Backfilled coordinates cho farm cũ: ${farm._id}`)
  } else {
    logger.info(`[seed] Farm already exists: ${farm._id}`)
  }

  let expert = await User.findOne({ email: 'expert@swiftletcare.dev' })
  if (!expert) {
    expert = await User.create({
      email: 'expert@swiftletcare.dev',
      password_hash: 'Test1234!',
      full_name: 'Demo Domain Expert',
      role: 'DOMAIN_EXPERT',
    })
    logger.info(`[seed] Created domain expert: ${expert.email} (password: Test1234!)`)
  }
  if (!farm.members.some(m => String(m.user_id) === String(expert!._id))) {
    farm.members.push({ user_id: expert._id, is_primary: false, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    logger.info(`[seed] Added ${expert.email} to farm ${farm._id} as DOMAIN_EXPERT`)
  }

  let house = await House.findOne({ farm_id: farm._id })
  if (!house) {
    house = await House.create({ farm_id: farm._id, name: 'Nhà chính', floors: 2 })
    logger.info(`[seed] Created house: ${house._id}`)
  } else {
    logger.info(`[seed] House already exists: ${house._id}`)
  }
  if (!farm.members.some(m => String(m.user_id) === String(technician!._id))) {
    farm.members.push({ user_id: technician._id, is_primary: false, role: 'FARM_TECHNICIAN' } as never)
    await farm.save()
    logger.info(`[seed] Added ${technician.email} to farm ${farm._id} as FARM_TECHNICIAN`)
  }
  if (!(house.technicians ?? []).some(t => String(t.user_id) === String(technician!._id))) {
    house.technicians = [...(house.technicians ?? []), { user_id: technician._id, primary: true }]
    await house.save()
    logger.info(`[seed] Assigned ${technician.email} to house ${house._id} (primary)`)
  }

  let zone = await Zone.findOne({ house_id: house._id })
  if (!zone) {
    zone = await Zone.create({ house_id: house._id, name: 'Tầng 1', floor: 1 })
    logger.info(`[seed] Created zone: ${zone._id}`)
  } else {
    logger.info(`[seed] Zone already exists: ${zone._id}`)
  }

  // device_id phải khớp SECRET_DEVICE_ID trong Secrets.h
  const deviceId = 'node_001'
  let node = await SensorNode.findOne({ device_id: deviceId })
  if (!node) {
    node = await SensorNode.create({ device_id: deviceId, zone_id: zone._id })
    logger.info(`[seed] Created sensor node: ${node.device_id} → zone ${zone._id}`)
  } else {
    logger.info(`[seed] Sensor node already exists: ${node.device_id}`)
  }

  // secretKey cố định chỉ cho dev; node_002/cam_001 để thử onboarding
  const demoDevices: Array<[string, ProvisionedDeviceKind, string, boolean]> = [
    [deviceId,   'SENSOR', 'DEMO-NODE-0001', true],
    ['node_002', 'SENSOR', 'DEMO-NODE-0002', false],
    ['cam_001',  'CAMERA', 'DEMO-CAM-0001',  false],
  ]
  for (const [id, kind, secretKey, claimed] of demoDevices) {
    if (await ProvisionedDevice.exists({ device_id: id })) continue
    // Chỉ cho dev
    await ProvisionedDevice.create({
      device_id: id, kind, secret_key_hash: hashKey(secretKey), broker_secret_hash: hashBrokerSecret(secretKey).toString('hex'),
      ...(claimed ? { claimed_at: new Date() } : {}),
    })
    logger.info(`[seed] Provisioned device: ${id} (${kind}, secretKey và broker secret: ${secretKey})`)
  }

  logger.info('[seed] Done. Zone ID để test API/socket:', { zoneId: String(zone._id) })
  await mongoose.disconnect()
}

seed().catch((err: Error) => {
  logger.error('[seed] Failed', { err })
  process.exit(1)
})
