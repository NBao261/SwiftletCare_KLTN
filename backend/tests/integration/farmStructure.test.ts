import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { Recommendation } from '@/models/recommendation.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { listActiveHouseIds } from '@/utils/farmAccess.util'
import { listReviews } from '@/services/expertReview.service'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn(), emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use(requestContext)
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findById(ctx.zone.house_id))!
  house.floors = 3
  await house.save()
  const expert = await User.create({ email: `e${String(ctx.farm._id)}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  await Farm.updateOne({ _id: ctx.farm._id }, { $push: { members: { user_id: expert._id, role: 'DOMAIN_EXPERT' } } })
  const as = (token: string) => ({
    put: (path: string, body: object) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
    del: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
    get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  })
  const decommission = () => SensorNode.updateOne({ _id: ctx.node._id }, { decommissioned_at: new Date(), status: 'DECOMMISSIONED' })
  return { ...ctx, ownerDoc: ctx.owner, house, owner: as(ctx.token), expert: as(tokenFor(expert._id, 'DOMAIN_EXPERT')), decommission }
}

describe('sửa nhà và Zone (FARM-FR-002)', () => {
  it('Farm Owner đổi tên, số tầng, mô tả của nhà; ghi audit cũ → mới', async () => {
    const { house, owner } = await seed()
    const res = await owner.put(`/farms/houses/${house._id}`, { name: 'Nhà sau', floors: 2, description: 'Cạnh ao' }).expect(200)
    expect(res.body.data).toMatchObject({ name: 'Nhà sau', floors: 2, description: 'Cạnh ao' })
    const audit = (await AuditLog.findOne({ action: 'HOUSE_UPDATED' }).lean())!
    expect(audit.metadata).toMatchObject({ before: { name: 'H', floors: 3 }, after: { name: 'Nhà sau', floors: 2 } })
  })

  it('từ chối tên trùng (409), số tầng thấp hơn tầng của Zone (400), tên quá 50 ký tự (422)', async () => {
    const { house, zone, farm, owner } = await seed()
    await House.create({ farm_id: farm._id, name: 'Nhà B' })
    await Zone.updateOne({ _id: zone._id }, { floor: 3 })
    await owner.put(`/farms/houses/${house._id}`, { name: 'nhà b' }).expect(409)
    await owner.put(`/farms/houses/${house._id}`, { floors: 2 }).expect(400)
    await owner.put(`/farms/houses/${house._id}`, { name: 'x'.repeat(51) }).expect(422)
    await owner.put(`/farms/houses/${house._id}`, { floors: 11 }).expect(422)
  })

  it('Zone: đổi tên, tầng; tầng vượt số tầng của nhà bị từ chối (400)', async () => {
    const { zone, owner } = await seed()
    await owner.put(`/farms/zones/${zone._id}`, { name: 'Tầng thượng', floor: 3 }).expect(200)
    expect((await Zone.findById(zone._id).lean())!).toMatchObject({ name: 'Tầng thượng', floor: 3 })
    await owner.put(`/farms/zones/${zone._id}`, { floor: 4 }).expect(400)
  })

  it('Domain Expert không sửa hay xoá được nhà và Zone (403)', async () => {
    const { house, zone, expert } = await seed()
    await expert.put(`/farms/houses/${house._id}`, { name: 'x' }).expect(403)
    await expert.put(`/farms/zones/${zone._id}`, { name: 'x' }).expect(403)
    await expert.del(`/farms/houses/${house._id}`).expect(403)
    await expert.del(`/farms/zones/${zone._id}`).expect(403)
  })
})

describe('xoá mềm nhà và Zone (FARM-FR-002, Q-01)', () => {
  it('nhà và Zone tạo trước khi có trường is_deleted vẫn hiện (không cần migration)', async () => {
    const { farm, owner } = await seed()
    const raw = await House.collection.insertOne({ farm_id: farm._id, name: 'Nhà cũ', floors: 1 })
    await Zone.collection.insertOne({ house_id: raw.insertedId, farm_id: farm._id, name: 'Tầng cũ', floor: 1 })
    const houses = (await owner.get(`/farms/${farm._id}/houses`).expect(200)).body.data as Array<{ name: string }>
    expect(houses.map(h => h.name)).toContain('Nhà cũ')
    expect((await owner.get(`/farms/houses/${raw.insertedId}/zones`).expect(200)).body.data).toHaveLength(1)
    expect((await listActiveHouseIds()).map(String)).toContain(String(raw.insertedId))
  })

  it('còn thiết bị đang dùng thì 409 HAS_ACTIVE_DEVICES; gỡ xong thì xoá được', async () => {
    const { house, zone, owner, decommission } = await seed()
    const blocked = await owner.del(`/farms/houses/${house._id}`).expect(409)
    expect(blocked.body.error.code).toBe('HAS_ACTIVE_DEVICES')
    await owner.del(`/farms/zones/${zone._id}`).expect(409)
    await decommission()
    await owner.del(`/farms/houses/${house._id}`).expect(200)
  })

  it('xoá nhà: đóng cảnh báo, huỷ Work Order, thôi kế hoạch; nhà và Zone rời danh sách và job; lịch sử còn', async () => {
    const { ownerDoc, house, zone, node, farm, owner, decommission } = await seed()
    await decommission()
    const alert = await Alert.create({
      farm_id: farm._id, zone_id: zone._id, node_id: node._id, type: 'SENSOR_FAULT', severity: 'MEDIUM', title: 't', message: 'm',
    })
    const workOrder = await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, zone_id: zone._id, alert_id: alert._id, origin: 'ALERT', title: 'Sửa cảm biến',
      status: 'IN_PROGRESS', is_open: true,
    })
    const plan = await MaintenancePlan.create({
      farm_id: farm._id, house_id: house._id, equipment: 'NOZZLE', basis: 'CALENDAR', interval: 30, source: 'nhà sản xuất',
      checklist_template: ['Rửa béc'], created_by: ownerDoc._id,
    })
    await Telemetry.create({ node_id: node._id, zone_id: zone._id, timestamp: new Date(), temperature: 28, humidity: 80 })

    await owner.del(`/farms/houses/${house._id}`).expect(200)

    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
    expect((await WorkOrder.findById(workOrder._id).lean())!).toMatchObject({ status: 'CANCELLED', is_open: false })
    expect((await MaintenancePlan.findById(plan._id).lean())!.state).toBe('RETIRED')
    expect((await owner.get(`/farms/${farm._id}/houses`).expect(200)).body.data).toHaveLength(0)
    await owner.get(`/farms/houses/${house._id}/zones`).expect(404)
    await owner.get(`/farms/zones/${zone._id}`).expect(404)
    expect((await listActiveHouseIds()).map(String)).not.toContain(String(house._id))
    // Lịch sử giữ nguyên; tên cũ dùng lại được cho nhà mới
    expect(await Telemetry.countDocuments({ zone_id: zone._id })).toBe(1)
    expect((await House.findOne({ _id: house._id, is_deleted: true }).lean())!.deleted_at).toBeDefined()
    expect((await Zone.findOne({ _id: zone._id, is_deleted: true }).lean())!.is_deleted).toBe(true)
    await request(app).post(`/farms/${farm._id}/houses`).set('Authorization', `Bearer ${tokenFor(ownerDoc._id, 'FARM_OWNER')}`)
      .send({ name: 'H' }).expect(201)
  })

  it('xoá một Zone: chỉ Zone đó rời danh sách, nhà và Zone khác giữ nguyên', async () => {
    const { house, zone, owner, decommission } = await seed()
    await decommission()
    const other = await Zone.create({ house_id: house._id, name: 'Tầng 2', floor: 2 })
    await owner.del(`/farms/zones/${zone._id}`).expect(200)
    const zones = (await owner.get(`/farms/houses/${house._id}/zones`).expect(200)).body.data as Array<{ _id: string }>
    expect(zones.map(z => z._id)).toEqual([String(other._id)])
    await owner.get(`/farms/zones/${zone._id}`).expect(404)
    expect(await AuditLog.countDocuments({ action: 'ZONE_DELETED' })).toBe(1)
  })
})

describe('xoá nhà, Zone theo review của #217', () => {
  it('chủ farm khác, Farm Technician và Administrator không sửa, xoá được (403)', async () => {
    const { house, zone } = await seed()
    const other = await seedOwnerFarm()
    const technician = await User.create({ email: `t${String(house._id)}@test.vn`, password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
    const tokens = [other.token, tokenFor(technician._id, 'FARM_TECHNICIAN'), tokenFor(other.owner._id, 'ADMIN')]
    for (const token of tokens) {
      await request(app).put(`/farms/houses/${house._id}`).set('Authorization', `Bearer ${token}`).send({ name: 'x' }).expect(403)
      await request(app).delete(`/farms/zones/${zone._id}`).set('Authorization', `Bearer ${token}`).expect(403)
    }
  })

  it('nhà còn camera đang dùng thì 409; xoá xong gọi lại thì 404', async () => {
    const { house, owner, decommission } = await seed()
    await decommission()
    const camera = await CameraNode.create({ device_id: `cam-${String(house._id)}`, house_id: house._id, status: 'ONLINE' })
    expect((await owner.del(`/farms/houses/${house._id}`).expect(409)).body.error.code).toBe('HAS_ACTIVE_DEVICES')
    await CameraNode.updateOne({ _id: camera._id }, { decommissioned_at: new Date(), status: 'DECOMMISSIONED' })
    await owner.del(`/farms/houses/${house._id}`).expect(200)
    await owner.del(`/farms/houses/${house._id}`).expect(404)
  })

  it('xoá một Zone đóng cảnh báo và huỷ Work Order của Zone đó, không đụng Zone khác', async () => {
    const { house, zone, farm, node, owner, decommission } = await seed()
    await decommission()
    const other = await Zone.create({ house_id: house._id, name: 'Tầng 2', floor: 2 })
    const base = { farm_id: farm._id, type: 'SENSOR_FAULT', severity: 'MEDIUM', title: 't', message: 'm' }
    const [gone, kept] = await Alert.create([{ ...base, zone_id: zone._id, node_id: node._id }, { ...base, zone_id: other._id }])
    const workOrder = await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, zone_id: zone._id, alert_id: gone._id, origin: 'ALERT', title: 'Sửa', status: 'AWAITING_APPROVAL', is_open: true,
    })
    await owner.del(`/farms/zones/${zone._id}`).expect(200)
    expect((await Alert.findById(gone._id).lean())!.status).toBe('RESOLVED')
    expect((await Alert.findById(kept._id).lean())!.status).toBe('ACTIVE')
    expect((await WorkOrder.findById(workOrder._id).lean())!).toMatchObject({ status: 'CANCELLED', is_open: false })
  })

  it('xoá nhà: khuyến nghị hết hạn có mốc, đề xuất hệ số bị thay, mục duyệt rời hàng đợi của chuyên gia', async () => {
    const { ownerDoc, user, house, zone, farm, owner, decommission } = await seed()
    await decommission()
    const recommendation = await Recommendation.create({
      farm_id: farm._id, house_id: house._id, rule_id: farm._id, evidence: {}, raised_at: new Date(), raised_for: '2026-11-20',
    })
    const proposal = await CoefficientProposal.create({
      zone_id: zone._id, farm_id: farm._id, submitted_by: ownerDoc._id, suggested_values: {}, current_values: {},
    })
    await ParameterReview.create({
      target_id: zone._id, zone_id: zone._id, farm_id: farm._id, group: 'thresholds', old_values: {}, new_values: {}, changed_by: ownerDoc._id,
    })
    expect((await listReviews(user, { farmId: String(farm._id) })).total).toBe(1)

    await owner.del(`/farms/houses/${house._id}`).expect(200)
    expect((await Recommendation.findById(recommendation._id).lean())!).toMatchObject({ status: 'EXPIRED' })
    expect((await Recommendation.findById(recommendation._id).lean())!.expired_at).toBeDefined()
    expect((await CoefficientProposal.findById(proposal._id).lean())!.status).toBe('SUPERSEDED')
    expect((await listReviews(user, { farmId: String(farm._id) })).total).toBe(0)
  })

  it('gửi lại đúng giá trị cũ thì không ghi audit', async () => {
    const { house, owner } = await seed()
    await owner.put(`/farms/houses/${house._id}`, {}).expect(200)
    await owner.put(`/farms/houses/${house._id}`, { name: 'H' }).expect(200)
    expect(await AuditLog.countDocuments({ action: 'HOUSE_UPDATED' })).toBe(0)
  })
})
