import { describe, expect, it } from '@jest/globals'
import { findTabTitle, getRoleHomeHref, getRoleTabs, isMobileRole } from '@/constants/roleTabs'

describe('roleTabs', () => {
  it('chỉ Farm Owner và Domain Expert được vào app mobile', () => {
    expect(isMobileRole('FARM_OWNER')).toBe(true)
    expect(isMobileRole('DOMAIN_EXPERT')).toBe(true)
    expect(isMobileRole('TECHNICIAN')).toBe(false)
    expect(isMobileRole('ADMIN')).toBe(false)
  })

  it('Farm Owner giữ 5 tab theo đúng thứ tự', () => {
    expect(getRoleTabs('FARM_OWNER').map(tab => tab.name)).toEqual([
      'dashboard',
      'farms',
      'alerts',
      'analytics',
      'profile',
    ])
  })

  it('Domain Expert có 3 menu tạm', () => {
    expect(getRoleTabs('DOMAIN_EXPERT').map(tab => tab.title)).toEqual(['Menu 1', 'Menu 2', 'Menu 3'])
    expect(findTabTitle('menu-2')).toBe('Menu 2')
  })

  it('sau đăng nhập vào tab đầu của role; role không dùng mobile về màn đăng nhập', () => {
    expect(getRoleHomeHref('FARM_OWNER')).toBe('/(tabs)/dashboard')
    expect(getRoleHomeHref('DOMAIN_EXPERT')).toBe('/(tabs)/menu-1')
    expect(getRoleHomeHref('TECHNICIAN')).toBe('/(auth)/login')
  })
})
