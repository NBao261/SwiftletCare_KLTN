import { router, useLocalSearchParams } from 'expo-router'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'
import { useFarmPrefsStore, type AnalyticsPrefs, type AnalyticsTab } from '@/stores/farmPrefsStore'
import type { AnalyticsRange } from '@/types'
import type { BirdPeriod } from '@/utils/analytics.utils'
import type { SensorMetric } from '@/utils/threshold.utils'

const TABS: readonly AnalyticsTab[] = ['birds', 'env', 'control', 'harvest', 'reports']
const METRICS: readonly SensorMetric[] = ['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound']
// 1 giờ, 6 giờ chỉ có ở tab Môi trường (đặc tả §3.1)
const SHORT_RANGES: readonly AnalyticsRange[] = ['1h', '6h']

// Tham số route của màn Phân tích: mở thẳng từ màn Farm, Trang chủ, thông báo báo cáo
export interface AnalyticsParams {
  houseId?: string
  zoneId?: string
  tab?: string
  metric?: string
  reportId?: string
}

// Phạm vi đang xem ở màn Phân tích, dùng chung mọi tab: nhà, tầng (null = tất cả), khoảng, tab, chỉ số.
// Thứ tự lấy: tham số route → lựa chọn đã nhớ → mặc định. Đổi gì cũng nhớ lại và ghi vào route
export function useAnalyticsScope() {
  const params = useLocalSearchParams<AnalyticsParams & Record<string, string>>()
  const { userId, prefs } = useFarmPrefs()
  const setAnalyticsPrefs = useFarmPrefsStore(state => state.setAnalyticsPrefs)
  const setAnalyticsZone = useFarmPrefsStore(state => state.setAnalyticsZone)
  const setLastHouse = useFarmPrefsStore(state => state.setLastHouse)
  const setCurrentFarm = useFarmPrefsStore(state => state.setCurrentFarm)
  const allHouses = useAllHouses()
  const requestedHouse = allHouses.houses.find(house => house._id === params.houseId)
  const farmQuery = useCurrentFarm(requestedHouse?.farm_id)
  const farm = farmQuery.farm
  const housesQuery = useOrderedHouses(farm?._id ?? '')
  const houses = housesQuery.houses
  const house =
    houses.find(item => item._id === params.houseId) ??
    houses.find(item => item._id === prefs.lastHouseIdByFarm[farm?._id ?? '']) ??
    houses[0] ??
    null
  const houseId = house?._id ?? ''
  const zonesQuery = useHouseZones(houseId)
  const zones = zonesQuery.data ?? []

  // Tầng: tham số → đã nhớ ở Phân tích (null = tất cả) → tầng xem gần nhất ở tab Farm → tầng đầu
  const rememberedZone = prefs.analyticsZoneIdByHouse?.[houseId]
  const requestedZone = zones.find(zone => zone._id === params.zoneId)
  let selectedZoneId: string | null
  if (requestedZone) selectedZoneId = requestedZone._id
  else if (rememberedZone === null && zones.length > 1) selectedZoneId = null
  else
    selectedZoneId =
      zones.find(zone => zone._id === rememberedZone)?._id ??
      zones.find(zone => zone._id === prefs.lastZoneIdByHouse[houseId])?._id ??
      zones[0]?._id ??
      null
  // Tầng dùng cho khối chỉ một tầng (Điều khiển, Báo cáo) khi đang chọn "Tất cả tầng"
  const focusZone = zones.find(zone => zone._id === selectedZoneId) ?? zones[0] ?? null

  const remembered = prefs.analytics ?? {}
  const tab: AnalyticsTab = TABS.find(item => item === params.tab) ?? remembered.tab ?? 'birds'
  const metric: SensorMetric = METRICS.find(item => item === params.metric) ?? remembered.metric ?? 'temperature'
  const storedRange: AnalyticsRange = remembered.range ?? '7d'
  // Khoảng ngắn chỉ hợp lệ ở tab Môi trường; tab khác dùng 24 giờ
  const range: AnalyticsRange = tab !== 'env' && SHORT_RANGES.includes(storedRange) ? '24h' : storedRange
  const compareZones = selectedZoneId === null || (remembered.compareZones ?? false)
  const birdPeriod: BirdPeriod = remembered.birdPeriod ?? 'day'

  const remember = (change: Partial<AnalyticsPrefs>) => {
    if (userId) setAnalyticsPrefs(userId, change)
  }

  return {
    farm,
    houses,
    house,
    zones,
    selectedZoneId,
    focusZone,
    tab,
    metric,
    range,
    storedRange,
    compareZones,
    birdPeriod,
    reportId: params.reportId,
    isLoading: farmQuery.isLoading || housesQuery.isLoading || zonesQuery.isLoading,
    isError: farmQuery.isError || housesQuery.isError || zonesQuery.isError,
    // Đổi nhà ở đây thì tab Farm cũng mở nhà này
    selectHouse: (nextHouseId: string) => {
      const nextHouse = houses.find(item => item._id === nextHouseId)
      if (userId && nextHouse) {
        setLastHouse(userId, nextHouse.farm_id, nextHouseId)
        setCurrentFarm(userId, nextHouse.farm_id)
      }
      router.setParams({ houseId: nextHouseId, zoneId: '' })
    },
    selectZone: (zoneId: string | null) => {
      if (userId && houseId) setAnalyticsZone(userId, houseId, zoneId)
      router.setParams({ zoneId: zoneId ?? '' })
    },
    selectTab: (nextTab: AnalyticsTab) => {
      remember({ tab: nextTab })
      router.setParams({ tab: nextTab })
    },
    selectMetric: (nextMetric: SensorMetric) => {
      remember({ metric: nextMetric })
      router.setParams({ metric: nextMetric })
    },
    selectRange: (nextRange: AnalyticsRange) => remember({ range: nextRange }),
    setCompareZones: (isOn: boolean) => remember({ compareZones: isOn }),
    selectBirdPeriod: (period: BirdPeriod) => remember({ birdPeriod: period }),
  }
}

export type AnalyticsScope = ReturnType<typeof useAnalyticsScope>
