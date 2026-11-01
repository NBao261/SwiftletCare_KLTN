import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { preferenceStateStorage } from '@/services/storage/preferenceStorage'
import type { AlertSeverity, AlertType, AnalyticsRange } from '@/types'
import type { VerdictFilter } from '@/utils/alertList.utils'
import type { BirdPeriod } from '@/utils/analytics.utils'
import type { SensorMetric } from '@/utils/threshold.utils'

// Lựa chọn của người dùng ở tab Farm, lưu trên máy (file JSON, services/storage/preferenceStorage) theo từng tài khoản.
// Để ở Zustand chứ không ở React Query: đây không phải dữ liệu server (backend không có API ghim nhà, nhà xem gần
// nhất, nhà đã ghim…), cả Màn A, Màn B và hàm thường đều đọc chung, và phải còn sau khi tắt app
export type CellularAutoplay = 'allow' | 'deny'

// Tab nội bộ của màn Phân tích
export type AnalyticsTab = 'birds' | 'env' | 'control' | 'harvest' | 'reports'

// Bộ lọc tab Cảnh báo, nhớ khi tắt app (đặc tả Trang Cảnh báo §8). houseId null là mọi nhà, chưa có thì dùng nhà xem
// gần nhất của tab Farm; zoneId null là mọi tầng
export interface AlertsPrefs {
  segment: 'active' | 'resolved'
  houseId: string | null
  zoneId: string | null
  severity: AlertSeverity | null
  type: AlertType | null
  verdict: VerdictFilter | null
}

// Lựa chọn ở màn Phân tích, nhớ khi tắt app (đặc tả Menu Phân tích §8)
export interface AnalyticsPrefs {
  tab: AnalyticsTab
  range: AnalyticsRange
  metric: SensorMetric
  compareZones: boolean
  birdPeriod: BirdPeriod
}

export interface FarmPrefs {
  currentFarmId?: string
  lastHouseIdByFarm: Record<string, string>
  // Nhà đã ghim lên đầu danh sách, chung mọi farm — như web (pinnedHouseStore)
  pinnedHouseIds: string[]
  lastZoneIdByHouse: Record<string, string>
  isCameraCollapsed: boolean
  // Tự phát camera khi dùng dữ liệu di động; chưa chọn thì hỏi một lần
  cellularAutoplay?: CellularAutoplay
  // Màn Phân tích; nhà dùng chung lastHouseIdByFarm với tab Farm
  analytics?: Partial<AnalyticsPrefs>
  // Tầng đang xem ở Phân tích theo nhà; null là "Tất cả tầng"
  analyticsZoneIdByHouse?: Record<string, string | null>
  alerts?: Partial<AlertsPrefs>
}

// Giá trị mặc định dùng chung, đông cứng để selector trả về cùng một object khi chưa có gì
export const EMPTY_FARM_PREFS: Readonly<FarmPrefs> = Object.freeze({
  lastHouseIdByFarm: {},
  pinnedHouseIds: [],
  lastZoneIdByHouse: {},
  isCameraCollapsed: false,
})

interface FarmPrefsState {
  byUserId: Record<string, FarmPrefs>
  // Farm đã tự mở nhà xem gần nhất trong phiên này — chỉ giữ trong bộ nhớ, không lưu xuống máy
  autoOpenedFarmIds: string[]
  setCurrentFarm: (userId: string, farmId: string) => void
  setLastHouse: (userId: string, farmId: string, houseId: string) => void
  togglePinnedHouse: (userId: string, houseId: string) => void
  setLastZone: (userId: string, houseId: string, zoneId: string) => void
  setCameraCollapsed: (userId: string, isCollapsed: boolean) => void
  setCellularAutoplay: (userId: string, choice: CellularAutoplay) => void
  setAnalyticsPrefs: (userId: string, change: Partial<AnalyticsPrefs>) => void
  setAnalyticsZone: (userId: string, houseId: string, zoneId: string | null) => void
  setAlertsPrefs: (userId: string, change: Partial<AlertsPrefs>) => void
  markAutoOpened: (farmId: string) => void
}

// Sửa lựa chọn của một tài khoản, giữ nguyên các tài khoản khác
function updatePrefs(
  state: FarmPrefsState,
  userId: string,
  change: (prefs: FarmPrefs) => Partial<FarmPrefs>,
): Pick<FarmPrefsState, 'byUserId'> {
  const current = state.byUserId[userId] ?? EMPTY_FARM_PREFS
  return { byUserId: { ...state.byUserId, [userId]: { ...current, ...change(current) } } }
}

export const useFarmPrefsStore = create<FarmPrefsState>()(
  persist(
    set => ({
      byUserId: {},
      autoOpenedFarmIds: [],
      setCurrentFarm: (userId, farmId) => set(state => updatePrefs(state, userId, () => ({ currentFarmId: farmId }))),
      setLastHouse: (userId, farmId, houseId) =>
        set(state =>
          updatePrefs(state, userId, prefs => ({ lastHouseIdByFarm: { ...prefs.lastHouseIdByFarm, [farmId]: houseId } })),
        ),
      togglePinnedHouse: (userId, houseId) =>
        set(state =>
          updatePrefs(state, userId, prefs => ({
            pinnedHouseIds: prefs.pinnedHouseIds.includes(houseId)
              ? prefs.pinnedHouseIds.filter(id => id !== houseId)
              : [...prefs.pinnedHouseIds, houseId],
          })),
        ),
      setLastZone: (userId, houseId, zoneId) =>
        set(state =>
          updatePrefs(state, userId, prefs => ({ lastZoneIdByHouse: { ...prefs.lastZoneIdByHouse, [houseId]: zoneId } })),
        ),
      setCameraCollapsed: (userId, isCollapsed) =>
        set(state => updatePrefs(state, userId, () => ({ isCameraCollapsed: isCollapsed }))),
      setCellularAutoplay: (userId, choice) =>
        set(state => updatePrefs(state, userId, () => ({ cellularAutoplay: choice }))),
      setAnalyticsPrefs: (userId, change) =>
        set(state => updatePrefs(state, userId, prefs => ({ analytics: { ...prefs.analytics, ...change } }))),
      setAnalyticsZone: (userId, houseId, zoneId) =>
        set(state =>
          updatePrefs(state, userId, prefs => ({
            analyticsZoneIdByHouse: { ...prefs.analyticsZoneIdByHouse, [houseId]: zoneId },
          })),
        ),
      setAlertsPrefs: (userId, change) =>
        set(state => updatePrefs(state, userId, prefs => ({ alerts: { ...prefs.alerts, ...change } }))),
      markAutoOpened: farmId =>
        set(state =>
          state.autoOpenedFarmIds.includes(farmId) ? state : { autoOpenedFarmIds: [...state.autoOpenedFarmIds, farmId] },
        ),
    }),
    {
      name: 'farm-prefs',
      // Bản 2: bỏ thứ tự nhà tự sắp (↑↓), thay bằng nhà ghim như web
      version: 2,
      migrate: () => ({ byUserId: {} }),
      storage: createJSONStorage(() => preferenceStateStorage),
      // Chỉ lưu lựa chọn theo tài khoản; danh sách farm đã tự mở là của phiên hiện tại
      partialize: state => ({ byUserId: state.byUserId }),
    },
  ),
)
