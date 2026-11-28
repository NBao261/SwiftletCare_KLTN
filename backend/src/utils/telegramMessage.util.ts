import { appPublicUrl } from '@/utils/appUrl.util'
import { SEVERITY_LABEL, formatVnDateTime } from '@/utils/displayLabel.util'
import type { AlertSeverity } from '@/types/domain.types'

// Tin Telegram dạng HTML: tiêu đề đậm, các dòng "Nhãn: giá trị", một nút mở ứng dụng. Chỉ ba ký tự cần thoát
export interface TelegramMessage {
  text: string
  button?: { label: string; url: string }
}

export interface AlertPlace {
  farm?: string
  house?: string
  zone?: string
  device?: string
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const field = (label: string, value: string | undefined) => (value ? `<b>${label}:</b> ${esc(value)}` : undefined)

// Đèn theo mức: đỏ khẩn cấp, cam cao, vàng thường
const SEVERITY_MARK: Record<AlertSeverity, string> = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟡' }

// Nút chỉ hiện khi địa chỉ là HTTPS công khai: Telegram từ chối cả tin nếu nút trỏ vào localhost hay địa chỉ IP
export function telegramButtonUrl(path: string): string | undefined {
  try {
    const url = new URL(path, `${appPublicUrl()}/`)
    const isPublicName = url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname) && url.hostname !== 'localhost'
    return url.protocol === 'https:' && isPublicName ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const withButton = (text: string, label: string, path: string): TelegramMessage => {
  const url = telegramButtonUrl(path)
  return { text, ...(url && { button: { label, url } }) }
}

// Một dòng vị trí ngắn cho push: "Nhà A · Tầng 1 · ESP-1"
export function placeLine(place: AlertPlace): string {
  return [place.house, place.zone, place.device].filter(Boolean).join(' · ')
}

export function alertTelegram(input: {
  alertId: string
  severity: AlertSeverity
  title: string
  message: string
  at: Date
  place: AlertPlace
  kind?: 'repeat' | 'escalation'
}): TelegramMessage {
  const tag = input.kind === 'escalation' ? ' · Chưa ai xác nhận' : input.kind === 'repeat' ? ' · Nhắc lại' : ''
  const lines = [
    `${SEVERITY_MARK[input.severity]} <b>${SEVERITY_LABEL[input.severity]}</b>${tag}`,
    `<b>${esc(input.title)}</b>`,
    esc(input.message),
    '',
    field('Trang trại', input.place.farm),
    field('Nhà yến', input.place.house),
    field('Vị trí', input.place.zone),
    field('Thiết bị', input.place.device),
    field('Lúc', formatVnDateTime(input.at)),
  ].filter(line => line !== undefined)
  return withButton(lines.join('\n'), 'Mở cảnh báo', `/alerts?highlight=${input.alertId}`)
}

// Mỗi loại thông báo mở đúng trang của nó; loại khác mở hộp thông báo
const REF_PATH: Record<string, string> = { alert: '/alerts?highlight=', work_order: '/work-orders', device_action: '/devices' }

export function noticeTelegram(input: { title: string; body: string; ref?: { kind: string; id: string } }): TelegramMessage {
  const text = `<b>${esc(input.title)}</b>\n${esc(input.body)}`
  const target = input.ref ? REF_PATH[input.ref.kind] : undefined
  const path = target ? (target.endsWith('=') ? `${target}${input.ref!.id}` : target) : '/notifications'
  return withButton(text, 'Mở trong ứng dụng', path)
}

export const telegramLinked = (email: string): TelegramMessage => ({
  text: `✅ <b>Đã kết nối Telegram</b>\n<b>Tài khoản:</b> ${esc(email)}\n\nBạn sẽ nhận cảnh báo của nhà yến tại đây. Chọn mức cảnh báo nhận qua Telegram trong Cài đặt, mục Thông báo.`,
})

export const telegramLinkRejected = (): TelegramMessage => ({
  text: '⚠️ <b>Mã kết nối không đúng hoặc đã hết hạn</b>\nBấm "Kết nối Telegram" trong ứng dụng để lấy mã mới.',
})

export const telegramWelcome = (): TelegramMessage => ({
  text: '👋 <b>Bot thông báo của SwiftletCare</b>\nĐể nhận cảnh báo, mở Cài đặt trong ứng dụng và bấm "Kết nối Telegram".',
})
