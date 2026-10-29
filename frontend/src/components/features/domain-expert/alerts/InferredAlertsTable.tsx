/**
 * InferredAlertsTable — Bảng danh sách cảnh báo suy luận chuẩn responsive & no-wrap
 * SRS v2.1.4: EXPERT-FR-003
 */
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import {
  ALERT_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_BADGE_CLASS,
} from '@/hooks/domain-expert/useExpertAlerts'

const HEADERS = ['MỨC ĐỘ', 'THỜI GIAN', 'LOẠI CẢNH BÁO', 'GIÁ TRỊ ĐO / NGƯỠNG', 'LẶP LẠI', 'VẬN HÀNH', 'PHÁN QUYẾT', 'THAO TÁC']

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 2) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (Math.floor(diffMin / 60) < 24) return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} — Hôm nay`
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} — ${date.getDate()}/${date.getMonth() + 1}`
}

function StatusDot({ alert }: { alert: InferredAlertItem }) {
  if (alert.expert_verdict?.result === 'CONFIRMED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Đã xác nhận</span>
  if (alert.expert_verdict?.result === 'REJECTED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#878380] whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />Đã bác bỏ</span>
  if (alert.status === 'RESOLVED')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#878380] whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-[#B5D32C] shrink-0" />Đã xử lý</span>
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#27231F] whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />Đang mở</span>
}

const BADGE_BASE = 'inline-flex items-center justify-center min-w-[112px] h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap'

function VerdictBadge({ alert }: { alert: InferredAlertItem }) {
  if (alert.expert_verdict?.result === 'CONFIRMED')
    return <span className={cn(BADGE_BASE, 'bg-red-50 text-red-600 border border-red-200')}>Đã xác nhận</span>
  if (alert.expert_verdict?.result === 'REJECTED')
    return <span className={cn(BADGE_BASE, 'bg-neutral-100 text-[#878380] border border-neutral-200')}>Đã bác bỏ</span>
  return <span className={cn(BADGE_BASE, 'bg-amber-50 text-amber-800 border border-amber-200/80')}>Chờ kiểm chứng</span>
}

function MeasuredValueCell({ alert }: { alert: InferredAlertItem }) {
  const m = alert.metadata ?? {}
  if (alert.type === 'NOISE_ANOMALY') {
    const db = m.sound_db as number | undefined
    const thresh = db !== undefined && m.noise_margin !== undefined ? db - (m.noise_margin as number) : 67
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-[#27231F] whitespace-nowrap">{db ?? '—'} dB</b>
        <span className="text-[11px] text-[#878380] whitespace-nowrap">Ngưỡng: {thresh} dB</span>
      </div>
    )
  }
  if (alert.type === 'SENSOR_ANOMALY') {
    const metric = (m.sensor_type as string) || (m.metric as string) || 'Độ ẩm'
    const delta = m.delta as number | undefined
    const mainText = delta !== undefined ? `${metric} nhảy ${delta > 0 ? `+${delta}` : delta}%` : 'Độ ẩm nhảy +12%'
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-[#27231F] whitespace-nowrap">{mainText}</b>
        <span className="text-[11px] text-[#878380] whitespace-nowrap">Ngưỡng: {(m.threshold as number | undefined) ?? 5}%</span>
      </div>
    )
  }
  if (alert.type === 'PUMP_DRY') {
    return <div className="flex flex-col text-xs leading-tight"><b className="text-[#27231F] whitespace-nowrap">Bơm {(m.pump_on_sec as number | undefined) ?? 30}s</b><span className="text-[11px] text-[#878380] whitespace-nowrap">Ngưỡng: 5%</span></div>
  }
  if (alert.type === 'FORECAST_BREACH') {
    return <div className="flex flex-col text-xs leading-tight"><b className="text-[#27231F] whitespace-nowrap">Dự báo 73,6% RH</b><span className="text-[11px] text-[#878380] whitespace-nowrap">Ngưỡng: 75% RH</span></div>
  }
  if (alert.type === 'LOW_RETURN_RATE') {
    return (
      <div className="flex flex-col text-xs leading-tight">
        <b className="text-[#27231F] whitespace-nowrap">Giảm {(m.drop_pct as number | undefined) ?? '—'}%</b>
        <span className="text-[11px] text-[#878380] whitespace-nowrap">Chuẩn: {(m.baseline_rate as number | undefined) ?? 95}%</span>
      </div>
    )
  }
  return <span className="text-xs text-[#878380] whitespace-nowrap">—</span>
}

interface Props {
  alerts: InferredAlertItem[]
  isLoading: boolean
  onOpenDrawer: (alert: InferredAlertItem) => void
  page: number
  pageSize?: number
  filteredTotal: number
  totalPages: number
  onPageChange: (p: number) => void
  isFetching: boolean
}

export default function InferredAlertsTable({
  alerts, isLoading, onOpenDrawer, page, filteredTotal, totalPages, onPageChange, isFetching,
}: Props) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[#878380] bg-neutral-50/80 border-b border-neutral-100">
              {HEADERS.map(h => (
                <th key={h} className={cn('font-bold px-4 py-3 first:px-6 whitespace-nowrap',
                  (h === 'LẶP LẠI' || h === 'PHÁN QUYẾT' || h === 'THAO TÁC') ? 'text-center' : 'text-left')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-4 py-4"><div className="h-4 bg-neutral-100 rounded w-full" /></td>)}</tr>
                ))
              : alerts.length === 0
              ? <tr><td colSpan={8} className="text-center py-12 text-sm text-[#878380]">Không có cảnh báo nào phù hợp bộ lọc.</td></tr>
              : alerts.map(alert => {
                  const isPending = !alert.expert_verdict
                  return (
                    <tr key={alert._id} className="hover:bg-neutral-50/80 transition-colors duration-100">
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', SEVERITY_BADGE_CLASS[alert.severity] ?? 'bg-neutral-100 text-neutral-600')}>
                          {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#27231F] font-medium whitespace-nowrap">{formatRelativeTime(alert.created_at)}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-[#27231F] whitespace-nowrap">{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><MeasuredValueCell alert={alert} /></td>
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-[#27231F] whitespace-nowrap">{alert.occurrence_count ?? 1} lần</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusDot alert={alert} /></td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap"><VerdictBadge alert={alert} /></td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap shrink-0">
                        {isPending ? (
                          <button id={`btn-verdict-${alert._id}`} type="button" onClick={() => onOpenDrawer(alert)}
                            className="inline-flex items-center justify-center min-w-[104px] h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap bg-[#ECFFA9] text-[#27231F] border border-[#B5D32C] hover:bg-[#B5D32C] hover:text-white transition-all duration-150 shadow-sm active:scale-95">
                            Kiểm chứng
                          </button>
                        ) : (
                          <button id={`btn-detail-${alert._id}`} type="button" onClick={() => onOpenDrawer(alert)}
                            className="inline-flex items-center justify-center min-w-[104px] h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap bg-white text-[#27231F] border border-neutral-200 hover:border-neutral-400 transition-all duration-150 active:scale-95">
                            Chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-100">
        <span className="text-xs text-[#878380]">
          {isFetching ? 'Đang tải...' : `Hiển thị ${Math.min((page - 1) * 5 + 1, filteredTotal)}-${Math.min(page * 5, filteredTotal)} trong ${filteredTotal} cảnh báo`}
        </span>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 3) }).map((_, i) => (
            <button key={i} type="button" onClick={() => onPageChange(i + 1)}
              className={cn('w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150',
                page === i + 1 ? 'bg-[#27231F] text-white shadow-sm' : 'text-[#878380] hover:bg-neutral-100')}>
              {i + 1}
            </button>
          ))}
          {totalPages > 3 && <span className="text-[#878380] text-xs px-1">...</span>}
        </div>
      </div>
    </>
  )
}
