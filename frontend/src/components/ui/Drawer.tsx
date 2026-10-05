import { ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

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
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl outline-none animate-slide-in-right flex flex-col"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-warmGray/10 px-6">
          {title && <h2 className="text-lg font-bold text-charcoal">{title}</h2>}
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
