import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { FirmwareImage } from '@/models/firmwareImage.model'
import { User } from '@/models/user.model'
import { APP_OFFSET, BOOTLOADER_OFFSET } from '@/utils/firmwareImage.util'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
let storageDir: string
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fw-images-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.LOCAL_STORAGE_DIR = storageDir
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
  await fs.rm(storageDir, { recursive: true, force: true })
  delete process.env.STORAGE_DRIVER
  delete process.env.LOCAL_STORAGE_DIR
})
afterEach(async () => {
  await Promise.all([AuditLog.deleteMany({}), FirmwareImage.deleteMany({}), User.deleteMany({})])
})

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

function image(version: string): Buffer {
  const buffer = Buffer.alloc(APP_OFFSET + 4096, 0xFF)
  buffer[BOOTLOADER_OFFSET] = 0xE9
  buffer[APP_OFFSET] = 0xE9
  buffer.write(`SwiftletCare ESP32 Firmware v${version}     `, APP_OFFSET + 100, 'utf8')
  return buffer
}

async function adminToken(role: Role = 'ADMIN') {
  const user = await User.create({ email: `${role.toLowerCase()}@test.vn`, password_hash: 'password123', full_name: role, role })
  return tokenFor(user._id, role)
}

const upload = (token: string, version: string, file: Buffer, note?: string) => {
  const req = request(app).post('/admin/firmware-images').set('Authorization', `Bearer ${token}`).field('version', version)
  if (note) req.field('note', note)
  return req.attach('file', file, 'factory.bin')
}

describe('kho firmware cho trạm nạp (FARM-FR-010, Report 4 D9)', () => {
  it('Administrator tải lên, xem danh sách mới nhất trước, tải về đúng file kèm SHA-256, xoá', async () => {
    const token = await adminToken()
    const first = await upload(token, '2.4.0', image('2.4.0'), 'Bản đầu có nạp qua USB').expect(201)
    expect(first.body.data).toMatchObject({ version: '2.4.0', size: APP_OFFSET + 4096, note: 'Bản đầu có nạp qua USB' })
    expect(first.body.data.object_key).toBeUndefined()
    await upload(token, '2.10.0', image('2.10.0')).expect(201)

    const list = await request(app).get('/admin/firmware-images').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.data.map((f: { version: string }) => f.version)).toEqual(['2.10.0', '2.4.0'])

    const file = await request(app).get(`/admin/firmware-images/${first.body.data._id}/file`).set('Authorization', `Bearer ${token}`)
      .buffer(true).parse((res, done) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => done(null, Buffer.concat(chunks)))
      }).expect(200)
    expect(Buffer.compare(file.body as Buffer, image('2.4.0'))).toBe(0)
    expect(file.headers['x-firmware-sha256']).toBe(first.body.data.sha256)

    await request(app).delete(`/admin/firmware-images/${first.body.data._id}`).set('Authorization', `Bearer ${token}`).expect(200)
    await request(app).get(`/admin/firmware-images/${first.body.data._id}/file`).set('Authorization', `Bearer ${token}`).expect(404)
    expect((await AuditLog.find().lean()).map(a => a.action).sort())
      .toEqual(['FIRMWARE_IMAGE_DELETED', 'FIRMWARE_IMAGE_UPLOADED', 'FIRMWARE_IMAGE_UPLOADED'])
  })

  it('từ chối phiên bản trùng (409), sai định dạng (422), file không khớp phiên bản hoặc không phải ảnh gộp (400)', async () => {
    const token = await adminToken()
    await upload(token, '2.4.0', image('2.4.0')).expect(201)
    await upload(token, '2.4.0', image('2.4.0')).expect(409)
    await upload(token, 'v2.4', image('2.4.0')).expect(422)
    const mismatch = await upload(token, '2.5.0', image('2.4.0')).expect(400)
    expect(mismatch.body.error.message).toContain('2.5.0')
    await upload(token, '2.6.0', Buffer.alloc(1024)).expect(400)
    await request(app).post('/admin/firmware-images').set('Authorization', `Bearer ${token}`).field('version', '2.7.0').expect(400)
  })

  it('chỉ Administrator dùng được kho firmware', async () => {
    const owner = await adminToken('FARM_OWNER')
    await upload(owner, '2.4.0', image('2.4.0')).expect(403)
    await request(app).get('/admin/firmware-images').set('Authorization', `Bearer ${owner}`).expect(403)
  })
})
