// Ô số giữa nút −/+: gõ thẳng số khác, Enter hoặc rời ô thì nhận (kẹp vào phạm vi), Esc thì bỏ
import { useEffect, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

// Chuỗi đã gõ thành số đã kẹp; null khi không đọc được (giữ số cũ). Nhận cả dấu phẩy thập phân
export function parseTypedValue(draft: string, clamp: (value: number) => number): number | null {
  const text = draft.trim().replace(',', '.')
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? clamp(parsed) : null
}

interface Props {
  value: number
  onChange: (value: number) => void
  clamp: (value: number) => number
  decimals: number
  label: string
  unit: string
  className?: string
  // Giá trị đang sai luật: trình đọc màn hình đọc là ô lỗi, id của câu lỗi để aria-describedby trỏ tới
  invalid?: boolean
  errorId?: string
}

export default function StepperValueInput({ value, onChange, clamp, decimals, label, unit, className, invalid, errorId }: Props) {
  const shown = value.toFixed(decimals)
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])

  function commit() {
    const next = parseTypedValue(draft, clamp)
    setDraft((next ?? value).toFixed(decimals))
    if (next !== null && next !== value) onChange(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(shown)
  }

  return (
    <label className={cn('flex items-center justify-center gap-1 focus-within:ring-2 focus-within:ring-accent-600/40', className)}>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="w-14 bg-transparent text-center outline-none"
      />
      <span className="text-xs font-normal text-warmGray">{t(unit)}</span>
    </label>
  )
}
