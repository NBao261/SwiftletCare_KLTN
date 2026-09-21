import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenu } from '@/hooks/useFloatingMenu'
import { cn } from '@/utils/cn'
import { IconChevronDown, IconCheck } from '@/components/ui/icons'

export interface SelectMenuOption<V extends string> {
  value: V
  label: string
}

interface SelectMenuProps<V extends string> {
  value: V
  options: SelectMenuOption<V>[]
  onChange: (value: V) => void
  /** Nhãn cho screen reader — trigger chỉ hiện label của option đang chọn */
  ariaLabel: string
  className?: string
}

const OPTION_HEIGHT = 36
const MENU_PADDING = 8

/**
 * Dropdown chọn 1 giá trị, thay cho <select> native ở các hàng filter: <select>
 * không style được phần danh sách (màu hover option do hệ điều hành vẽ) nên
 * không theo được bảng màu §2 (highlight = LIME MIST). Trigger là pill h-8 cùng
 * chiều cao chip/nút sort; danh sách portal ra body (useFloatingMenu). Hỗ trợ
 * bàn phím: ↑/↓ di chuyển, Enter/Space chọn, Esc đóng.
 */
export default function SelectMenu<V extends string>({ value, options, onChange, ariaLabel, className }: SelectMenuProps<V>) {
  const { open, setOpen, toggle, triggerRef, menuRef, style } = useFloatingMenu({
    align: 'left',
    estimatedHeight: options.length * OPTION_HEIGHT + MENU_PADDING,
    matchTriggerWidth: true,
  })
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  // Mỗi lần mở lại, con trỏ bàn phím đứng ở option đang chọn
  useEffect(() => { if (open) setActiveIndex(selectedIndex) }, [open, selectedIndex])

  function select(index: number) {
    onChange(options[index].value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(activeIndex) }
    else if (e.key === 'Tab') setOpen(false)
  }

  const selected = options[selectedIndex]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border bg-white pl-3.5 pr-2.5 text-xs font-semibold text-charcoal transition-colors',
          open ? 'border-charcoal' : 'border-warmGray/25 hover:border-warmGray/50',
          className,
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <IconChevronDown width={14} height={14} className={cn('shrink-0 text-warmGray transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          style={style}
          className="z-50 animate-fade-in overflow-hidden rounded-xl border border-warmGray/15 bg-white py-1 shadow-dock"
        >
          {options.map((opt, index) => {
            const isSelected = index === selectedIndex
            const isActive = index === activeIndex
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(index)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-limeMist text-charcoal' : 'text-charcoal',
                  isSelected && 'font-semibold',
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <IconCheck width={14} height={14} className="shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
