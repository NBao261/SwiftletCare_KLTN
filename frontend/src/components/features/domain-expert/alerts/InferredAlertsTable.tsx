/**
 * InferredAlertsTable — Bảng danh sách cảnh báo suy luận dùng DataTable và Pagination chuẩn hệ thống
 * SRS v2.1.4: EXPERT-FR-003
 */
import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import {
  ALERT_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_BADGE_CLASS,
} from '@/hooks/domain-expert/useExpertAlerts'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 2) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (Math.floor(diffMin / 60) < 24) return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} — Hôm nay`
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} — ${date.getDate()}/${date.getMonth() + 1}`
}

function StatusDot({ alert }: { alert: InferredAlertItem }) {
  if (alert.status === 'RESOLVED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Đã xử lý</span>
  if (alert.status === 'ACKNOWLEDGED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />Chủ nhà đã nhận</span>
  if (alert.status === 'DISMISSED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warmGray whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-warmGray/50 shrink-0" />Đã bác bỏ</span>
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />Chưa xử lý</span>
}

const BADGE_BASE = 'inline-flex items-center justify-center min-w-[112px] h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap'

function VerdictBadge({ alert }: { alert: InferredAlertItem }) {
  if (alert.expert_verdict?.result === 'CONFIRMED')
    return <span className={cn(BADGE_BASE, 'bg-red-50 text-red-600 border border-red-200')}>Đã xác nhận</span>
  if (alert.expert_verdict?.result === 'REJECTED')
    return <span className={cn(BADGE_BASE, 'bg-neutral-100 text-warmGray border border-neutral-200')}>Đã bác bỏ</span>
  return <span className={cn(BADGE_BASE, 'bg-amber-50 text-amber-800 border border-amber-200/80')}>Chờ kiểm chứng</span>
}

function MeasuredValueCell({ alert }: { alert: InferredAlertItem }) {
  const m = alert.metadata ?? {}
  if (alert.type === 'NOISE_ANOMALY') {
    const db = (m.sound_db as number | undefined) ?? (m.db as number | undefined)
    const thresh = db !== undefined && m.noise_margin !== undefined ? db - (m.noise_margin as number) : 75
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-charcoal whitespace-nowrap">{db !== undefined ? `${db} dB` : 'Tiếng ồn bất thường'}</b>
        <span className="text-[11px] text-warmGray whitespace-nowrap">Ngưỡng: {thresh} dB</span>
      </div>
    )
  }
  if (alert.type === 'SENSOR_ANOMALY') {
    const metric = (m.sensor_type as string) || (m.metric as string) || 'Cảm biến'
    const delta = m.delta as number | undefined
    const thresh = (m.threshold as number | undefined) ?? 5
    const mainText = delta !== undefined ? `${metric} lệch ${delta > 0 ? `+${delta}` : delta}%` : (alert.title || 'Cảm biến bất thường')
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-charcoal whitespace-nowrap">{mainText}</b>
        <span className="text-[11px] text-warmGray whitespace-nowrap">Ngưỡng sai lệch: ±{thresh}%</span>
      </div>
    )
  }
  if (alert.type === 'MISTING_INEFFECTIVE' || (alert.type as string) === 'PUMP_DRY') {
    const current = m.motor_current !== undefined ? `${m.motor_current} A` : undefined
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-charcoal whitespace-nowrap">{current ? `Tải bơm: ${current}` : 'Phun sương không tăng ẩm'}</b>
        <span className="text-[11px] text-warmGray whitespace-nowrap">Định mức: 4.2 A / &lt; 2.5 A</span>
      </div>
    )
  }
  if (alert.type === 'FORECAST_BREACH') {
    const val = m.forecast_value !== undefined ? `${m.forecast_value}% RH` : '73.6% RH'
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-charcoal whitespace-nowrap">Dự báo 60p: {val}</b>
        <span className="text-[11px] text-warmGray whitespace-nowrap">Ngưỡng an toàn: 75% RH</span>
      </div>
    )
  }
  if (alert.type === 'LOW_RETURN_RATE') {
    const drop = (m.drop_pct as number | undefined) ?? (m.drop as number | undefined)
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-charcoal whitespace-nowrap">{drop !== undefined ? `Giảm ${drop}% đàn chim` : 'Tỉ lệ chim về sụt giảm'}</b>
        <span className="text-[11px] text-warmGray whitespace-nowrap">Chuẩn nền: {(m.baseline_rate as number | undefined) ?? 95}%</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col text-xs leading-tight max-w-[160px]">
      <span className="text-charcoal truncate" title={alert.message}>{alert.message || '—'}</span>
    </div>
  )
}

interface Props {
  alerts: InferredAlertItem[]
  isLoading: boolean
  onOpenDrawer: (alert: InferredAlertItem) => void
  page: number
  pageSize?: number
  filteredTotal: number
  totalPages?: number
  onPageChange: (p: number) => void
  isFetching?: boolean
}

export default function InferredAlertsTable({
  alerts,
  isLoading,
  onOpenDrawer,
  page,
  pageSize = 5,
  filteredTotal,
  onPageChange,
}: Props) {
  const columns = useMemo<DataTableColumn<InferredAlertItem>[]>(() => [
    {
      key: 'severity',
      header: 'Mức độ',
      className: 'w-[90px]',
      render: alert => (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap', SEVERITY_BADGE_CLASS[alert.severity] ?? 'bg-neutral-100 text-neutral-600')}>
          {SEVERITY_LABELS[alert.severity] ?? alert.severity}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Thời gian',
      className: 'w-[120px] whitespace-nowrap',
      render: alert => (
        <span className="text-xs text-charcoal font-medium whitespace-nowrap">
          {formatRelativeTime(alert.created_at)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Loại cảnh báo',
      className: 'w-[180px]',
      render: alert => (
        <span className="text-sm font-semibold text-charcoal">
          {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
        </span>
      ),
    },
    {
      key: 'evidence',
      header: 'Bằng chứng phát hiện',
      className: 'min-w-[200px]',
      render: alert => <MeasuredValueCell alert={alert} />,
    },
    {
      key: 'occurrence',
      header: 'Lặp lại',
      align: 'center',
      className: 'w-[85px]',
      render: alert => (
        <span className="text-xs font-semibold text-charcoal whitespace-nowrap">
          {alert.occurrence_count ?? 1} lần
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Vận hành',
      align: 'center',
      className: 'w-[125px]',
      render: alert => <StatusDot alert={alert} />,
    },
    {
      key: 'verdict',
      header: 'Phán quyết',
      align: 'center',
      className: 'w-[135px]',
      render: alert => <VerdictBadge alert={alert} />,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      className: 'w-[115px] whitespace-nowrap',
      render: alert => {
        const isPending = !alert.expert_verdict
        return isPending ? (
          <button
            id={`btn-verdict-${alert._id}`}
            type="button"
            onClick={e => { e.stopPropagation(); onOpenDrawer(alert) }}
            className="inline-flex items-center justify-center min-w-[92px] h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap bg-[#ECFFA9] text-[#27231F] border border-[#B5D32C] hover:bg-[#B5D32C] hover:text-[#27231F] transition-all duration-150 shadow-xs active:scale-95 cursor-pointer"
          >
            Kiểm chứng
          </button>
        ) : (
          <button
            id={`btn-detail-${alert._id}`}
            type="button"
            onClick={e => { e.stopPropagation(); onOpenDrawer(alert) }}
            className="inline-flex items-center justify-center min-w-[92px] h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap bg-white text-[#27231F] border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            Chi tiết
          </button>
        )
      },
    },
  ], [onOpenDrawer])

  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSkeleton count={4} className="h-14 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        rows={alerts}
        getRowKey={alert => alert._id}
        onRowClick={onOpenDrawer}
        emptyMessage="Không có cảnh báo nào phù hợp bộ lọc."
        minTableWidth={960}
      />
      <Pagination
        page={page}
        limit={pageSize}
        total={filteredTotal}
        onChange={onPageChange}
        variant="full"
      />
    </div>
  )
}
