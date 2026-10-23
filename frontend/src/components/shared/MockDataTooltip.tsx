import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MockDataTooltipProps {
  reason?: string
  className?: string
  align?: 'left' | 'right' | 'center'
}

const TOOLTIP_WIDTH = 280
const VIEWPORT_PADDING = 12

/**
 * MockDataTooltip — Chỉ báo tinh tế khi trường/khối dữ liệu đang dùng Mock Fallback.
 * Tự động tính toán toạ độ (Floating Portal) bám sát màn hình/viewport, không bị che khuất
 * hoặc cắt xén bởi viền khung hình (boundary collision detection).
 * SRS v2.1.4: Real API First + Mock Fallback transparency.
 */
export default function MockDataTooltip({
  reason = 'Đang hiển thị dữ liệu mô phỏng do DB chưa tích lũy đủ dữ liệu thực tế.',
  className,
}: MockDataTooltipProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})
  const [arrowLeft, setArrowLeft] = useState<number>(TOOLTIP_WIDTH / 2)
  const [placedBelow, setPlacedBelow] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const triggerCenter = rect.left + rect.width / 2
    const idealLeft = triggerCenter - TOOLTIP_WIDTH / 2
    const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING
    const clampedLeft = Math.max(VIEWPORT_PADDING, Math.min(idealLeft, maxLeft))

    // Vị trí mũi tên tam giác bám chuẩn tâm icon
    const computedArrow = Math.max(16, Math.min(triggerCenter - clampedLeft, TOOLTIP_WIDTH - 16))
    setArrowLeft(computedArrow)

    // Lật xuống dưới nếu icon nằm quá sát mép trên viewport
    const spaceAbove = rect.top
    const shouldFlipDown = spaceAbove < 110
    setPlacedBelow(shouldFlipDown)

    setStyle({
      position: 'fixed',
      left: `${clampedLeft}px`,
      width: `${TOOLTIP_WIDTH}px`,
      ...(shouldFlipDown
        ? { top: `${rect.bottom + 8}px` }
        : { bottom: `${window.innerHeight - rect.top + 8}px` }),
    })
  }

  const handleOpen = () => {
    updatePosition()
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handleScrollOrResize = () => setOpen(false)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open])

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        aria-label="Giải thích dữ liệu mô phỏng"
        className="inline-flex cursor-help items-center justify-center rounded-full p-0.5 transition-colors hover:bg-amber-500/10 focus:outline-none"
      >
        <Info className="h-3.5 w-3.5 text-amber-600/80 transition-colors hover:text-amber-600" />
      </span>

      {open &&
        createPortal(
          <div
            style={style}
            role="tooltip"
            className={cn(
              'pointer-events-none z-50 flex flex-col gap-1.5 rounded-xl p-3 text-left',
              'border border-white/10 bg-[#27231F] text-white shadow-2xl',
              'animate-in fade-in zoom-in-95 duration-150',
            )}
          >
            {/* Header nhận diện Mock Fallback */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ECFFA9]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              <span>Dữ liệu mô phỏng (Mock Fallback)</span>
            </div>

            {/* Nội dung giải thích lý do */}
            <p className="text-[11px] font-normal leading-relaxed text-white/85">
              {reason}
            </p>

            {/* Mũi tên chỉ hướng tới icon trigger */}
            <div
              style={{ left: `${arrowLeft}px` }}
              className={cn(
                'absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-white/10 bg-[#27231F]',
                placedBelow
                  ? '-top-1.5 border-b-0 border-r-0'
                  : '-bottom-1.5 border-l-0 border-t-0',
              )}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
