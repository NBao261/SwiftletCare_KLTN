// DE-02: Trang chủ Chuyên gia — 4 KpiTile + danh sách việc phẳng (todo-ui-layout-1120 §6)
import { Link } from 'react-router-dom'
import { CalendarCheckIcon, ChecksIcon, FileTextIcon, ShieldCheckIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { ALERT_TYPE_LABELS } from '@/hooks/domain-expert/useExpertAlerts'
import SeverityBadge from '@/components/common/SeverityBadge'
import KpiTile from '@/components/common/KpiTile'
import { useHealthReportConclusionCounts } from '@/hooks/shared/useHealthDays'
import { useHealthDisagreements } from '@/hooks/domain-expert/useHealthDisagreements'
import { shiftDate, vietnamDate } from '@/components/common/healthDay.utils'
import { useParameterReviews, useCoefficientProposals } from '@/hooks/domain-expert/useExpertReviews'
import { useZoneStore } from '@/stores/zoneStore'
import { useExpertQueueAlerts } from '@/hooks/domain-expert/useExpertDashboard'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/i18n'

function formatAlertTitle(alert?: { title?: string; type?: string }, defaultZoneName?: string | null): string {
  if (!alert) return t('Cảnh báo vi khí hậu')
  let title = alert.title || ALERT_TYPE_LABELS[alert.type ?? ''] || alert.type || t('Cảnh báo vi khí hậu')
  if (title.includes('undefined')) {
    const typeLabel = ALERT_TYPE_LABELS[alert.type ?? ''] || t('Cảnh báo thiết bị')
    title = defaultZoneName ? t('{{type}} tại {{zone}}', { type: typeLabel, zone: defaultZoneName }) : typeLabel
  }
  return title
    .replace('NOISE_ANOMALY', ALERT_TYPE_LABELS.NOISE_ANOMALY)
    .replace('SENSOR_ANOMALY', ALERT_TYPE_LABELS.SENSOR_ANOMALY)
    .replace('FORECAST_BREACH', ALERT_TYPE_LABELS.FORECAST_BREACH)
    .replace('LOW_RETURN_RATE', ALERT_TYPE_LABELS.LOW_RETURN_RATE)
}

export default function DomainExpertQueuePage() {
  const { selectedFarmId, selectedHouseId, selectedZoneId, selectedZoneName } = useZoneStore()

  const { data: pendingAlerts, isLoading: isLoadingAlerts } = useExpertQueueAlerts(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  )

  const { pending: pendingReports, isLoading: isLoadingReports } = useHealthReportConclusionCounts(
    selectedFarmId ?? '',
    selectedHouseId ?? '',
  )

  const { total: pendingReviewsCount, isLoading: isLoadingReviews } = useParameterReviews({
    farmId: selectedFarmId ?? '',
    zoneId: selectedZoneId ?? undefined,
    status: 'PENDING_REVIEW',
  })
  const { total: pendingProposalsCount, isLoading: isLoadingProposals } = useCoefficientProposals({
    farmId: selectedFarmId ?? '',
    zoneId: selectedZoneId ?? undefined,
    status: 'PROPOSED',
  })
  const totalPendingReviews = pendingReviewsCount + pendingProposalsCount

  const to = vietnamDate()
  const from = shiftDate(to, -13)
  const { totalDays: disagreeingDaysCount, isLoading: isLoadingDisagreements } = useHealthDisagreements({
    farmId: selectedFarmId ?? undefined,
    from,
    to,
  })

  const pendingCount = pendingAlerts?.total ?? 0
  // Chờ đủ 5 nguồn: ba nguồn dưới trả 0 khi chưa tải xong, thiếu một nguồn là trang hiện "không có việc" rồi mới đổi
  const isLoading = isLoadingAlerts || isLoadingReports || isLoadingReviews || isLoadingProposals || isLoadingDisagreements

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
        </div>
        <LoadingSkeleton count={3} className="h-14 w-full rounded-2xl" />
      </div>
    )
  }

  const hasAnything = pendingCount > 0 || totalPendingReviews > 0 || disagreeingDaysCount > 0 || pendingReports > 0
  const alertRecords = pendingAlerts?.records ?? []

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-5">
      {/* Hàng 4 KpiTile — mỗi ô dẫn đến trang chi tiết */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/domain-expert/alert-verdicts" className="block">
          <KpiTile
            icon={ShieldCheckIcon}
            label={t('Cảnh báo chờ kết luận')}
            value={pendingCount}
            sub={t('cảnh báo suy luận')}
            tone={pendingCount > 0 ? 'orange' : 'neutral'}
            className="h-full transition-shadow hover:shadow-sm"
          />
        </Link>
        <Link to="/domain-expert/reviews" className="block">
          <KpiTile
            icon={ChecksIcon}
            label={t('Thay đổi chờ duyệt')}
            value={totalPendingReviews}
            sub={t('ngưỡng & hệ số mờ')}
            tone={totalPendingReviews > 0 ? 'orange' : 'neutral'}
            className="h-full transition-shadow hover:shadow-sm"
          />
        </Link>
        <Link to="/domain-expert/reports" className="block">
          <KpiTile
            icon={CalendarCheckIcon}
            label={t('Ngày lệch')}
            value={disagreeingDaysCount}
            sub={t('14 ngày gần nhất')}
            tone={disagreeingDaysCount > 0 ? 'orange' : 'neutral'}
            className="h-full transition-shadow hover:shadow-sm"
          />
        </Link>
        <Link to="/domain-expert/reports" className="block">
          <KpiTile
            icon={FileTextIcon}
            label={t('Báo cáo chờ kết luận')}
            value={pendingReports}
            sub={t('báo cáo sức khoẻ')}
            tone={pendingReports > 0 ? 'warning' : 'neutral'}
            className="h-full transition-shadow hover:shadow-sm"
          />
        </Link>
      </div>

      {/* Danh sách việc hoặc trạng thái trống */}
      {hasAnything ? (
        <SectionCard
          icon={<ClipboardTextIcon className="h-5 w-5" />}
          title={t('Cảnh báo chờ kết luận')}
        >
          <div className="divide-y divide-warmGray/10">
            {alertRecords.map(alert => (
              <Link
                key={alert._id}
                to="/domain-expert/alert-verdicts"
                className="flex items-center gap-3 py-3 -mx-4 px-4 hover:bg-stone/30"
              >
                <SeverityBadge severity={alert.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {formatAlertTitle(alert, selectedZoneName)}
                  </p>
                  <p className="text-small text-warmGray">{formatDateTime(alert.created_at)}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-warmGray/20 px-3 py-1 text-small font-medium text-charcoal">
                  {t('Xem')}
                </span>
              </Link>
            ))}
            {pendingCount > alertRecords.length && (
              <div className="py-3 text-center">
                <Link to="/domain-expert/alert-verdicts" className="text-small font-medium text-accent-700 hover:underline">
                  {t('Xem tất cả {{n}} cảnh báo', { n: pendingCount })}
                </Link>
              </div>
            )}
            {alertRecords.length === 0 && pendingCount === 0 && (totalPendingReviews > 0 || disagreeingDaysCount > 0 || pendingReports > 0) && (
              <p className="py-3 text-small text-warmGray">
                {t('Không có cảnh báo chờ kết luận. Xem chi tiết ở các ô trên.')}
              </p>
            )}
          </div>
        </SectionCard>
      ) : (
        <EmptyState
          icon={<ClipboardTextIcon className="h-8 w-8" />}
          title={t('Không có việc gì đang chờ')}
        />
      )}
    </div>
  )
}
