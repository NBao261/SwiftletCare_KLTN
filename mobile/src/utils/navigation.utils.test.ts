import { describe, expect, it } from '@jest/globals'
import {
  RETURN_TO_HOME,
  RETURN_TO_NOTIFICATIONS,
  buildAlertReturnTo,
  buildHouseReturnTo,
  isPreviousRoute,
  isRootStackReturnTo,
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

describe('isPreviousRoute', () => {
  const state = {
    index: 2,
    routes: [
      { name: '(tabs)' },
      { name: 'alert/[alertId]', params: { alertId: 'alert-1' } },
      { name: 'work-orders/[workOrderId]', params: { workOrderId: 'wo-1' } },
    ],
  }

  it('màn ngay dưới đúng route và đúng tham số thì là màn trước', () => {
    expect(isPreviousRoute(state, 'alert/[alertId]', { alertId: 'alert-1' })).toBe(true)
  })

  it('khác tham số, khác route hoặc không có màn dưới thì không phải', () => {
    expect(isPreviousRoute(state, 'alert/[alertId]', { alertId: 'alert-2' })).toBe(false)
    expect(isPreviousRoute(state, 'work-orders/[workOrderId]', { workOrderId: 'wo-1' })).toBe(false)
    expect(isPreviousRoute({ index: 0, routes: [{ name: '(tabs)' }] }, '(tabs)', {})).toBe(false)
    expect(isPreviousRoute(undefined, 'alert/[alertId]', { alertId: 'alert-1' })).toBe(false)
  })
})

describe('isRootStackReturnTo', () => {
  it('chi tiết cảnh báo và chuông là màn của stack gốc, màn trong tab thì không', () => {
    expect(isRootStackReturnTo(buildAlertReturnTo('alert-1'))).toBe(true)
    expect(isRootStackReturnTo(RETURN_TO_NOTIFICATIONS)).toBe(true)
    expect(isRootStackReturnTo(RETURN_TO_HOME)).toBe(false)
    expect(isRootStackReturnTo(buildHouseReturnTo('house-1'))).toBe(false)
  })
})
