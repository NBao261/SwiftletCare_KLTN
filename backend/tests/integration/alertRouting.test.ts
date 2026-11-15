/**
 * ALERT-FR-017, BR-40 — cảnh báo của nhà tới thợ đang trực; Farm Owner sau 15 phút chưa xác nhận, đúng 1 lần;
 * CRITICAL tới cả hai cùng lúc; nhà không có thợ thì Farm Owner. ALERT-FR-015 gửi lại cho người đã nhận.
 * EXPERT-FR-021 — cảnh báo suy luận ở nhà có thợ tạo đúng 1 yêu cầu kiểm tra tại chỗ.
 */
import { Alert } from '@/models/alert.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import { acknowledgeAlert, createAlert, renotifyStaleAlerts, setAlertVerdict } from '@/services/alert.service'
import { escalateUnacknowledgedAlerts } from '@/services/alertRouting.service'
import { dispatchAlertNotification } from '@/services/notification.service'
import type { AlertType, CurrentUser } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

useTestDb()
afterEach(() => Notification.deleteMany({}))

let seq = 0
async function technician(farm: Awaited<ReturnType<typeof seedOwnerFarm>>['farm']) {
  seq++
  const user = await User.create({ email: `route${seq}@test.vn`, password_hash: 'password123', full_name: `T${seq}`, role: 'FARM_TECHNICIAN' })
  farm.members.push({ user_id: user._id, role: 'FARM_TECHNICIAN' } as never)
  await farm.save()
  return user
}

/** Farm có 1 nhà; `withTechnician` = thợ chính được giao nhà */
async function seed(withTechnician = true) {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const tech = withTechnician ? await technician(ctx.farm) : null
  if (tech) {
    house.technicians = [{ user_id: tech._id, primary: true }] as never
    await house.save()
  }
  const raise = (type: AlertType, severity?: 'CRITICAL' | 'HIGH') => createAlert({
    farmId: String(ctx.farm._id), zoneId: String(ctx.zone._id), nodeId: String(ctx.node._id),
    type, severity, title: `${type} tại Z`, message: 'chi tiết',
  })
  return { ...ctx, house, tech, raise }
}

const ago = (min: number) => new Date(Date.now() - min * 60_000)
const lastDispatch = () => (dispatchAlertNotification as jest.Mock).mock.calls.at(-1) as [{ _id: unknown }, Record<string, unknown>]

describe('định tuyến cảnh báo (ALERT-FR-017)', () => {
  it('HIGH ở nhà có thợ chỉ tới thợ; sau 15 phút chưa xác nhận thì tới Farm Owner đúng 1 lần', async () => {
    const { owner, tech, raise } = await seed()
    const alert = (await raise('UNEXPECTED_RESTART'))!
    expect(lastDispatch()[1]).toEqual({ awaitsVerdict: false, recipientIds: [String(tech!._id)] })
    expect((await Alert.findById(alert._id).lean())!.routing).toEqual({ technician_id: tech!._id, owners_notified: false })

    expect(await escalateUnacknowledgedAlerts()).toBe(0)
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(16) } })
    expect(await escalateUnacknowledgedAlerts()).toBe(1)
    expect(lastDispatch()[1]).toEqual({ escalation: true, recipientIds: [String(owner._id)] })
    expect((await Alert.findById(alert._id).lean())!.escalated_at).toBeInstanceOf(Date)
    expect(await escalateUnacknowledgedAlerts()).toBe(0)
  })

  it('thợ xác nhận trước hạn thì không leo thang', async () => {
    const { tech, raise } = await seed()
    const alert = (await raise('UNEXPECTED_RESTART'))!
    const techUser: CurrentUser = { _id: String(tech!._id), email: tech!.email, role: 'FARM_TECHNICIAN' }
    await acknowledgeAlert(String(alert._id), techUser, 'đang xem')
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(30) } })
    expect(await escalateUnacknowledgedAlerts()).toBe(0)
  })

  it('CRITICAL tới thợ và Farm Owner cùng lúc, không leo thang thêm', async () => {
    const { owner, tech, raise } = await seed()
    const alert = (await raise('RS485_BUS_FAILURE'))!
    expect(alert.severity).toBe('CRITICAL')
    expect(lastDispatch()[1]).toEqual({ awaitsVerdict: false, recipientIds: [String(tech!._id), String(owner._id)] })
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(30) } })
    expect(await escalateUnacknowledgedAlerts()).toBe(0)
  })

  it('nhà không có thợ: Farm Owner nhận ngay', async () => {
    const { owner, raise } = await seed(false)
    const alert = (await raise('UNEXPECTED_RESTART'))!
    expect(lastDispatch()[1]).toEqual({ awaitsVerdict: false, recipientIds: [String(owner._id)] })
    expect((await Alert.findById(alert._id).lean())!.routing).toEqual({ owners_notified: true })
  })

  it('trong ca thợ phụ thì thợ phụ nhận (AUTH-FR-014)', async () => {
    const { farm, house, tech, raise } = await seed()
    const backup = await technician(farm)
    house.technicians.push({ user_id: backup._id, primary: false } as never)
    house.roster = [{ technician_id: backup._id, role: 'BACKUP', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' }] as never
    await house.save()
    await raise('UNEXPECTED_RESTART')
    expect(lastDispatch()[1].recipientIds).toEqual([String(backup._id)])
    expect(lastDispatch()[1].recipientIds).not.toContain(String(tech!._id))
  })

  it('nhà có thợ nhưng không có thợ chính (chưa đặt, hoặc thợ chính bị khoá): thợ hợp lệ nhận, không về Farm Owner', async () => {
    const { farm, house, tech, raise } = await seed()
    const second = await technician(farm)
    house.technicians = [{ user_id: tech!._id, primary: true }, { user_id: second._id, primary: false }] as never
    await house.save()
    await User.updateOne({ _id: tech!._id }, { is_active: false })
    await raise('UNEXPECTED_RESTART')
    expect(lastDispatch()[1].recipientIds).toEqual([String(second._id)])
  })

  it('thợ bị khoá hoặc đã rời farm không nhận: Farm Owner nhận', async () => {
    const { owner, tech, raise } = await seed()
    await User.updateOne({ _id: tech!._id }, { is_active: false })
    await raise('UNEXPECTED_RESTART')
    expect(lastDispatch()[1].recipientIds).toEqual([String(owner._id)])
  })

  it('định tuyến lỗi vẫn gửi cảnh báo cho Farm Owner như trước (không mất cảnh báo)', async () => {
    const { raise } = await seed()
    jest.spyOn(Zone, 'findById').mockImplementationOnce(() => { throw new Error('db down') })
    const alert = (await raise('RS485_BUS_FAILURE'))!
    expect(lastDispatch()).toEqual([expect.objectContaining({ _id: alert._id }), { awaitsVerdict: false }])
    expect((await Alert.findById(alert._id).lean())!.routing).toBeUndefined()
  })
})

describe('cảnh báo bị bác bỏ rồi được xác nhận lại (SM-01)', () => {
  it('báo lại cả thợ đang trực lẫn Farm Owner; job leo thang không báo Farm Owner thêm lần nữa (BR-40)', async () => {
    const { owner, farm, tech, raise } = await seed()
    const expert = await User.create({ email: `exp${++seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
    farm.members.push({ user_id: expert._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const expertUser: CurrentUser = { _id: String(expert._id), email: expert.email, role: 'DOMAIN_EXPERT' }
    const alert = (await raise('SENSOR_ANOMALY'))!

    await setAlertVerdict(String(alert._id), expertUser, 'REJECTED', 'Cảm biến vừa lau')
    await setAlertVerdict(String(alert._id), expertUser, 'CONFIRMED')
    expect(lastDispatch()[1]).toEqual({ recipientIds: [String(tech!._id), String(owner._id)] })
    expect((await Alert.findById(alert._id).lean())!.routing).toMatchObject({ technician_id: tech!._id, owners_notified: true })

    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(30) } })
    expect(await escalateUnacknowledgedAlerts()).toBe(0)
  })

  it('giữ thợ được định tuyến lúc tạo cho MTTA/MTTR, nhưng báo lại cho thợ đang trực lúc xác nhận lại', async () => {
    const { owner, farm, house, tech, raise } = await seed()
    const expert = await User.create({ email: `exp${++seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
    farm.members.push({ user_id: expert._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const expertUser: CurrentUser = { _id: String(expert._id), email: expert.email, role: 'DOMAIN_EXPERT' }
    const alert = (await raise('SENSOR_ANOMALY'))!
    await setAlertVerdict(String(alert._id), expertUser, 'REJECTED', 'nhầm')
    // Hôm sau thợ khác trực
    const next = await technician(farm)
    house.technicians = [{ user_id: next._id, primary: true }] as never
    await house.save()
    await setAlertVerdict(String(alert._id), expertUser, 'CONFIRMED')
    expect(lastDispatch()[1]).toEqual({ recipientIds: [String(next._id), String(owner._id)] })
    expect((await Alert.findById(alert._id).lean())!.routing).toMatchObject({ technician_id: tech!._id, owners_notified: true })
  })
})

describe('gửi lại cảnh báo chưa xác nhận (ALERT-FR-015) theo người đã nhận', () => {
  it('thợ nhận "Nhắc lại"; Farm Owner đã nhận bản leo thang thì không nhận thêm', async () => {
    const { tech, raise } = await seed()
    const alert = (await raise('UNEXPECTED_RESTART'))!
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(20) } })
    await escalateUnacknowledgedAlerts()
    expect(await renotifyStaleAlerts()).toBe(1)
    expect(lastDispatch()[1]).toEqual({ repeat: true, recipientIds: [String(tech!._id)] })
  })

  it('thợ bị gỡ khỏi nhà sau khi nhận thì không nhận "Nhắc lại" (AUTH-FR-013)', async () => {
    const { owner, house, raise } = await seed()
    const alert = (await raise('RS485_BUS_FAILURE'))!
    house.technicians = [] as never
    await house.save()
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(20) } })
    expect(await renotifyStaleAlerts()).toBe(1)
    expect(lastDispatch()[1]).toEqual({ repeat: true, recipientIds: [String(owner._id)] })
  })

  it('CRITICAL: gửi lại cho cả thợ và Farm Owner', async () => {
    const { owner, tech, raise } = await seed()
    const alert = (await raise('RS485_BUS_FAILURE'))!
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(20) } })
    expect(await renotifyStaleAlerts()).toBe(1)
    expect(lastDispatch()[1]).toEqual({ repeat: true, recipientIds: [String(tech!._id), String(owner._id)] })
  })
})

describe('yêu cầu kiểm tra tại chỗ (EXPERT-FR-021)', () => {
  it('cảnh báo suy luận ở nhà có thợ: đúng 1 yêu cầu cho thợ đang trực, báo trong ứng dụng', async () => {
    const { tech, raise } = await seed()
    const alert = (await raise('NOISE_ANOMALY'))!
    expect(lastDispatch()[1]).toEqual({ awaitsVerdict: true, recipientIds: [String(tech!._id)] })
    const stored = (await Alert.findById(alert._id).lean())!
    expect(stored.onsite_checks).toHaveLength(1)
    expect(stored.onsite_checks[0]).toMatchObject({ technician_id: tech!._id })
    expect(stored.onsite_checks[0].answered_at).toBeUndefined()
    expect(await Notification.countDocuments({ user_id: tech!._id, 'ref.kind': 'alert', 'ref.id': alert._id })).toBe(1)

    // Lần gặp lại cùng sự cố bị gộp: không thêm yêu cầu
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { last_seen_at: ago(5) } })
    expect(await raise('NOISE_ANOMALY')).toBeNull()
    expect((await Alert.findById(alert._id).lean())!.onsite_checks).toHaveLength(1)
  })

  it('nhà không có thợ: không có yêu cầu, chuyên gia kết luận trên dữ liệu', async () => {
    const { raise } = await seed(false)
    const alert = (await raise('NOISE_ANOMALY'))!
    expect((await Alert.findById(alert._id).lean())!.onsite_checks).toEqual([])
  })

  it('cảnh báo đo trực tiếp không tạo yêu cầu kiểm tra', async () => {
    const { raise } = await seed()
    const alert = (await raise('UNEXPECTED_RESTART'))!
    expect((await Alert.findById(alert._id).lean())!.onsite_checks).toEqual([])
  })
})
