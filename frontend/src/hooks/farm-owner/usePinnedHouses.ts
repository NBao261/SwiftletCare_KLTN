import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePinnedHouseStore } from '@/stores/pinnedHouseStore'

const NO_PINS: string[] = []

/** Tập nhà yến đã ghim của người dùng hiện tại + hàm bật/tắt ghim */
export function usePinnedHouses() {
  const userId = useAuthStore(s => s.user?._id) ?? ''
  const ids = usePinnedHouseStore(s => s.pinnedByUser[userId]) ?? NO_PINS
  const toggleInStore = usePinnedHouseStore(s => s.toggle)

  const pinned = useMemo(() => new Set(ids), [ids])
  const toggle = useCallback((houseId: string) => { if (userId) toggleInStore(userId, houseId) }, [userId, toggleInStore])
  return { pinned, toggle }
}
