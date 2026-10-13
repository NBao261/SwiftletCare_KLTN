import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenu } from '@/components/ui/useFloatingMenu'
import { cn } from '@/lib/cn'
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
  /**
   * Kiểu ô form (trong modal): trigger dùng class `.input` như Input/Select, không tô viền
   * xanh "đang lọc" — ở form, chọn 1 giá trị là chuyện bình thường, không phải bộ lọc đang bật.
   */
  field?: boolean
  disabled?: boolean
  /** Chỉ với `field`: viền đỏ như Input có `error` */
  invalid?: boolean
}

const OPTION_HEIGHT = 36
const OPTION_GAP = 2 // space-y-0.5
const MENU_CHROME = 14 // p-1.5 trên + dưới (12) + border (2)
/** Quá số dòng này thì danh sách có thanh cuộn */
const MAX_VISIBLE_OPTIONS = 8

/** Chiều cao khung vừa khít `count` dòng — không lộ nửa dòng kế tiếp */
function listHeight(count: number): number {
  return count * OPTION_HEIGHT + Math.max(0, count - 1) * OPTION_GAP + MENU_CHROME
}
/** Kiểu `field` nằm trong modal: chỉ hiện 4 dòng rồi cuộn, để danh sách không tràn khỏi form */
// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Chỉ ảnh hưởng SelectMenu có prop `field` (hiện chỉ popup ticket của Admin dùng). Thêm: `field`/`disabled`/`invalid`, danh sách field cao 4 dòng rồi cuộn, Esc không đóng Modal. Hàng bộ lọc (không `field`) của mọi role giữ nguyên max-h-72.
const FIELD_VISIBLE_OPTIONS = 4

/**
 * Dropdown chọn 1 giá trị, thay cho <select> native ở các hàng filter: <select>
 * không style được phần danh sách (màu hover option do hệ điều hành vẽ) nên
 * không theo được bảng màu §2 (highlight = LIME MIST). Trigger là pill h-8 cùng
 * chiều cao chip/nút sort; danh sách portal ra body (useFloatingMenu). Hỗ trợ
 * bàn phím: ↑/↓ di chuyển, Enter/Space chọn, Esc đóng.
 * `options[0]` phải là giá trị mặc định ("Mọi …"): chọn option khác thì trigger
 * viền xanh (accent-600) để thấy ngay bộ lọc nào đang bật.
 */
export default function SelectMenu<V extends string>({ value, options, onChange, ariaLabel, className, field, disabled, invalid }: SelectMenuProps<V>) {
  const maxVisible = field ? FIELD_VISIBLE_OPTIONS : MAX_VISIBLE_OPTIONS
  const { open, setOpen, toggle, triggerRef, menuRef, style } = useFloatingMenu({
    align: 'left',
    estimatedHeight: listHeight(Math.min(options.length, maxVisible)),
    matchTriggerWidth: true,
  })
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  // Mỗi lần mở lại, con trỏ bàn phím đứng ở option đang chọn
  useEffect(() => { if (open) setActiveIndex(selectedIndex) }, [open, selectedIndex])

  // Danh sách dài có thanh cuộn: giữ option đang trỏ (↑/↓ hoặc đang chọn lúc mở) trong tầm nhìn
  useEffect(() => {
    if (open) menuRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, menuRef])

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
    // Nằm trong Modal (field): Esc chỉ đóng danh sách — chặn lan lên document kẻo Modal đóng luôn, mất dữ liệu đang nhập
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
  }

  const selected = options[selectedIndex]
  // Quy ước: option đầu tiên là giá trị mặc định ("Mọi …"). Chọn khác đi = đang lọc → viền xanh
  const isFiltered = value !== options[0]?.value

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          field
            ? cn('input flex items-center justify-between gap-2 text-left', open ? 'border-charcoal' : invalid && 'border-alertRed')
            : cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border bg-white pl-3.5 pr-2.5 text-xs font-semibold text-charcoal transition-colors',
                open ? 'border-charcoal' : isFiltered ? 'border-accent-600' : 'border-warmGray/25 hover:border-warmGray/50',
              ),
          className,
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <IconChevronDown width={field ? 16 : 14} height={field ? 16 : 14} className={cn('shrink-0 text-warmGray transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          // Cao đúng maxVisible dòng (field 4, filter 8) kể cả padding/gap/border — vừa khít, không lộ nửa dòng kế tiếp
          style={{ ...style, maxHeight: listHeight(maxVisible) }}
          className="z-50 animate-fade-in space-y-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-1.5 shadow-dropdown [scrollbar-width:thin]"
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
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-charcoal transition-colors duration-150',
                  isActive ? 'bg-gray-100' : 'bg-transparent',
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
