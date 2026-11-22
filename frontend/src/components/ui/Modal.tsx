import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { t, tr } from '@/i18n'
import { cn } from '@/lib/cn'

// Modal Bottom Sheet cơ bản: mục 2.1 (rounded-3xl)
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  // Tên cho trình đọc màn hình khi không có `title` (popup tự dựng đầu)
  ariaLabel?: string
  children: ReactNode
  // md, lg, xl (popup 2 cột)
  size?: 'md' | 'lg' | 'xl'
  // Ghi đè class của khung (VD `max-w-sm` cho popup xác nhận ngắn): thắng `size` nhờ tailwind-merge
  className?: string
  // Nhấn ra vùng tối ngoài khung thì đóng: chỉ bật cho popup không có form dễ mất dữ liệu
  closeOnBackdrop?: boolean
  // Ghi đè cỡ chữ tiêu đề (VD `text-h1`): không truyền thì giữ cỡ chung `text-lg`
  titleClassName?: string
}

const SIZE_CLASS = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-3xl' } as const

export function Modal({ open, onClose, title, ariaLabel, children, size = 'md', className, closeOnBackdrop = false, titleClassName }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Giữ onClose mới nhất trong ref: để trong deps thì mỗi phím gõ làm focus() giật khỏi input
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Esc đóng và giữ Tab trong panel
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
  // Portal ra body vì <main> là stacking context z-10; my-auto để khung cao hơn màn hình vẫn cuộn được
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-charcoal/30 p-4 backdrop-blur-sm animate-fade-in"
      // mousedown (không phải click): kéo bôi chữ từ trong khung rồi thả ra ngoài không đóng nhầm
      onMouseDown={closeOnBackdrop ? e => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={tr(title ?? ariaLabel)}
        className={cn('relative my-auto w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-popover outline-none', SIZE_CLASS[size], className)}
      >
        {title ? (
          <div className="mb-4 flex items-center justify-between gap-3">
            {/* Tên dài không có khoảng trắng (VD tên nhà) vẫn xuống dòng thay vì tràn khung */}
            <h2 className={cn('min-w-0 text-lg font-bold text-charcoal [overflow-wrap:anywhere]', titleClassName)}>{tr(title)}</h2>
            <Button variant="icon" size="sm" onClick={onClose} aria-label={t('Đóng')}>
              <CloseIcon />
            </Button>
          </div>
        ) : (
          // Không tiêu đề thì nút đóng neo góc trên phải
          <Button variant="icon" size="sm" onClick={onClose} aria-label={t('Đóng')} className="absolute right-6 top-6 z-10">
            <CloseIcon />
          </Button>
        )}
        {children}
      </div>
    </div>,
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
