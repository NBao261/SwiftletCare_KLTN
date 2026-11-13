import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { RecommendationRule } from '@/types/expert.types'

const METRIC_LABEL: Record<RecommendationRule['metric'], string> = {
  return_rate:             'Tỷ lệ về',
  health_status_good_rate: 'Tỷ lệ ngày GOOD',
  humidity_in_range:       'Độ ẩm trong ngưỡng',
  temp_in_range:           'Nhiệt độ trong ngưỡng',
}

const ACTION_LABEL: Record<RecommendationRule['action_type'], string> = {
  WORK_ORDER:   'Tạo Work Order',
  PARAM_CHANGE: 'Đổi tham số',
}

interface Props {
  rule: RecommendationRule
  onToggle: () => void
  onRemove: () => void
  disabled?: boolean
}

export default function RecommendationRuleRow({ rule, onToggle, onRemove, disabled }: Props) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border px-3.5 py-3 bg-white transition-colors',
      rule.active ? 'border-neutral-200' : 'border-neutral-100 opacity-60',
    )}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="mt-0.5 shrink-0 text-neutral-400 hover:text-[#27231F] disabled:opacity-50"
        title={rule.active ? 'Tắt luật' : 'Bật luật'}
      >
        {rule.active
          ? <ToggleRight className="w-5 h-5 text-green-600" />
          : <ToggleLeft className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-[#27231F] leading-snug">{rule.name}</p>
        <p className="text-[11px] text-[#878380]">
          {METRIC_LABEL[rule.metric]} · cửa sổ {rule.window_days} ngày · ngưỡng {rule.threshold}
        </p>
        <span className="inline-block text-[10.5px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
          {ACTION_LABEL[rule.action_type]}
          {rule.work_order_type && ` — ${rule.work_order_type}`}
          {rule.param_key && ` — ${rule.param_key}`}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="shrink-0 mt-0.5 text-neutral-300 hover:text-red-500 disabled:opacity-50 transition-colors"
        title="Xoá luật"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
