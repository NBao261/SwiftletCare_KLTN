import { describe, expect, it } from 'vitest'
import { describeStructuredChange } from '@/components/features/domain-expert/reviews/reviewChanges.utils'

const hours = (morning: [string, string], evening: [string, string]) => ({
  morning: { start: morning[0], end: morning[1] }, evening: { start: evening[0], end: evening[1] },
})
const rain = { name: 'Mùa mưa', from: '05-01', to: '09-30', ...hours(['05:00', '07:00'], ['17:00', '19:00']) }

describe('mô tả thay đổi lịch đếm và vòng đếm cho chuyên gia', () => {
  it('khoá số đơn không mô tả (thẻ tự hiện cũ → mới)', () => {
    expect(describeStructuredChange('humidity_min', 75, 78)).toBeNull()
  })

  it('hồ sơ theo mùa: thêm, bỏ, sửa giờ', () => {
    expect(describeStructuredChange('profiles', [], [rain])).toEqual([
      { kind: 'added', text: 'Thêm hồ sơ Mùa mưa (01/05–30/09): Sáng 05:00–07:00, chiều 17:00–19:00' },
    ])
    expect(describeStructuredChange('profiles', [rain], [])).toEqual([
      { kind: 'removed', text: 'Bỏ hồ sơ Mùa mưa (01/05–30/09): Sáng 05:00–07:00, chiều 17:00–19:00' },
    ])
    const moved = { ...rain, morning: { start: '05:30', end: '07:30' } }
    expect(describeStructuredChange('profiles', [rain], [moved])).toEqual([{
      kind: 'changed',
      text: 'Sửa hồ sơ Mùa mưa: Sáng 05:00–07:00 → 05:30–07:30',
    }])
  })

  it('khung tạm một ngày ghi một ngày; không đổi thì không có dòng nào', () => {
    const day = { from: '2026-12-01', to: '2026-12-01', ...hours(['05:00', '07:00'], ['17:00', '19:00']) }
    expect(describeStructuredChange('temporary', [], [day])).toEqual([
      { kind: 'added', text: 'Thêm khung tạm 01/12/2026: Sáng 05:00–07:00, chiều 17:00–19:00' },
    ])
    expect(describeStructuredChange('temporary', [day], [day])).toEqual([])
    const longer = { ...day, to: '2026-12-03', evening: { start: '17:30', end: '19:00' } }
    expect(describeStructuredChange('temporary', [day], [longer])).toEqual([{
      kind: 'changed', text: 'Sửa khung tạm 01/12/2026: Ngày 01/12/2026 → 01/12/2026–03/12/2026; Chiều 17:00–19:00 → 17:30–19:00',
    }])
  })

  it('khung mặc định của nhà: từ khung hệ thống sang khung riêng', () => {
    expect(describeStructuredChange('default_windows', undefined, hours(['05:00', '07:00'], ['17:00', '19:00']))).toEqual([
      { kind: 'changed', text: 'Khung mặc định của nhà: Khung hệ thống → Sáng 05:00–07:00, chiều 17:00–19:00' },
    ])
  })

  it('vòng đếm: thêm vòng, đổi số đỉnh, đổi hướng, bỏ vòng', () => {
    const square = { points: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][], into_ring_is_exit: true }
    const triangle = { points: square.points.slice(0, 3), into_ring_is_exit: true }
    expect(describeStructuredChange('rings', [], [square])).toEqual([
      { kind: 'added', text: 'Thêm vòng 1: 4 đỉnh, Chim bay vào vòng là chim ra khỏi tổ' },
    ])
    expect(describeStructuredChange('rings', [square], [{ ...triangle, into_ring_is_exit: false }])).toEqual([{
      kind: 'changed',
      text: 'Sửa vòng 1: 4 → 3 đỉnh; Chim bay vào vòng là chim ra khỏi tổ → Chim bay vào vòng là chim về tổ',
    }])
    expect(describeStructuredChange('rings', [square, triangle], [square])).toEqual([
      { kind: 'removed', text: 'Bỏ vòng 2: 3 đỉnh' },
    ])
    // Bản ghi cũ ghi một vòng, không phải danh sách
    expect(describeStructuredChange('ring', null, square)).toHaveLength(1)
  })
})
