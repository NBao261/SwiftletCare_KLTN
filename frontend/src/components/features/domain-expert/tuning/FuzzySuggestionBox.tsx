import { Sparkles, Info } from 'lucide-react'
import { Button } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { t } from '@/i18n'
import type { FuzzySuggestionResponse, ExpertFuzzyTuning } from '@/types/expert.types'

// Nút của gợi ý theo quyền: áp ngay (chuyên gia, Farm Owner ở farm chưa có chuyên gia) hoặc gửi chuyên gia duyệt (EXPERT-FR-011)
export interface SuggestionAction {
  label: string
  loading: boolean
  onClick: () => void
}

interface Props {
  suggestion: FuzzySuggestionResponse | undefined
  isLoading: boolean
  action?: SuggestionAction
  onDismiss: () => void
  dismissed: boolean
}

type NumericKey = Exclude<keyof ExpertFuzzyTuning, 'fuzzy_input_filter'>

const CHIPS: Array<{ key: NumericKey; label: string; unit: string }> = [
  { key: 'fuzzy_humidity_band', label: 'Dải biên độ ẩm', unit: '%RH' },
  { key: 'fuzzy_temp_band', label: 'Dải biên nhiệt độ', unit: '°C' },
  { key: 'fuzzy_fan_dry_level', label: 'Mức quạt khử ẩm', unit: '%' },
  { key: 'fuzzy_window_sec', label: 'Chu kỳ điều khiển', unit: 'giây' },
]

function SuggestionChip({ current, next, unit, label }: { current?: number; next?: number; unit: string; label: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-[#B5D32C]/40 flex flex-col gap-1 min-w-[120px]">
      <p className="text-[11px] text-[#878380] leading-tight">{label}</p>
      <p className="text-base font-bold text-[#27231F] leading-tight">
        {current ?? NO_VALUE} → <span className="text-[#4A5C00]">{next ?? NO_VALUE}</span>
        <span className="text-xs font-normal text-[#878380] ml-1">{unit}</span>
      </p>
    </div>
  )
}

// Gợi ý hệ số mờ từ hồi quy trên dữ liệu đã ghi (ANALYTICS-FR-010): chỉ có khi đủ 3 ngày dữ liệu và R² ≥ 0,3
export default function FuzzySuggestionBox({ suggestion, isLoading, action, onDismiss, dismissed }: Props) {
  if (dismissed) return null

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#B5D32C]/30 bg-[#ECFFA9]/60 p-5 animate-pulse">
        <div className="h-4 bg-[#B5D32C]/30 rounded w-1/3 mb-3" />
        <div className="h-3 bg-[#B5D32C]/20 rounded w-2/3 mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white/60 rounded-xl h-16" />
          ))}
        </div>
      </div>
    )
  }

  const model = suggestion?.model
  const suggested = suggestion?.suggestion
  const predicted = suggestion?.predicted
  const current = suggestion?.current

  if (!model || !suggested) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F6F2] border border-stone-200/80 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#ECFFA9] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#27231F]" />
          </div>
          <span className="text-stone-700">
            {t('Hệ thống gợi ý hệ số mờ khi có đủ 3 ngày dữ liệu và R² ≥ 0,3.')}
          </span>
        </div>
        <span className="bg-white text-stone-600 border border-stone-200/80 text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap self-start sm:self-center shrink-0">
          {t('Đang tích lũy dữ liệu')}
        </span>
      </div>
    )
  }

  const inRangeDelta = predicted ? (predicted.inRangeSuggested - predicted.inRangeNow).toFixed(1) : null
  const mistingDelta = predicted ? predicted.mistingSuggested - predicted.mistingNow : null
  const mistingSign = mistingDelta !== null && mistingDelta > 0 ? '+' : ''

  return (
    <div className="rounded-2xl border border-[#B5D32C]/40 bg-[#ECFFA9] p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#4A5C00]" />
          <h3 className="text-sm font-bold text-[#27231F]">{t('Gợi ý hệ số điều khiển mờ từ dữ liệu')}</h3>
        </div>
        <p className="text-xs text-[#878380]">
          {t('Hồi quy trên {{days}} ngày qua ({{samples}} mẫu đo) • R² = {{r2}}', {
            days: model.days,
            samples: model.samples.toLocaleString(),
            r2: model.r2.toFixed(2),
          })}
        </p>
      </div>

      {predicted && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[#4A5C00]">{t('Thời gian trong ngưỡng:')}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-bold text-[#27231F] border border-[#B5D32C]">
            {predicted.inRangeNow}% → <span className="text-[#4A5C00]">{predicted.inRangeSuggested}%</span>
            {inRangeDelta && <span className="text-[#B5D32C] font-bold ml-0.5">(+{inRangeDelta}%)</span>}
          </span>
          <span className="text-xs font-medium text-[#4A5C00] ml-1">{t('Công suất phun sương trung bình:')}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-bold text-[#27231F] border border-[#B5D32C]">
            {predicted.mistingNow}% → <span className="text-[#4A5C00]">{predicted.mistingSuggested}%</span>
            {mistingDelta !== null && <span className="text-[#4A5C00] font-bold ml-0.5">({mistingSign}{mistingDelta}%)</span>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CHIPS.map(chip => (
          <SuggestionChip key={chip.key} label={t(chip.label)} unit={t(chip.unit)} current={current?.[chip.key]} next={suggested[chip.key]} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[#878380] italic flex items-center gap-1">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {t('Gợi ý không tự áp dụng; hệ số chỉ đổi khi người có quyền áp dụng.')}
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onDismiss} className="text-xs text-[#878380] hover:text-[#27231F] transition-colors font-medium">
            {t('Bỏ qua')}
          </button>
          {action && (
            <Button size="sm" loading={action.loading} onClick={action.onClick}>
              <Sparkles className="w-3.5 h-3.5" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
