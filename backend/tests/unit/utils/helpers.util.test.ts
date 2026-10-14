import { paginate } from '@/utils/helpers.util'

describe('paginate', () => {
  it('uses page 1 / limit 20 when nothing is given', () => {
    expect(paginate(undefined, undefined)).toEqual({ page: 1, skip: 0, limit: 20 })
  })

  it('computes skip from a valid page and limit (strings from the query string too)', () => {
    expect(paginate('3', '10')).toEqual({ page: 3, skip: 20, limit: 10 })
    expect(paginate(2, 50)).toEqual({ page: 2, skip: 50, limit: 50 })
  })

  it('clamps limit to maxLimit', () => {
    expect(paginate(1, 1000).limit).toBe(100)
    expect(paginate(1, 1000, { maxLimit: 25 }).limit).toBe(25)
  })

  it.each([0, -1, -20, NaN, 'abc', '', null])('falls back to page 1 for invalid page %p', bad => {
    const result = paginate(bad as never, 10)
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it.each([0, -5, NaN, 'abc', ''])('falls back to the default limit for invalid limit %p', bad => {
    expect(paginate(1, bad as never).limit).toBe(20)
    expect(paginate(1, bad as never, { defaultLimit: 15 }).limit).toBe(15)
  })

  it('never returns a negative skip or a NaN value', () => {
    const { page, skip, limit } = paginate('-3', 'x')
    expect([page, skip, limit].every(Number.isFinite)).toBe(true)
    expect(skip).toBeGreaterThanOrEqual(0)
  })

  it('floors fractional values', () => {
    expect(paginate(2.9, 10.7)).toEqual({ page: 2, skip: 10, limit: 10 })
  })
})
