import { useAuthStore } from '@/stores/authStore'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarms } from '@/hooks/shared/useFarms'
import { expertDecisionRights, type ExpertDecisionRights } from '@/hooks/domain-expert/expertDecisionRights'

// Theo has_active_expert của GET /farms
export function useExpertDecisionRights(): ExpertDecisionRights {
  const role = useAuthStore(s => s.user?.role)
  const selectedFarmId = useZoneStore(s => s.selectedFarmId)
  const { data: farms } = useFarms()
  return expertDecisionRights(role, farms?.find(farm => farm._id === selectedFarmId))
}
