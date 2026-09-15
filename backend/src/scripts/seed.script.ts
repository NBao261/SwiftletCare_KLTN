/**
 * seed.ts – Tạo dữ liệu test tối thiểu để xem telemetry từ ESP32 lên web,
 * mà chưa cần chờ AUTH/FARM API hoàn chỉnh.
 *
 * Chạy: npm run seed
 *
 * Tạo: 1 Farm Owner + 1 Technician (phụ trách khu vực của farm) + 1 Farm +
 * 1 House + 1 Zone + 1 SensorNode với device_id khớp firmware/src/config/Secrets.h
 * (node_001) để telemetry.handler tìm thấy đúng Zone khi ESP32 publish MQTT.
 *
 * Technician được seed vì từ SRS v1.12.0, đăng ký/kích hoạt thiết bị là việc của
 * Technician chứ không phải Farm Owner (FARM-FR-003) — muốn test luồng onboarding
 * phải đăng nhập bằng tài khoản này.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import logger from '@/utils/logger.util'

/** Khu vực của farm demo — Technician phải có region này trong assigned_regions */
const DEMO_REGION = 'HCMC'

async function seed(): Promise<void> {
  await connectDB()

  // ── User (Farm Owner) ────────────────────────────────────────────────────
  let user = await User.findOne({ email: 'owner@swiftletcare.dev' })
  if (!user) {
    user = await User.create({
      email: 'owner@swiftletcare.dev',
      password_hash: 'Test1234!', // bị hash tự động bởi pre-save hook trong User.ts
      full_name: 'Demo Farm Owner',
      role: 'FARM_OWNER',
    })
    logger.info(`[seed] Created user: ${user.email} (password: Test1234!)`)
  } else {
    logger.info(`[seed] User already exists: ${user.email}`)
  }

  // ── User (Technician) — người đăng ký/kích hoạt thiết bị (FARM-FR-003) ────
  let technician = await User.findOne({ email: 'tech@swiftletcare.dev' })
  if (!technician) {
    technician = await User.create({
      email: 'tech@swiftletcare.dev',
      password_hash: 'Test1234!',
      full_name: 'Demo Technician',
      role: 'TECHNICIAN',
      assigned_regions: [DEMO_REGION],
    })
    logger.info(`[seed] Created technician: ${technician.email} (password: Test1234!, region: ${DEMO_REGION})`)
  } else {
    logger.info(`[seed] Technician already exists: ${technician.email}`)
  }

  // ── Farm ──────────────────────────────────────────────────────────────────
  let farm = await Farm.findOne({ name: 'Nhà Yến Demo' })
  if (!farm) {
    farm = await Farm.create({
      name: 'Nhà Yến Demo',
      address: 'Test address',
      region: DEMO_REGION,
      owner_id: user._id,
    })
    logger.info(`[seed] Created farm: ${farm._id}`)
  } else if (!farm.region) {
    // Farm seed từ bản cũ chưa có region → Technician sẽ không truy cập được
    farm.region = DEMO_REGION
    await farm.save()
    logger.info(`[seed] Backfilled region="${DEMO_REGION}" cho farm cũ: ${farm._id}`)
  } else {
    logger.info(`[seed] Farm already exists: ${farm._id}`)
  }

  // ── House ─────────────────────────────────────────────────────────────────
  let house = await House.findOne({ farm_id: farm._id })
  if (!house) {
    house = await House.create({ farm_id: farm._id, name: 'Nhà chính', floors: 2 })
    logger.info(`[seed] Created house: ${house._id}`)
  } else {
    logger.info(`[seed] House already exists: ${house._id}`)
  }

  // ── Zone ──────────────────────────────────────────────────────────────────
  let zone = await Zone.findOne({ house_id: house._id })
  if (!zone) {
    zone = await Zone.create({ house_id: house._id, name: 'Tầng 1', floor: 1 })
    logger.info(`[seed] Created zone: ${zone._id}`)
  } else {
    logger.info(`[seed] Zone already exists: ${zone._id}`)
  }

  // ── SensorNode – device_id PHẢI khớp SECRET_DEVICE_ID trong Secrets.h ──────
  const deviceId = 'node_001'
  let node = await SensorNode.findOne({ device_id: deviceId })
  if (!node) {
    node = await SensorNode.create({ device_id: deviceId, zone_id: zone._id })
    logger.info(`[seed] Created sensor node: ${node.device_id} → zone ${zone._id}`)
  } else {
    logger.info(`[seed] Sensor node already exists: ${node.device_id}`)
  }

  logger.info('[seed] Done. Zone ID để test API/socket:', { zoneId: String(zone._id) })
  await mongoose.disconnect()
}

seed().catch((err: Error) => {
  logger.error('[seed] Failed', { err })
  process.exit(1)
})
