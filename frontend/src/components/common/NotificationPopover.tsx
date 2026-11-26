import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useAlertsInfinite, usePendingAlertTotal } from '@/hooks/shared/useAlerts'
import { useMarkAllNotificationsRead, useNotificationUnreadCount } from '@/hooks/shared/useNotifications'
import NotificationInboxList from '@/components/common/NotificationInboxList'
import SeverityBadge from '@/components/common/SeverityBadge'
import StatusTabs from '@/components/common/StatusTabs'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { canAccessPath } from '@/constants/roles'
import { formatDateTime } from '@/lib/i18n'
import { IconBell } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import type { Alert } from '@/types'

const PAGE_SIZE = 10

type PopoverTab = 'alerts' | 'inbox'

// Popup chuông: tab Cảnh báo (bấm mở thẳng cảnh báo) và tab Thông báo (nơi duy nhất có đã đọc / chưa đọc); chân popup dẫn tới trang đầy đủ và cài đặt
export default function NotificationPopover() {
  const { t } = useTranslation(shellDict)
  const [open, setOpen] = useState(false)
  // Role không vào được /alerts (Domain Expert) chỉ có tab Thông báo và không gọi GET /alerts
  const showAlerts = canAccessPath(useAuthStore(s => s.user?.role), '/alerts')
  const [tab, setTab] = useState<PopoverTab>(showAlerts ? 'alerts' : 'inbox')
  const inboxUnreadCount = useNotificationUnreadCount()
  const [pendingFirst, setPendingFirst] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const markAllRead = useMarkAllNotificationsRead()
  const alertPendingCount = usePendingAlertTotal() ?? 0
  // Badge chuông = cảnh báo chờ xác nhận + thông báo trong ứng dụng chưa đọc
  const badgeCount = alertPendingCount + inboxUnreadCount
  const alertsOpen = open && showAlerts && tab === 'alerts'
  const all = useAlertsInfinite(PAGE_SIZE, undefined, alertsOpen)
  const pendingOnly = useAlertsInfinite(PAGE_SIZE, 'ACTIVE', alertsOpen && pendingFirst)
  const isLoading = all.isLoading || (pendingFirst && pendingOnly.isLoading)
  const pager = pendingFirst && pendingOnly.hasNextPage ? pendingOnly : all
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pager

  // Gộp các trang bỏ trùng; chế độ chờ xác nhận lên đầu thì tin ACTIVE đứng trước
  const alerts = useMemo(() => {
    const byId = new Map<string, Alert>()
    if (pendingFirst) for (const page of pendingOnly.data?.pages ?? []) for (const alert of page.data) byId.set(alert._id, alert)
    for (const page of all.data?.pages ?? []) for (const alert of page.data) if (!byId.has(alert._id)) byId.set(alert._id, alert)
    return [...byId.values()]
  }, [all.data, pendingOnly.data, pendingFirst])

  function closePopover() {
    setOpen(false)
  }

  // Bấm một cảnh báo: sang trang Cảnh báo, cuộn tới đúng dòng qua highlight
  function openAlertPage(alert: Alert) {
    closePopover()
    navigate(`/alerts?highlight=${alert._id}`)
  }

  function goTo(path: string) {
    closePopover()
    navigate(path)
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

  // Cuộn gần đáy danh sách thì tải trang kế tiếp
  useEffect(() => {
    const root = listRef.current
    const sentinel = sentinelRef.current
    if (!open || tab !== 'alerts' || !root || !sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { root, rootMargin: '0px 0px 80px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, tab, hasNextPage, isFetchingNextPage, fetchNextPage])

  const toolbarLinkClass = 'shrink-0 text-xs text-warmGray underline transition-colors hover:text-charcoal disabled:opacity-50'

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
        aria-label={badgeCount > 0 ? t('notif.ariaUnread', { count: badgeCount }) : t('notif.title')}
      >
        <IconBell />
        {badgeCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alertRed px-1 text-small font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          onWheel={e => e.stopPropagation()}
          className="absolute right-0 z-30 mt-2 flex w-[360px] animate-fade-in flex-col overflow-hidden rounded-2xl glass-panel"
        >
          {/* Đầu: hai tab, hoặc tiêu đề khi role chỉ có hộp thông báo; không lặp chữ "Thông báo" ở hai chỗ */}
          <div className="shrink-0 border-b border-charcoal/10 px-3 py-2.5">
            {showAlerts ? (
              <StatusTabs
                ariaLabel={t('notif.tabsAria')}
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'alerts', label: t('notif.tabAlerts'), badge: alertPendingCount },
                  { id: 'inbox', label: t('notif.tabInbox'), badge: inboxUnreadCount },
                ]}
              />
            ) : (
              <span className="px-1 text-base font-bold text-charcoal">{t('notif.title')}</span>
            )}
          </div>

          {/* Dòng công cụ chung: tóm tắt bên trái, thao tác của tab bên phải */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-charcoal/10 px-4 py-2">
            {tab === 'alerts' ? (
              <>
                <span className="text-xs text-warmGray">{t('notif.pendingSummary', { count: alertPendingCount })}</span>
                <button type="button" aria-pressed={pendingFirst} onClick={() => setPendingFirst(on => !on)} className={toolbarLinkClass}>
                  {pendingFirst ? t('notif.sortByTime') : t('notif.pendingFirst')}
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-warmGray">{inboxUnreadCount > 0 ? t('notif.unreadSummary', { count: inboxUnreadCount }) : t('notif.allRead')}</span>
                {inboxUnreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markAllRead.isPending}
                    onClick={() => markAllRead.mutate(undefined, { onError: error => push(apiErrorMessage(error, t('notif.markFailed')), 'error') })}
                    className={toolbarLinkClass}
                  >
                    {t('notif.markAllRead')}
                  </button>
                )}
              </>
            )}
          </div>

          {tab === 'inbox' ? <NotificationInboxList onNavigate={closePopover} /> : (
            <div ref={listRef} className="max-h-[380px] overflow-y-auto [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin]">
              {isLoading && <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.loading')}</p>}
              {!isLoading && alerts.length === 0 && <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.empty')}</p>}
              {alerts.map(alert => {
                const pending = alert.status === 'ACTIVE'
                return (
                  <button
                    key={alert._id}
                    type="button"
                    onClick={() => openAlertPage(alert)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b p-3.5 text-left transition-colors',
                      pending ? 'border-charcoal/10 bg-charcoal/5 hover:bg-charcoal/10' : 'border-charcoal/5 hover:bg-charcoal/5',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', pending ? 'bg-safetyOrange' : 'bg-transparent')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', pending ? 'font-bold text-charcoal' : 'font-medium text-graphite')}>{alert.title}</span>
                      <span className="mt-1 line-clamp-2 break-words text-xs text-graphite">{alert.message}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warmGray">
                        <SeverityBadge severity={alert.severity} isMuted={!pending} />
                        <span>{t(`status.${alert.status}`)}</span>
                        <span aria-hidden>·</span>
                        <span>{formatDateTime(alert.created_at)}</span>
                      </span>
                    </span>
                    <CaretRightIcon size={16} className="mt-0.5 shrink-0 text-warmGray" aria-hidden />
                  </button>
                )
              })}
              <div ref={sentinelRef} aria-hidden="true" />
              {isFetchingNextPage && <p className="px-4 py-3 text-center text-xs text-warmGray">{t('notif.loadingMore')}</p>}
            </div>
          )}

          {/* Chân: nơi đọc đầy đủ của tab đang mở, và cài đặt kênh nhận */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-charcoal/10 px-4 py-2.5">
            <button type="button" onClick={() => goTo('/settings?tab=notifications')} className={toolbarLinkClass}>
              {t('notif.settings')}
            </button>
            <button
              type="button"
              onClick={() => goTo(tab === 'alerts' ? '/alerts' : '/notifications')}
              className="text-xs font-bold text-charcoal transition-colors hover:text-charcoal/70"
            >
              {tab === 'alerts' ? t('notif.viewAllAlerts') : t('notif.viewAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
