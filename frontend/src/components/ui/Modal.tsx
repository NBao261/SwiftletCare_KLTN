import { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

/** Modal Bottom Sheet cơ bản — mục 2.1 (rounded-3xl) */
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-dock">
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
