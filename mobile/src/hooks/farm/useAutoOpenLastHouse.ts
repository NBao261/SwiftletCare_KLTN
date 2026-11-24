import { useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import type { House } from '@/types'
import { resolveEntryHouseId } from '@/utils/houseOrder.utils'

interface AutoOpenInput {
  farmId: string
  houses: House[]
  // Danh sách nhà đã tải xong
  isReady: boolean
  // Mở farm theo link (Trang chủ) hoặc vừa đổi farm: người dùng muốn xem danh sách, không tự mở nhà
  isFarmRequested: boolean
}

// Vào tab Farm thì mở thẳng nhà xem gần nhất (farm 1 nhà thì nhà đó) — mỗi farm một lần mỗi phiên,
// nên quay lại danh sách hoặc bấm lại tab không bị đẩy sang nhà lần nữa
export function useAutoOpenLastHouse({ farmId, houses, isReady, isFarmRequested }: AutoOpenInput) {
  const { prefs } = useFarmPrefs()
  const autoOpenedFarmIds = useFarmPrefsStore(state => state.autoOpenedFarmIds)
  const markAutoOpened = useFarmPrefsStore(state => state.markAutoOpened)
  const lastHouseId = prefs.lastHouseIdByFarm[farmId]

  // Chỉ chạy khi Màn A đang hiện trên cùng; mở thẳng Màn B từ link thì Màn B tự đánh dấu farm
  useFocusEffect(
    useCallback(() => {
      if (!isReady || !farmId || autoOpenedFarmIds.includes(farmId)) return
      markAutoOpened(farmId)
      if (isFarmRequested) return
      const houseId = resolveEntryHouseId(houses, lastHouseId)
      if (houseId) router.push({ pathname: '/(tabs)/farms/[houseId]', params: { houseId } })
    }, [isReady, farmId, autoOpenedFarmIds, markAutoOpened, isFarmRequested, houses, lastHouseId]),
  )
}
