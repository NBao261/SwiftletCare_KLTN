import { conditionOfWeatherCode, isRainy } from '@/utils/weatherCondition.util'

describe('conditionOfWeatherCode', () => {
  it.each([
    [0, 'CLEAR'], [1, 'CLEAR'], [2, 'PARTLY_CLOUDY'], [3, 'CLOUDY'], [45, 'FOG'], [48, 'FOG'],
    [51, 'DRIZZLE'], [55, 'DRIZZLE'], [57, 'DRIZZLE'], [61, 'RAIN'], [65, 'RAIN'], [67, 'RAIN'],
    [80, 'RAIN'], [82, 'RAIN'], [95, 'THUNDERSTORM'], [99, 'THUNDERSTORM'],
  ])('mã %i là %s', (code, condition) => {
    expect(conditionOfWeatherCode(code)).toBe(condition)
  })

  it.each([[71], [77], [85], [4], [-1], [100], [1.5], ['0'], [null], [undefined]])('mã lạ %p là OTHER, không đoán', code => {
    expect(conditionOfWeatherCode(code)).toBe('OTHER')
  })
})

describe('isRainy', () => {
  it('mưa phùn, mưa và dông là đang mưa; còn lại thì không', () => {
    expect(['DRIZZLE', 'RAIN', 'THUNDERSTORM'].every(c => isRainy(c as never))).toBe(true)
    expect(['CLEAR', 'PARTLY_CLOUDY', 'CLOUDY', 'FOG', 'OTHER'].some(c => isRainy(c as never))).toBe(false)
  })
})
