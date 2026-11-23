import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useAuthStore } from '@/stores/authStore'
import { getExpertReviewNote } from '@/utils/settingsSection.utils'

// Dòng "Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại" cho mục nhóm A của BR-22; null khi người xem không phải chủ trại
// trên farm có chuyên gia
export function useExpertReviewNote(farmId: string): string | null {
  const role = useAuthStore(state => state.user?.role)
  const hasExpert = useFarmHasExpert(farmId)
  return getExpertReviewNote(role, hasExpert)
}
