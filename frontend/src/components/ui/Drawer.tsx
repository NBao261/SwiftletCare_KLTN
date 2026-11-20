import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  // 'bottom': bảng mở từ đáy màn (VD menu "Thêm" của dock điện thoại)
  side?: 'right' | 'bottom'
}

const PANEL_CLASS = {
  right: 'fixed inset-y-0 right-0 z-50 w-full max-w-md animate-slide-in-right',
  bottom: 'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl pb-[env(safe-area-inset-bottom)] animate-fade-in',
} as const

export function Drawer({ open, onClose, title, children, side = 'right' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    // Đóng thì trả focus về chỗ đã mở (nút bấm), người dùng bàn phím không bị lạc
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus()
    }
  }, [open])

  if (!open) return null
  // Portal ra body: <main> của AppShell là stacking context z-10 nên drawer vẽ bên trong sẽ nằm dưới header z-20
  return createPortal(
    <>
      {/* Lớp nền mờ */}
      <div 
        className="fixed inset-0 z-40 bg-charcoal/30 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Khung Drawer trượt từ phải ra */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${PANEL_CLASS[side]} flex flex-col bg-white shadow-2xl outline-none`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-warmGray/10 px-6">
          {/* Thanh tiêu đề cao cố định: tên dài cắt "…", rê chuột xem đủ */}
          {title && <h2 title={typeof title === 'string' ? title : undefined} className="min-w-0 truncate text-lg font-bold text-charcoal">{title}</h2>}
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </Button>
        </div>
        <div className={side === 'bottom' ? 'flex flex-col overflow-y-auto px-3 py-3' : 'flex-1 flex flex-col overflow-hidden px-6 py-5'}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
