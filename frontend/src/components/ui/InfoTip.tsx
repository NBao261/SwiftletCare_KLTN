import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t, tr } from '@/i18n'
import { useFloatingMenu } from '@/components/ui/useFloatingMenu'

// Nút (i) mở khung giải thích dài (C-07), bấm để mở vì điện thoại không rê chuột được
export default function InfoTip({ children, className }: { children: ReactNode; className?: string }) {
  const { open, toggle, triggerRef, menuRef, style } = useFloatingMenu({ align: 'left', estimatedHeight: 160 })

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t('Giải thích')}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-warmGray transition-colors hover:bg-charcoal/5 hover:text-charcoal max-sm:h-11 max-sm:w-11',
          open && 'bg-charcoal/5 text-charcoal',
          className,
        )}
      >
        <Info width={16} height={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="note"
          style={style}
          className="z-50 w-72 max-w-[calc(100vw-2rem)] animate-fade-in rounded-2xl glass-panel p-3.5 text-body text-charcoal"
        >
          {tr(children)}
        </div>,
        document.body,
      )}
    </>
  )
}
