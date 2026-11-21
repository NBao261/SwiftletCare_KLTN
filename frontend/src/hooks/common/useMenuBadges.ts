import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useZoneStore } from '@/stores/zoneStore'
import { usePendingAlertTotal } from '@/hooks/shared/useAlerts'
import { useFarms } from '@/hooks/shared/useFarms'
import { useExpertPendingAlerts } from '@/hooks/domain-expert/useExpertDashboard'
import { useAwaitingApproval } from '@/hooks/farm-owner/useWorkOrders'
import { usePendingDeletionCount } from '@/hooks/admin/useAccountRequests'
import { expertService } from '@/services/expert.service'

// Số trên mục menu theo đường dẫn của mục (§3.1): Công việc và Chuyên môn theo trang trại đang chọn ở khung lọc, Cảnh báo đếm mọi trang trại như trang Cảnh báo
export function useMenuBadges(): Record<string, number> {
  const role = useAuthStore(state => state.user?.role)
  const isExpert = role === 'DOMAIN_EXPERT'
  const isOwner = role === 'FARM_OWNER'
  const isAdmin = role === 'ADMIN'
  const pendingAlertCount = usePendingAlertTotal() ?? 0
  const { data: expertAlerts } = useExpertPendingAlerts(undefined, undefined, isExpert)
  // AUTH-FR-012 — yêu cầu xoá tài khoản chờ Admin xử lý
  const pendingDeletion = usePendingDeletionCount(isAdmin)
  const storedFarmId = useZoneStore(state => state.scopeFarmId)
  const { data: farms } = useFarms()
  // Trang trại đã xoá hoặc mất quyền thì về tất cả trang trại, như useScopeFilter (tránh hỏi lại một trang trại trả 403)
  const scopeFarmId = farms?.find(farm => farm._id === storedFarmId)?._id ?? ''
  const { data: awaitingApproval } = useAwaitingApproval(scopeFarmId, '', isOwner && farms !== undefined)

  // BR-22: trang trại chưa có chuyên gia thì chủ nhà yến kết luận thay, đếm cảnh báo chờ kết luận của các trang trại đó
  const farmsWithoutExpert = useMemo(
    () => (isOwner ? (farms ?? []).filter(farm => farm.has_active_expert === false && (!scopeFarmId || farm._id === scopeFarmId)).map(farm => farm._id) : []),
    [isOwner, farms, scopeFarmId],
  )
  const ownerVerdictCount = useQueries({
    queries: farmsWithoutExpert.map(farmId => ({
      queryKey: ['expert', 'pending-alerts', farmId, undefined],
      queryFn: () => expertService.getInferredAlerts({ farmId, verdict: 'pending', limit: 1 }),
      // Cùng khoá và nhịp với useExpertPendingAlerts: badge làm mới 2 phút một lần, không cần sát từng giây
      staleTime: 60_000,
      refetchInterval: 120_000,
    })),
    combine: results => results.reduce((sum, result) => sum + (result.data?.total ?? 0), 0),
  })

  return {
    '/alerts': pendingAlertCount,
    '/work-orders': awaitingApproval?.total ?? 0,
    '/domain-expert/alert-verdicts': isExpert ? (expertAlerts?.total ?? 0) : ownerVerdictCount,
    '/users': isAdmin ? pendingDeletion : 0,
  }
}
