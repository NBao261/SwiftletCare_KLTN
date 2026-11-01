import { router, useLocalSearchParams } from 'expo-router'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'
import { useAuthStore } from '@/stores/authStore'
import { useFarmPrefsStore, type AlertsPrefs } from '@/stores/farmPrefsStore'
import type { AlertSeverity } from '@/types'
import { SEVERITIES } from '@/utils/alertList.utils'
import { canPerform } from '@/utils/permission.utils'

// Tham số route của tab Cảnh báo: mở từ chuông chi tiết nhà, hàng cảnh báo tầng, thẻ nhà, ô thống kê Trang chủ
export interface AlertsParams {
  houseId?: string
  zoneId?: string
  severity?: string
  // '1': mở cho cả farm (chuông ở danh sách nhà), không lọc theo nhà xem gần nhất
  allHouses?: string
}

// Phạm vi và bộ lọc của tab Cảnh báo (đặc tả §2, §8): farm, nhà (null = mọi nhà), tầng, mức, loại, phán quyết, phần đang xem.
// Thứ tự lấy: tham số route → bộ lọc đã nhớ → nhà xem gần nhất của tab Farm. Chuyên gia mặc định lọc "Chờ phán quyết"
export function useAlertsScope() {
  const params = useLocalSearchParams<AlertsParams & Record<string, string>>()
  const user = useAuthStore(state => state.user)
  const { userId, prefs } = useFarmPrefs()
  const setAlertsPrefs = useFarmPrefsStore(state => state.setAlertsPrefs)
  const setCurrentFarm = useFarmPrefsStore(state => state.setCurrentFarm)
  const allHouses = useAllHouses()
  const requestedHouse = allHouses.houses.find(house => house._id === params.houseId)
  const farmQuery = useCurrentFarm(requestedHouse?.farm_id)
  const farm = farmQuery.farm
  const farmId = farm?._id ?? ''
  const housesQuery = useOrderedHouses(farmId)
  const houses = housesQuery.houses
  const remembered = prefs.alerts ?? {}

  let houseId: string | null
  if (requestedHouse) houseId = requestedHouse._id
  else if (params.allHouses === '1' || remembered.houseId === null) houseId = null
  else
    houseId =
      houses.find(house => house._id === remembered.houseId)?._id ??
      houses.find(house => house._id === prefs.lastHouseIdByFarm[farmId])?._id ??
      null
  const house = houses.find(item => item._id === houseId) ?? null
  const zonesQuery = useHouseZones(house?._id ?? '')
  const zones = zonesQuery.data ?? []
  const zoneId =
    zones.find(zone => zone._id === params.zoneId)?._id ??
    zones.find(zone => zone._id === remembered.zoneId)?._id ??
    null
  const severity: AlertSeverity | null =
    SEVERITIES.find(item => item === params.severity) ?? remembered.severity ?? null
  // Chuyên gia chưa chọn phán quyết lần nào thì mặc định "Chờ phán quyết" (đặc tả §6)
  const isExpert = canPerform(user, 'setAlertVerdict')
  const verdict = remembered.verdict === undefined ? (isExpert ? 'pending' : null) : remembered.verdict

  // Đổi bộ lọc: nhớ lại và xoá tham số route tương ứng để lựa chọn mới không bị tham số cũ đè
  const remember = (change: Partial<AlertsPrefs>, clearParams: (keyof AlertsParams)[] = []) => {
    if (userId) setAlertsPrefs(userId, change)
    if (clearParams.length > 0) router.setParams(Object.fromEntries(clearParams.map(key => [key, ''])))
  }

  return {
    farm,
    farms: farmQuery.farms,
    houses,
    house,
    zones,
    zoneId,
    severity,
    type: remembered.type ?? null,
    verdict,
    segment: remembered.segment ?? 'active',
    isExpert,
    isLoading: farmQuery.isLoading || housesQuery.isLoading,
    isError: farmQuery.isError || housesQuery.isError,
    selectHouse: (nextHouseId: string | null) =>
      remember({ houseId: nextHouseId, zoneId: null }, ['houseId', 'zoneId', 'allHouses']),
    selectFarm: (nextFarmId: string) => {
      if (userId) setCurrentFarm(userId, nextFarmId)
      remember({ houseId: null, zoneId: null }, ['houseId', 'zoneId', 'allHouses'])
    },
    selectZone: (nextZoneId: string | null) => remember({ zoneId: nextZoneId }, ['zoneId']),
    // Chạm lại ô đang chọn thì bỏ lọc mức
    toggleSeverity: (next: AlertSeverity) => remember({ severity: severity === next ? null : next }, ['severity']),
    selectType: (next: AlertsPrefs['type']) => remember({ type: next }),
    selectVerdict: (next: AlertsPrefs['verdict']) => remember({ verdict: next }),
    selectSegment: (next: AlertsPrefs['segment']) => remember({ segment: next }),
    clearFilters: () => remember({ zoneId: null, severity: null, type: null, verdict: null }, ['zoneId', 'severity']),
  }
}

export type AlertsScope = ReturnType<typeof useAlertsScope>
