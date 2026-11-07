import { router, useLocalSearchParams } from 'expo-router'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarms } from '@/hooks/farm/useFarms'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'
import { useAuthStore } from '@/stores/authStore'
import { useFarmPrefsStore, type AlertsPrefs } from '@/stores/farmPrefsStore'
import { resolveVerdictFilter } from '@/utils/alertList.utils'
import { parseSeverityLevel, type SeverityLevel } from '@/utils/severity.utils'
import { canPerform } from '@/utils/permission.utils'

// Tham số route của tab Cảnh báo: mở từ chuông tab Farm, chuông chi tiết nhà, hàng cảnh báo tầng, thẻ nhà, ô thống kê
// Trang chủ. Nhà thắng farm; truyền chuỗi rỗng để xoá tham số cũ
export interface AlertsParams {
  farmId?: string
  houseId?: string
  zoneId?: string
  severity?: string
  // '1': mở cho mọi farm (chuông tab Farm khi đang xem "Tất cả trang trại")
  allFarms?: string
}

const ALL_PARAMS: (keyof AlertsParams)[] = ['farmId', 'houseId', 'zoneId', 'allFarms']

// Phạm vi và bộ lọc của tab Cảnh báo (đặc tả §2, §8): farm (null = mọi farm), nhà (null = mọi nhà), tầng, mức, loại,
// phán quyết, phần đang xem. Phạm vi riêng của tab, không theo farm/nhà đang xem ở tab Farm hay Phân tích; chưa chọn
// gì thì là tất cả. Thứ tự lấy: tham số route → lựa chọn đã nhớ → tất cả. Chuyên gia mặc định lọc "Chờ phán quyết"
export function useAlertsScope() {
  const params = useLocalSearchParams<AlertsParams & Record<string, string>>()
  const user = useAuthStore(state => state.user)
  const { userId, prefs } = useFarmPrefs()
  const setAlertsPrefs = useFarmPrefsStore(state => state.setAlertsPrefs)
  const farmsQuery = useFarms()
  const farms = farmsQuery.data?.data ?? []
  const allHouses = useAllHouses()
  const remembered = prefs.alerts ?? {}
  const hasMultipleFarms = farms.length > 1
  // Không có danh sách farm nào để dùng; tải lại nền lỗi mà còn danh sách cũ thì vẫn xem tiếp được
  const isFarmsError = farmsQuery.isError && !farmsQuery.data

  const requestedHouse = allHouses.houses.find(house => house._id === params.houseId)
  const requestedFarm = farms.find(farm => farm._id === params.farmId)
  let farmId: string | null
  if (requestedHouse) farmId = requestedHouse.farm_id
  else if (requestedFarm) farmId = requestedFarm._id
  else if (params.allFarms === '1') farmId = null
  else farmId = farms.find(farm => farm._id === remembered.farmId)?._id ?? null
  // Chỉ có một farm thì "tất cả farm" chính là farm đó: cho chọn nhà luôn
  if (farmId === null && !hasMultipleFarms) farmId = farms[0]?._id ?? null
  const farm = farms.find(item => item._id === farmId) ?? null

  const housesQuery = useOrderedHouses(farmId ?? '')
  const houses = farmId ? housesQuery.houses : []
  let houseId: string | null
  if (requestedHouse) houseId = requestedHouse._id
  else if (requestedFarm || params.allFarms === '1') houseId = null
  else houseId = houses.find(house => house._id === remembered.houseId)?._id ?? null
  const house = houses.find(item => item._id === houseId) ?? null

  const zonesQuery = useHouseZones(house?._id ?? '')
  const zones = zonesQuery.data ?? []
  const zoneId =
    zones.find(zone => zone._id === params.zoneId)?._id ??
    zones.find(zone => zone._id === remembered.zoneId)?._id ??
    null
  // Giá trị đã nhớ từ bản cũ có thể là mức backend (CRITICAL…): đổi sang cấp, giá trị lạ thì bỏ
  const severity: SeverityLevel | null = parseSeverityLevel(params.severity) ?? parseSeverityLevel(remembered.severity)
  // Chuyên gia chưa chọn phán quyết lần nào thì mặc định "Chờ phán quyết" (đặc tả §6)
  const isExpert = canPerform(user, 'setAlertVerdict')
  const chosenVerdict = remembered.verdict === undefined ? (isExpert ? 'pending' : null) : remembered.verdict
  const type = remembered.type ?? null
  // Lựa chọn phán quyết vẫn được nhớ: bỏ lọc loại hoặc về loại suy luận thì áp lại
  const verdict = resolveVerdictFilter(type, chosenVerdict)

  // Đổi bộ lọc: nhớ lại và xoá tham số route tương ứng để lựa chọn mới không bị tham số cũ đè
  const remember = (change: Partial<AlertsPrefs>, clearParams: (keyof AlertsParams)[] = []) => {
    if (userId) setAlertsPrefs(userId, change)
    if (clearParams.length > 0) router.setParams(Object.fromEntries(clearParams.map(key => [key, ''])))
  }

  return {
    // null: mọi farm (chỉ khi thuộc từ 2 farm)
    farmId,
    farm,
    farms,
    hasMultipleFarms,
    houses,
    house,
    zones,
    zoneId,
    severity,
    type,
    verdict,
    segment: remembered.segment ?? 'active',
    isExpert,
    // Danh sách farm đã tải (mới biết "tất cả" gồm những farm nào); mở bằng ?houseId thì chờ cả danh sách nhà, để lần gọi đầu
    // không lấy nhầm phạm vi đã nhớ khi cache còn lạnh
    isReady:
      !farmsQuery.isLoading &&
      !isFarmsError &&
      !(params.houseId && !requestedHouse && allHouses.isLoading) &&
      !(Boolean(farmId) && housesQuery.isLoading),
    isLoading: farmsQuery.isLoading || (Boolean(farmId) && housesQuery.isLoading),
    isError: farmsQuery.isError || housesQuery.isError,
    isFarmsError,
    retryFarms: farmsQuery.refetch,
    // Đổi farm thì về mọi nhà, mọi tầng của farm đó; null là mọi farm
    selectFarm: (nextFarmId: string | null) =>
      remember({ farmId: nextFarmId, houseId: null, zoneId: null }, ALL_PARAMS),
    selectHouse: (nextHouseId: string | null) =>
      remember({ farmId, houseId: nextHouseId, zoneId: null }, ALL_PARAMS),
    selectZone: (nextZoneId: string | null) => remember({ zoneId: nextZoneId }, ['zoneId']),
    // Chạm lại ô đang chọn thì bỏ lọc mức
    toggleSeverity: (next: SeverityLevel) => remember({ severity: severity === next ? null : next }, ['severity']),
    selectType: (next: AlertsPrefs['type']) => remember({ type: next }),
    selectVerdict: (next: AlertsPrefs['verdict']) => remember({ verdict: next }),
    selectSegment: (next: AlertsPrefs['segment']) => remember({ segment: next }),
    clearFilters: () => remember({ zoneId: null, severity: null, type: null, verdict: null }, ['zoneId', 'severity']),
  }
}

export type AlertsScope = ReturnType<typeof useAlertsScope>
