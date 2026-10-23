import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeftIcon, ChatCircleDotsIcon, XCircleIcon } from '@phosphor-icons/react'
import { Button, Card, EmptyState, LoadingSkeleton, NoteActionModal } from '@/components/ui'
import TicketProgressCard from '@/components/features/farm-owner/tickets/TicketProgressCard'
import TicketNotesCard from '@/components/features/farm-owner/tickets/TicketNotesCard'
import TicketInfoCard from '@/components/features/farm-owner/tickets/TicketInfoCard'
import TicketRatingCard from '@/components/features/farm-owner/tickets/TicketRatingCard'
import SupportTicketChat from '@/components/features/farm-owner/tickets/SupportTicketChat'
import { useCancelTicket, useTicket } from '@/hooks/shared/useTickets'
import { useFarmZones, useFarms } from '@/hooks/shared/useFarms'
import { usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { getApiErrorGroup } from '@/lib/apiError'
import { supportDict } from '@/constants/support.i18n'
import PriorityBadge from '@/components/common/PriorityBadge'
import TicketStatusBadge from '@/components/common/TicketStatusBadge'
import { formatTimestampsInText } from '@/lib/i18n'
import {
  SUPPORT_PATH, isTicketFinished, readableNoteText, ticketDescription, ticketOrigin, type SupportDetailState,
} from '@/components/features/farm-owner/tickets/tickets.constants'

// Trang chi tiết yêu cầu hỗ trợ của Farm Owner
export default function FarmOwnerTicketDetailPage() {
  const { t, dateTime } = useTranslation(supportDict)
  const detailState = useLocation().state as SupportDetailState | null
  const id = detailState?.ticketId
  const { data: ticket, isLoading, isError, error, refetch } = useTicket(id)
  const { data: farms } = useFarms()
  const { data: zones } = useFarmZones(ticket?.farm_id)
  const cancelTicket = useCancelTicket()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [showChat, setShowChat] = useState(detailState?.openChat ?? false)
  const [showCancel, setShowCancel] = useState(false)

  usePageBreadcrumb(ticket ? [{ label: t(`type.${ticket.type}`) }] : [])

  // Mở tab mới / copy link không mang theo history state → không biết ticket nào, về danh sách
  if (!id) return <Navigate to={SUPPORT_PATH} replace />

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <LoadingSkeleton className="h-32 w-full" />
        <LoadingSkeleton count={2} className="h-56 w-full" />
      </div>
    )
  }

  if (isError || !ticket) {
    // Không tìm thấy thì báo riêng; lỗi quyền, mạng, hệ thống thì báo không mở được kèm câu theo nhóm lỗi
    const isNotFound = !isError || getApiErrorGroup(error) === 'notFound'
    return (
      <EmptyState
        title={isNotFound ? t('detail.notFoundTitle') : t('detail.errorTitle')}
        description={isError ? apiErrorMessage(error) : t('detail.notFoundDesc')}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>
            <Link to={SUPPORT_PATH}><Button size="sm">{t('detail.backToList')}</Button></Link>
          </div>
        }
      />
    )
  }

  const farm = farms?.find(farmItem => farmItem._id === ticket.farm_id)
  const farmName = farm?.name ?? t('cell.unknownLocation')
  const zone = zones?.find(zone => zone._id === ticket.zone_id)
  const zoneLabel = zone ? `${zone.houseName} / ${zone.name}` : undefined
  const isOpen = ticket.status !== 'CLOSED'
  // Chỉ hiện mô tả người tạo nhập; ticket hệ thống tự sinh đã có dòng nguồn + nhật ký, không lặp lại
  const userDescription = ticketDescription(ticket)
  const description = userDescription ? readableNoteText(userDescription, formatTimestampsInText) : undefined

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={SUPPORT_PATH}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-warmGray shadow-card transition-colors hover:text-charcoal"
      >
        <ArrowLeftIcon size={14} weight="bold" />
        {t('list.title')}
      </Link>

      <Card size="lg" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Badge đầu trang có nhãn đi kèm: Trạng thái · Ưu tiên (cùng tên cột bảng danh sách) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium text-warmGray">{t('col.status')}</span>
              <TicketStatusBadge ticket={ticket} />
            </span>
            {/* Vạch ngăn giữa 2 cặp nhãn */}
            <span className="h-4 w-px bg-warmGray/30" aria-hidden />
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium text-warmGray">{t('col.priority')}</span>
              <PriorityBadge priority={ticket.priority} isMuted={isTicketFinished(ticket)} />
            </span>
          </div>
          <div>
            <h1 className="text-h1 text-charcoal">{t(`type.${ticket.type}`)}</h1>
            <p className="mt-1 text-sm text-warmGray">
              {farmName} · {zoneLabel ?? t('cell.wholeFarm')} · {t(`origin.${ticketOrigin(ticket)}`)} · {t('detail.createdAt', { time: dateTime(ticket.created_at) })}
            </p>
          </div>
          {description && <p className="max-w-2xl whitespace-pre-wrap break-words text-sm text-graphite">{description}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" className="hover:border-accent-600 hover:bg-accent-600" onClick={() => setShowChat(true)}>
            <ChatCircleDotsIcon size={16} weight="bold" />
            {t('detail.chat')}
          </Button>
          {/* Nút huỷ: chữ đỏ, rê chuột nền đỏ nhạt + viền đỏ (không về xám như nút phụ thường) */}
          {isOpen && (
            <Button variant="secondary" className="text-alertRed hover:border-alertRed/30 hover:bg-alertRed/10" onClick={() => setShowCancel(true)}>
              <XCircleIcon size={16} weight="bold" />
              {t('detail.cancel')}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <TicketProgressCard ticket={ticket} />
          <TicketNotesCard ticket={ticket} />
        </div>
        <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
          <TicketInfoCard ticket={ticket} farmName={farmName} zoneLabel={zoneLabel} farmAddress={farm?.address} />
          {ticket.status === 'CLOSED' && !ticket.cancelled_at && <TicketRatingCard ticket={ticket} />}
        </aside>
      </div>

      <SupportTicketChat ticketId={ticket._id} closed={!isOpen} open={showChat} onClose={() => setShowChat(false)} />

      <NoteActionModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={t('cancel.title')}
        label={t('cancel.label')}
        placeholder={ticket.type === 'INSTALLATION' ? t('cancel.phInstall') : t('cancel.phFault')}
        submitLabel={t('detail.cancel')}
        required
        danger
        loading={cancelTicket.isPending}
        onSubmit={reason => cancelTicket.mutate({ id: ticket._id, reason }, {
          onSuccess: () => { push(t('cancel.done')); setShowCancel(false) },
          onError: error => push(apiErrorMessage(error, t('cancel.failed')), 'error'),
        })}
      />
    </div>
  )
}
