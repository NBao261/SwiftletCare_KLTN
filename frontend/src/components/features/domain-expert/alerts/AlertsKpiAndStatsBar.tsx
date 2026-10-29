/**
 * AlertsKpiAndStatsBar — Interactive KPI filter cards + Clean Single-row Header + Verdict stats
 * SRS v2.1.4: EXPERT-FR-003
 */
import { Info, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import SelectMenu from '@/components/ui/SelectMenu'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import type { InferredAlertType } from '@/types/expert.types'
import type { AlertSeverity } from '@/types'
import type { AlertTabFilter } from '@/hooks/domain-expert/useExpertAlerts'

interface KpiCounts { total: number; pending: number; confirmed: number; rejected: number }

interface KpiCardProps {
  label: string; sublabel: string; value: string | number; accent: string
  dotColor: string; badgeBg?: string; isActive: boolean; onClick: () => void
}

function KpiCard({ label, sublabel, value, accent, dotColor, badgeBg, isActive, onClick }: KpiCardProps) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        'rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 text-left w-full transition-all duration-200 cursor-pointer shadow-sm',
        isActive ? 'border-[#27231F] ring-1 ring-[#27231F] bg-white' : 'border border-stone-200/80 bg-white/90 hover:bg-white hover:border-stone-300',
      )}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <span className="text-xs font-medium text-[#878380] leading-tight">{label}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', badgeBg ?? 'bg-neutral-100')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', dotColor)} />
        </span>
      </div>
      <div>
        <div className={cn('text-3xl font-extrabold leading-none tabular-nums', accent)}>{value}</div>
        <p className="mt-1.5 text-[11px] text-[#878380] leading-tight">{sublabel}</p>
      </div>
    </button>
  )
}

interface Props {
  counts: KpiCounts; isLoading: boolean; activeTab: AlertTabFilter
  activeType: InferredAlertType | 'ALL'; activeSeverity: AlertSeverity | 'ALL'
  statsSummary: string; onTabChange: (t: AlertTabFilter) => void
  onTypeChange: (t: InferredAlertType | 'ALL') => void
  onSeverityChange: (s: AlertSeverity | 'ALL') => void; onNavigateTuning: () => void
}

const TYPE_OPTS: Array<{ value: InferredAlertType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Loại cảnh báo' }, { value: 'NOISE_ANOMALY', label: 'Ồn bất thường' },
  { value: 'SENSOR_ANOMALY', label: 'Cảm biến bất thường' }, { value: 'FORECAST_BREACH', label: 'Dự báo vượt ngưỡng' },
  { value: 'LOW_RETURN_RATE', label: 'Giảm tỉ lệ chim về' }, { value: 'PUMP_DRY', label: 'Bơm khô bất thường' },
]

const SEV_OPTS: Array<{ value: AlertSeverity | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Mức độ' }, { value: 'CRITICAL', label: 'Khẩn cấp' },
  { value: 'HIGH', label: 'Cao' }, { value: 'MEDIUM', label: 'Trung bình' }, { value: 'LOW', label: 'Thường' },
]

const TAB_INFO: Record<AlertTabFilter, { label: string; countKey: keyof KpiCounts }> = {
  ALL: { label: 'Tất cả', countKey: 'total' },
  PENDING: { label: 'Chờ kiểm chứng', countKey: 'pending' },
  CONFIRMED: { label: 'Đã xác nhận', countKey: 'confirmed' },
  REJECTED: { label: 'Đã bác bỏ', countKey: 'rejected' },
}

export default function AlertsKpiAndStatsBar({
  counts, isLoading, activeTab, activeType, activeSeverity, statsSummary,
  onTabChange, onTypeChange, onSeverityChange, onNavigateTuning,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 animate-pulse">
            <div className="h-3 bg-neutral-100 rounded w-2/3 mb-3" /><div className="h-8 bg-neutral-100 rounded w-1/3 mb-2" /><div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  const hasEvaluated = Boolean(statsSummary)
  const isFiltered = activeType !== 'ALL' || activeSeverity !== 'ALL' || activeTab !== 'ALL'
  const currentTab = TAB_INFO[activeTab]

  return (
    <div className="space-y-4">
      {/* 4 Interactive KPI Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tổng cảnh báo suy luận" sublabel="30 ngày qua" value={String(counts.total).padStart(2, '0')}
          accent="text-[#27231F]" dotColor="bg-[#B5D32C]" badgeBg="bg-[#B5D32C]/15"
          isActive={activeTab === 'ALL'} onClick={() => onTabChange('ALL')} />
        <KpiCard label="Chờ kiểm chứng" sublabel="Cần chuyên gia thẩm định" value={String(counts.pending).padStart(2, '0')}
          accent="text-orange-500" dotColor="bg-orange-500" badgeBg="bg-orange-500/15"
          isActive={activeTab === 'PENDING'} onClick={() => onTabChange('PENDING')} />
        <KpiCard label="Đã xác nhận (Sự cố thật)" sublabel="Hệ thống suy luận chính xác" value={String(counts.confirmed).padStart(2, '0')}
          accent="text-[#27231F]" dotColor="bg-emerald-500" badgeBg="bg-emerald-50"
          isActive={activeTab === 'CONFIRMED'} onClick={() => onTabChange('CONFIRMED')} />
        <KpiCard label="Đã bác bỏ (Báo động giả)" sublabel="Nhiễu hoặc dao động tự nhiên" value={String(counts.rejected).padStart(2, '0')}
          accent="text-[#878380]" dotColor="bg-neutral-400" badgeBg="bg-neutral-100"
          isActive={activeTab === 'REJECTED'} onClick={() => onTabChange('REJECTED')} />
      </div>

      {/* Bảng danh sách header: 1 HÀNG DUY NHẤT */}
      <div className="bg-white rounded-t-2xl border border-neutral-100 border-b-0 px-6 pt-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#27231F] shrink-0">Danh sách cảnh báo</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-[#27231F] border border-stone-200/80">
              {currentTab.label} • {counts[currentTab.countKey]}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isFiltered && (
              <button
                type="button"
                onClick={() => { onTypeChange('ALL'); onSeverityChange('ALL'); onTabChange('ALL') }}
                className="text-xs text-[#878380] hover:text-[#27231F] underline font-medium px-1 transition-colors"
              >
                Xóa lọc
              </button>
            )}
            <SelectMenu
              value={activeType} options={TYPE_OPTS}
              onChange={val => onTypeChange(val as InferredAlertType | 'ALL')} ariaLabel="Lọc theo loại cảnh báo"
            />
            <SelectMenu
              value={activeSeverity} options={SEV_OPTS}
              onChange={val => onSeverityChange(val as AlertSeverity | 'ALL')} ariaLabel="Lọc theo mức độ cảnh báo"
            />
          </div>
        </div>

        {/* Thanh phụ mảnh: Thông tin phán quyết gọn gàng */}
        <div className="flex items-center justify-between gap-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-[#878380]">
            {hasEvaluated ? (
              <>
                <Info className="w-3.5 h-3.5 text-[#B5D32C] shrink-0" />
                <p className="truncate text-[11.5px]">
                  <span className="font-semibold text-[#27231F]">Tỷ lệ xác nhận sự cố thật:</span> {statsSummary}
                </p>
              </>
            ) : (
              <span className="text-[11.5px] text-[#878380] flex items-center gap-1.5">
                Chưa có lịch sử phán quyết trong kỳ
                <MockDataTooltip reason="Tỷ lệ xác nhận sự cố thật theo từng loại cảnh báo sẽ tự động tổng hợp sau khi Chuyên gia thẩm định." />
              </span>
            )}
          </div>
          <button
            type="button" onClick={onNavigateTuning}
            className="inline-flex items-center gap-1 text-xs text-[#B5D32C] hover:text-[#4A5C00] font-semibold whitespace-nowrap transition-colors shrink-0"
          >
            Chỉnh tham số phát hiện
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
