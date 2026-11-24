import { useEffect, useRef, type ReactNode } from 'react'

interface StableHeightProps {
  // px: chiều cao tối thiểu ban đầu, trước khi nội dung kịp đo
  minHeight?: number
  className?: string
  children: ReactNode
}

// Nhớ chiều cao lớn nhất làm min-height để trang không giật; resize thì đo lại
export default function StableHeight({ minHeight = 0, className, children }: StableHeightProps) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outerEl = outer.current
    const innerEl = inner.current
    if (!outerEl || !innerEl) return
    let maxHeight = minHeight
    let lastWidth = innerEl.offsetWidth
    const observer = new ResizeObserver(() => {
      if (innerEl.offsetWidth !== lastWidth) {
        lastWidth = innerEl.offsetWidth
        maxHeight = minHeight
      }
      maxHeight = Math.max(maxHeight, innerEl.offsetHeight)
      outerEl.style.minHeight = `${maxHeight}px`
    })
    observer.observe(innerEl)
    return () => observer.disconnect()
  }, [minHeight])

  return (
    <div ref={outer} className={className} style={{ minHeight }}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
