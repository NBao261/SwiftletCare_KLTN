import { useQueries } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import { useFarms } from '@/hooks/farm/useFarms'
import { useAuthStore } from '@/stores/authStore'
import { farmApi } from '@/services/api/farm.api'
import type { HouseOverview } from '@/types'
import { canPerform } from '@/utils/permission.utils'

// Một nhà trong tổng quan kèm ngày của tổng quan (hôm nay giờ VN)
export interface HouseOverviewOfDay extends HouseOverview {
  date: string
}

// Tổng quan hôm nay của mọi farm (ANALYTICS-FR-015), tra theo id nhà; chỉ chủ trại gọi (kỹ thuật viên 403). Trạng thái ngày đổi
// sau đánh giá cuối ngày nên làm mới mỗi 5 phút là đủ (hằng số giao diện, chưa có trong Report 3 §4.5); chỉ làm mới khi màn đang
// hiện, như các hook polling khác (mobile/CLAUDE.md "Plumbing as written")
const REFETCH_INTERVAL_MS = 5 * 60 * 1000

export function useFarmOverviews() {
  const user = useAuthStore(state => state.user)
  const farmsQuery = useFarms()
  const farmIds = (farmsQuery.data?.data ?? []).map(farm => farm._id)
  const enabled = canPerform(user, 'viewFarmOverview')
  const isFocused = useIsFocused()

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['farm-overview', farmId],
      queryFn: () => farmApi.getOverview(farmId).then(response => response.data.data),
      enabled,
      refetchInterval: isFocused ? REFETCH_INTERVAL_MS : false,
    })),
    combine: results => {
      const houseById = new Map<string, HouseOverviewOfDay>()
      for (const result of results) {
        for (const house of result.data?.houses ?? []) houseById.set(house.house_id, { ...house, date: result.data?.date ?? '' })
      }
      return houseById
    },
  })
}
