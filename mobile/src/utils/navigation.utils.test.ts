import { describe, expect, it } from '@jest/globals'
import {
  RETURN_TO_HOME,
  RETURN_TO_NOTIFICATIONS,
  buildAlertReturnTo,
  buildHouseReturnTo,
  isSafeReturnTo,
} from '@/utils/navigation.utils'

describe('isSafeReturnTo', () => {
  it('nhận đường dẫn tab và chi tiết cảnh báo', () => {
    expect(isSafeReturnTo(RETURN_TO_HOME)).toBe(true)
    expect(isSafeReturnTo(buildHouseReturnTo('house-1'))).toBe(true)
    expect(isSafeReturnTo(buildAlertReturnTo('alert-1'))).toBe(true)
    expect(isSafeReturnTo(RETURN_TO_NOTIFICATIONS)).toBe(true)
  })

  it('từ chối chuỗi rỗng, không phải chuỗi, link ngoài và đường dẫn lạ', () => {
    expect(isSafeReturnTo(undefined)).toBe(false)
    expect(isSafeReturnTo('')).toBe(false)
    expect(isSafeReturnTo(['/(tabs)/home'])).toBe(false)
    expect(isSafeReturnTo('https://example.com')).toBe(false)
    expect(isSafeReturnTo('/(auth)/login')).toBe(false)
    expect(isSafeReturnTo('/(tabs)/../(auth)/login')).toBe(false)
    expect(isSafeReturnTo('/(tabs)/home?x=1')).toBe(false)
  })
})

describe('buildHouseReturnTo / buildAlertReturnTo', () => {
  it('mã hoá id để không chèn được đường dẫn khác', () => {
    expect(buildHouseReturnTo('a/b')).toBe('/(tabs)/farms/a%2Fb')
    expect(buildAlertReturnTo('x')).toBe('/alert/x')
  })
})
