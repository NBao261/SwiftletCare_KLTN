import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import type { RecommendationRule } from '@/types/expert.types'

const METRIC_OPTIONS: { value: RecommendationRule['metric']; label: string }[] = [
  { value: 'return_rate',             label: 'Tỷ lệ về (%)' },
  { value: 'health_status_good_rate', label: 'Tỷ lệ ngày GOOD (%)' },
  { value: 'humidity_in_range',       label: 'Độ ẩm trong ngưỡng (%)' },
  { value: 'temp_in_range',           label: 'Nhiệt độ trong ngưỡng (%)' },
]

const ACTION_OPTIONS: { value: RecommendationRule['action_type']; label: string }[] = [
  { value: 'WORK_ORDER',   label: 'Tạo Work Order' },
  { value: 'PARAM_CHANGE', label: 'Đổi tham số' },
]

type DraftRule = Omit<Partial<RecommendationRule>, 'metric' | 'action_type'> & {
  metric: RecommendationRule['metric'] | ''
  action_type: RecommendationRule['action_type'] | ''
}

const BLANK: DraftRule = {
  name: '', metric: '', window_days: 7, threshold: undefined, action_type: '',
  work_order_type: '', param_key: '', active: true,
}

interface Props {
  onAdd: (rule: Omit<RecommendationRule, '_id'>) => void
  disabled?: boolean
}

export default function RecommendationRuleAddForm({ onAdd, disabled }: Props) {
  const [draft, setDraft] = useState<DraftRule>(BLANK)
  const [touched, setTouched] = useState(false)

  const errors: Partial<Record<keyof DraftRule, string>> = {}
  if (touched) {
    if (!draft.name?.trim()) errors.name = 'Nhập tên luật'
    if (!draft.metric) errors.metric = 'Chọn chỉ số'
    if (!draft.action_type) errors.action_type = 'Chọn hành động'
    if (draft.window_days == null || draft.window_days < 1 || draft.window_days > 30) errors.window_days = '1–30 ngày'
    if (draft.threshold == null) errors.threshold = 'Nhập ngưỡng'
  }

  const canAdd = !draft.name || !draft.metric || !draft.action_type || draft.threshold == null
    ? false : Object.keys(errors).length === 0

  function handleSubmit() {
    setTouched(true)
    if (!canAdd) return
    onAdd({
      name: draft.name!,
      metric: draft.metric as RecommendationRule['metric'],
      window_days: draft.window_days!,
      threshold: draft.threshold!,
      action_type: draft.action_type as RecommendationRule['action_type'],
      work_order_type: draft.work_order_type || undefined,
      param_key: draft.param_key || undefined,
      active: true,
    })
    setDraft(BLANK)
    setTouched(false)
  }

  const inputCls = (err?: string) => cn(
    'w-full rounded-lg border px-2.5 py-1.5 text-sm text-charcoal bg-white outline-none transition-colors',
    err ? 'border-alertRed focus:ring-1 focus:ring-alertRed/30' : 'border-warmGray/15 focus:border-charcoal focus:ring-1 focus:ring-charcoal/20',
    disabled && 'opacity-50 cursor-not-allowed',
  )

  return (
    <div className="rounded-2xl border border-dashed border-warmGray/30 bg-warmGray/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-charcoal">Thêm luật mới</p>

      <div className="space-y-1">
        <label className="text-xs text-warmGray font-medium">Tên luật</label>
        <input type="text" value={draft.name ?? ''} maxLength={80}
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          disabled={disabled}
          placeholder="vd. Tỷ lệ về thấp — kiểm tra béc phun"
          className={inputCls(errors.name)}
        />
        {errors.name && <p className="text-xs text-alertRed">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Chỉ số</label>
          <select value={draft.metric} onChange={e => setDraft(d => ({ ...d, metric: e.target.value as RecommendationRule['metric'] | '' }))} disabled={disabled} className={cn(inputCls(errors.metric), 'appearance-none')}>
            <option value="">— Chọn —</option>
            {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.metric && <p className="text-xs text-alertRed">{errors.metric}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Cửa sổ (1–30 ngày)</label>
          <input type="number" min={1} max={30} value={draft.window_days ?? ''} onChange={e => setDraft(d => ({ ...d, window_days: Number(e.target.value) }))} disabled={disabled} className={inputCls(errors.window_days)} />
          {errors.window_days && <p className="text-xs text-alertRed">{errors.window_days}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Ngưỡng kích hoạt (%)</label>
          <input type="number" value={draft.threshold ?? ''} onChange={e => setDraft(d => ({ ...d, threshold: e.target.value === '' ? undefined : Number(e.target.value) }))} disabled={disabled} placeholder="vd. 60" className={inputCls(errors.threshold)} />
          {errors.threshold && <p className="text-xs text-alertRed">{errors.threshold}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Hành động</label>
          <select value={draft.action_type} onChange={e => setDraft(d => ({ ...d, action_type: e.target.value as RecommendationRule['action_type'] | '', work_order_type: '', param_key: '' }))} disabled={disabled} className={cn(inputCls(errors.action_type), 'appearance-none')}>
            <option value="">— Chọn —</option>
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.action_type && <p className="text-xs text-alertRed">{errors.action_type}</p>}
        </div>

        {draft.action_type === 'WORK_ORDER' && (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-warmGray font-medium">Loại Work Order</label>
            <input type="text" value={draft.work_order_type ?? ''} onChange={e => setDraft(d => ({ ...d, work_order_type: e.target.value }))} disabled={disabled} placeholder="vd. MAINTENANCE, INSPECTION" className={inputCls()} />
          </div>
        )}

        {draft.action_type === 'PARAM_CHANGE' && (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-warmGray font-medium">Khoá tham số</label>
            <input type="text" value={draft.param_key ?? ''} onChange={e => setDraft(d => ({ ...d, param_key: e.target.value }))} disabled={disabled} placeholder="vd. noise_margin_db" className={inputCls()} />
          </div>
        )}
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={disabled}
      >
        <Plus className="w-3.5 h-3.5" />
        Thêm luật
      </Button>
    </div>
  )
}
