/**
 * EXPERT-FR-021 — thợ được giao nhà trả lời yêu cầu kiểm tra tại chỗ của cảnh báo suy luận, kèm ảnh tuỳ chọn;
 * câu trả lời nằm trong bằng chứng (ALERT-FR-014) trước khi chuyên gia kết luận; SENSOR_ANOMALY mà cảm biến
 * bẩn/hỏng mở ngay 1 Work Order (BR-39); thợ nhà khác → 403.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { createAlert } from '@/services/alert.service'
import type { AlertType, Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))
jest.mock('@/config/minio.config', () => ({
  putObject: jest.fn().mockResolvedValue(undefined),
  presignedGetUrl: jest.fn(async (key: string) => `http://minio.test/${key}`),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/alerts', alertRoutes)
app.use(errorHandler)

useTestDb()

let seq = 0
async function account(role: Role) {
  seq++
  const user = await User.create({ email: `check${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  upload: (path: string) => request(app).post(path).set('Authorization', `Bearer ${token}`),
})

async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const [tech, other, expert] = [await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('DOMAIN_EXPERT')]
  ctx.farm.members.push(
    { user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never, { user_id: other.user._id, role: 'FARM_TECHNICIAN' } as never,
    { user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never,
  )
  await ctx.farm.save()
  house.technicians = [{ user_id: tech.user._id, primary: true }] as never
  await house.save()
  house2.technicians = [{ user_id: other.user._id, primary: true }] as never
  await house2.save()
  const raise = (type: AlertType) => createAlert({
    farmId: String(ctx.farm._id), zoneId: String(ctx.zone._id), nodeId: String(ctx.node._id), type, title: `${type}`, message: 'm',
  })
  return { ...ctx, tech, raise, owner$: as(ctx.token), tech$: as(tech.token), other$: as(other.token), expert$: as(expert.token) }
}

describe('kiểm tra tại chỗ (EXPERT-FR-021)', () => {
  it('thợ ghi quan sát kèm ảnh; câu trả lời có trong chi tiết và bằng chứng; trả lời lần hai → 409', async () => {
    const { tech, tech$, other$, owner$, expert$, raise } = await seed()
    const alert = (await raise('NOISE_ANOMALY'))!
    const path = `/alerts/${alert._id}/onsite-check`
    await other$.post(path, { observation: 'RAIN' }).expect(403)
    await owner$.post(path, { observation: 'RAIN' }).expect(403)
    await expert$.post(path, { observation: 'RAIN' }).expect(403)
    await tech$.post(path, { observation: 'SOMETHING' }).expect(422)
    // Spec: yêu cầu còn chờ có `observation: null` (mobile tìm nút "Trả lời" theo đó), không phải thiếu khoá
    const pending = await tech$.get(`/alerts/${alert._id}`).expect(200)
    expect(pending.body.data.onsite_checks[0]).toMatchObject({
      observation: null, note: null, answered_by: null, answered_at: null, photo_url: null,
    })

    const res = await tech$.upload(path).field('observation', 'WORK_OR_PEOPLE_NEARBY').field('note', 'Thợ hàn mái nhà bên')
      .attach('photo', Buffer.from('jpeg'), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(200)
    expect(res.body.data.onsite_checks).toHaveLength(1)
    expect(res.body.data.onsite_checks[0]).toMatchObject({
      observation: 'WORK_OR_PEOPLE_NEARBY', note: 'Thợ hàn mái nhà bên',
      answered_by: { _id: String(tech.user._id) }, photo_url: expect.stringContaining(`onsite-checks/${alert._id}/`),
    })
    await tech$.post(path, { observation: 'RAIN' }).expect(409)

    // Danh sách không ký URL ảnh cho từng dòng: không trả khoá MinIO thô, `observation` có như chi tiết
    const list = await owner$.get('/alerts').expect(200)
    const row = list.body.data.find((a: { _id: string }) => a._id === String(alert._id))
    expect(row.onsite_checks[0]).toMatchObject({ observation: 'WORK_OR_PEOPLE_NEARBY' })
    expect(row.onsite_checks[0]).not.toHaveProperty('photo')

    const evidence = await expert$.get(`/alerts/${alert._id}/evidence`).expect(200)
    expect(evidence.body.data.onsite_checks[0]).toMatchObject({ observation: 'WORK_OR_PEOPLE_NEARBY', technician_id: { _id: String(tech.user._id) } })
    expect(await WorkOrder.countDocuments()).toBe(0)
  })

  it('SENSOR_ANOMALY được trả lời cảm biến bẩn/hỏng mở đúng 1 Work Order (BR-39)', async () => {
    const { tech$, raise } = await seed()
    const alert = (await raise('SENSOR_ANOMALY'))!
    await tech$.post(`/alerts/${alert._id}/onsite-check`, { observation: 'SENSOR_DIRTY_OR_FAULTY' }).expect(200)
    const orders = await WorkOrder.find().lean()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ origin: 'ONSITE_CHECK', alert_id: alert._id })
  })

  it('cảnh báo không có yêu cầu kiểm tra → 409', async () => {
    const { tech$, raise } = await seed()
    const alert = (await raise('UNEXPECTED_RESTART'))!
    await tech$.post(`/alerts/${alert._id}/onsite-check`, { observation: 'NOTHING_UNUSUAL' }).expect(409)
  })
})
