import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useAlertsInfinite } from '@/hooks/shared/useAlerts'
import { useReadAlerts } from '@/hooks/shared/useReadAlerts'
import { useAlertStore } from '@/stores/alertStore'
import { formatDate } from '@/lib/helpers'
import { IconBell } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import type { Alert } from '@/types'

const PAGE_SIZE = 10

// Popup chuông thông báo: cuộn tải thêm, xổ chi tiết tại chỗ là đã đọc; xác nhận kèm ghi chú làm ở trang Thông báo
export default function NotificationPopover() {
  const { t } = useTranslation(shellDict)
  const [open, setOpen] = useState(false)
  const [unreadFirst, setUnreadFirst] = useState(false)
  const [justRead, setJustRead] = useState<Map<string, Alert>>(() => new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const unreadCount = useAlertStore(s => s.unreadCount)
  const { readIds, markRead } = useReadAlerts()
  const all = useAlertsInfinite(PAGE_SIZE, undefined, open)
  const unreadOnly = useAlertsInfinite(PAGE_SIZE, 'ACTIVE', open && unreadFirst)
  const isLoading = all.isLoading || (unreadFirst && unreadOnly.isLoading)
  const pager = unreadFirst && unreadOnly.hasNextPage ? unreadOnly : all
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pager

  const isUnread = (alert: Alert) => alert.status === 'ACTIVE' && !readIds.has(alert._id)

  // Gộp các trang bỏ trùng; chế độ chưa đọc lên đầu thì tin ACTIVE đứng trước
  const alerts = useMemo(() => {
    const byId = new Map<string, Alert>()
    if (unreadFirst) {
      const top = new Map<string, Alert>(justRead)
      for (const page of unreadOnly.data?.pages ?? []) for (const alert of page.data) if (!readIds.has(alert._id)) top.set(alert._id, alert)
      const sortedTop = [...top.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      for (const alert of sortedTop) byId.set(alert._id, alert)
    }
    for (const page of all.data?.pages ?? []) for (const alert of page.data) if (!byId.has(alert._id)) byId.set(alert._id, alert)
    return [...byId.values()]
  }, [all.data, unreadOnly.data, unreadFirst, justRead, readIds])

  // Xổ/thu chi tiết 1 tin; tin chưa đọc thì đánh dấu đã đọc (badge tự giảm), giữ chỗ trong danh sách tới khi đóng popup
  function toggleNotification(alert: Alert) {
    const willExpand = expandedId !== alert._id
    setExpandedId(willExpand ? alert._id : null)
    if (willExpand && isUnread(alert)) {
      markRead(alert._id)
      setJustRead(prev => new Map(prev).set(alert._id, alert))
    }
  }

  // Đóng popup, thu gọn tin đang xổ và xếp lại danh sách
  function closePopover() {
    setOpen(false)
    setExpandedId(null)
    setJustRead(new Map())
  }

  // Sang trang Cảnh báo, cuộn tới đúng dòng qua highlight
  function openAlertPage(alert: Alert) {
    closePopover()
    navigate(`/alerts?highlight=${alert._id}`)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closePopover()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePopover()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Cuộn gần đáy danh sách thì tải trang kế tiếp
  useEffect(() => {
    const root = listRef.current
    const sentinel = sentinelRef.current
    if (!open || !root || !sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { root, rootMargin: '0px 0px 80px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => (open ? closePopover() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white hover:shadow-icon',
          open && 'bg-white shadow-icon',
        )}
        aria-label={unreadCount > 0 ? t('notif.ariaUnread', { count: unreadCount }) : t('notif.title')}
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
          onWheel={e => e.stopPropagation()}
          className="absolute right-0 z-30 mt-2 flex w-[360px] animate-fade-in flex-col overflow-hidden rounded-2xl glass-panel"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-charcoal/10 px-4 py-3">
            <span className="text-base font-bold text-charcoal">{t('notif.title')}</span>
            <button
              type="button"
              aria-pressed={unreadFirst}
              onClick={() => setUnreadFirst(on => !on)}
              className="shrink-0 text-xs text-warmGray underline transition-colors hover:text-charcoal"
            >
              {unreadFirst ? t('notif.sortByTime') : t('notif.unreadFirst')}
            </button>
          </div>

          <div ref={listRef} className="max-h-[380px] overflow-y-auto [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin]">
            {isLoading && <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.loading')}</p>}
            {!isLoading && alerts.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.empty')}</p>
            )}
            {alerts.map(alert => {
              const unread = isUnread(alert)
              const expanded = expandedId === alert._id
              return (
                <div
                  key={alert._id}
                  className={cn(
                    'border-b transition-colors',
                    expanded ? 'border-charcoal/10 bg-limeMist/50' : unread ? 'border-charcoal/10 bg-charcoal/5' : 'border-charcoal/5 bg-transparent',
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleNotification(alert)}
                    className={cn(
                      'flex w-full items-start gap-3 p-3.5 text-left transition-colors',
                      !expanded && (unread ? 'hover:bg-charcoal/10' : 'hover:bg-charcoal/5'),
                      !unread && !expanded && 'opacity-80',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-safetyOrange' : 'bg-transparent')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', expanded ? 'whitespace-normal break-words' : 'truncate', unread ? 'font-bold text-charcoal' : 'font-medium text-graphite')}>
                        {alert.title}
                      </span>
                      <span className={cn('mt-1 block text-xs', expanded ? 'whitespace-normal break-words' : 'truncate', unread ? 'text-gray-600' : 'text-warmGray')}>
                        {alert.message}
                      </span>
                      <span className={cn('mt-1 block text-xs', unread ? 'text-gray-600' : 'text-warmGray')}>
                        {formatDate(alert.created_at)}
                      </span>
                    </span>
                    <ChevronDown width={16} height={16} className={cn('mt-0.5 shrink-0 text-warmGray transition-transform duration-200', expanded && 'rotate-180')} />
                  </button>

                  {expanded && (
                    <div className="flex items-end justify-between gap-3 px-3.5 pb-3.5 pl-[34px]">
                      <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-warmGray">{t('notif.severity')}</dt>
                        <dd className="font-semibold text-charcoal">{t(`severity.${alert.severity}`)}</dd>
                        <dt className="text-warmGray">{t('notif.status')}</dt>
                        <dd className="font-semibold text-charcoal">{t(`status.${alert.status}`)}</dd>
                        {alert.acknowledged_at && (
                          <>
                            <dt className="text-warmGray">{t('notif.acknowledgedAt')}</dt>
                            <dd className="font-semibold text-charcoal">{formatDate(alert.acknowledged_at)}</dd>
                          </>
                        )}
                        {alert.acknowledgement_note && (
                          <>
                            <dt className="text-warmGray">{t('notif.note')}</dt>
                            <dd className="break-words text-charcoal">{alert.acknowledgement_note}</dd>
                          </>
                        )}
                      </dl>
                      <button
                        type="button"
                        onClick={() => openAlertPage(alert)}
                        aria-label={t('notif.openDetail')}
                        title={t('notif.openDetail')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-white transition-colors hover:bg-charcoal/85"
                      >
                        <ArrowRight width={16} height={16} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={sentinelRef} aria-hidden="true" />
            {isFetchingNextPage && <p className="px-4 py-3 text-center text-xs text-warmGray">{t('notif.loadingMore')}</p>}
          </div>

          <button
            onClick={() => { closePopover(); navigate('/alerts') }}
            className="block w-full shrink-0 rounded-b-2xl border-t border-charcoal/10 py-3 text-center text-xs font-bold text-charcoal transition-colors hover:bg-charcoal/5"
          >
            {t('notif.viewAll')}
          </button>
        </div>
      )}
    </div>
  )
}
