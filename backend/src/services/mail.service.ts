import nodemailer, { type Transporter } from 'nodemailer'
import logger from '@/utils/logger.util'

// Chỉ thư tài khoản đi qua e-mail. Không ghi log nội dung. Chưa cấu hình SMTP thì chỉ cảnh báo

export interface MailMessage {
  to: string
  subject: string
  text: string
}

// Giá trị mẫu của .env.example coi như chưa cấu hình
const PLACEHOLDER = 'CHANGE_ME'
// Mặc định nodemailer 2–10 phút: SMTP treo sẽ giữ request rất lâu
export const SMTP_TIMEOUT_MS = 10_000

let transporter: Transporter | null | undefined

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass || pass === PLACEHOLDER) return null
  const port = Number(process.env.SMTP_PORT) || 587
  return { host, port, user, pass, from: process.env.SMTP_FROM?.trim() || user }
}

// null = chưa cấu hình
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter
  const config = smtpConfig()
  transporter = config
    ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })
    : null
  return transporter
}

// Cho test
export function resetMailTransport(): void {
  transporter = undefined
}

export function isMailConfigured(): boolean {
  return smtpConfig() !== null
}

// Không throw. true khi SMTP đã nhận thư
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransporter()
  if (!transport) {
    logger.warn('SMTP chưa cấu hình (SMTP_HOST, SMTP_USER, SMTP_PASS): không gửi được thư', { subject: message.subject })
    return false
  }
  try {
    await transport.sendMail({ from: smtpConfig()!.from, to: message.to, subject: message.subject, text: message.text })
    return true
  } catch (err) {
    logger.error('Gửi thư thất bại', { subject: message.subject, err: err instanceof Error ? err.message : String(err) })
    return false
  }
}

export function appPublicUrl(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim() || process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (configured || 'http://localhost:5173').replace(/\/+$/, '')
}

const SIGNATURE = '\n\n— SwiftletCare'
const vnDateTime = (at: Date) => at.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })

export function invitationMail(input: {
  to: string; farmName: string; roleLabel: string; token: string; expiresAt: Date
}): MailMessage {
  const link = `${appPublicUrl()}/invitations/${input.token}`
  return {
    to: input.to,
    subject: `Lời mời tham gia trại ${input.farmName} trên SwiftletCare`,
    text: `Bạn được mời tham gia trại "${input.farmName}" với vai trò ${input.roleLabel}.\n\n`
      + `Mở link sau để nhận lời mời (chưa có tài khoản thì tạo tài khoản ngay từ link này):\n${link}\n\n`
      + `Lời mời hết hạn lúc ${vnDateTime(input.expiresAt)}.${SIGNATURE}`,
  }
}

export function resetCodeMail(input: { to: string; code: string; expiresAt: Date }): MailMessage {
  return {
    to: input.to,
    subject: 'Mã đặt lại mật khẩu SwiftletCare',
    text: `Mã đặt lại mật khẩu của bạn: ${input.code}\n\n`
      + `Mã dùng được một lần, hết hạn lúc ${vnDateTime(input.expiresAt)}. `
      + `Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua thư này.${SIGNATURE}`,
  }
}

export function temporaryPasswordMail(input: { to: string; fullName: string; temporaryPassword: string }): MailMessage {
  return {
    to: input.to,
    subject: 'Tài khoản SwiftletCare của bạn',
    text: `Chào ${input.fullName},\n\nTài khoản chủ nhà yến của bạn trên SwiftletCare đã được tạo.\n`
      + `Email đăng nhập: ${input.to}\nMật khẩu tạm: ${input.temporaryPassword}\n\n`
      + `Đăng nhập tại ${appPublicUrl()}/login. Ở lần đăng nhập đầu, bạn phải đổi mật khẩu tạm này `
      + `trước khi dùng được các chức năng khác.${SIGNATURE}`,
  }
}
