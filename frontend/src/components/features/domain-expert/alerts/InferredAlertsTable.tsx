// Bảng cảnh báo suy luận: mỗi cảnh báo một dòng, bấm cả dòng để mở ngăn kéo kiểm chứng
import { useMemo } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { NO_VALUE } from '@/constants/display'
import type { InferredAlertItem } from '@/types/expert.types'
import { ALERT_TYPE_LABELS } from '@/hooks/domain-expert/useExpertAlerts'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import SeverityBadge from '@/components/common/SeverityBadge'
import TableEmptyState from '@/components/common/TableEmptyState'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import type { DataTableColumn } from '@/components/ui/DataTable'
import { t } from '@/i18n'

const ROW_HEIGHT = 72

// Giờ:phút · hôm nay, hoặc giờ:phút · ngày/tháng; dưới 1 giờ ghi "n phút trước"
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 2) return t('Vừa xong')
  if (diffMin < 60) return t('{{n}} phút trước', { n: diffMin })
  const clock = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  if (Math.floor(diffMin / 60) < 24) return `${clock} · ${t('Hôm nay')}`
  return `${clock} · ${date.getDate()}/${date.getMonth() + 1}`
}

// Kết luận của chuyên gia: chờ, xác nhận là sự cố thật, hoặc bác bỏ là báo động giả
function verdictOf(alert: InferredAlertItem): { label: string; tone: BadgeTone } {
  if (alert.expert_verdict?.result === 'CONFIRMED') return { label: 'Đã xác nhận', tone: 'critical' }
  if (alert.expert_verdict?.result === 'REJECTED') return { label: 'Đã bác bỏ', tone: 'neutral' }
  return { label: 'Chờ kiểm chứng', tone: 'warning' }
}

// Tình trạng xử lý ngoài hiện trường, ghi nhỏ dưới kết luận; cảnh báo đã bác bỏ thì không có (kết luận đã nói rõ)
function operationLabel(alert: InferredAlertItem): string {
  if (alert.status === 'RESOLVED') return 'Đã xử lý'
  if (alert.status === 'ACKNOWLEDGED') return 'Chủ nhà đã nhận'
  if (alert.status === 'DISMISSED') return ''
  return 'Chưa xử lý'
}

interface Props {
  alerts: InferredAlertItem[]
  isLoading: boolean
  onOpenDrawer: (alert: InferredAlertItem) => void
  page: number
  pageSize: number
  filteredTotal: number
  onPageChange: (page: number) => void
}

export default function InferredAlertsTable({ alerts, isLoading, onOpenDrawer, page, pageSize, filteredTotal, onPageChange }: Props) {
  // Người không được kết luận (chủ nhà yến ở farm đã có chuyên gia) chỉ "Xem", không "Kiểm chứng"
  const { canDecide } = useExpertDecisionRights()

  const columns = useMemo<DataTableColumn<InferredAlertItem>[]>(() => [
    { key: 'severity', header: t('Mức độ'), className: 'w-[11%]', render: alert => <SeverityBadge severity={alert.severity} /> },
    // Loại cảnh báo ở dòng trên, bằng chứng phát hiện (câu backend ghi kèm số đo) ở dòng dưới
    {
      key: 'alert', header: t('Cảnh báo'), className: 'w-[38%]',
      render: alert => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-charcoal">{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</span>
          <span title={alert.message} className="truncate text-xs text-warmGray">{alert.message || NO_VALUE}</span>
        </div>
      ),
    },
    // Lặp lại nhiều lần thì ghi ngay dưới giờ phát
    {
      key: 'time', header: t('Thời gian'), className: 'w-[15%] whitespace-nowrap',
      render: alert => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-charcoal">{formatRelativeTime(alert.created_at)}</span>
          {(alert.occurrence_count ?? 1) > 1 && <span className="text-xs text-warmGray">{t('{{n}} lần', { n: alert.occurrence_count })}</span>}
        </div>
      ),
    },
    {
      key: 'verdict', header: t('Kết luận'), className: 'w-[20%]',
      render: alert => {
        const verdict = verdictOf(alert)
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={verdict.tone}>{t(verdict.label)}</Badge>
            {operationLabel(alert) && <span className="text-xs text-warmGray">{t(operationLabel(alert))}</span>}
          </div>
        )
      },
    },
    // Việc chính ngay trên dòng với cảnh báo chưa có kết luận; đã kết luận thì chỉ mũi tên, bấm dòng để xem lại
    {
      key: 'actions', header: '', align: 'right', className: 'w-[16%] whitespace-nowrap',
      render: alert => (!alert.expert_verdict
        ? (
          <div className="flex justify-end" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <Button id={`btn-verdict-${alert._id}`} size="sm" variant={canDecide ? 'primary' : 'secondary'} onClick={() => onOpenDrawer(alert)}>
              {t(canDecide ? 'Kiểm chứng' : 'Xem')}
            </Button>
          </div>
        )
        : <CaretRightIcon size={16} weight="bold" aria-hidden className="ml-auto text-warmGray" />),
    },
  ], [onOpenDrawer, canDecide])

  if (isLoading) return <LoadingSkeleton count={4} className="h-14 w-full" />

  return (
    <FixedRowsTable
      columns={columns}
      rows={alerts}
      getRowKey={alert => alert._id}
      onRowClick={onOpenDrawer}
      rowHeight={ROW_HEIGHT}
      pageSize={pageSize}
      emptyNotice={t('Không có cảnh báo nào phù hợp bộ lọc.')}
      emptyContent={<TableEmptyState title={t('Không có cảnh báo nào phù hợp bộ lọc.')} />}
      serverPagination={{ page, total: filteredTotal, onChange: onPageChange }}
      mobileCard={alert => {
        const verdict = verdictOf(alert)
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-body font-semibold text-charcoal">{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</p>
              <SeverityBadge severity={alert.severity} />
            </div>
            <p className="text-small text-warmGray">{alert.message || NO_VALUE}</p>
            <p className="text-small text-warmGray">{[formatRelativeTime(alert.created_at), operationLabel(alert) && t(operationLabel(alert))].filter(Boolean).join(' · ')}</p>
            <div><Badge tone={verdict.tone}>{t(verdict.label)}</Badge></div>
          </div>
        )
      }}
    />
  )
}
