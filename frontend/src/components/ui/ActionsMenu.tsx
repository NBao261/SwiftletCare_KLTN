import { Fragment, useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenu } from '@/components/ui/useFloatingMenu'
import { cn } from '@/lib/cn'
import { IconMore } from '@/components/ui/icons'

export interface ActionsMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ActionsMenuProps {
  items: ActionsMenuItem[]
}

const MENU_ITEM_HEIGHT = 36
const ITEM_GAP = 2 // space-y-0.5
const MENU_CHROME = 14 // p-1.5 trên + dưới (12) + border (2)
const DIVIDER_HEIGHT = 11 // my-1 + h-px (9) + 1 gap space-y-0.5 (2)

function estimateMenuHeight(items: ActionsMenuItem[]): number {
  const dividers = items.filter((item, i) => item.danger && i > 0 && !items[i - 1].danger).length
  return items.length * MENU_ITEM_HEIGHT + Math.max(0, items.length - 1) * ITEM_GAP + dividers * DIVIDER_HEIGHT + MENU_CHROME
}

/**
 * Menu "..." theo dòng bảng (DataTable) — cơ chế portal/lật/đóng xem useFloatingMenu.
 * Bàn phím (cùng cách với SelectMenu): ↑/↓ di chuyển (bỏ qua mục disabled),
 * Enter/Space chạy mục đang trỏ, Esc/Tab đóng; đóng xong trả focus về nút "...".
 */
export default function ActionsMenu({ items }: ActionsMenuProps) {
  const { open, setOpen, toggle, triggerRef, menuRef, style } = useFloatingMenu({
    align: 'right',
    estimatedHeight: estimateMenuHeight(items),
  })
  const [activeIndex, setActiveIndex] = useState(-1)

  // Mỗi lần mở lại, CHƯA có mục nào được tô — nền chỉ hiện khi thật sự hover/di
  // chuyển bằng bàn phím (Floating Inset Menu, không "dính sẵn" nền xám mục đầu
  // như bản cũ). Mũi tên ↓ lần đầu sẽ nhảy vào mục bấm-được đầu tiên (xem move()).
  useEffect(() => {
    if (open) setActiveIndex(-1)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function run(index: number) {
    const item = items[index]
    if (!item || item.disabled) return
    close()
    item.onClick()
  }

  /** Bước tới mục kế tiếp theo hướng `dir`, bỏ qua mục disabled, không vòng lại */
  function move(dir: 1 | -1) {
    setActiveIndex(current => {
      let next = current
      while (true) {
        next += dir
        if (next < 0 || next >= items.length) return current
        if (!items[next].disabled) return next
      }
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    // Chưa trỏ mục nào (vừa mở menu) thì Enter/Space chạy mục bấm-được đầu tiên
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(activeIndex >= 0 ? activeIndex : items.findIndex(i => !i.disabled)) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') setOpen(false)
  }

  // Không có mục nào thì không hiện nút "..." — tránh mở ra 1 menu rỗng không nội dung
  if (items.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={onKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Thao tác khác"
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-full text-warmGray transition-all duration-200 ease-in-out hover:bg-charcoal/5 hover:text-charcoal',
          open && 'bg-charcoal/5 text-charcoal',
        )}
      >
        <IconMore width={18} height={18} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={style}
          className="z-50 w-48 animate-fade-in space-y-0.5 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-dropdown"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex
            // Ngăn cách nhóm thao tác thường với mục nguy hiểm (Xóa) — chỉ khi mục
            // ngay trước đó KHÔNG phải danger, tránh 2 đường kẻ dính liền nhau.
            const showDivider = item.danger && index > 0 && !items[index - 1].danger
            return (
              <Fragment key={item.label}>
                {showDivider && <div className="mx-1.5 my-1 h-px bg-gray-200" />}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  onMouseEnter={() => { if (!item.disabled) setActiveIndex(index) }}
                  onClick={() => run(index)}
                  className={cn(
                    'block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:text-warmGray/40',
                    item.danger ? 'text-alertRed' : 'text-charcoal',
                    isActive ? 'bg-gray-100' : 'bg-transparent',
                  )}
                >
                  {item.label}
                </button>
              </Fragment>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
