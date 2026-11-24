import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { EMPTY_FARM_PREFS, migrateFarmPrefs, useFarmPrefsStore } from '@/stores/farmPrefsStore'

// Kho file cần module native: trong test thay bằng kho trong bộ nhớ
jest.mock('@/services/storage/preferenceStorage', () => {
  const values = new Map<string, string>()
  return {
    preferenceStateStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  }
})

describe('farmPrefsStore', () => {
  beforeEach(() => {
    useFarmPrefsStore.setState({ byUserId: {}, autoOpenedFarmIds: [] })
  })

  it('lưu riêng theo tài khoản', () => {
    const { setLastHouse, togglePinnedHouse } = useFarmPrefsStore.getState()
    setLastHouse('user-a', 'farm-1', 'house-2')
    togglePinnedHouse('user-a', 'house-2')
    setLastHouse('user-b', 'farm-1', 'house-1')
    const { byUserId } = useFarmPrefsStore.getState()
    expect(byUserId['user-a'].lastHouseIdByFarm).toEqual({ 'farm-1': 'house-2' })
    expect(byUserId['user-a'].pinnedHouseIds).toEqual(['house-2'])
    expect(byUserId['user-b'].lastHouseIdByFarm).toEqual({ 'farm-1': 'house-1' })
  })

  it('tài khoản chưa lưu gì không làm đổi giá trị mặc định dùng chung', () => {
    useFarmPrefsStore.getState().setCameraCollapsed('user-a', true)
    expect(useFarmPrefsStore.getState().byUserId['user-a'].isCameraCollapsed).toBe(true)
    expect(EMPTY_FARM_PREFS.isCameraCollapsed).toBe(false)
  })

  it('bấm ghim lần nữa thì bỏ ghim', () => {
    const { togglePinnedHouse } = useFarmPrefsStore.getState()
    togglePinnedHouse('user-a', 'house-1')
    togglePinnedHouse('user-a', 'house-1')
    expect(useFarmPrefsStore.getState().byUserId['user-a'].pinnedHouseIds).toEqual([])
  })

  it('mỗi farm chỉ đánh dấu đã tự mở một lần', () => {
    const { markAutoOpened } = useFarmPrefsStore.getState()
    markAutoOpened('farm-1')
    markAutoOpened('farm-1')
    expect(useFarmPrefsStore.getState().autoOpenedFarmIds).toEqual(['farm-1'])
  })
})

describe('migrateFarmPrefs', () => {
  it('bản 2 → 3: giữ mọi lựa chọn, bộ lọc Cảnh báo chưa có farmId thì nhà/tầng về "tất cả"', () => {
    const migrated = migrateFarmPrefs(
      {
        byUserId: {
          'user-1': {
            ...EMPTY_FARM_PREFS,
            pinnedHouseIds: ['house-1'],
            alerts: { houseId: 'house-1', zoneId: 'zone-1', severity: 'P1' },
          },
        },
      },
      2,
    )
    const prefs = migrated.byUserId['user-1']
    expect(prefs?.pinnedHouseIds).toEqual(['house-1'])
    expect(prefs?.alerts).toEqual({ houseId: null, zoneId: null, severity: 'P1' })
  })

  it('đã có farmId thì giữ nguyên; bản cũ hơn 2 thì bỏ hết', () => {
    const alerts = { farmId: 'farm-1', houseId: 'house-1', zoneId: null }
    expect(migrateFarmPrefs({ byUserId: { 'user-1': { ...EMPTY_FARM_PREFS, alerts } } }, 2).byUserId['user-1']?.alerts).toEqual(
      alerts,
    )
    expect(migrateFarmPrefs({ byUserId: { 'user-1': EMPTY_FARM_PREFS } }, 1)).toEqual({ byUserId: {} })
  })
})
