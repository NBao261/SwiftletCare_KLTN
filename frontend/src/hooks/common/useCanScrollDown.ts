import { useEffect, useRef, useState } from 'react'

const BOTTOM_TOLERANCE_PX = 2

// Vùng cuộn còn nội dung phía dưới không (tính lại khi cuộn, đổi cỡ khung hoặc nội dung)
export function useCanScrollDown<TScroll extends HTMLElement, TContent extends HTMLElement>() {
  const scrollRef = useRef<TScroll>(null)
  const contentRef = useRef<TContent>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const update = () => {
      const remaining = scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop
      setCanScrollDown(remaining > BOTTOM_TOLERANCE_PX)
    }

    update()
    scrollEl.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scrollEl)
    if (contentRef.current) observer.observe(contentRef.current)

    return () => {
      scrollEl.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  return { scrollRef, contentRef, canScrollDown }
}
