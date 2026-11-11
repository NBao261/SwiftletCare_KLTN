/**
 * ANALYTICS-FR-012, BR-28…30 — trạng thái sức khỏe ngày của nhà yến (TC-F20-01…03, DS-21, DS-22).
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House } from '@/models/houseZone.model'
import { Alert } from '@/models/alert.model'
import { vnDate } from '@/services/birdCount.service'
import { addDays, assessAllHouses, assessHouseDay, computeHouseDay, recomputeForAlert, vnDayStart } from '@/services/healthAssessment.service'
import { notifyUser } from '@/services/notification.service'
import {
  HEALTH_MODELS, SLOTS_PER_DAY, seedCounts, seedDryWeather, seedHouse, seedNoise, seedRainOverEvening, seedTelemetry,
} from '../helpers/healthDay'

jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

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
  jest.clearAllMocks()
  await Promise.all(HEALTH_MODELS.map(m => (m as typeof House).deleteMany({})))
})

const DATE = '2026-10-20'
const NOW = vnDayStart(addDays(DATE, 1))
/** 15 % mẫu độ ẩm ngoài ngưỡng → 85 % trong ngưỡng: SLIGHT (dưới 90, không dưới 75) */
const HUMIDITY_SLIGHT = Math.round(SLOTS_PER_DAY * 0.15)
/** Nền 3 ngày 100 %, hôm nay 70 %: giảm 30 % ≥ return_rate_drop_pct 20 → CLEAR */
const FLOCK_CLEAR = [100, 100, 100, 70]

async function scenario(opts: { humidityOutSlots?: number; sound?: boolean; rates?: (number | null)[]; weather?: boolean } = {}) {
  const seeded = await seedHouse()
  await seedTelemetry(seeded.zone, DATE, { humidityOutSlots: opts.humidityOutSlots, sound: opts.sound })
  await seedCounts(seeded.house, DATE, opts.rates ?? [100, 100, 100, 100])
  if (opts.weather !== false) await seedDryWeather(seeded.farm, DATE)
  return seeded
}
const compute = (houseId: unknown) => computeHouseDay(String(houseId), DATE, NOW)
/** Lý do có cấu trúc (mã + số liệu), không phải câu — web, mobile tự dịch */
const reasonOf = (code: string, fields: object = {}) => expect.objectContaining({ code, ...fields })

describe('TC-F20-01 — đồng thuận giữa các nguồn', () => {
  it('đàn chim CLEAR + độ ẩm SLIGHT → ACTION, lý do nêu cả hai kèm số liệu', async () => {
    const { house } = await scenario({ humidityOutSlots: HUMIDITY_SLIGHT, rates: FLOCK_CLEAR })
    const a = await compute(house._id)

    expect(a?.current_status).toBe('ACTION')
    expect(a?.indicators.flock).toMatchObject({ value: 30, level: 'CLEAR' })
    expect(a?.indicators.environment).toMatchObject({ value: 85, level: 'SLIGHT' })
    expect(a?.indicators.air.level).toBe('NORMAL')
    expect(a?.current_reasons).toEqual(expect.arrayContaining([
      reasonOf('FLOCK_DROP', { source: 'flock', level: 'CLEAR', values: { return_rate: 70, drop_pct: 30, baseline_avg: 100, baseline_days: 3 } }),
      reasonOf('ENV_IN_RANGE', { source: 'environment', level: 'SLIGHT', values: expect.objectContaining({ in_range_pct: 85 }) }),
    ]))
  })

  it('mức của nhà đổi thì mức chỉ số đổi theo (BR-28: chuyên gia đặt mức)', async () => {
    const { house } = await scenario({ humidityOutSlots: HUMIDITY_SLIGHT, rates: FLOCK_CLEAR })
    await House.updateOne({ _id: house._id }, { 'health_levels.in_range_slight_pct': 80, 'health_levels.in_range_clear_pct': 70 })
    const a = await compute(house._id)
    expect(a?.indicators.environment.level).toBe('NORMAL')
    expect(a?.current_status).toBe('WATCH')
  })
})

describe('TC-F20-02 — một nguồn đơn lẻ và mưa (BR-29, BR-30)', () => {
  it('chỉ đàn chim CLEAR → WATCH', async () => {
    const { house } = await scenario({ rates: FLOCK_CLEAR })
    expect((await compute(house._id))?.current_status).toBe('WATCH')
  })

  it('đàn chim CLEAR + tiếng ồn SLIGHT, không mưa → ACTION, bằng chứng có cảnh báo ồn', async () => {
    const { farm, house, zone } = await scenario({ rates: FLOCK_CLEAR })
    const noise = await seedNoise(farm, zone, DATE)
    const a = await compute(house._id)
    expect(a?.current_status).toBe('ACTION')
    expect(a?.indicators.noise).toMatchObject({ value: 1, level: 'SLIGHT' })
    expect(a?.evidence.noise_alert_ids.map(String)).toEqual([String(noise._id)])
  })

  it('cùng ngày đó có mưa 2 mm trùng phiên chiều và đợt ồn → WATCH, lý do nêu mưa', async () => {
    const { farm, house, zone } = await scenario({ rates: FLOCK_CLEAR })
    await seedNoise(farm, zone, DATE)
    await seedRainOverEvening(farm, house, DATE, 2)
    const a = await compute(house._id)
    expect(a?.current_status).toBe('WATCH')
    expect(a?.current_reasons).toContainEqual({ code: 'RAIN_DOWNGRADE', source: null, level: null, values: { mm_per_hour: 1 } })
  })

  it('mưa dưới 1 mm không đổi gì', async () => {
    const { farm, house, zone } = await scenario({ rates: FLOCK_CLEAR })
    await seedNoise(farm, zone, DATE)
    await seedRainOverEvening(farm, house, DATE, 0.5)
    expect((await compute(house._id))?.current_status).toBe('ACTION')
  })

  it('mưa không hạ ACTION do môi trường (chỉ khi nguồn quyết định đúng là đàn chim + tiếng ồn)', async () => {
    const { farm, house, zone } = await scenario({ humidityOutSlots: HUMIDITY_SLIGHT, rates: FLOCK_CLEAR })
    await seedNoise(farm, zone, DATE)
    await seedRainOverEvening(farm, house, DATE, 2)
    expect((await compute(house._id))?.current_status).toBe('ACTION')
  })

  it('NOISE_ANOMALY đã bị bác bỏ (DISMISSED) không được tính', async () => {
    const { farm, house, zone } = await scenario({ rates: FLOCK_CLEAR })
    await seedNoise(farm, zone, DATE, 'DISMISSED')
    const a = await compute(house._id)
    expect(a?.indicators.noise).toMatchObject({ value: 0, level: 'NORMAL' })
    expect(a?.current_status).toBe('WATCH')
  })
})

describe('TC-F20-03 — thiếu dữ liệu (DS-22)', () => {
  it('thiếu phiên chiều → INSUFFICIENT_DATA (không bao giờ GOOD), lý do nêu phiên thiếu', async () => {
    const { house } = await scenario({ rates: [100, 100, 100, null] })
    const a = await compute(house._id)
    expect(a?.current_status).toBe('INSUFFICIENT_DATA')
    expect(a?.completeness.flock).toBe(false)
    expect(a?.current_reasons[0]).toEqual({ code: 'MISSING_DATA', source: 'flock', level: null, values: { missing: 'EVENING' } })
  })

  it('mẫu nhiệt độ, độ ẩm hợp lệ dưới 80 % → INSUFFICIENT_DATA', async () => {
    const seeded = await seedHouse()
    await seedTelemetry(seeded.zone, DATE, { slots: Math.round(SLOTS_PER_DAY * 0.7) })
    await seedCounts(seeded.house, DATE, [100, 100, 100, 100])
    const a = await compute(seeded.house._id)
    expect(a?.current_status).toBe('INSUFFICIENT_DATA')
    expect(a?.current_reasons[0]).toEqual(reasonOf('MISSING_DATA', { source: 'environment', values: expect.objectContaining({ min_pct: 80 }) }))
  })

  it('không có mẫu độ ồn → vẫn đánh giá, tiếng ồn không đánh giá và lý do ghi rõ', async () => {
    const { house } = await scenario({ sound: false })
    const a = await compute(house._id)
    expect(a?.current_status).toBe('GOOD')
    expect(a?.indicators.noise).toMatchObject({ value: null, level: null })
    expect(a?.current_reasons).toEqual([
      reasonOf('ALL_NORMAL'), { code: 'NOT_ASSESSED', source: 'noise', level: null, values: {} },
    ])
  })

  it('không có thời tiết → trạng thái giữ nguyên, lý do ghi "Không có dữ liệu thời tiết"', async () => {
    const { house } = await scenario({ weather: false })
    const a = await compute(house._id)
    expect(a?.current_status).toBe('GOOD')
    expect(a?.current_reasons).toContainEqual({ code: 'WEATHER_UNAVAILABLE', source: null, level: null, values: {} })
    expect(a?.weather).toBeNull()
  })

  it('chưa đủ 3 ngày nền → đàn chim bình thường, lý do nêu chưa đủ ngày nền', async () => {
    const { house } = await scenario({ rates: [100, 60] })
    const a = await compute(house._id)
    expect(a?.indicators.flock).toMatchObject({ value: null, level: 'NORMAL' })
    expect(a?.current_reasons).toContainEqual(reasonOf('FLOCK_NO_BASELINE', { source: 'flock', values: { min_days: 3, baseline_days: 1 } }))
  })
})

describe('job đánh giá (SM-17)', () => {
  it('ngày mới: ghi 1 bản ghi và báo "ngày đã sẵn sàng" không kèm trạng thái cho người chấm, không báo chuyên gia; chạy lại không trùng, không báo lại', async () => {
    const { house, owner, expert } = await scenario({ humidityOutSlots: HUMIDITY_SLIGHT, rates: FLOCK_CLEAR })
    expect(await assessAllHouses(DATE, NOW)).toBe(1)
    expect(await assessAllHouses(DATE, NOW)).toBe(0)

    expect(await HouseHealthDay.countDocuments({ house_id: house._id })).toBe(1)
    // Chỉ người chấm được báo (BR-31, Report 3 4.2.0): chuyên gia không chấm nên không nhận
    const recipients = (notifyUser as jest.Mock).mock.calls.map(c => c[0])
    expect(recipients).toEqual([String(owner._id)])
    expect(recipients).not.toContain(String(expert!._id))
    for (const [, message] of (notifyUser as jest.Mock).mock.calls) {
      expect(JSON.stringify(message)).not.toMatch(/ACTION|WATCH|GOOD|Cần xử lý/)
      expect(message.ref.kind).toBe('health_day')
    }
  })

  it('chuyên gia bác bỏ NOISE_ANOMALY của ngày đã đánh giá → tính lại ngay, ACTION thành WATCH', async () => {
    const { farm, house, zone } = await scenario({ rates: FLOCK_CLEAR })
    const noise = await seedNoise(farm, zone, DATE)
    // Ngày trong 7 ngày gần nhất mới được tính lại — dùng ngày thật
    const today = vnDate(new Date())
    await seedTelemetry(zone, today)
    await seedCounts(house, today, FLOCK_CLEAR)
    const todayNoise = await seedNoise(farm, zone, today)
    await assessHouseDay(String(house._id), today, new Date(vnDayStart(today).getTime() + 86_400_000))
    expect((await HouseHealthDay.findOne({ house_id: house._id, date: today }).lean())!.current_status).toBe('ACTION')

    await Alert.updateOne({ _id: todayNoise._id }, { status: 'DISMISSED' })
    await recomputeForAlert(todayNoise)
    const after = await HouseHealthDay.findOne({ house_id: house._id, date: today }).lean()
    expect(after!.current_status).toBe('WATCH')
    expect(after!.indicators.noise.value).toBe(0)

    // Ngày ngoài 7 ngày (DATE) chưa đánh giá → không tạo mới
    await recomputeForAlert(noise)
    expect(await HouseHealthDay.exists({ house_id: house._id, date: DATE })).toBeNull()
  })

  it('tính lại giữ nguyên ratings', async () => {
    const { house, owner } = await scenario({ rates: FLOCK_CLEAR })
    const first = await assessHouseDay(String(house._id), DATE, NOW)
    await HouseHealthDay.updateOne({ _id: first!.day._id }, {
      $push: { ratings: { by: owner._id, role: 'FARM_OWNER', outcome: 'RATED', rating: 'GOOD', at: NOW, snapshot: { status: 'WATCH', reasons: [{ code: 'FLOCK_DROP', source: 'flock', level: 'CLEAR', values: { drop_pct: 30 } }] } } },
    })
    const again = await assessHouseDay(String(house._id), DATE, NOW)
    expect(again?.created).toBe(false)
    expect(again?.day.ratings).toHaveLength(1)
  })
})

describe('BR-46 — nhà giai đoạn dẫn dụ (FARM-FR-014)', () => {
  /** Đổi giai đoạn lúc 08:00 giờ VN của ngày `date` */
  const stageAt = (stage: 'ATTRACTING' | 'OCCUPIED', date: string) =>
    ({ stage, changed_by: new mongoose.Types.ObjectId(), changed_by_role: 'FARM_OWNER', changed_at: new Date(vnDayStart(date).getTime() + 8 * 3600_000) })

  it('nhà ATTRACTING: không đánh giá đàn chim, không thành INSUFFICIENT_DATA vì thiếu số đếm, lý do ghi giai đoạn dẫn dụ', async () => {
    const { house } = await scenario({ rates: [100, 100, 100, null] })
    await House.updateOne({ _id: house._id }, { stage: 'ATTRACTING', stage_history: [stageAt('ATTRACTING', addDays(DATE, -10))] })
    const a = await compute(house._id)
    expect(a?.current_status).toBe('GOOD')
    expect(a?.indicators.flock).toMatchObject({ value: null, level: null })
    expect(a?.current_reasons).toContainEqual({ code: 'ATTRACTING_STAGE', source: 'flock', level: null, values: {} })
    expect(a?.current_reasons).not.toContainEqual(reasonOf('MISSING_DATA', { source: 'flock' }))
  })

  it('nhà ATTRACTING: đàn chim giảm mạnh không góp vào trạng thái', async () => {
    const { house } = await scenario({ rates: FLOCK_CLEAR, humidityOutSlots: HUMIDITY_SLIGHT })
    await House.updateOne({ _id: house._id }, { stage: 'ATTRACTING', stage_history: [stageAt('ATTRACTING', addDays(DATE, -10))] })
    const a = await compute(house._id)
    // Không có ATTRACTING thì đàn chim CLEAR + độ ẩm SLIGHT là ACTION (TC-F20-01); ở đây chỉ còn độ ẩm SLIGHT
    expect(a?.current_status).toBe('GOOD')
    expect(a?.current_reasons).not.toContainEqual(reasonOf('FLOCK_DROP'))
  })

  it('về OCCUPIED: nền so sánh chỉ gồm các ngày sau lần chuyển; ngày cũ tính lại theo giai đoạn lúc ấy', async () => {
    const { house } = await scenario({ rates: FLOCK_CLEAR })
    await House.updateOne({ _id: house._id }, {
      stage: 'OCCUPIED',
      stage_history: [stageAt('ATTRACTING', addDays(DATE, -20)), stageAt('OCCUPIED', addDays(DATE, -2))],
    })
    const a = await compute(house._id)
    // Chỉ còn 1 ngày nền (DATE-1) → chưa đủ 3 ngày, đàn chim bình thường
    expect(a?.indicators.flock).toMatchObject({ value: null, level: 'NORMAL' })
    expect(a?.current_reasons).toContainEqual(reasonOf('FLOCK_NO_BASELINE', { values: { min_days: 3, baseline_days: 1 } }))

    // Ngày trước lần chuyển vẫn là ATTRACTING khi tính lại
    const earlier = await computeHouseDay(String(house._id), addDays(DATE, -3), NOW)
    expect(earlier?.current_reasons).toContainEqual(reasonOf('ATTRACTING_STAGE'))
  })
})
