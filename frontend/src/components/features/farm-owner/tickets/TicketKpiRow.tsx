import { CheckCircleIcon, HourglassIcon, TicketIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/components/ui'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import KpiTile from '@/components/features/farm-owner/farms/KpiTile'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { supportDict } from '@/constants/support.i18n'
import type { useTicketCounts } from '@/hooks/farm-owner/useTicketCounts'

type Counts = ReturnType<typeof useTicketCounts>

// Hàng KPI ticket: tổng + đã/chưa hoàn tất, chờ tiếp nhận, đang thực hiện, quá hạn — mỗi số có câu nói rõ nó là gì
export default function TicketKpiRow({ counts }: { counts: Counts }) {
  const { t } = useTranslation(supportDict)
  const apiErrorMessage = useApiErrorMessage()

  if (counts.isError) {
    return (
      <FarmFrame title={t('kpi.title')}>
        <EmptyState
          icon={<WarningCircleIcon size={32} />}
          title={t('kpi.errorTitle')}
          description={apiErrorMessage(counts.error)}
          action={<Button variant="secondary" size="sm" onClick={counts.refetch}>{t('common.retry')}</Button>}
        />
      </FarmFrame>
    )
  }

  const working = counts.IN_PROGRESS + counts.AWAITING_FIELD_CONFIRMATION
  const notFinished = counts.all - counts.CLOSED

  // Dòng phụ ô Chờ tiếp nhận: còn ticket chưa có kỹ thuật viên hay đã giao hết
  let waitingSub = t('kpi.waitingNone')
  if (counts.NEW > 0) waitingSub = t('kpi.waitingAssigned')
  if (counts.newUnassigned > 0) waitingSub = t('kpi.waitingUnassigned', { n: counts.newUnassigned })

  return (
    <FarmFrame title={t('kpi.title')}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          icon={TicketIcon}
          label={t('kpi.total')}
          value={counts.all}
          sub={t('kpi.totalSub', { done: counts.CLOSED, open: notFinished })}
        />
        <KpiTile icon={HourglassIcon} label={t('kpi.waiting')} value={counts.NEW} sub={waitingSub} />
        <KpiTile
          icon={CheckCircleIcon}
          label={t('kpi.working')}
          value={working}
          sub={t('kpi.workingSub', { accepted: counts.IN_PROGRESS, processing: counts.AWAITING_FIELD_CONFIRMATION })}
        />
        <KpiTile
          icon={WarningIcon}
          label={t('kpi.breached')}
          value={counts.openBreached}
          tone={counts.openBreached > 0 ? 'orange' : 'neutral'}
          sub={counts.openBreached > 0 ? t('kpi.breachedSub') : t('kpi.breachedNone')}
        />
      </div>
    </FarmFrame>
  )
}
