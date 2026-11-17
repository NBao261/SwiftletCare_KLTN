/**
 * G-02 — AUTH-FR-005c Administrator tạo Farm Owner với mật khẩu tạm; thư tài khoản qua SMTP (SF-03): mật khẩu tạm,
 * mã đặt lại mật khẩu (AUTH-FR-009), lời mời (AUTH-FR-010). Không ghi log mã, mật khẩu hay token; chưa cấu hình SMTP
 * thì nghiệp vụ vẫn chạy, thư không đi.
 */
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn(() => ({ sendMail: sendMailMock })) } }))

import express, { type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import adminRoutes from '@/routes/admin.route'
import { authenticate } from '@/middlewares/auth.middleware'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { User } from '@/models/user.model'
import { forgotPassword, resetPassword } from '@/services/auth.service'
import { inviteMember } from '@/services/farm.service'
import { resetMailTransport } from '@/services/mail.service'
import logger from '@/utils/logger.util'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
// Route bất kỳ sau `authenticate`: kiểm chặn tài khoản còn mật khẩu tạm
app.get('/probe', authenticate, (_req: Request, res: Response) => { res.json({ success: true }) })
app.use(errorHandler)

useTestDb()

const SMTP = { SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'noreply@test.vn', SMTP_PASS: 'secret', APP_PUBLIC_URL: 'https://app.test/' }
const setSmtp = (values: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetMailTransport()
}

beforeEach(() => {
  sendMailMock.mockReset().mockResolvedValue({ messageId: 'm1' })
  setSmtp(SMTP)
})
afterAll(() => setSmtp(Object.fromEntries(Object.keys(SMTP).map(k => [k, undefined]))))

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
let seq = 0
async function account(role: Role) {
  seq++
  const user = await User.create({ email: `acc${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: tokenFor(user._id, role) }
}
const sentMails = () => sendMailMock.mock.calls.map(([mail]) => mail as { to: string; subject: string; text: string })
/** Toàn bộ nội dung đã ghi log, để kiểm không lộ mã hay mật khẩu */
const loggedText = (spies: jest.SpyInstance[]) => JSON.stringify(spies.flatMap(s => s.mock.calls))

describe('Administrator tạo Farm Owner (AUTH-FR-005c)', () => {
  it('tạo Farm Owner với mật khẩu tạm 12 ký tự gửi qua e-mail; đăng nhập bằng mật khẩu đó bị chặn tới khi đổi', async () => {
    const admin = await account('ADMIN')
    const res = await request(app).post('/admin/farm-owners').set('Authorization', `Bearer ${admin.token}`)
      .send({ email: ' New.Owner@Test.vn ', full_name: ' Chủ Trại ', phone: '0901234567' }).expect(201)

    expect(res.body.data).toMatchObject({ email: 'new.owner@test.vn', full_name: 'Chủ Trại', role: 'FARM_OWNER', temporary_password_emailed: true })
    expect(res.body.data).not.toHaveProperty('password_hash')

    const mails = sentMails()
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ to: 'new.owner@test.vn', subject: 'Tài khoản SwiftletCare của bạn' })
    const temporaryPassword = /Mật khẩu tạm: (\S+)/.exec(mails[0].text)![1]
    expect(temporaryPassword).toHaveLength(12)
    expect(mails[0].text).toContain('https://app.test/login')
    expect(JSON.stringify(res.body)).not.toContain(temporaryPassword)

    const stored = (await User.findOne({ email: 'new.owner@test.vn' }))!
    expect(stored.must_change_password).toBe(true)
    expect(await stored.comparePassword(temporaryPassword)).toBe(true)
    await request(app).get('/probe').set('Authorization', `Bearer ${tokenFor(stored._id, 'FARM_OWNER')}`).expect(403)
      .expect(r => expect(r.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED'))

    expect(await AuditLog.countDocuments({ action: 'FARM_OWNER_CREATED', target_id: stored._id })).toBe(1)
  })

  it('email đã có tài khoản (mọi role) → 409; email sai hoặc thiếu tên → 422; không phải Administrator → 403', async () => {
    const admin = await account('ADMIN')
    const expert = await account('DOMAIN_EXPERT')
    const auth = { Authorization: `Bearer ${admin.token}` }
    await request(app).post('/admin/farm-owners').set(auth).send({ email: expert.user.email, full_name: 'X' }).expect(409)
    await request(app).post('/admin/farm-owners').set(auth).send({ email: 'không-phải-email', full_name: 'X' }).expect(422)
    await request(app).post('/admin/farm-owners').set(auth).send({ email: 'a@test.vn' }).expect(422)
    const owner = await account('FARM_OWNER')
    await request(app).post('/admin/farm-owners').set('Authorization', `Bearer ${owner.token}`).send({ email: 'b@test.vn', full_name: 'X' }).expect(403)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('chưa cấu hình SMTP: tài khoản vẫn tạo, thư không đi, cảnh báo không kèm mật khẩu', async () => {
    setSmtp({ SMTP_PASS: 'CHANGE_ME' })
    const warn = jest.spyOn(logger, 'warn')
    const admin = await account('ADMIN')
    const res = await request(app).post('/admin/farm-owners').set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'nosmtp@test.vn', full_name: 'Chưa SMTP' }).expect(201)
    expect(res.body.data.temporary_password_emailed).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SMTP chưa cấu hình'), expect.objectContaining({ subject: 'Tài khoản SwiftletCare của bạn' }))
    expect(loggedText([warn])).not.toMatch(/Mật khẩu tạm/)
    warn.mockRestore()
  })

  it('máy chủ SMTP lỗi: tài khoản vẫn tạo, báo chưa gửi được thư, log không kèm nội dung thư', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('connection refused'))
    const error = jest.spyOn(logger, 'error')
    const admin = await account('ADMIN')
    const res = await request(app).post('/admin/farm-owners').set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'smtpdown@test.vn', full_name: 'SMTP lỗi' }).expect(201)
    expect(res.body.data.temporary_password_emailed).toBe(false)
    expect(loggedText([error])).not.toMatch(/Mật khẩu tạm/)
    error.mockRestore()
  })
})

describe('mã đặt lại mật khẩu qua e-mail (AUTH-FR-009)', () => {
  it('gửi mã 6 chữ số tới chủ tài khoản; mã đó đặt lại được mật khẩu; mã không ghi log hay console', async () => {
    const consoleLog = jest.spyOn(console, 'log')
    const spies = (['info', 'warn', 'debug', 'error'] as const).map(level => jest.spyOn(logger, level))
    const { user } = await account('FARM_OWNER')

    await forgotPassword(user.email.toUpperCase())
    const mails = sentMails()
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ to: user.email, subject: 'Mã đặt lại mật khẩu SwiftletCare' })
    const code = /Mã đặt lại mật khẩu của bạn: (\d{6})/.exec(mails[0].text)![1]

    expect(consoleLog).not.toHaveBeenCalled()
    expect(loggedText(spies)).not.toContain(code)
    await resetPassword(user.email, code, 'newpassword1')
    expect(await (await User.findById(user._id))!.comparePassword('newpassword1')).toBe(true)

    consoleLog.mockRestore()
    for (const spy of spies) spy.mockRestore()
  })

  it('email không có tài khoản: không gửi thư (không lộ tài khoản nào tồn tại)', async () => {
    await forgotPassword('khongco@test.vn')
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('thư lời mời (AUTH-FR-010)', () => {
  it('gửi link nhận lời mời có token tới email được mời, kèm tên trại, vai trò và hạn', async () => {
    const { farm, user } = await seedOwnerFarm()
    const invitation = await inviteMember(String(farm._id), user, { email: 'Moi@Test.vn', role: 'DOMAIN_EXPERT' })
    const mails = sentMails()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('moi@test.vn')
    expect(mails[0].subject).toContain(farm.name)
    expect(mails[0].text).toContain(`https://app.test/invitations/${invitation.token}`)
    expect(mails[0].text).toContain('Domain Expert')
  })

  it('thư lời mời lỗi thì lời mời vẫn được tạo', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('timeout'))
    const { farm, user } = await seedOwnerFarm()
    const invitation = await inviteMember(String(farm._id), user, { email: 'moi2@test.vn' })
    expect(invitation.status).toBe('PENDING')
  })
})
