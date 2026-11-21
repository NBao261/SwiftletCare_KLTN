import { describe, expect, it } from 'vitest'
import { activeTabPath, isMenuItemActive, isPathWithin } from '@/lib/menuMatch'

describe('isPathWithin', () => {
  it('khớp chính trang và trang chi tiết bên dưới', () => {
    expect(isPathWithin('/devices', '/devices')).toBe(true)
    expect(isPathWithin('/devices/onboarding', '/devices')).toBe(true)
  })

  it('không khớp đường dẫn chỉ trùng tiền tố chữ', () => {
    expect(isPathWithin('/users-x', '/users')).toBe(false)
    expect(isPathWithin('/dashboard', '/devices')).toBe(false)
  })
})

describe('isMenuItemActive', () => {
  const users = { path: '/users', tabs: [{ path: '/users' }, { path: '/account-requests' }] }

  it('mục có tab sáng ở mọi trang của tab', () => {
    expect(isMenuItemActive(users, '/users')).toBe(true)
    expect(isMenuItemActive(users, '/account-requests')).toBe(true)
    expect(isMenuItemActive(users, '/account-requests/detail')).toBe(true)
  })

  it('mục không có tab chỉ sáng ở trang của nó', () => {
    expect(isMenuItemActive({ path: '/alerts' }, '/alerts')).toBe(true)
    expect(isMenuItemActive({ path: '/alerts' }, '/account-requests')).toBe(false)
  })
})

describe('activeTabPath', () => {
  const tabs = [{ path: '/dashboard' }, { path: '/overview' }, { path: '/dashboard/scada' }]

  it('chọn tab có đường dẫn dài nhất chứa trang hiện tại', () => {
    expect(activeTabPath(tabs, '/dashboard/scada')).toBe('/dashboard/scada')
    expect(activeTabPath(tabs, '/dashboard/scada/x')).toBe('/dashboard/scada')
  })

  it('trang cha chỉ sáng tab của chính nó', () => {
    expect(activeTabPath(tabs, '/dashboard')).toBe('/dashboard')
    expect(activeTabPath(tabs, '/overview')).toBe('/overview')
  })

  it('không khớp tab nào thì không có tab đang mở', () => {
    expect(activeTabPath(tabs, '/alerts')).toBeUndefined()
    expect(activeTabPath([], '/dashboard')).toBeUndefined()
  })
})
