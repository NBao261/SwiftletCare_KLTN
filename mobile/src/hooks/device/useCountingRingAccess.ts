import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useExpertReviewNote } from '@/hooks/farm/useExpertReviewNote'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'

export interface CountingRingAccess {
  // Được vẽ vòng đếm cho camera của nhà này (VISION-FR-018): chuyên gia, chủ trại, kỹ thuật viên của nhà
  canDraw: boolean
  // Chủ trại trên farm có chuyên gia: vòng áp ngay và chuyên gia xem lại (BR-22 nhóm A); null với người khác
  reviewNote: string | null
}

// Quyền vẽ vòng đếm và dòng "chuyên gia sẽ xem lại" cho camera của một nhà; farm lấy từ danh sách nhà vì camera không kèm farm
export function useCountingRingAccess(houseId: string | null): CountingRingAccess {
  const user = useAuthStore(state => state.user)
  const { houses } = useAllHouses()
  const farmId = houses.find(house => house._id === houseId)?.farm_id ?? ''
  const reviewNote = useExpertReviewNote(farmId)

  return { canDraw: canPerform(user, 'drawCountingRing'), reviewNote }
}
