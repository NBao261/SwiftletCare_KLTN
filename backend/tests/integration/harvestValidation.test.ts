/**
 * HARVEST-FR-001 — lô thu hoạch thiếu hoặc sai ngày, số tổ, cân nặng bị từ chối 422 (lúc tạo và lúc sửa);
 * ngày sau hôm nay theo giờ Việt Nam không hợp lệ.
 */
jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

import express from 'express'
import request from 'supertest'
import harvestRoutes from '@/routes/harvests.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { createHarvest } from '@/services/harvest.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/harvests', harvestRoutes)
app.use(errorHandler)

useTestDb()

const DAY = 86400_000

const valid = (zoneId: unknown) => ({
  zone_id: String(zoneId), harvest_date: new Date().toISOString(), nest_count: 40, weight_grams: 320.5, nest_type: 'RAW',
})

describe('HARVEST-FR-001 — tạo lô', () => {
  it('lô hợp lệ hôm nay → 201', async () => {
    const { zone, token } = await seedOwnerFarm()
    const res = await request(app).post('/harvests').set('Authorization', `Bearer ${token}`).send(valid(zone._id)).expect(201)
    expect(res.body.data).toMatchObject({ nest_count: 40, weight_grams: 320.5, status: 'CONFIRMED' })
  })

  it.each([
    ['thiếu cân nặng', { weight_grams: undefined }],
    ['thiếu số tổ', { nest_count: undefined }],
    ['cân nặng null', { weight_grams: null }],
    ['số tổ 0', { nest_count: 0 }],
    ['số tổ lẻ', { nest_count: 2.5 }],
    ['cân nặng âm', { weight_grams: -1 }],
    ['cân nặng 0', { weight_grams: 0 }],
    ['cân nặng là chữ', { weight_grams: 'nặng' }],
    ['loại tổ lạ', { nest_type: 'GOLD' }],
    ['thiếu loại tổ', { nest_type: undefined }],
    ['thiếu ngày', { harvest_date: undefined }],
    ['ngày sai', { harvest_date: '2026-02-30' }],
    ['ngày không phải chuỗi', { harvest_date: 20260101 }],
    ['ảnh không phải mảng chuỗi', { product_images: [1] }],
  ])('%s → 422, không lưu', async (_label, override) => {
    const { zone, token } = await seedOwnerFarm()
    await request(app).post('/harvests').set('Authorization', `Bearer ${token}`)
      .send({ ...valid(zone._id), ...override }).expect(422)
    expect(await HarvestBatch.countDocuments()).toBe(0)
  })

  it('ngày mai theo giờ VN → 422', async () => {
    const { zone, token } = await seedOwnerFarm()
    await request(app).post('/harvests').set('Authorization', `Bearer ${token}`)
      .send({ ...valid(zone._id), harvest_date: new Date(Date.now() + DAY).toISOString() }).expect(422)
    expect(await HarvestBatch.countDocuments()).toBe(0)
  })

  it('ngày đã qua → 201', async () => {
    const { zone, token } = await seedOwnerFarm()
    await request(app).post('/harvests').set('Authorization', `Bearer ${token}`)
      .send({ ...valid(zone._id), harvest_date: new Date(Date.now() - 3 * DAY).toISOString() }).expect(201)
  })

  it('service cũng chặn ngày sau hôm nay khi gọi thẳng', async () => {
    const { zone, user } = await seedOwnerFarm()
    await expect(createHarvest(user, { ...valid(zone._id), nest_type: 'RAW', harvest_date: new Date(Date.now() + 2 * DAY).toISOString() }))
      .rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('HARVEST-FR-001 — sửa lô', () => {
  it('chỉ kiểm trường gửi lên: hợp lệ → 200, cân nặng 0 hoặc số tổ 0 → 422 và giữ giá trị cũ', async () => {
    const { zone, token } = await seedOwnerFarm()
    const created = await request(app).post('/harvests').set('Authorization', `Bearer ${token}`).send(valid(zone._id)).expect(201)
    const id = created.body.data._id

    await request(app).put(`/harvests/${id}`).set('Authorization', `Bearer ${token}`).send({ nest_count: 45 }).expect(200)
    await request(app).put(`/harvests/${id}`).set('Authorization', `Bearer ${token}`).send({ weight_grams: 0 }).expect(422)
    await request(app).put(`/harvests/${id}`).set('Authorization', `Bearer ${token}`).send({ nest_count: 0 }).expect(422)
    await request(app).put(`/harvests/${id}`).set('Authorization', `Bearer ${token}`).send({ nest_type: 'GOLD' }).expect(422)

    expect(await HarvestBatch.findById(id).lean()).toMatchObject({ nest_count: 45, weight_grams: 320.5, nest_type: 'RAW' })
  })
})
