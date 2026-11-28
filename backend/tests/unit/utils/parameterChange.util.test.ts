import { isUnchanged } from '@/utils/parameterChange.util'

describe('isUnchanged', () => {
  it('coi hai bộ giống nhau là không đổi dù khoá sắp xếp khác nhau', () => {
    expect(isUnchanged({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it('bỏ qua giá trị undefined', () => {
    expect(isUnchanged({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })

  it('so sánh cả mảng và đối tượng lồng nhau', () => {
    expect(isUnchanged({ windows: [{ from: '05:00', to: '08:00' }] }, { windows: [{ from: '05:00', to: '08:00' }] })).toBe(true)
    expect(isUnchanged({ windows: [{ from: '05:00', to: '08:00' }] }, { windows: [{ from: '05:00', to: '09:00' }] })).toBe(false)
    expect(isUnchanged({ windows: [] }, { windows: [{ from: '05:00', to: '08:00' }] })).toBe(false)
  })

  it('một giá trị khác là có đổi, số 0 khác không có', () => {
    expect(isUnchanged({ a: 0 }, { a: 1 })).toBe(false)
    expect(isUnchanged({ a: 0 }, {})).toBe(false)
  })

  it('null và undefined là một: chưa có gì so với chưa có gì', () => {
    expect(isUnchanged(null, undefined)).toBe(true)
    expect(isUnchanged(undefined, { a: 1 })).toBe(false)
  })
})
