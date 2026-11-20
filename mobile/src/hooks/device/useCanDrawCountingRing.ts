import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'

// Người dùng có được vẽ vòng đếm cho camera của nhà này không (VISION-FR-018): chuyên gia và kỹ thuật viên của nhà được; chủ
// trại chỉ khi farm chứa nhà chưa có chuyên gia còn hoạt động (BR-22, has_active_expert). Chưa tải xong farm thì chủ trại chưa vẽ
export function useCanDrawCountingRing(houseId: string | null): boolean {
  const user = useAuthStore(state => state.user)
  const { houses } = useAllHouses()
  const farmId = houses.find(house => house._id === houseId)?.farm_id ?? ''
  const hasExpert = useFarmHasExpert(farmId)

  return canPerform(user, 'drawCountingRing', { farmHasExpert: hasExpert })
}
