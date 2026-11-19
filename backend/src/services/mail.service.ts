import nodemailer, { type Transporter } from 'nodemailer'
import logger from '@/utils/logger.util'

/**
 * Report 4 §2.1 — thư của tài khoản (SF-03): lời mời, mã đặt lại mật khẩu, mật khẩu tạm của tài khoản do Administrator
 * tạo. Chỉ những thư này đi qua e-mail; cảnh báo và thông báo nghiệp vụ đi qua trong ứng dụng, push và Telegram.
 * Nội dung thư (mã, mật khẩu, token) không bao giờ ghi log. Chưa cấu hình SMTP thì không gửi, chỉ ghi một cảnh báo.
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
}

/** Giá trị mẫu của `.env.example` coi như chưa cấu hình */
const PLACEHOLDER = 'CHANGE_ME'
/**
 * Report 3 §4.5 — thời gian chờ SMTP (kết nối, chào, socket). Mặc định của nodemailer là 2 phút và 10 phút, đủ để một
 * máy chủ SMTP treo giữ request tạo tài khoản hay lời mời rất lâu
 */
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

/** Dựng transporter một lần; null = chưa cấu hình SMTP */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter
  const config = smtpConfig()
  transporter = config
    ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 là SMTPS; 587 và cổng khác nâng lên TLS bằng STARTTLS
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })
    : null
  return transporter
}

/** Cho test đổi biến môi trường SMTP rồi dựng lại transporter */
export function resetMailTransport(): void {
  transporter = undefined
}

export function isMailConfigured(): boolean {
  return smtpConfig() !== null
}

/**
 * Gửi một thư tài khoản. Không throw: thư hỏng không được làm hỏng nghiệp vụ chính (tạo lời mời, tạo tài khoản).
 * Trả true khi máy chủ SMTP đã nhận thư.
 */
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

/** Địa chỉ web để đặt vào link trong thư (trang nhận lời mời, trang đăng nhập) */
export function appPublicUrl(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim() || process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (configured || 'http://localhost:5173').replace(/\/+$/, '')
}

// ── Nội dung thư ─────────────────────────────────────────────────────────────

const SIGNATURE = '\n\n— SwiftletCare'
const vnDateTime = (at: Date) => at.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })

/** AUTH-FR-010 — lời mời vào farm, hạn 7 ngày */
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

/** AUTH-FR-009 — mã đặt lại mật khẩu, 15 phút, dùng 1 lần */
export function resetCodeMail(input: { to: string; code: string; expiresAt: Date }): MailMessage {
  return {
    to: input.to,
    subject: 'Mã đặt lại mật khẩu SwiftletCare',
    text: `Mã đặt lại mật khẩu của bạn: ${input.code}\n\n`
      + `Mã dùng được một lần, hết hạn lúc ${vnDateTime(input.expiresAt)}. `
      + `Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua thư này.${SIGNATURE}`,
  }
}

/** AUTH-FR-005c — mật khẩu tạm của tài khoản Farm Owner do Administrator tạo */
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
