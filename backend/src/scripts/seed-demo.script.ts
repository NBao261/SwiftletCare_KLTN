/**
 * seed-demo — dữ liệu cho 16 kịch bản demo DS-01…16 (Design Brief Phụ lục A2, docs/deploy/staging.md §5, G-17).
 *
 * Chạy sau `npm run seed` (dùng lại owner@, tech@, expert@): `npm run seed:demo`. Mỗi lần chạy xoá rồi dựng lại
 * hai farm demo, nên chạy lại ngay trước buổi tổng duyệt để mọi điều kiện đầu đúng như Phụ lục A2.
 *
 * Đi qua service thật (Administrator nhập kho, Farm Owner tạo nhà, tầng, đăng ký thiết bị, cảnh báo qua Alert Engine,
 * Work Order qua thợ) để trạng thái hợp lệ như khi dùng app. Chỉ dữ liệu quá khứ (telemetry, số đếm chim, khuyến nghị
 * đã chấp nhận từ 10 ngày trước) được ghi thẳng vào DB. Activation key / broker secret của thiết bị demo sinh ngẫu
 * nhiên mỗi lần và chỉ in ra màn hình (nạp vào ESP32 thật hoặc bộ giả lập bằng firmware/tools/flash_identity.py).
 */
import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import { connectDB } from '@/config/db.config'
import { User } from '@/models/user.model'
import { Farm, type IFarm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { Telemetry } from '@/models/telemetry.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { Recommendation } from '@/models/recommendation.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { createProvisionedDevice } from '@/services/provisionedDevice.service'
import { createFarm, createHouse, createZone, assignTechnician } from '@/services/farm.service'
import { registerSensorNode, registerCameraNode } from '@/services/device.service'
import { createAlert } from '@/services/alert.service'
import { startWorkOrder, completeWorkOrder, openPreventiveWorkOrder } from '@/services/workOrder.service'
import { WorkOrder } from '@/models/workOrder.model'
import { createPlan } from '@/services/maintenance.service'
import { createRule, evaluateRecommendationRules } from '@/services/recommendation.service'
import { addDays, assessHouseDay, vnDayStart } from '@/services/healthAssessment.service'
import { vnDate } from '@/services/birdCount.service'
import { getTuningSuggestion } from '@/services/tuningSuggestion.service'
import type { CurrentUser, Role } from '@/types'
import logger from '@/utils/logger.util'

export const DEMO_FARM = 'Trại yến Demo A2'
export const NO_EXPERT_FARM = 'Trại yến không chuyên gia'
/**
 * Mật khẩu của 6 tài khoản demo (cả admin@). Trên staging (NODE_ENV=production, tên miền công khai) phải đặt DEMO_PASSWORD:
 * mật khẩu mặc định ai cũng đoán được. Máy dev và CI dùng mật khẩu của `npm run seed`.
 */
function demoPassword(): string {
  const fromEnv = process.env.DEMO_PASSWORD?.trim()
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Đặt DEMO_PASSWORD trước khi chạy seed:demo trên staging (docs/deploy/staging.md §5)')
  }
  return 'Test1234!'
}
const DEMO_COORDINATES = { lat: 10.7769, lng: 106.7009 }
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const SAMPLE_MS = 10_000
const STEP_SAMPLES = 60 // 1 bước mô phỏng 10 phút = 60 mẫu 10 giây (ENV-FR-004)

/** PRNG cố định: chạy lại ra cùng số liệu */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const asUser = (u: { _id: unknown; email: string; role: string }): CurrentUser => ({ _id: String(u._id), email: u.email, role: u.role as Role })

async function ensureUser(email: string, fullName: string, role: Role, password: string) {
  const found = await User.findOne({ email })
  if (found) return found
  logger.info(`[seed:demo] Tạo tài khoản ${email} (${role})`)
  return User.create({ email, password_hash: password, full_name: fullName, role })
}

/** Xoá 2 farm demo cùng mọi bản ghi gắn với farm, nhà, tầng, thiết bị của chúng */
async function resetDemo(): Promise<void> {
  const farms = await Farm.find({ name: { $in: [DEMO_FARM, NO_EXPERT_FARM] }, is_deleted: { $in: [true, false] } }).select('_id').lean()
  if (farms.length === 0) return
  const farmIds = farms.map(f => f._id)
  const houses = await House.find({ farm_id: { $in: farmIds } }).select('_id').lean()
  const houseIds = houses.map(h => h._id)
  const zoneIds = (await Zone.find({ house_id: { $in: houseIds } }).select('_id').lean()).map(z => z._id)
  const nodeIds = (await SensorNode.find({ zone_id: { $in: zoneIds } }).select('_id').lean()).map(n => n._id)
  const scopes: Array<[string, Types.ObjectId[]]> = [['farm_id', farmIds], ['house_id', houseIds], ['zone_id', zoneIds], ['node_id', nodeIds]]
  for (const name of mongoose.modelNames()) {
    if (['User', 'Farm'].includes(name)) continue
    const model = mongoose.model(name)
    const scope = scopes.find(([path]) => model.schema.path(path))
    if (scope) await model.deleteMany({ [scope[0]]: { $in: scope[1] } })
  }
  await Farm.deleteMany({ _id: { $in: farmIds } })
  await ProvisionedDevice.deleteMany({ device_id: /^demo-/ })
  logger.info(`[seed:demo] Đã xoá ${farms.length} farm demo cũ`)
}

const deviceKeys: Array<{ device_id: string; house: string; activation_key: string; broker_secret: string }> = []

/** Administrator nhập kho, Farm Owner quét nhãn và đăng ký (SF-01) */
async function provisionController(admin: CurrentUser, owner: CurrentUser, deviceId: string, zoneId: string, house: string) {
  const stock = await createProvisionedDevice(admin._id, { device_id: deviceId, kind: 'SENSOR' })
  const node = await registerSensorNode(owner, { device_id: deviceId, zone_id: zoneId, secret_key: stock.secret_key })
  deviceKeys.push({ device_id: deviceId, house, activation_key: stock.secret_key, broker_secret: stock.broker_secret })
  return node
}

async function provisionCamera(admin: CurrentUser, owner: CurrentUser, deviceId: string, houseId: string, house: string) {
  const stock = await createProvisionedDevice(admin._id, { device_id: deviceId, kind: 'CAMERA' })
  const camera = await registerCameraNode(owner, { device_id: deviceId, house_id: houseId, secret_key: stock.secret_key })
  deviceKeys.push({ device_id: deviceId, house, activation_key: stock.secret_key, broker_secret: stock.broker_secret })
  return camera
}

interface Sample { temperature: number; humidity: number; nh3_ppm: number; misting_pct: number; ventilation_pct: number; sound_db: number }

/** Ghi các mẫu 10 giây của 1 ngày (giờ VN): `step(k)` cho số đo của bước 10 phút thứ k */
async function insertDay(nodeId: unknown, zoneId: unknown, date: string, step: (k: number) => Sample, rnd: () => number) {
  const start = vnDayStart(date).getTime()
  const docs = []
  for (let k = 0; k < 144; k++) {
    const s = step(k)
    for (let i = 0; i < STEP_SAMPLES; i++) {
      docs.push({
        node_id: nodeId, zone_id: zoneId, timestamp: new Date(start + (k * STEP_SAMPLES + i) * SAMPLE_MS),
        temperature: round1(s.temperature + (rnd() - 0.5) * 0.1), humidity: round1(s.humidity + (rnd() - 0.5) * 0.2),
        light_lux: 0.05, nh3_ppm: round1(s.nh3_ppm), co2_ppm: 700 + Math.round((rnd() - 0.5) * 40),
        sound_db: round1(s.sound_db + (rnd() - 0.5) * 2),
        misting_pct: Math.round(s.misting_pct), ventilation_pct: Math.round(s.ventilation_pct),
        misting_on: s.misting_pct > 0, ventilation_on: s.ventilation_pct > 0, is_anomaly: false,
      })
    }
  }
  await Telemetry.collection.insertMany(docs, { ordered: false })
}

const temperatureAt = (k: number) => 28.5 + 2 * Math.sin(2 * Math.PI * (k / 144 - 0.375))
/** Chim ra vào lúc sáng sớm và chiều tối: ồn hơn (Report 3 BR-13) */
const soundAt = (k: number) => ((k >= 33 && k < 42) || (k >= 105 && k < 114) ? 55 : 45)

/**
 * Nhà A: phun sương theo một bộ điều khiển thô trên một mô hình nhà đơn giản (Δ độ ẩm theo phun, quạt, nhiệt), đủ
 * 14 ngày cho gợi ý hệ số (ENV-FR-021, DS-09) và NH3 vượt ngưỡng `nh3Hours(date)` giờ mỗi ngày (luật DS-15).
 */
async function seedHouseATelemetry(nodeId: unknown, zoneId: unknown, dates: string[], nh3Hours: (date: string) => number) {
  const rnd = prng(1)
  let humidity = 85
  for (const date of dates) {
    const overSteps = Math.round(nh3Hours(date) * 6)
    await insertDay(nodeId, zoneId, date, k => {
      const temperature = temperatureAt(k)
      const misting = clamp((88 - humidity) * 12, 0, 100)
      const ventilation = clamp((temperature - 29.5) * 40, 0, 100)
      const sample = {
        temperature, humidity, misting_pct: misting, ventilation_pct: ventilation, sound_db: soundAt(k),
        // NH3 vượt 25 ppm (ngưỡng mặc định) từ 01:00, đúng số giờ của ngày
        nh3_ppm: k >= 6 && k < 6 + overSteps ? 32 : 12,
      }
      humidity = clamp(humidity + 0.04 * misting - 0.02 * ventilation - 0.3 * (temperature - 28.5) - 1.2 + (rnd() - 0.5) * 0.6, 60, 99)
      return sample
    }, rnd)
  }
}

/** Nhà C: ngày `slightDate` độ ẩm dưới 75 % 3,5 giờ buổi trưa (≈ 85 % thời gian trong ngưỡng: SLIGHT), ngày khác bình thường */
async function seedHouseCTelemetry(nodeId: unknown, zoneId: unknown, dates: string[], slightDate: string) {
  const rnd = prng(2)
  for (const date of dates) {
    await insertDay(nodeId, zoneId, date, k => ({
      temperature: temperatureAt(k),
      humidity: date === slightDate && k >= 72 && k < 93 ? 72 : 84,
      nh3_ppm: 12, misting_pct: 30, ventilation_pct: 0, sound_db: soundAt(k),
    }), rnd)
  }
}

/** Bản ghi phiên đã tính từ số đếm 5 phút (VISION-FR-008): sáng ra, chiều về */
async function seedSessions(cameraId: unknown, houseId: unknown, date: string, counts: { exit: number; entry: number; eveningComplete?: boolean }) {
  const at = (hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`)
  await BirdCountRecord.insertMany([
    {
      camera_node_id: cameraId, house_id: houseId, timestamp: at('07:00'), session_date: date, session_type: 'MORNING_EXIT',
      exit_count: counts.exit, entry_count: 20, window_start: '05:30', window_end: '07:00', complete: true, computed_at: at('19:15'),
    },
    {
      camera_node_id: cameraId, house_id: houseId, timestamp: at('19:00'), session_date: date, session_type: 'EVENING_ENTRY',
      entry_count: counts.entry, exit_count: 15, window_start: '17:30', window_end: '19:00',
      complete: counts.eveningComplete ?? true, computed_at: at('19:15'),
    },
  ])
}

async function seedDemo(): Promise<void> {
  await connectDB()
  const password = demoPassword()
  const now = new Date()
  const today = vnDate(now)
  const day = (n: number) => addDays(today, -n)

  const ownerDoc = await User.findOne({ email: 'owner@swiftletcare.dev' })
  const techDoc = await User.findOne({ email: 'tech@swiftletcare.dev' })
  const expertDoc = await User.findOne({ email: 'expert@swiftletcare.dev' })
  if (!ownerDoc || !techDoc || !expertDoc) throw new Error('Chạy `npm run seed` trước (cần owner@, tech@, expert@)')
  const adminDoc = await ensureUser('admin@swiftletcare.dev', 'Demo Administrator', 'ADMIN', password)
  const tech2Doc = await ensureUser('tech2@swiftletcare.dev', 'Demo Farm Technician 2', 'FARM_TECHNICIAN', password)
  const owner2Doc = await ensureUser('owner2@swiftletcare.dev', 'Demo Farm Owner 2', 'FARM_OWNER', password)
  // Cả 6 tài khoản dùng chung một mật khẩu, kể cả 3 tài khoản `npm run seed` đã tạo (hook pre-save băm lại)
  for (const doc of [ownerDoc, techDoc, expertDoc, adminDoc, tech2Doc, owner2Doc]) {
    doc.password_hash = password
    await doc.save()
  }
  const [admin, owner, tech, expert, owner2] = [adminDoc, ownerDoc, techDoc, expertDoc, owner2Doc].map(asUser)

  await resetDemo()

  // ── Farm có chuyên gia, hai thợ ─────────────────────────────────────────────────────────────────
  const farm: IFarm = await createFarm(owner, { name: DEMO_FARM, address: 'Nhà yến thử nghiệm (dữ liệu demo)', coordinates: DEMO_COORDINATES })
  farm.members.push(
    { user_id: expertDoc._id, is_primary: false, role: 'DOMAIN_EXPERT', joined_at: now } as never,
    { user_id: techDoc._id, is_primary: false, role: 'FARM_TECHNICIAN', joined_at: now } as never,
    { user_id: tech2Doc._id, is_primary: false, role: 'FARM_TECHNICIAN', joined_at: now } as never,
  )
  await farm.save()
  const farmId = String(farm._id)

  // Nhà A — điều khiển, sự cố cảm biến, ồn bất thường, gợi ý hệ số, bảo trì, luật NH3 (DS-01, 02, 07–10, 13–15)
  const houseA = await createHouse(farmId, owner, { name: 'A · Nhà điều khiển', floors: 1 })
  const zoneA = await createZone(String(houseA._id), owner, { name: 'A · Tầng 1', floor: 1 })
  await assignTechnician(String(houseA._id), owner, tech._id, true)
  const nodeA = await provisionController(admin, owner, 'demo-ctl-a1', String(zoneA._id), 'A')

  // Nhà B — đếm chim và Work Order đang kiểm phục hồi (DS-03…06)
  const houseB = await createHouse(farmId, owner, { name: 'B · Nhà đếm chim', floors: 1 })
  const zoneB = await createZone(String(houseB._id), owner, { name: 'B · Tầng 1', floor: 1 })
  await assignTechnician(String(houseB._id), owner, tech._id, true)
  const nodeB = await provisionController(admin, owner, 'demo-ctl-b1', String(zoneB._id), 'B')
  const cameraB = await provisionCamera(admin, owner, 'demo-cam-b1', String(houseB._id), 'B')

  // Nhà C — đánh giá ngày (DS-11, 12; DS-16)
  const houseC = await createHouse(farmId, owner, { name: 'C · Nhà đánh giá ngày', floors: 1 })
  const zoneC = await createZone(String(houseC._id), owner, { name: 'C · Tầng 1', floor: 1 })
  await assignTechnician(String(houseC._id), owner, tech._id, true)
  const nodeC = await provisionController(admin, owner, 'demo-ctl-c1', String(zoneC._id), 'C')
  const cameraC = await provisionCamera(admin, owner, 'demo-cam-c1', String(houseC._id), 'C')

  // Nhà D — thợ thứ hai (DS-04: thợ của nhà khác)
  const houseD = await createHouse(farmId, owner, { name: 'D · Nhà phụ', floors: 1 })
  await createZone(String(houseD._id), owner, { name: 'D · Tầng 1', floor: 1 })
  await assignTechnician(String(houseD._id), owner, String(tech2Doc._id), true)

  // ── Farm không có chuyên gia (BR-22) ─────────────────────────────────────────────────────────────
  const farm2 = await createFarm(owner2, { name: NO_EXPERT_FARM, address: 'Nhà yến thử nghiệm (dữ liệu demo)', coordinates: DEMO_COORDINATES })
  const house2 = await createHouse(String(farm2._id), owner2, { name: 'Nhà 1', floors: 1 })
  await createZone(String(house2._id), owner2, { name: 'Tầng 1', floor: 1 })

  // ── Nhà A: 17 ngày telemetry; NH3 vượt 5 giờ/ngày trước lần chấp nhận, 1 giờ sau, 4,5 giờ 3 ngày gần nhất ─────
  const datesA = Array.from({ length: 17 }, (_, i) => day(17 - i))
  const nh3Hours = (date: string) => (date <= day(11) ? 5 : date >= day(3) ? 4.5 : 1)
  await seedHouseATelemetry(nodeA._id, zoneA._id, datesA, nh3Hours)
  // Bộ đếm giờ chạy bắt đầu từ bây giờ: lịch sử giả lập không được cộng vào giờ bơm (BR-45)
  await SensorNode.updateOne({ _id: nodeA._id }, {
    $set: {
      'relay_usage.misting.since_service_hours': 499, 'relay_usage.misting.on_hours': 499,
      'relay_usage.counted_until': now,
    },
  })
  for (const date of datesA) await assessHouseDay(String(houseA._id), date, now)

  // ── Nhà B: 7 ngày số đếm đủ phiên, tỷ lệ về ≈ 97 % (nền của DS-05) ───────────────────────────────
  for (let n = 7; n >= 1; n--) await seedSessions(cameraB._id, houseB._id, day(n), { exit: 1200, entry: 1150 })

  // ── Nhà C: nền 8 ngày ≈ 96 %; ngày D-2 về 65 % (CLEAR) + độ ẩm SLIGHT → ACTION; ngày D-1 phiên chiều không đầy đủ ──
  for (let n = 10; n >= 3; n--) await seedSessions(cameraC._id, houseC._id, day(n), { exit: 1000, entry: 960 })
  await seedSessions(cameraC._id, houseC._id, day(2), { exit: 1000, entry: 650 })
  await seedSessions(cameraC._id, houseC._id, day(1), { exit: 1000, entry: 940, eveningComplete: false })
  await seedHouseCTelemetry(nodeC._id, zoneC._id, [day(2), day(1)], day(2))
  for (const date of [day(2), day(1)]) await assessHouseDay(String(houseC._id), date, now)

  // ── Cảnh báo qua Alert Engine ───────────────────────────────────────────────────────────────────
  // DS-02: cảm biến hỏng ở tầng A (mở luôn Work Order cho thợ, BR-39)
  await createAlert({
    farmId, zoneId: String(zoneA._id), nodeId: String(nodeA._id), type: 'SENSOR_FAULT',
    title: 'Cảm biến độ ẩm không trả số đo', message: 'demo-ctl-a1: SHT35 không trả lời trên bus RS485 (dữ liệu demo)',
  })
  // DS-07, 08: ồn bất thường chờ chuyên gia kết luận (thợ được yêu cầu kiểm tra tại chỗ, EXPERT-FR-021)
  await createAlert({
    farmId, zoneId: String(zoneA._id), nodeId: String(nodeA._id), type: 'NOISE_ANOMALY',
    title: 'Ồn bất thường kéo dài', message: 'demo-ctl-a1: mức ồn cao hơn nền theo giờ (dữ liệu demo)',
  })
  // DS-04: phun không tăng ẩm ở nhà B → Work Order → thợ báo xong → VERIFYING
  const misting = await createAlert({
    farmId, zoneId: String(zoneB._id), nodeId: String(nodeB._id), type: 'MISTING_INEFFECTIVE',
    title: 'Phun sương không tăng độ ẩm', message: 'demo-ctl-b1: bơm chạy 10 phút, độ ẩm không tăng (dữ liệu demo)',
  })
  const verifying = misting && await WorkOrder.findOne({ alert_id: misting._id, is_open: true })
  if (verifying) {
    await startWorkOrder(String(verifying._id), tech)
    await completeWorkOrder(String(verifying._id), tech, { cause: 'NOZZLE', work_note: 'Thông béc phun bị tắc (dữ liệu demo)' })
  }

  // ── Bảo trì (DS-13, 14) — chu kỳ do Farm Owner nhập, ghi rõ là dữ liệu demo ────────────────────────
  await createPlan(owner, {
    house_id: String(houseA._id), equipment: 'PUMP', basis: 'RUN_HOURS', interval: 500,
    checklist_template: ['Kiểm tra áp suất bơm', 'Vệ sinh lưới lọc', 'Kiểm tra rò rỉ đường ống'],
    source: 'Dữ liệu demo — Design Brief Phụ lục A2 DS-13',
  }, now)
  const calendar = await createPlan(owner, {
    house_id: String(houseA._id), equipment: 'NOZZLE', basis: 'CALENDAR', interval: 30,
    checklist_template: ['Tháo và ngâm béc phun', 'Kiểm tra tia phun từng béc'],
    source: 'Dữ liệu demo — Design Brief Phụ lục A2 DS-14',
  }, now)
  const dueSince = new Date(now.getTime() - 7 * DAY_MS - HOUR_MS)
  const plan = await MaintenancePlan.findByIdAndUpdate(calendar._id, { state: 'DUE', due_since: dueSince, next_due_at: dueSince }, { new: true })
  if (plan) {
    await openPreventiveWorkOrder({
      plan, title: 'Đến hạn Béc phun — A · Nhà điều khiển', description: 'Kế hoạch béc phun đến hạn từ 7 ngày trước (dữ liệu demo).',
    })
  }

  // ── Luật khuyến nghị (DS-15, 16) — luật của chuyên gia, ghi rõ nguồn là dữ liệu demo ─────────────────
  const nh3Rule = await createRule(expert, {
    farm_id: farmId, name: 'NH3 vượt ngưỡng 4 giờ/ngày trong 3 ngày', indicator: 'AIR_HOURS_OVER', comparison: 'GTE',
    value: 4, window_days: 3, action: { type: 'WORK_ORDER', title: 'Kiểm tra thông gió và dọn phân chim' },
    source: 'Dữ liệu demo — Design Brief Phụ lục A2 DS-15, chưa phải luật từ phỏng vấn', active: true,
  })
  await createRule(expert, {
    farm_id: farmId, name: 'Thời gian trong ngưỡng dưới 90 %', indicator: 'TIME_IN_RANGE', comparison: 'LTE',
    value: 90, window_days: 1, action: { type: 'WORK_ORDER', title: 'Kiểm tra hệ thống phun sương' },
    source: 'Dữ liệu demo — Design Brief Phụ lục A2 DS-16, chưa phải luật từ phỏng vấn', active: true,
  })
  // Lần trước của luật NH3 ở nhà A: chấp nhận 10 ngày trước, chờ job đo hiệu quả (EXPERT-FR-019)
  const acceptedDate = day(10)
  const evidenceDays = await HouseHealthDay.find({ house_id: houseA._id, date: { $gte: day(13), $lte: day(11) } }).sort({ date: 1 }).lean()
  await Recommendation.create({
    farm_id: farm._id, house_id: houseA._id, rule_id: nh3Rule._id, status: 'ACCEPTED',
    rule_snapshot: { name: nh3Rule.name, indicator: nh3Rule.indicator, comparison: nh3Rule.comparison, value: nh3Rule.value, window_days: nh3Rule.window_days, action: nh3Rule.action },
    evidence: {
      indicator: nh3Rule.indicator, comparison: nh3Rule.comparison, value: nh3Rule.value, window_days: nh3Rule.window_days,
      days: evidenceDays.map(d => ({ date: d.date, value: d.indicators?.air?.value ?? null })),
    },
    raised_at: new Date(`${day(11)}T19:20:00+07:00`), raised_for: day(11),
    decided_by: ownerDoc._id, decided_at: new Date(`${acceptedDate}T09:00:00+07:00`),
  })
  // DS-16: khuyến nghị đang mở ở nhà C (ngày D-2 chỉ ≈ 85 % trong ngưỡng)
  await evaluateRecommendationRules(day(2), now, [String(houseC._id)])

  const suggestion = await getTuningSuggestion(owner, String(zoneA._id), now)
  logger.info(`[seed:demo] Gợi ý hệ số tầng A (DS-09): ${suggestion.suggestion ? 'có' : `chưa có — ${suggestion.reason}`}`)

  logger.info(`[seed:demo] Xong. Tài khoản (mật khẩu ${process.env.DEMO_PASSWORD ? 'DEMO_PASSWORD' : password}): owner@, tech@ (nhà A, B, C), tech2@ (nhà D), expert@, admin@, owner2@ (${NO_EXPERT_FARM})`)
  // Khoá chỉ in ra đây, không lưu ở đâu khác: nạp vào thiết bị bằng firmware/tools/flash_identity.py
  console.table(deviceKeys)
  await mongoose.disconnect()
}

seedDemo().catch(async (err: Error) => {
  logger.error('[seed:demo] Failed', { err: err.message })
  await mongoose.disconnect()
  process.exit(1)
})
