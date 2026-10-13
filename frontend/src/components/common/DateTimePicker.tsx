import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { IconCalendar, IconChevronRight } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { isWithinVisitHours } from '@/validations/common/schedule.validation'

/** Cùng định dạng giá trị với <input type="datetime-local"> — giờ máy người dùng, để form cũ không phải đổi */
const VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm"
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
/** Bước 5 phút — lịch hẹn không cần chính xác tới phút lẻ, danh sách ngắn gọn */
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const DEFAULT_HOUR = 8

interface DateTimePickerProps {
  /** "yyyy-MM-ddTHH:mm" hoặc '' khi chưa chọn */
  value: string
  onChange: (value: string) => void
  /** Không cho chọn trước mốc này (ngày, giờ, phút đều mờ đi) */
  min?: Date
  id?: string
  ariaLabel: string
  placeholder?: string
  invalid?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Chọn ngày + giờ, thay cho <input type="datetime-local">: bảng chọn native do trình duyệt vẽ (nền xanh
 * dương, chữ tiếng Anh) nên không theo được bảng màu §2. Trigger dùng class `.input` như Input/SelectMenu
 * (field). Bảng chọn nằm NGAY TRONG luồng bố cục dưới ô (không portal/nổi như SelectMenu) nên mở ra thì
 * khung chứa — thường là Modal — tự cao thêm, không tràn ra ngoài popup; đóng khi bấm ra ngoài hoặc Esc.
 * Lịch tháng (T2 đầu tuần) bên trái, cột giờ + phút (bước 5 phút) bên phải. Chọn: charcoal chữ trắng,
 * hover LIME MIST. Mốc trước `min` và giờ/phút ngoài khung hẹn 07:00–18:00 giờ VN bị mờ, không bấm được.
 */
export default function DateTimePicker({ value, onChange, min, id, ariaLabel, placeholder = 'Chọn ngày giờ', invalid }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = value ? new Date(value) : undefined
  const [month, setMonth] = useState(() => startOfMonth(selected ?? min ?? new Date()))
  const hourListRef = useRef<HTMLDivElement>(null)
  const minuteListRef = useRef<HTMLDivElement>(null)

  // Mở lại thì nhảy về tháng đang chọn, cuộn 2 cột giờ/phút tới giá trị đang chọn
  useEffect(() => {
    if (!open) return
    setMonth(startOfMonth(selected ?? min ?? new Date()))
    // Đặt scrollTop của riêng cột (không dùng scrollIntoView — nó cuộn luôn cả Modal/trang chứa bảng chọn)
    requestAnimationFrame(() => {
      for (const list of [hourListRef.current, minuteListRef.current]) {
        const el = list?.querySelector<HTMLElement>('[aria-selected="true"]')
        if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Bấm ra ngoài (ô + bảng chọn) thì đóng
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const isBeforeMin = (d: Date) => !!min && d.getTime() < min.getTime()

  /** Ghép ngày + giờ + phút; mốc rơi vào quá khứ (so với min) thì đẩy lên mốc 5 phút kế tiếp sau min */
  function commit(day: Date, hour: number, minute: number) {
    let next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
    if (min && isBeforeMin(next)) {
      next = new Date(min)
      next.setSeconds(0, 0)
      next.setMinutes(Math.ceil((next.getMinutes() + 1) / 5) * 5)
    }
    onChange(format(next, VALUE_FORMAT))
  }

  const day = selected ?? min ?? new Date()
  const hour = selected?.getHours() ?? DEFAULT_HOUR
  const minute = selected ? selected.getMinutes() - (selected.getMinutes() % 5) : 0

  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const minDay = min ? startOfDay(min) : undefined

  // Nằm trong Modal: Esc chỉ đóng bảng chọn — chặn lan lên document kẻo Modal đóng luôn, mất dữ liệu đang nhập
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); triggerRef.current?.focus() }
  }

  const cellBase = 'flex items-center justify-center rounded-full text-small tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-warmGray/35 disabled:hover:bg-transparent'

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn('input flex items-center justify-between gap-2 text-left', open ? 'border-charcoal' : invalid && 'border-alertRed')}
      >
        <span className={cn('truncate tabular-nums', !selected && 'text-warmGray')}>
          {selected ? format(selected, 'dd/MM/yyyy · HH:mm') : placeholder}
        </span>
        <IconCalendar width={16} height={16} className="shrink-0 text-warmGray" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="flex animate-fade-in gap-2 rounded-2xl border border-warmGray/15 bg-white p-3"
        >
          {/* ── Lịch tháng ── */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Tháng trước"
                disabled={!!minDay && month <= startOfMonth(minDay)}
                onClick={() => setMonth(m => addMonths(m, -1))}
                className={cn(cellBase, 'h-7 w-7 hover:bg-warmGray/10')}
              >
                <IconChevronRight width={16} height={16} className="rotate-180" />
              </button>
              <span className="text-sm font-semibold text-charcoal">Tháng {format(month, 'M, yyyy')}</span>
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(m => addMonths(m, 1))} className={cn(cellBase, 'h-7 w-7 hover:bg-warmGray/10')}>
                <IconChevronRight width={16} height={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map(w => <span key={w} className="label-caption py-1 text-center">{w}</span>)}
              {days.map(d => {
                const isSel = !!selected && isSameDay(d, selected)
                const disabled = !!minDay && d < minDay
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSel}
                    onClick={() => commit(d, hour, minute)}
                    className={cn(
                      cellBase,
                      'h-8 w-8 justify-self-center',
                      isSel ? 'bg-charcoal font-semibold text-white'
                        : cn('hover:bg-limeMist', isSameMonth(d, month) ? 'text-charcoal' : 'text-warmGray/60'),
                      !isSel && isSameDay(d, new Date()) && 'ring-1 ring-inset ring-charcoal/40',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Giờ + phút ── */}
          <div className="flex gap-0.5 border-l border-warmGray/10 pl-2">
            {([['Giờ', HOURS, hour, hourListRef], ['Phút', MINUTES, minute, minuteListRef]] as const).map(([label, list, current, ref]) => (
              <div key={label} className="flex w-10 flex-col">
                <span className="label-caption pb-2 text-center">{label}</span>
                <div ref={ref} role="listbox" aria-label={label} className="relative flex max-h-[14rem] flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none]">
                  {list.map(n => {
                    const at = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
                    // Giờ còn phút nào hợp lệ (:00 hoặc :55 — khung 07:00–18:00 tính cả 18:00) thì chưa mờ
                    const disabled = label === 'Giờ'
                      ? isBeforeMin(at(n, 55)) || !(isWithinVisitHours(at(n, 0)) || isWithinVisitHours(at(n, 55)))
                      : isBeforeMin(at(hour, n)) || !isWithinVisitHours(at(hour, n))
                    const isSel = !!selected && n === current
                    return (
                      <button
                        key={n}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        disabled={disabled}
                        onClick={() => (label === 'Giờ' ? commit(day, n, minute) : commit(day, hour, n))}
                        className={cn(cellBase, 'h-7 w-full shrink-0 rounded-lg', isSel ? 'bg-charcoal font-semibold text-white' : 'text-charcoal hover:bg-limeMist')}
                      >
                        {pad(n)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
