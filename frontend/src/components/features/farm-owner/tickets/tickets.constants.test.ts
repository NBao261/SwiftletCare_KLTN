import { describe, expect, it } from 'vitest'
import { formatTimestampsInText } from '@/lib/i18n'
import { isTicketFinished, noteAuthor, progressHintKey, readableNoteText, ticketDescription, ticketOrigin } from '@/components/features/farm-owner/tickets/tickets.constants'

describe('ticketOrigin', () => {
  it('bảo trì là tự tạo theo lịch, lắp đặt là tạo thủ công', () => {
    expect(ticketOrigin({ type: 'MAINTENANCE' })).toBe('schedule')
    expect(ticketOrigin({ type: 'INSTALLATION', created_by: 'u1' })).toBe('manual')
  })

  it('ticket job tự sinh từ cảnh báo không có người tạo', () => {
    expect(ticketOrigin({ type: 'NODE_OFFLINE', alert_id: 'a1' })).toBe('alert')
  })

  it('người dùng tạo từ cảnh báo vẫn là tạo thủ công', () => {
    expect(ticketOrigin({ type: 'NODE_OFFLINE', alert_id: 'a1', created_by: 'u1' })).toBe('manual')
  })
})

describe('isTicketFinished', () => {
  it('chỉ ticket đã đóng (kể cả huỷ) mới tính là kết thúc', () => {
    expect(isTicketFinished({ status: 'CLOSED' })).toBe(true)
    expect(isTicketFinished({ status: 'NEW' })).toBe(false)
    expect(isTicketFinished({ status: 'IN_PROGRESS' })).toBe(false)
    expect(isTicketFinished({ status: 'AWAITING_FIELD_CONFIRMATION' })).toBe(false)
  })
})

describe('readableNoteText', () => {
  it('đổi mốc ISO sang giờ Việt Nam và bỏ mã yêu cầu SRS', () => {
    const note = 'Tự động đánh dấu vượt hạn xử lý SLA (hạn 2026-09-18T11:34:00.721Z) (TICKET-FR-002)'
    expect(readableNoteText(note, formatTimestampsInText)).toBe('Tự động đánh dấu vượt hạn xử lý SLA (hạn 18/09/2026, 18:34)')
  })
})

describe('ticketDescription', () => {
  it('chỉ lấy ghi chú đầu do chính người tạo viết', () => {
    expect(ticketDescription({ created_by: 'u1', notes: [{ author_id: 'u1', content: 'Cảm biến báo 0°C' }] })).toBe('Cảm biến báo 0°C')
    expect(ticketDescription({ notes: [{ content: 'Tự tạo từ cảnh báo' }] })).toBeUndefined()
    expect(ticketDescription({ created_by: 'u1', notes: [{ content: 'Tự động đánh dấu vượt hạn' }] })).toBeUndefined()
  })
})

describe('noteAuthor', () => {
  const ticket = { created_by: 'u1', assigned_to: { _id: 't1' }, notes: [] }
  it('phân biệt hệ thống, bạn, kỹ thuật viên, người khác', () => {
    expect(noteAuthor({ content: 'x' }, ticket, 'u1')).toBe('system')
    expect(noteAuthor({ author_id: 'u1', content: 'x' }, ticket, 'u1')).toBe('you')
    expect(noteAuthor({ author_id: 't1', content: 'x' }, ticket, 'u1')).toBe('technician')
    expect(noteAuthor({ author_id: 'u2', content: 'x' }, ticket, 'u1')).toBe('other')
  })
})

describe('progressHintKey', () => {
  it('ticket mới nói đúng ai tạo và đã có kỹ thuật viên chưa', () => {
    expect(progressHintKey({ status: 'NEW', type: 'NODE_OFFLINE', alert_id: 'a1', assigned_to: 't1' })).toBe('hint.NEW_SYSTEM')
    expect(progressHintKey({ status: 'NEW', type: 'SENSOR_FAULT', created_by: 'u1', assigned_to: 't1' })).toBe('hint.NEW')
    expect(progressHintKey({ status: 'NEW', type: 'SENSOR_FAULT', created_by: 'u1' })).toBe('hint.NEW_UNASSIGNED')
    expect(progressHintKey({ status: 'IN_PROGRESS', type: 'SENSOR_FAULT', created_by: 'u1', assigned_to: 't1' })).toBe('hint.IN_PROGRESS')
  })
})
