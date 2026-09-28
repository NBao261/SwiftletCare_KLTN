import { describe, it, expect } from 'vitest'
import { validateNewTicket, validateReschedule } from '@/validations/admin/ticket.validation'

// 10:00 giờ VN; các mốc dưới đây ghi rõ +07:00 để test không phụ thuộc múi giờ máy chạy
const NOW = new Date('2026-09-24T10:00+07:00').getTime()

describe('validateNewTicket', () => {
  it('bắt buộc chọn trang trại', () => {
    expect(validateNewTicket({ farmId: '', type: 'OTHER', scheduledAt: '' }, NOW).farmId).toMatch(/Chưa chọn/)
  })
  it('lắp đặt bắt buộc ngày hẹn, không ở quá khứ, trong khung 7:00–18:00 giờ VN', () => {
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '' }, NOW).scheduledAt).toMatch(/cần ngày giờ hẹn/)
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '2026-09-23T10:00+07:00' }, NOW).scheduledAt).toMatch(/đã qua/)
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '2026-09-25T20:00+07:00' }, NOW).scheduledAt).toMatch(/7:00–18:00/)
  })
  it('loại sự cố không cần ngày hẹn; form hợp lệ trả map rỗng', () => {
    expect(validateNewTicket({ farmId: 'f', type: 'SENSOR_FAULT', scheduledAt: '' }, NOW)).toEqual({})
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '2026-09-25T09:00+07:00' }, NOW)).toEqual({})
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '2026-09-25T18:00+07:00' }, NOW)).toEqual({})
  })
})

describe('validateReschedule', () => {
  it('chặn giờ ngoài khung giờ VN giống backend assertValidVisitTime', () => {
    expect(validateReschedule('2026-09-25T06:55+07:00', NOW)).toMatch(/7:00–18:00/)
    expect(validateReschedule('2026-09-25T18:05+07:00', NOW)).toMatch(/7:00–18:00/)
    expect(validateReschedule('2026-09-25T07:00+07:00', NOW)).toBeUndefined()
  })
})
