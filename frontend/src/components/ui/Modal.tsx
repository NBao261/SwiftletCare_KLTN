import { ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { t, tr } from '@/i18n'
import { cn } from '@/lib/cn'

/** Modal Bottom Sheet cơ bản — mục 2.1 (rounded-3xl) */
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Tên cho trình đọc màn hình khi không có `title` (popup tự dựng đầu) */
  ariaLabel?: string
  children: ReactNode
  /**
   * `md` (mặc định, max-w-md) · `lg` (max-w-lg) — form cần hàng nhãn rộng hơn, VD lỗi nằm cùng hàng nhãn ·
   * `xl` (max-w-3xl) — popup bố cục ngang 2 cột (danh mục trái + nội dung phải), VD chi tiết tài khoản
   */
  size?: 'md' | 'lg' | 'xl'
  /** Ghi đè class của khung (VD `max-w-sm` cho popup xác nhận ngắn) — thắng `size` nhờ tailwind-merge */
  className?: string
}

const SIZE_CLASS = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-3xl' } as const

export function Modal({ open, onClose, title, ariaLabel, children, size = 'md', className }: ModalProps) {
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
        aria-label={tr(title ?? ariaLabel)}
        className={cn('relative w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-popover outline-none', SIZE_CLASS[size], className)}
      >
        {title ? (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-charcoal">{tr(title)}</h2>
            <Button variant="icon" size="sm" onClick={onClose} aria-label={t('Đóng')}>
              <CloseIcon />
            </Button>
          </div>
        ) : (
          // Không tiêu đề (popup tự dựng đầu, VD 2 cột): nút đóng neo góc trên phải, không chiếm 1 hàng riêng — trước
          // đây hàng chỉ có nút + justify-between đẩy nút sang TRÁI. Nội dung tự chừa chỗ bên phải hàng đầu.
          <Button variant="icon" size="sm" onClick={onClose} aria-label={t('Đóng')} className="absolute right-6 top-6 z-10">
            <CloseIcon />
          </Button>
        )}
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
