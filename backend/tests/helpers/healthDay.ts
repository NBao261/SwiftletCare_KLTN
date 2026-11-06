import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Farm } from '@/models/farm.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { addDays, vnDayStart } from '@/services/healthAssessment.service'

/** Dữ liệu cho test đánh giá sức khỏe ngày (ANALYTICS-FR-012) */
export const HEALTH_MODELS = [Alert, BirdCountBucket, BirdCountRecord, Farm, HouseHealthDay, House, Zone, Telemetry, User, WeatherObservation]

export const SLOTS_PER_DAY = 8640
const SLOT_MS = 10_000
const HOUR = 3600_000
let seq = 0

/** Chủ trại + chuyên gia + farm (có toạ độ) + 1 nhà + 1 Zone (ngưỡng mặc định: ẩm 75–95, nhiệt 26–31) */
export async function seedHouse(opts: { withExpert?: boolean } = {}) {
  seq++
  const owner = await User.create({ email: `ho${seq}@test.vn`, password_hash: 'password123', full_name: `Chủ ${seq}`, role: 'FARM_OWNER' })
  const expert = opts.withExpert === false ? null
    : await User.create({ email: `he${seq}@test.vn`, password_hash: 'password123', full_name: `CG ${seq}`, role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id, coordinates: { lat: 10.8, lng: 106.6 },
    members: [{ user_id: owner._id, is_primary: true }, ...(expert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: `Nhà ${seq}` })
  const zone = await Zone.create({ house_id: house._id, name: 'Tầng 1' })
  return { owner, expert, farm, house, zone }
}

/**
 * Đủ 8640 mẫu (1 mẫu / 10 giây) của ngày `date`. `humidityOutSlots` mẫu đầu có độ ẩm 60 % (ngoài
 * ngưỡng); `sound: false` bỏ độ ồn (tiếng ồn không đánh giá được); `slots` < 8640 để thiếu dữ liệu.
 */
export async function seedTelemetry(zone: { _id: unknown }, date: string, opts: { humidityOutSlots?: number; sound?: boolean; slots?: number } = {}) {
  const start = vnDayStart(date).getTime()
  const docs = []
  for (let i = 0; i < (opts.slots ?? SLOTS_PER_DAY); i++) {
    docs.push({
      node_id: new Types.ObjectId(), zone_id: zone._id, timestamp: new Date(start + i * SLOT_MS),
      temperature: 28, humidity: i < (opts.humidityOutSlots ?? 0) ? 60 : 85,
      nh3_ppm: 5, co2_ppm: 600, ...(opts.sound !== false && { sound_db: 40 }),
    })
  }
  await Telemetry.insertMany(docs, { lean: true })
}

/** Số đếm 2 phiên: `rates[i]` là tỷ lệ chim về (%) của ngày date − (rates.length − 1 − i); null = thiếu phiên chiều */
export async function seedCounts(house: { _id: unknown }, date: string, rates: (number | null)[]) {
  const camera = new Types.ObjectId()
  const docs = []
  for (let i = 0; i < rates.length; i++) {
    const day = addDays(date, i - (rates.length - 1))
    const start = vnDayStart(day).getTime()
    docs.push({ camera_node_id: camera, house_id: house._id, session_type: 'MORNING_EXIT', session_date: day, timestamp: new Date(start + 6 * HOUR), entry_count: 0, exit_count: 1000 })
    const rate = rates[i]
    if (rate !== null) {
      docs.push({ camera_node_id: camera, house_id: house._id, session_type: 'EVENING_ENTRY', session_date: day, timestamp: new Date(start + 19 * HOUR), entry_count: rate * 10, exit_count: 0 })
    }
  }
  await BirdCountRecord.insertMany(docs)
  return camera
}

/** 1 đợt NOISE_ANOMALY lúc 18:05–18:20 giờ VN của ngày */
export const seedNoise = (farm: { _id: unknown }, zone: { _id: unknown }, date: string, status = 'ACTIVE') => {
  const at = vnDayStart(date).getTime() + 18 * HOUR + 5 * 60_000
  return Alert.create({
    farm_id: farm._id, zone_id: zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'Ồn', message: 'Ồn',
    status, created_at: new Date(at), last_seen_at: new Date(at + 15 * 60_000),
  })
}

/** Phiên chiều có số đếm 5 phút lúc 18:00 và mưa `mm` trong giờ 18:00–19:00 giờ VN */
export async function seedRainOverEvening(farm: { _id: unknown }, house: { _id: unknown }, date: string, mm: number) {
  const evening = vnDayStart(date).getTime() + 18 * HOUR
  await BirdCountBucket.create({ camera_node_id: new Types.ObjectId(), house_id: house._id, bucket_start: new Date(evening), entry_count: 10, exit_count: 0 })
  await WeatherObservation.create({ farm_id: farm._id, hour: new Date(evening), temperature: 27, humidity: 90, precipitation_mm: mm })
}

/** Có thời tiết khô cả ngày (để lý do không có "Không có dữ liệu thời tiết") */
export const seedDryWeather = (farm: { _id: unknown }, date: string) =>
  WeatherObservation.create({ farm_id: farm._id, hour: vnDayStart(date), temperature: 26, humidity: 80, precipitation_mm: 0 })
