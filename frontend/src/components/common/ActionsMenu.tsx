import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenu } from '@/hooks/useFloatingMenu'
import { cn } from '@/utils/cn'
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
const MENU_PADDING = 8

/**
 * Menu "..." theo dòng bảng (DataTable) — cơ chế portal/lật/đóng xem useFloatingMenu.
 * Bàn phím (cùng cách với SelectMenu): ↑/↓ di chuyển (bỏ qua mục disabled),
 * Enter/Space chạy mục đang trỏ, Esc/Tab đóng; đóng xong trả focus về nút "...".
 */
export default function ActionsMenu({ items }: ActionsMenuProps) {
  const { open, setOpen, toggle, triggerRef, menuRef, style } = useFloatingMenu({
    align: 'right',
    estimatedHeight: items.length * MENU_ITEM_HEIGHT + MENU_PADDING,
  })
  const [activeIndex, setActiveIndex] = useState(-1)

  // Mỗi lần mở lại, con trỏ bàn phím đứng ở mục đầu tiên còn bấm được. Chỉ phụ
  // thuộc `open`: `items` được tạo mới mỗi render (columns.tsx build inline) nên
  // nếu đưa vào deps thì mỗi lần ↑/↓ re-render lại nhảy về mục đầu.
  useEffect(() => {
    if (open) setActiveIndex(items.findIndex(i => !i.disabled))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(activeIndex) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') setOpen(false)
  }

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
          'inline-flex h-8 w-8 items-center justify-center rounded-full text-warmGray transition-colors hover:bg-warmGray/10 hover:text-charcoal',
          open && 'bg-warmGray/10 text-charcoal',
        )}
      >
        <IconMore width={18} height={18} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={style}
          className="z-50 w-48 animate-fade-in overflow-hidden rounded-xl border border-warmGray/15 bg-white py-1 shadow-dock"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onMouseEnter={() => { if (!item.disabled) setActiveIndex(index) }}
                onClick={() => run(index)}
                className={cn(
                  'block w-full px-3.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:text-warmGray/40',
                  item.danger
                    ? cn('text-alertRed', isActive && 'bg-alertRed/10')
                    : cn('text-charcoal', isActive && 'bg-limeMist'),
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
