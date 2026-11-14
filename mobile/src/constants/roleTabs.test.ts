import { describe, expect, it } from '@jest/globals'
import { findTabTitle, getRoleHomeHref, getRoleTabs, isMobileRole } from '@/constants/roleTabs'

describe('roleTabs', () => {
  it('Farm Owner, kỹ thuật viên nhà yến và Domain Expert vào được app mobile; Administrator thì không', () => {
    expect(isMobileRole('FARM_OWNER')).toBe(true)
    expect(isMobileRole('FARM_TECHNICIAN')).toBe(true)
    expect(isMobileRole('DOMAIN_EXPERT')).toBe(true)
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

  it('kỹ thuật viên có cùng 5 tab với Farm Owner (chỉ thấy nhà được giao)', () => {
    expect(getRoleTabs('FARM_TECHNICIAN').map(tab => tab.name)).toEqual(['home', 'farms', 'alerts', 'analytics', 'profile'])
  })

  it('Domain Expert có 4 tab nghiệp vụ (Hàng đợi, Thẩm định, Tham số, Tài khoản)', () => {
    const tabs = getRoleTabs('DOMAIN_EXPERT')
    expect(tabs.map(tab => tab.name)).toEqual(['queue', 'verdicts', 'tuning', 'profile'])
    expect(findTabTitle('queue')).toBe('Hàng đợi')
    expect(findTabTitle('verdicts')).toBe('Thẩm định')
    expect(findTabTitle('tuning')).toBe('Tham số')

    const verdictsTab = tabs.find(t => t.name === 'verdicts')
    expect(verdictsTab?.showsAlertBadge).toBe(true)
    expect(verdictsTab?.isFeatured).toBe(true)
  })

  it('role nào dùng mobile cũng có tab Tài khoản để đăng xuất', () => {
    expect(getRoleTabs('FARM_OWNER').some(tab => tab.name === 'profile')).toBe(true)
    expect(getRoleTabs('DOMAIN_EXPERT').some(tab => tab.name === 'profile')).toBe(true)
    expect(getRoleTabs('FARM_TECHNICIAN').some(tab => tab.name === 'profile')).toBe(true)
  })

  it('sau đăng nhập vào tab đầu của role; role không dùng mobile về màn đăng nhập', () => {
    expect(getRoleHomeHref('FARM_OWNER')).toBe('/(tabs)/home')
    expect(getRoleHomeHref('DOMAIN_EXPERT')).toBe('/(tabs)/queue')
    expect(getRoleHomeHref('FARM_TECHNICIAN')).toBe('/(tabs)/home')
    expect(getRoleHomeHref('ADMIN')).toBe('/(auth)/login')
  })
})
