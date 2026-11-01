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
      'home',
      'farms',
      'alerts',
      'analytics',
      'profile',
    ])
  })

  it('Domain Expert có tab Cảnh báo, 1 menu tạm và tab Tài khoản', () => {
    expect(getRoleTabs('DOMAIN_EXPERT').map(tab => tab.name)).toEqual(['alerts', 'menu-2', 'profile'])
    expect(findTabTitle('menu-2')).toBe('Menu 2')
  })

  it('role nào dùng mobile cũng có tab Tài khoản để đăng xuất', () => {
    expect(getRoleTabs('FARM_OWNER').some(tab => tab.name === 'profile')).toBe(true)
    expect(getRoleTabs('DOMAIN_EXPERT').some(tab => tab.name === 'profile')).toBe(true)
  })

  it('sau đăng nhập vào tab đầu của role; role không dùng mobile về màn đăng nhập', () => {
    expect(getRoleHomeHref('FARM_OWNER')).toBe('/(tabs)/home')
    expect(getRoleHomeHref('DOMAIN_EXPERT')).toBe('/(tabs)/alerts')
    expect(getRoleHomeHref('TECHNICIAN')).toBe('/(auth)/login')
  })
})
