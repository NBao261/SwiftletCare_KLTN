import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface Options {
  /** Cạnh nào của menu bám theo nút mở: trái (dropdown chọn) hay phải (menu "..." cuối dòng) */
  align: 'left' | 'right'
  /** Chiều cao ước lượng để quyết định mở xuống hay lật lên khi gần đáy viewport */
  estimatedHeight: number
  /** Menu rộng tối thiểu bằng nút mở (dropdown chọn) */
  matchTriggerWidth?: boolean
}

/**
 * Menu nổi portal ra document.body với `position: fixed` tính từ toạ độ thật của
 * nút mở — không bị `overflow-hidden`/`overflow-x-auto` của khung cha cắt (bảng,
 * card). Tự lật lên trên khi thiếu chỗ phía dưới; đóng khi click ngoài, Esc,
 * cuộn trang hoặc resize (thay vì tính lại vị trí liên tục). Dùng chung cho
 * ActionsMenu (align right) và SelectMenu (align left).
 */
export function useFloatingMenu({ align, estimatedHeight, matchTriggerWidth }: Options) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) { setOpen(true); return }
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight
    setStyle({
      position: 'fixed',
      ...(align === 'left' ? { left: rect.left } : { right: window.innerWidth - rect.right }),
      ...(flipUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(matchTriggerWidth ? { minWidth: rect.width } : {}),
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function close() { setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return { open, setOpen, toggle: () => (open ? setOpen(false) : openMenu()), triggerRef, menuRef, style }
}
