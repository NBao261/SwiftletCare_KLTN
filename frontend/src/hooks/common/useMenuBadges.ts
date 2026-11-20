import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { usePendingAlertTotal } from '@/hooks/shared/useAlerts'
import { useFarms } from '@/hooks/shared/useFarms'
import { useExpertPendingAlerts } from '@/hooks/domain-expert/useExpertDashboard'
import { useAwaitingApproval } from '@/hooks/farm-owner/useWorkOrders'
import { expertService } from '@/services/expert.service'

// Số trên mục menu theo đường dẫn của mục (todo-ui-layout-1120 §3.1): cùng phạm vi với trang mà mục đó mở
export function useMenuBadges(): Record<string, number> {
  const role = useAuthStore(state => state.user?.role)
  const isExpert = role === 'DOMAIN_EXPERT'
  const isOwner = role === 'FARM_OWNER'
  const pendingAlertCount = usePendingAlertTotal() ?? 0
  const { data: expertAlerts } = useExpertPendingAlerts(undefined, undefined, isExpert)
  const { data: awaitingApproval } = useAwaitingApproval('', isOwner)
  const { data: farms } = useFarms()

  // BR-22: trang trại chưa có chuyên gia thì chủ nhà yến kết luận thay, đếm cảnh báo chờ kết luận của các trang trại đó
  const farmsWithoutExpert = useMemo(
    () => (isOwner ? (farms ?? []).filter(farm => farm.has_active_expert === false).map(farm => farm._id) : []),
    [isOwner, farms],
  )
  const ownerVerdictCount = useQueries({
    queries: farmsWithoutExpert.map(farmId => ({
      queryKey: ['expert', 'pending-alerts', farmId, undefined],
      queryFn: () => expertService.getInferredAlerts({ farmId, verdict: 'pending', limit: 1 }),
      staleTime: 60_000,
      refetchInterval: 120_000,
    })),
    combine: results => results.reduce((sum, result) => sum + (result.data?.total ?? 0), 0),
  })

  return {
    '/alerts': pendingAlertCount,
    '/work-orders': awaitingApproval?.total ?? 0,
    '/domain-expert/alert-verdicts': isExpert ? (expertAlerts?.total ?? 0) : ownerVerdictCount,
  }
}
