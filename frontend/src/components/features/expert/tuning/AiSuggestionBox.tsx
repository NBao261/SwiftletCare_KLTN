/**
 * AiSuggestionBox — Hộp Gợi ý Thuật toán AI (banner nền #ECFFA9)
 * Hiển thị gợi ý hệ số mờ, nút Áp dụng điền xuống Cột 2
 * SRS v2.1.4: ANALYTICS-FR-010, EXPERT-FR-004
 */
import { Sparkles, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FuzzySuggestionResponse, ExpertFuzzyTuning } from '@/types/expert.types'

interface Props {
  suggestion: FuzzySuggestionResponse | undefined
  isLoading: boolean
  onApply: (values: Partial<ExpertFuzzyTuning>) => void
  onDismiss: () => void
  dismissed: boolean
}

function SuggestionChip({ current, next, unit, label }: {
  current: number; next: number; unit: string; label: string
}) {
  return (
    <div className="bg-white rounded-xl p-3 border border-[#B5D32C]/40 flex flex-col gap-1 min-w-[120px]">
      <p className="text-[11px] text-[#878380] leading-tight">{label}</p>
      <p className="text-base font-bold text-[#27231F] leading-tight">
        {current} → <span className="text-[#4A5C00]">{next}</span>
        <span className="text-xs font-normal text-[#878380] ml-1">{unit}</span>
      </p>
    </div>
  )
}

export default function AiSuggestionBox({ suggestion, isLoading, onApply, onDismiss, dismissed }: Props) {
  if (dismissed) return null

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#B5D32C]/30 bg-[#ECFFA9]/60 p-5 animate-pulse">
        <div className="h-4 bg-[#B5D32C]/30 rounded w-1/3 mb-3" />
        <div className="h-3 bg-[#B5D32C]/20 rounded w-2/3 mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/60 rounded-xl h-16" />
          ))}
        </div>
      </div>
    )
  }

  // Trạng thái chưa đủ điều kiện (< 3 ngày hoặc R² < 0.3)
  const model = suggestion?.model
  const isInsufficient = !model || model.days < 3 || model.r2 < 0.3
  const sugg = suggestion?.suggestion
  const predicted = suggestion?.predicted
  const current = suggestion?.current

  if (isInsufficient) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F6F2] border border-stone-200/80 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#ECFFA9] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#27231F]" />
          </div>
          <span className="text-stone-700">
            Hệ thống tự động sinh gợi ý hệ số mờ khi thu thập đủ <b className="text-[#27231F]">≥ 3 ngày dữ liệu</b> và <b className="text-[#27231F]">R² ≥ 0,3</b>.
          </span>
        </div>
        <span className="bg-white text-stone-600 border border-stone-200/80 text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap self-start sm:self-center shrink-0">
          Đang tích lũy dữ liệu
        </span>
      </div>
    )
  }

  const chips = [
    { label: 'Dải biên độ ẩm', current: current?.fuzzy_humidity_band ?? 8, next: sugg?.fuzzy_humidity_band ?? 6, unit: '%RH' },
    { label: 'Dải biên nhiệt độ', current: current?.fuzzy_temp_band ?? 4, next: sugg?.fuzzy_temp_band ?? 3.5, unit: '°C' },
    { label: 'Mức quạt khử ẩm', current: current?.fuzzy_fan_dry_level ?? 40, next: sugg?.fuzzy_fan_dry_level ?? 35, unit: '%' },
    { label: 'Chu kỳ điều khiển', current: current?.fuzzy_window_sec ?? 120, next: sugg?.fuzzy_window_sec ?? 150, unit: 'giây' },
  ]

  const inRangeDelta = predicted ? (predicted.inRangeSuggested - predicted.inRangeNow).toFixed(1) : null
  const mistingDelta = predicted ? predicted.mistingSuggested - predicted.mistingNow : null

  return (
    <div className="rounded-2xl border border-[#B5D32C]/40 bg-[#ECFFA9] p-5 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#4A5C00]" />
          <h3 className="text-sm font-bold text-[#27231F]">
            Gợi ý thuật toán AI — Tối ưu hệ số điều khiển mờ
          </h3>
        </div>
        <p className="text-xs text-[#878380]">
          Phân tích hồi quy {model.days} ngày qua ({model.samples.toLocaleString()} mẫu đo) •{' '}
          Độ tin cậy R² = {model.r2.toFixed(2)}
        </p>
      </div>

      {/* Badges cải thiện */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-[#4A5C00]">Thời gian đạt chuẩn vi khí hậu:</span>
        {predicted && (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-bold text-[#27231F] border border-[#B5D32C]">
              {predicted.inRangeNow}% → <span className="text-[#4A5C00]">{predicted.inRangeSuggested}%</span>
              {inRangeDelta && <span className="text-[#B5D32C] font-bold ml-0.5">(+{inRangeDelta}%)</span>}
            </span>
            <span className="text-xs font-medium text-[#4A5C00] ml-1">• Công suất phun sương TB:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-bold text-[#27231F] border border-[#B5D32C]">
              {predicted.mistingNow}% → <span className="text-[#4A5C00]">{predicted.mistingSuggested}%</span>
              {mistingDelta !== null && <span className="text-[#4A5C00] font-bold ml-0.5">({mistingDelta > 0 ? '+' : ''}{mistingDelta}%)</span>}
            </span>
          </>
        )}
      </div>

      {/* 4 suggestion chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {chips.map(chip => (
          <SuggestionChip key={chip.label} {...chip} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#878380] italic flex items-center gap-1">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Hệ thống chỉ sinh gợi ý khi thu thập đủ 3 ngày và hệ số R² ≥ 0,3
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onDismiss}
            className="text-xs text-[#878380] hover:text-[#27231F] transition-colors font-medium">
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={() => sugg && onApply(sugg)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150',
              'bg-[#27231F] text-[#ECFFA9] hover:bg-[#3D3630] shadow-md hover:shadow-lg',
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Áp dụng đề xuất
          </button>
        </div>
      </div>
    </div>
  )
}
