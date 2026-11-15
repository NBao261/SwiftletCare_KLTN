import { useCallback, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useInferredAlerts } from '@/hooks/expert/useInferredAlerts'
import { useHealthReports, useSetReportConclusion } from '@/hooks/expert/useExpertReports'
import {
  useExpertProposals,
  useExpertReviewItems,
  useTakeProposalAction,
  useTakeReviewAction,
} from '@/hooks/expert/useExpertReviews'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { onNotificationNew } from '@/services/socket/socketClient'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { CoefficientProposal, HouseHealthReportSummary, InferredAlert, ReviewItem } from '@/types/expert.types'
import { t } from '@/utils/i18n.utils'

// Hàng đợi là việc đang chờ xử lý (bị chặn), số lượng có giới hạn tự nhiên; lấy đủ 1 trang rộng và
// đếm theo meta.total để badge không bị chặn ở 20 (api trả { data, meta: { total } })
const QUEUE_LIMIT = 50

/**
 * Logic nghiệp vụ màn Hàng đợi chuyên gia (EXPERT-FR-003/005/010/011): 4 nhóm việc chờ xử lý.
 * Số đếm KPI/badge lấy từ meta.total (không phải data.length); mọi hành động kèm toast + haptics.
 */
export function useQueueScreen() {
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedHouseId = useExpertScopeStore(state => state.selectedHouseId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)

  const toast = useToastMessage()
  const queryClient = useQueryClient()

  const farmId = selectedFarmId || undefined
  const houseId = selectedHouseId || undefined
  const zoneId = selectedZoneId || undefined

  // Realtime: thông báo mới làm mới cả 4 nhóm việc (EXPERT-FR-007)
  useEffect(() => {
    const unsubscribe = onNotificationNew(() => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'inferred-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'review-items'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'health-reports'] })
    })
    return unsubscribe
  }, [queryClient])

  const alertsQuery = useInferredAlerts({ farm_id: farmId, zone_id: zoneId, verdict: 'pending', limit: QUEUE_LIMIT })
  const reviewsQuery = useExpertReviewItems({ farm_id: farmId, zone_id: zoneId, status: 'PENDING_REVIEW', limit: QUEUE_LIMIT })
  const proposalsQuery = useExpertProposals({ farm_id: farmId, zone_id: zoneId, status: 'PROPOSED', limit: QUEUE_LIMIT })
  const reportsQuery = useHealthReports({ farm_id: farmId, house_id: houseId, has_conclusion: false, limit: QUEUE_LIMIT })

  const takeReviewAction = useTakeReviewAction()
  const takeProposalAction = useTakeProposalAction()
  const setReportConclusion = useSetReportConclusion()

  const alerts = (alertsQuery.data?.data ?? []) as InferredAlert[]
  const reviews = (reviewsQuery.data?.data ?? []) as ReviewItem[]
  const proposals = (proposalsQuery.data?.data ?? []) as CoefficientProposal[]
  const reports = (reportsQuery.data?.data ?? []) as HouseHealthReportSummary[]

  // Đếm theo meta.total (tổng thật ở server), fallback về số đã tải khi thiếu meta
  const counts = {
    alerts: alertsQuery.data?.meta?.total ?? alerts.length,
    reviews: reviewsQuery.data?.meta?.total ?? reviews.length,
    proposals: proposalsQuery.data?.meta?.total ?? proposals.length,
    reports: reportsQuery.data?.meta?.total ?? reports.length,
  }

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string, errorMessage: string) => {
      try {
        await action()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
        toast.show(successMessage)
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
        toast.show(errorMessage)
      }
    },
    [toast]
  )

  const acceptReview = useCallback(
    (itemId: string) =>
      runAction(
        () => takeReviewAction.mutateAsync({ itemId, action: 'ACCEPT' }),
        t('Đã chấp thuận thay đổi tham số của chủ nhà'),
        t('Không thể chấp thuận thay đổi, vui lòng thử lại')
      ),
    [runAction, takeReviewAction]
  )

  const revertReview = useCallback(
    (itemId: string) =>
      runAction(
        () => takeReviewAction.mutateAsync({ itemId, action: 'REVERT' }),
        t('Đã hoàn nguyên tham số về giá trị an toàn'),
        t('Không thể hoàn nguyên tham số, vui lòng thử lại')
      ),
    [runAction, takeReviewAction]
  )

  const approveProposal = useCallback(
    (proposalId: string) =>
      runAction(
        () => takeProposalAction.mutateAsync({ proposalId, action: 'APPROVE' }),
        t('Đã duyệt áp dụng bộ hệ số độ ẩm & gió'),
        t('Không thể duyệt đề xuất, vui lòng thử lại')
      ),
    [runAction, takeProposalAction]
  )

  const rejectProposal = useCallback(
    (proposalId: string, reason: string) =>
      runAction(
        () => takeProposalAction.mutateAsync({ proposalId, action: 'REJECT', rejectionReason: reason }),
        t('Đã từ chối đề xuất và gửi phản hồi'),
        t('Không thể từ chối đề xuất, vui lòng thử lại')
      ),
    [runAction, takeProposalAction]
  )

  const setConclusion = useCallback(
    (reportId: string, text: string) =>
      runAction(
        () => setReportConclusion.mutateAsync({ reportId, text }),
        t('Đã ban hành kết luận chuyên môn cho báo cáo'),
        t('Không thể lưu kết luận báo cáo, vui lòng thử lại')
      ),
    [runAction, setReportConclusion]
  )

  const refreshAll = useCallback(() => {
    void alertsQuery.refetch()
    void reviewsQuery.refetch()
    void proposalsQuery.refetch()
    void reportsQuery.refetch()
  }, [alertsQuery, reviewsQuery, proposalsQuery, reportsQuery])

  return {
    alerts,
    reviews,
    proposals,
    reports,
    counts,
    sections: {
      alerts: { isLoading: alertsQuery.isLoading, isError: alertsQuery.isError, refetch: alertsQuery.refetch },
      reviews: { isLoading: reviewsQuery.isLoading, isError: reviewsQuery.isError, refetch: reviewsQuery.refetch },
      proposals: { isLoading: proposalsQuery.isLoading, isError: proposalsQuery.isError, refetch: proposalsQuery.refetch },
      reports: { isLoading: reportsQuery.isLoading, isError: reportsQuery.isError, refetch: reportsQuery.refetch },
    },
    isRefreshing:
      alertsQuery.isRefetching ||
      reviewsQuery.isRefetching ||
      proposalsQuery.isRefetching ||
      reportsQuery.isRefetching,
    refreshAll,
    acceptReview,
    revertReview,
    approveProposal,
    rejectProposal,
    setConclusion,
    isReviewActing: takeReviewAction.isPending,
    isProposalActing: takeProposalAction.isPending,
    isReportActing: setReportConclusion.isPending,
    toastMessage: toast.message,
  }
}
