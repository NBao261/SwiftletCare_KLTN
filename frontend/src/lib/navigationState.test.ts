import { describe, expect, it } from 'vitest'
import { UP_FROM_CHILD_STATE, isUpFromChildState, menuLinkState } from '@/lib/navigationState'

describe('isUpFromChildState', () => {
  it('chỉ nhận state đi lên từ trang con', () => {
    expect(isUpFromChildState(UP_FROM_CHILD_STATE)).toBe(true)
    expect(isUpFromChildState(null)).toBe(false)
    expect(isUpFromChildState(undefined)).toBe(false)
    expect(isUpFromChildState({ fromChildPage: false })).toBe(false)
    expect(isUpFromChildState({ zoneId: 'z1' })).toBe(false)
  })
})

describe('menuLinkState', () => {
  it('đang ở trang con của mục menu thì bấm menu là đi lên', () => {
    expect(menuLinkState('/farms', '/farms/f1/houses/h1')).toBe(UP_FROM_CHILD_STATE)
    expect(menuLinkState('/farms', '/farms/f1/houses/h1/zones/z1')).toBe(UP_FROM_CHILD_STATE)
  })

  it('ở chính trang menu hoặc trang khác thì không gắn state', () => {
    expect(menuLinkState('/farms', '/farms')).toBeUndefined()
    expect(menuLinkState('/farms', '/dashboard')).toBeUndefined()
    expect(menuLinkState('/farms', '/farmsx')).toBeUndefined()
  })
})
