import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import { joinHouse, leaveHouse, offBirdCountUpdate, onBirdCountUpdate } from '@/services/socket/socketClient'
import type { SocketBirdCountUpdate } from '@/types'

// Số đếm chim hôm nay của một nhà, cập nhật ngay khi có tin BIRD_COUNT_UPDATE của nhà đó (VISION-FR-012)
export function useLiveHouseBirdCount(houseId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    // Cùng key với useTodayBirdCounts nên dùng chung cache
    queryKey: ['bird-count', 'current', houseId],
    queryFn: () => analyticsApi.getBirdCountCurrent(houseId as string).then(response => response.data),
    enabled: Boolean(houseId),
  })

  // Vào phòng của nhà khi mở, có tin mới thì tải lại số; ra phòng khi đóng
  useEffect(() => {
    if (!houseId) return
    const handleUpdate = (update: SocketBirdCountUpdate) => {
      if (update.houseId === houseId) queryClient.invalidateQueries({ queryKey: ['bird-count', 'current', houseId] })
    }
    joinHouse(houseId)
    onBirdCountUpdate(handleUpdate)
    return () => {
      offBirdCountUpdate(handleUpdate)
      leaveHouse(houseId)
    }
  }, [houseId, queryClient])

  return query.data?.data
}
