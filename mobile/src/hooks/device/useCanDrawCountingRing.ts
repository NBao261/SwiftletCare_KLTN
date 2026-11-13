import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import { useAuthStore } from '@/stores/authStore'
import { farmHasExpert } from '@/utils/farm.utils'
import { canPerform } from '@/utils/permission.utils'

// Người dùng có được vẽ vòng đếm cho camera của nhà này không (VISION-FR-018): chuyên gia và kỹ thuật viên của nhà được; chủ
// trại chỉ khi farm chưa có chuyên gia (BR-22) — nên cần thành viên của farm chứa nhà. Chưa tải xong farm thì chủ trại chưa vẽ
export function useCanDrawCountingRing(houseId: string | null): boolean {
  const user = useAuthStore(state => state.user)
  const mayDraw = canPerform(user, 'drawCountingRing', { farmHasExpert: false })
  const { houses } = useAllHouses()
  const farmId = houses.find(house => house._id === houseId)?.farm_id ?? ''
  const farmQuery = useFarmDetail(mayDraw ? farmId : '')
  const farm = farmQuery.data?.data ?? null

  return canPerform(user, 'drawCountingRing', { farmHasExpert: farm ? farmHasExpert(farm) : undefined })
}
