import { alertTelegram, noticeTelegram, placeLine, telegramButtonUrl } from '@/utils/telegramMessage.util'

const AT = new Date('2026-11-28T15:10:00Z')
const PLACE = { farm: 'Trại yến Demo', house: 'A · Nhà điều khiển', zone: 'A · Tầng 1', device: 'demo-ctl-a1' }
const BASE = { alertId: 'abc123', severity: 'CRITICAL' as const, title: 'Thiết bị mất kết nối', message: 'Không gửi dữ liệu 30 giây.', at: AT, place: PLACE }

const originalUrl = process.env.APP_PUBLIC_URL
afterEach(() => {
  if (originalUrl === undefined) delete process.env.APP_PUBLIC_URL
  else process.env.APP_PUBLIC_URL = originalUrl
})

describe('tin cảnh báo Telegram', () => {
  it('mức, tên cảnh báo, nội dung rồi các dòng vị trí và giờ theo giờ Việt Nam', () => {
    const { text } = alertTelegram(BASE)
    expect(text.split('\n')).toEqual([
      '🔴 <b>Khẩn cấp</b>',
      '<b>Thiết bị mất kết nối</b>',
      'Không gửi dữ liệu 30 giây.',
      '',
      '<b>Trang trại:</b> Trại yến Demo',
      '<b>Nhà yến:</b> A · Nhà điều khiển',
      '<b>Vị trí:</b> A · Tầng 1',
      '<b>Thiết bị:</b> demo-ctl-a1',
      '<b>Lúc:</b> 22:10 28/11/2026',
    ])
  })

  it('đèn theo mức và đánh dấu tin nhắc lại hay chưa ai xác nhận', () => {
    expect(alertTelegram({ ...BASE, severity: 'HIGH', kind: 'escalation' }).text.split('\n')[0]).toBe('🟠 <b>Cao</b> · Chưa ai xác nhận')
    expect(alertTelegram({ ...BASE, severity: 'MEDIUM', kind: 'repeat' }).text.split('\n')[0]).toBe('🟡 <b>Thường</b> · Nhắc lại')
    expect(alertTelegram({ ...BASE, severity: 'LOW' }).text.split('\n')[0]).toBe('🟡 <b>Thường</b>')
  })

  it('dòng nào thiếu số liệu thì bỏ, không để nhãn trống', () => {
    const { text } = alertTelegram({ ...BASE, place: { house: 'Nhà A' } })
    expect(text).toContain('<b>Nhà yến:</b> Nhà A')
    expect(text).not.toContain('Trang trại')
    expect(text).not.toContain('Thiết bị:')
  })

  it('thoát <, > và & trong chữ cảnh báo và tên nhà để Telegram không hiểu nhầm thẻ', () => {
    const { text } = alertTelegram({ ...BASE, title: 'Nhiệt độ <18°C', message: 'A & B > C', place: { house: '<b>Nhà</b>' } })
    expect(text).toContain('<b>Nhiệt độ &lt;18°C</b>')
    expect(text).toContain('A &amp; B &gt; C')
    expect(text).toContain('&lt;b&gt;Nhà&lt;/b&gt;')
  })

  it('nút "Mở cảnh báo" chỉ có khi địa chỉ ứng dụng là HTTPS công khai', () => {
    process.env.APP_PUBLIC_URL = 'https://app.swiftletcare.io.vn'
    expect(alertTelegram(BASE).button).toEqual({ label: 'Mở cảnh báo', url: 'https://app.swiftletcare.io.vn/alerts?highlight=abc123' })
    for (const local of ['http://localhost:5173', 'https://localhost', 'http://app.swiftletcare.io.vn', 'https://192.168.1.10', 'https://intranet']) {
      process.env.APP_PUBLIC_URL = local
      expect(alertTelegram(BASE).button).toBeUndefined()
      expect(telegramButtonUrl('/alerts')).toBeUndefined()
    }
  })
})

describe('tin thông báo nghiệp vụ Telegram', () => {
  it('tiêu đề đậm, nội dung bên dưới, nút mở đúng trang của loại thông báo', () => {
    process.env.APP_PUBLIC_URL = 'https://app.swiftletcare.io.vn'
    const workOrder = noticeTelegram({ title: 'Phiếu mới', body: 'Nhà A', ref: { kind: 'work_order', id: 'w1' } })
    expect(workOrder.text).toBe('<b>Phiếu mới</b>\nNhà A')
    expect(workOrder.button?.url).toBe('https://app.swiftletcare.io.vn/work-orders')
    expect(noticeTelegram({ title: 'x', body: 'y', ref: { kind: 'alert', id: 'a9' } }).button?.url).toBe('https://app.swiftletcare.io.vn/alerts?highlight=a9')
    expect(noticeTelegram({ title: 'x', body: 'y' }).button?.url).toBe('https://app.swiftletcare.io.vn/notifications')
    expect(noticeTelegram({ title: 'x', body: 'y', ref: { kind: 'health_report', id: 'h1' } }).button?.url).toBe('https://app.swiftletcare.io.vn/notifications')
  })
})

describe('dòng vị trí cho push', () => {
  it('nhà, Zone, thiết bị nối bằng dấu chấm giữa; thiếu thì bỏ', () => {
    expect(placeLine(PLACE)).toBe('A · Nhà điều khiển · A · Tầng 1 · demo-ctl-a1')
    expect(placeLine({ farm: 'Chỉ trang trại' })).toBe('')
  })
})
