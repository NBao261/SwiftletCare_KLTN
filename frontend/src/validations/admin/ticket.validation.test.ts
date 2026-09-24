import { describe, it, expect } from 'vitest'
import { validateNewTicket } from '@/validations/admin/ticket.validation'

const NOW = new Date('2026-09-24T10:00').getTime()

describe('validateNewTicket', () => {
  it('bắt buộc chọn trang trại', () => {
    expect(validateNewTicket({ farmId: '', type: 'OTHER', scheduledAt: '' }, NOW).farmId).toMatch(/Chưa chọn/)
  })
  it('lắp đặt/bảo trì bắt buộc ngày hẹn, và không được ở quá khứ', () => {
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '' }, NOW).scheduledAt).toMatch(/cần ngày giờ hẹn/)
    expect(validateNewTicket({ farmId: 'f', type: 'MAINTENANCE', scheduledAt: '2026-09-23T10:00' }, NOW).scheduledAt).toMatch(/đã qua/)
  })
  it('loại sự cố không cần ngày hẹn; form hợp lệ trả map rỗng', () => {
    expect(validateNewTicket({ farmId: 'f', type: 'SENSOR_FAULT', scheduledAt: '' }, NOW)).toEqual({})
    expect(validateNewTicket({ farmId: 'f', type: 'INSTALLATION', scheduledAt: '2026-09-25T09:00' }, NOW)).toEqual({})
  })
})
