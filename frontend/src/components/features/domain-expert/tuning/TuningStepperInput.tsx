// Ô số kiểu -/+ có min/max và đơn vị; số ở giữa gõ thẳng được
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import StepperValueInput from './StepperValueInput'

interface Props {
  label: string
  subLabel?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  decimals?: number
  unit: string
  highlighted?: boolean // true khi vừa áp dụng gợi ý AI
}

export default function TuningStepperInput({
  label, subLabel, value, onChange, min, max,
  step = 1, decimals = 0, unit, highlighted,
}: Props) {
  const clamp = (v: number) => {
    const rounded = Math.round(v * 10 ** decimals) / 10 ** decimals
    if (min !== undefined && rounded < min) return min
    if (max !== undefined && rounded > max) return max
    return rounded
  }

  const decrement = () => onChange(clamp(value - step))
  const increment = () => onChange(clamp(value + step))

  const atMin = min !== undefined && value <= min
  const atMax = max !== undefined && value >= max

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 py-2.5 px-0 border-b border-stone-100 last:border-b-0 transition-colors duration-300',
      highlighted && 'bg-[#ECFFA9]/40 rounded-lg px-2 -mx-2',
    )}>
      {/* "Phạm vi · Mặc định" ở nút (i) đầu khối (TuningRangeTip), ô chỉ còn nhãn và dòng phụ */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal leading-tight">{label}</p>
        {subLabel && <p className="text-small text-warmGray mt-0.5 italic">{t(subLabel)}</p>}
      </div>

      {/* Stepper control */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          aria-label={t('Giảm {{label}}', { label })}
          className={cn(
            'h-9 w-9 max-sm:h-11 max-sm:w-11 rounded-lg text-base font-bold transition-colors duration-100 select-none',
            atMin
              ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
              : 'bg-neutral-100 text-[#27231F] hover:bg-neutral-200 active:scale-95',
          )}
        >
          −
        </button>

        <StepperValueInput
          value={value}
          onChange={onChange}
          clamp={clamp}
          decimals={decimals}
          label={label}
          unit={unit}
          className={cn(
            'min-w-[80px] px-2 py-1 rounded-lg border text-sm font-semibold text-[#27231F] transition-colors duration-300',
            highlighted ? 'border-[#B5D32C] bg-[#ECFFA9]' : 'border-neutral-200 bg-neutral-50',
          )}
        />

        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          aria-label={t('Tăng {{label}}', { label })}
          className={cn(
            'h-9 w-9 max-sm:h-11 max-sm:w-11 rounded-lg text-base font-bold transition-colors duration-100 select-none',
            atMax
              ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
              : 'bg-neutral-100 text-[#27231F] hover:bg-neutral-200 active:scale-95',
          )}
        >
          +
        </button>
      </div>
    </div>
  )
}
