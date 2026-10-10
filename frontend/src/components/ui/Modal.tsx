import { ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'

/** Modal Bottom Sheet cơ bản — mục 2.1 (rounded-3xl) */
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Nơi gọi hay truyền onClose inline (hàm mới mỗi render). Để onClose trong deps
  // thì mỗi phím gõ vào input → parent render lại → effect chạy lại → focus() giật
  // focus khỏi input. Giữ bản mới nhất trong ref, effect chỉ chạy lại khi `open` đổi.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // A11y (mục 6): Esc đóng modal + focus trap giữ Tab/Shift+Tab quanh panel khi
  // đang mở — dùng chung cho mọi Modal/ConfirmModal trong app (ConfirmModal bọc
  // ngay component này) nên chỉ cần sửa 1 chỗ.
  useEffect(() => {
    if (!open) return
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
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-popover outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-bold text-charcoal">{title}</h2>}
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
