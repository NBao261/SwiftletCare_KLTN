/**
 * AlertsKpiAndStatsBar — Interactive KPI filter cards
 * SRS v2.1.4: EXPERT-FR-003
 */
import { cn } from '@/lib/cn'
import type { InferredAlertType } from '@/types/expert.types'
import type { AlertSeverity } from '@/types'
import type { AlertTabFilter } from '@/hooks/domain-expert/useExpertAlerts'

export interface KpiCounts {
  total: number
  pending: number
  confirmed: number
  rejected: number
}

interface KpiCardProps {
  label: string
  sublabel: string
  value: string | number
  accent: string
  dotColor: string
  badgeBg?: string
  isActive: boolean
  onClick: () => void
}

function KpiCard({ label, sublabel, value, accent, dotColor, badgeBg, isActive, onClick }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 text-left w-full transition-all duration-200 cursor-pointer shadow-card',
        isActive
          ? 'border-charcoal ring-1 ring-charcoal bg-white'
          : 'border border-warmGray/15 bg-white hover:border-warmGray/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <span className="text-xs font-medium text-warmGray leading-tight">{label}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', badgeBg ?? 'bg-neutral-100')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', dotColor)} />
        </span>
      </div>
      <div>
        <div className={cn('text-3xl font-extrabold leading-none tabular-nums', accent)}>{value}</div>
        <p className="mt-1.5 text-[11px] text-warmGray leading-tight">{sublabel}</p>
      </div>
    </button>
  )
}

export const TYPE_OPTS: Array<{ value: InferredAlertType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Loại cảnh báo' },
  { value: 'NOISE_ANOMALY', label: 'Ồn bất thường' },
  { value: 'SENSOR_ANOMALY', label: 'Cảm biến bất thường' },
  { value: 'FORECAST_BREACH', label: 'Dự báo vượt ngưỡng' },
  { value: 'LOW_RETURN_RATE', label: 'Giảm tỉ lệ chim về' },
  { value: 'MISTING_INEFFECTIVE', label: 'Phun sương kém' },
]

export const SEV_OPTS: Array<{ value: AlertSeverity | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Mức độ' },
  { value: 'CRITICAL', label: 'Khẩn cấp' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'LOW', label: 'Thường' },
]

export const TAB_INFO: Record<AlertTabFilter, { label: string; countKey: keyof KpiCounts }> = {
  ALL: { label: 'Tất cả', countKey: 'total' },
  PENDING: { label: 'Chờ kiểm chứng', countKey: 'pending' },
  CONFIRMED: { label: 'Đã xác nhận', countKey: 'confirmed' },
  REJECTED: { label: 'Đã bác bỏ', countKey: 'rejected' },
}

interface Props {
  counts: KpiCounts
  isLoading: boolean
  activeTab: AlertTabFilter
  onTabChange: (t: AlertTabFilter) => void
}

export default function AlertsKpiAndStatsBar({
  counts,
  isLoading,
  activeTab,
  onTabChange,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-card border border-warmGray/15 animate-pulse">
            <div className="h-3 bg-warmGray/15 rounded w-2/3 mb-3" />
            <div className="h-8 bg-warmGray/15 rounded w-1/3 mb-2" />
            <div className="h-3 bg-warmGray/15 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Tổng cảnh báo suy luận"
        sublabel="30 ngày qua"
        value={String(counts.total).padStart(2, '0')}
        accent="text-charcoal"
        dotColor="bg-[#B5D32C]"
        badgeBg="bg-[#B5D32C]/15"
        isActive={activeTab === 'ALL'}
        onClick={() => onTabChange('ALL')}
      />
      <KpiCard
        label="Chờ kiểm chứng"
        sublabel="Cần chuyên gia thẩm định"
        value={String(counts.pending).padStart(2, '0')}
        accent="text-orange-500"
        dotColor="bg-orange-500"
        badgeBg="bg-orange-500/15"
        isActive={activeTab === 'PENDING'}
        onClick={() => onTabChange('PENDING')}
      />
      <KpiCard
        label="Đã xác nhận (Sự cố thật)"
        sublabel="Hệ thống suy luận chính xác"
        value={String(counts.confirmed).padStart(2, '0')}
        accent="text-charcoal"
        dotColor="bg-emerald-500"
        badgeBg="bg-emerald-50"
        isActive={activeTab === 'CONFIRMED'}
        onClick={() => onTabChange('CONFIRMED')}
      />
      <KpiCard
        label="Đã bác bỏ (Báo động giả)"
        sublabel="Nhiễu hoặc dao động tự nhiên"
        value={String(counts.rejected).padStart(2, '0')}
        accent="text-warmGray"
        dotColor="bg-neutral-400"
        badgeBg="bg-neutral-100"
        isActive={activeTab === 'REJECTED'}
        onClick={() => onTabChange('REJECTED')}
      />
    </div>
  )
}
