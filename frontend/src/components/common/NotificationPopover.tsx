import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAlertsList, useAcknowledgeAlert } from '@/hooks/useAlerts'
import { useAlertStore } from '@/store/alertStore'
import { formatDate } from '@/utils/helpers'
import { IconBell } from '@/components/ui/icons'
import { cn } from '@/utils/cn'
import type { Alert, ApiResponse } from '@/types'

/** Query giống hệt tham số truyền cho `useAlertsList` bên dưới — dùng lại làm key để patch cache lạc quan khi ack. */
const RECENT_ALERTS_QUERY = { limit: 6 }

/**
 * Dropdown chuông thông báo trên TopBar — 6 cảnh báo gần nhất (ALERT-FR-007),
 * không filter status để thấy cả cái vừa xử lý. Badge/`unreadCount` lấy từ
 * `useAlertStore` (đồng bộ realtime qua `useAlertNotifications`, mount ở
 * MainLayout) chứ không tự đếm lại ở đây để tránh lệch số với chuông.
 */
export default function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const unreadCount = useAlertStore(s => s.unreadCount)
  const decrementUnread = useAlertStore(s => s.decrementUnread)
  const acknowledge = useAcknowledgeAlert()
  const { records, isLoading } = useAlertsList(RECENT_ALERTS_QUERY)

  /**
   * Bấm 1 thông báo: nếu đang ACTIVE (chưa đọc) thì đánh dấu đã đọc — patch cache
   * + trừ badge NGAY (UI phản hồi tức thì), rồi mới gọi API acknowledge thật ở nền
   * (invalidate ['alerts'] khi xong để đồng bộ lại số liệu chính xác từ server).
   * Luôn đóng dropdown và điều hướng sang trang Cảnh báo, kèm `highlight` để
   * AlertsPage cuộn tới đúng dòng đó (xem AlertsPage.tsx).
   */
  function handleNotificationClick(alert: Alert) {
    if (alert.status === 'ACTIVE') {
      decrementUnread()
      queryClient.setQueryData<{ data: ApiResponse<Alert[]> }>(['alerts', RECENT_ALERTS_QUERY], old =>
        old
          ? { ...old, data: { ...old.data, data: old.data.data.map(a => (a._id === alert._id ? { ...a, status: 'ACKNOWLEDGED' } : a)) } }
          : old,
      )
      acknowledge.mutate({ id: alert._id })
    }
    setOpen(false)
    navigate(`/alerts?highlight=${alert._id}`)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white hover:shadow-icon',
          open && 'bg-white shadow-icon',
        )}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alertRed px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 flex max-h-[440px] w-[360px] animate-fade-in flex-col overflow-hidden rounded-2xl border border-warmGray/20 bg-white shadow-[0_12px_32px_rgba(39,35,31,0.16)]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-warmGray/15 px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-charcoal">Thông báo</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-alertRed px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount} mới
                </span>
              )}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="px-4 py-8 text-center text-sm text-warmGray">Đang tải...</p>}
            {!isLoading && records.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-warmGray">Chưa có thông báo nào</p>
            )}
            {records.map(alert => {
              const unread = alert.status === 'ACTIVE'
              return (
                <button
                  key={alert._id}
                  onClick={() => handleNotificationClick(alert)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-warmGray/10 px-4 py-3 text-left transition-colors last:border-b-0',
                    unread ? 'bg-warmGray/10 hover:bg-warmGray/15' : 'bg-white hover:bg-warmGray/5',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-alertRed" />}
                    <span className="truncate text-sm font-semibold text-charcoal">
                      {alert.title}
                    </span>
                  </span>
                  <span className="truncate text-xs text-warmGray">
                    {alert.message}
                  </span>
                  <span className="text-[11px] text-warmGray">
                    {formatDate(alert.created_at)}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/alerts') }}
            className="shrink-0 border-t border-warmGray/15 px-4 py-3 text-center text-sm font-bold text-charcoal hover:bg-warmGray/10"
          >
            Xem tất cả thông báo lớn →
          </button>
        </div>
      )}
    </div>
  )
}
