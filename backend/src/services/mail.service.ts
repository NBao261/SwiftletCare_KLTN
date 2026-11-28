import nodemailer, { type Transporter } from 'nodemailer'
import { appPublicUrl } from '@/utils/appUrl.util'
import { ROLE_ABILITIES, formatVnDateTime } from '@/utils/displayLabel.util'
import { renderEmail } from '@/utils/emailTemplate.util'
import logger from '@/utils/logger.util'
import type { Role } from '@/types'

// Chỉ thư tài khoản đi qua e-mail. Không ghi log nội dung. Chưa cấu hình SMTP thì chỉ cảnh báo

export interface MailMessage {
  to: string
  subject: string
  // Bản chữ thường, cho trình đọc thư không hiện HTML
  text: string
  html?: string
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
    await transport.sendMail({ from: smtpConfig()!.from, to: message.to, subject: message.subject, text: message.text, html: message.html })
    return true
  } catch (err) {
    logger.error('Gửi thư thất bại', { subject: message.subject, err: err instanceof Error ? err.message : String(err) })
    return false
  }
}

// Thư tài khoản: cùng một khung (emailTemplate.util), mỗi thư chỉ nêu nội dung
function accountMail(to: string, subject: string, spec: Parameters<typeof renderEmail>[0]): MailMessage {
  const { html, text } = renderEmail(spec)
  return { to, subject, text, html }
}

export function invitationMail(input: {
  to: string; farmName: string; role: Role; roleLabel: string; token: string; expiresAt: Date
}): MailMessage {
  const link = `${appPublicUrl()}/invitations/${input.token}`
  return accountMail(input.to, `Lời mời tham gia ${input.farmName} trên SwiftletCare`, {
    preheader: `Bạn được mời vào ${input.farmName} với vai trò ${input.roleLabel}. Lời mời hết hạn ${formatVnDateTime(input.expiresAt)}.`,
    eyebrow: 'Lời mời',
    title: `Bạn được mời tham gia ${input.farmName}`,
    paragraphs: [
      `Bạn được mời vào trang trại "${input.farmName}" với vai trò ${input.roleLabel}. Chưa có tài khoản thì bạn tạo tài khoản ngay từ lời mời này.`,
    ],
    list: ROLE_ABILITIES[input.role] && { title: `Với vai trò ${input.roleLabel}, bạn sẽ`, items: ROLE_ABILITIES[input.role]! },
    details: [{ label: 'Hạn lời mời', value: formatVnDateTime(input.expiresAt) }],
    button: { label: 'Nhận lời mời', url: link },
    notes: ['Nếu bạn không biết lời mời này, cứ bỏ qua thư. Lời mời sẽ tự hết hạn.'],
  })
}

export function resetCodeMail(input: { to: string; code: string; expiresAt: Date }): MailMessage {
  return accountMail(input.to, 'Mã đặt lại mật khẩu SwiftletCare', {
    preheader: `Mã đặt lại mật khẩu của bạn là ${input.code}. Dùng được một lần, hết hạn ${formatVnDateTime(input.expiresAt)}.`,
    eyebrow: 'Bảo mật tài khoản',
    title: 'Đặt lại mật khẩu',
    paragraphs: ['Bạn vừa yêu cầu đặt lại mật khẩu. Nhập mã bên dưới vào màn hình đặt lại mật khẩu của SwiftletCare.'],
    highlight: { label: 'Mã đặt lại mật khẩu', value: input.code },
    details: [
      { label: 'Hạn dùng', value: formatVnDateTime(input.expiresAt) },
      { label: 'Số lần dùng', value: 'Một lần' },
    ],
    notes: [
      'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua thư này. Mật khẩu hiện tại của bạn vẫn giữ nguyên.',
      'Không chia sẻ mã này cho ai, kể cả người tự nhận là SwiftletCare.',
    ],
  })
}

export function temporaryPasswordMail(input: { to: string; fullName: string; temporaryPassword: string }): MailMessage {
  return accountMail(input.to, 'Tài khoản SwiftletCare của bạn', {
    preheader: 'Tài khoản chủ nhà yến của bạn đã được tạo. Đăng nhập và đổi mật khẩu tạm ở lần đầu.',
    eyebrow: 'Tài khoản mới',
    title: `Chào ${input.fullName}, tài khoản của bạn đã sẵn sàng`,
    paragraphs: [
      'Tài khoản chủ nhà yến của bạn trên SwiftletCare đã được tạo.',
      `Đăng nhập bằng email ${input.to} và mật khẩu tạm bên dưới.`,
    ],
    highlight: { label: 'Mật khẩu tạm', value: input.temporaryPassword },
    button: { label: 'Đăng nhập SwiftletCare', url: `${appPublicUrl()}/login` },
    notes: [
      'Ở lần đăng nhập đầu, bạn phải đổi mật khẩu tạm này trước khi dùng được các chức năng khác.',
      'Không chia sẻ mật khẩu này cho ai. Nên xoá thư sau khi đã đổi mật khẩu.',
    ],
  })
}
