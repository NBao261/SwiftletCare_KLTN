// Ticket Detail Page – TICKET-FR-001..004b/006/007/009/010/011
// Trang này dùng chung cho tất cả role — mỗi role nhìn thấy các phần UI khác nhau:
//   - Farm Owner / Admin: xem thông tin, huỷ, đánh giá, Admin can thiệp
//   - Technician: xem + cập nhật trạng thái, ghi chú, SAT checklist, chat, SLA breach banner
import { useState, useEffect, FormEvent } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useTicket, useAddTicketNote, useCancelTicket, useRateTicket } from '@/hooks/shared/useTickets'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/common/usePermission'
import { usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { Button, Badge, Card, Textarea } from '@/components/ui'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { IconUser, IconCalendar, IconAlert, IconCheck } from '@/components/ui/icons'
import StarRating from '@/components/ui/StarRating'
import NoteActionModal from '@/components/ui/NoteActionModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import { PRIORITY_LABEL } from '@/constants/sla'
// RescheduleModal gated by canAdminIntervene (ADMIN) — owned by admin/tickets/ per rule 12.7
// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Ảnh hưởng Technician: chỉ đổi đường import — file AdminOverrideModals.tsx cũ đã tách thành 3 file modal riêng; giao diện/logic trang không đổi.
import ChangePriorityModal from '@/components/features/admin/tickets/ChangePriorityModal'
import ReassignTicketModal from '@/components/features/admin/tickets/ReassignTicketModal'
import RescheduleModal from '@/components/features/admin/tickets/RescheduleModal'
// ── Technician components ───────────────────────────────────────────────────
import { SATChecklist } from '@/components/features/technician/tickets/SATChecklist'
import { UpdateStatusModal } from '@/components/features/technician/tickets/UpdateStatusModal'
import { ReassignModal as TechnicianReassignModal } from '@/components/features/technician/tickets/ReassignModal'
import { isTicketAssignee, requiresFieldVisit, canScheduleVisit } from '@/components/features/technician/tickets/ticketHelpers'
import { ScheduleVisitModal } from '@/components/features/technician/tickets/ScheduleVisitModal'
import { EscalateModal } from '@/components/features/technician/tickets/EscalateModal'
import { SLABreachBanner } from '@/components/features/technician/tickets/SLABreachBanner'
import { StatusStepper } from '@/components/features/technician/tickets/StatusStepper'
import { TicketChat } from '@/components/features/technician/tickets/TicketChat'
import { RemoteCommandPanel } from '@/components/features/technician/tickets/RemoteCommandPanel'

function assigneeName(assigned: string | { full_name: string; email: string } | undefined): string | undefined {
  return typeof assigned === 'object' ? assigned.full_name : undefined
}

// Màu nền header theo mức ưu tiên — chỉ dùng màu trong thang thiết kế (đỏ/cam/xám), độ đậm rất nhạt
const HEADER_TINT = {
  P1: 'from-alertRed/[0.08]',
  P2: 'from-climateOrange/[0.09]',
  P3: 'from-warmGray/[0.07]',
} as const

export default function TechnicianTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ticket, isLoading } = useTicket(id)
  const [showCancel, setShowCancel] = useState(false)
  const [showChangePriority, setShowChangePriority] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  // Technician actions (BE assertAssignee: chỉ KTV đang được gán mới được thao tác)
  const [showUpdateStatus, setShowUpdateStatus] = useState(false)
  const [showTechReassign, setShowTechReassign] = useState(false)
  const [showEscalate, setShowEscalate] = useState(false)
  const [showScheduleVisit, setShowScheduleVisit] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useToastStore(s => s.push)
  const isTechnician = usePermission('TECHNICIAN')
  const currentUserId = useAuthStore(s => s.user?._id)
  // Backend: PUT /tickets/:id/cancel và POST /tickets/:id/rating chỉ cho FARM_OWNER, ADMIN
  const canManageTicket = usePermission('FARM_OWNER', 'ADMIN')
  // TICKET-FR-005b — quyền can thiệp thường trực của Admin trên MỌI ticket, bất
  // kể trạng thái/SLA (không gate theo status !== 'CLOSED' như canCancel).
  // 3 modal ở features/admin/tickets/ (ChangePriority/ReassignTicket/Reschedule), cùng gọi PUT /tickets/:id/admin-override.
  const canAdminIntervene = usePermission('ADMIN')
  // Breadcrumb AppHeader: "Ticket / <loại> #<6 ký tự cuối id>" — dẫn xuất từ chính route :id, không có API riêng trả "tiêu đề" ticket
  usePageBreadcrumb(ticket ? [{ label: `${TICKET_TYPE_LABEL[ticket.type]} #${ticket._id.slice(-6)}` }] : [])

  // Menu "..." của danh sách (TicketCard) dẫn tới `?action=reschedule` — mở sẵn modal rồi xoá param để F5 không mở lại
  const wantsReschedule = searchParams.get('action') === 'reschedule'
  useEffect(() => {
    if (!wantsReschedule || !ticket) return
    if (isTechnician && isTicketAssignee(ticket, currentUserId) && canScheduleVisit(ticket)) setShowScheduleVisit(true)
    else if (isTechnician) pushToast('Chỉ kỹ thuật viên đang phụ trách mới hẹn/dời lịch được, và ticket sự cố cần ở trạng thái "Đang xử lý".', 'error')
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsReschedule, ticket?._id])

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />
  if (!ticket) return <EmptyState title="Không tìm thấy ticket" description="Ticket có thể đã bị xoá hoặc bạn không có quyền xem." />

  const fieldVisit = requiresFieldVisit(ticket)
  const isAssignee = isTicketAssignee(ticket, currentUserId)
  const canTechAct = isTechnician && isAssignee && ticket.status !== 'CLOSED'
  const canCancel = canManageTicket && ticket.status !== 'CLOSED'

  const menuItems: ActionsMenuItem[] = []

  if (canTechAct) {
    menuItems.push({ label: 'Xin gán lại', onClick: () => setShowTechReassign(true) })
    if (canScheduleVisit(ticket)) {
      menuItems.push({ label: ticket.scheduled_visit_at ? 'Dời lịch hẹn' : 'Hẹn lịch hiện trường', onClick: () => setShowScheduleVisit(true) })
    }
    if (!ticket.escalated_at) {
      menuItems.push({ label: 'Báo Admin', danger: true, onClick: () => setShowEscalate(true) })
    }
  }

  if (canAdminIntervene) {
    menuItems.push({ label: 'Đổi ưu tiên (Admin)', onClick: () => setShowChangePriority(true) })
    menuItems.push({ label: 'Gán lại KTV (Admin)', onClick: () => setShowReassign(true) })
    menuItems.push({ label: 'Đổi lịch hẹn (Admin)', onClick: () => setShowReschedule(true) })
  }

  if (canCancel) {
    menuItems.push({ label: 'Hủy ticket', danger: true, onClick: () => setShowCancel(true) })
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/tickets"
        className="group inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-warmGray shadow-sm ring-1 ring-inset ring-warmGray/10 transition-all hover:bg-warmGray/5 hover:text-charcoal"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
        Quay lại danh sách
      </Link>

      {/* Header ticket */}
      <section className="relative w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-warmGray/10">
        {/* Nền trang trí (z-0): gradient theo ưu tiên + lưới chấm mờ, phủ dần về phía phải */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-r ${ticket.status === 'CLOSED' ? 'from-warmGray/[0.05]' : HEADER_TINT[ticket.priority]} to-transparent`} />
        </div>
        <div className="relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-graphite/5 px-2 py-0.5 tabular-nums text-xs font-semibold tracking-wider text-warmGray">
                #{ticket._id.slice(-6).toUpperCase()}
              </span>
              <Badge tone={PRIORITY_TONE[ticket.priority]}>Ưu tiên {PRIORITY_LABEL[ticket.priority].toLowerCase()}</Badge>
              <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
              {ticket.escalated_at && <Badge tone="critical">Đã báo Admin</Badge>}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h1>
              <p className="mt-1 text-sm text-warmGray">Tạo lúc {formatDate(ticket.created_at)}</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Chat: mọi role có quyền xem ticket đều mở được (KTV không phụ trách chỉ xem — canSend gate trong TicketChat) */}
            <Button variant="secondary" onClick={() => setShowChat(true)}>
              Trao đổi
            </Button>
            {canTechAct && (
              <Button onClick={() => setShowUpdateStatus(true)}>
                {ticket.status === 'NEW' ? 'Tiếp nhận' : 'Cập nhật trạng thái'}
              </Button>
            )}
            {menuItems.length > 0 && (
              <div className="ml-1 flex items-center border-l border-warmGray/20 pl-3">
                <ActionsMenu items={menuItems} />
              </div>
            )}
          </div>
        </div>
        {ticket.escalation_reason && (
          <div className="mx-6 mb-6 ml-8 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm ring-1 ring-inset ring-red-500/20">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-alertRed" />
            <span className="text-alertRed"><span className="font-bold">Lý do báo Admin:</span> {ticket.escalation_reason}</span>
          </div>
        )}
      </section>

      {/* Thân trang: 2 cột — nội dung xử lý (trái) | thông tin & SLA (phải) */}
      <div className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {ticket.is_sla_breached && (
            <SLABreachBanner
              escalated={Boolean(ticket.escalated_at)}
              onEscalate={canTechAct ? () => setShowEscalate(true) : undefined}
            />
          )}

          {isTechnician && !isAssignee && ticket.status !== 'CLOSED' && (
            <p className="rounded-xl bg-warmGray/10 px-4 py-3 text-sm text-warmGray">
              {ticket.assigned_to
                ? 'Ticket này do kỹ thuật viên khác phụ trách — bạn chỉ có thể xem.'
                : 'Ticket chưa được gán cho ai — bạn chỉ có thể xem. Admin sẽ phân công.'}
            </p>
          )}

          <StatusStepper current={ticket.status} />
          {canTechAct && <RemoteCommandPanel ticket={ticket} />}
          {fieldVisit && (
            <SATChecklist ticketId={ticket._id} checklist={ticket.sat_checklist} readOnly={!canTechAct} />
          )}
          <NotesTimeline ticketId={ticket._id} notes={ticket.notes} />
        </div>

        {/* Cột phải: thông tin nhanh, sticky trên desktop */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
          <Card>
            <p className="label-caption mb-4">Thông tin ticket</p>
            <dl className="flex flex-col divide-y divide-warmGray/10 text-sm">
              <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <dt className="flex items-center gap-2 text-warmGray"><IconUser className="h-4 w-4" />Phụ trách</dt>
                <dd className="font-medium text-charcoal">{assigneeName(ticket.assigned_to) ?? 'Chưa gán'}</dd>
              </div>
              {ticket.scheduled_visit_at && (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-warmGray"><IconCalendar className="h-4 w-4" />Lịch hẹn</dt>
                  <dd className="font-medium text-charcoal">{formatDate(ticket.scheduled_visit_at)}</dd>
                </div>
              )}
              {ticket.responded_at && (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-warmGray"><IconCheck className="h-4 w-4" />Tiếp nhận</dt>
                  <dd className="font-medium text-charcoal">{formatDate(ticket.responded_at)}</dd>
                </div>
              )}
              {ticket.sla_resolve_due_at && (
                <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
                  <dt className="flex items-center gap-2 text-warmGray"><IconCalendar className="h-4 w-4" />Hạn SLA</dt>
                  <dd className={ticket.is_sla_breached ? 'font-semibold text-alertRed' : 'font-medium text-charcoal'}>
                    {formatDate(ticket.sla_resolve_due_at)}
                  </dd>
                </div>
              )}
            </dl>
            {ticket.is_sla_response_breached && (
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-alertRed ring-1 ring-inset ring-red-500/20">
                <IconAlert className="h-3.5 w-3.5" />
                Phản hồi trễ
              </span>
            )}
          </Card>

          {ticket.status === 'CLOSED' && (
            <RatingCard ticketId={ticket._id} existingRating={ticket.satisfaction_rating} />
          )}
        </aside>
      </div>


      {/* Chat realtime (socket + REST) — Drawer trượt từ cạnh phải */}
      <TicketChat
        ticketId={ticket._id}
        closed={ticket.status === 'CLOSED'}
        canSend={!isTechnician || isAssignee}
        open={showChat}
        onClose={() => setShowChat(false)}
      />



      <CancelTicketModal open={showCancel} onClose={() => setShowCancel(false)} ticketId={ticket._id} />
      {showUpdateStatus && <UpdateStatusModal ticket={ticket} onClose={() => setShowUpdateStatus(false)} />}
      {showTechReassign && <TechnicianReassignModal ticket={ticket} onClose={() => setShowTechReassign(false)} />}
      {canTechAct && <ScheduleVisitModal open={showScheduleVisit} onClose={() => setShowScheduleVisit(false)} ticket={ticket} />}
      <EscalateModal open={showEscalate} onClose={() => setShowEscalate(false)} ticketId={ticket._id} />
      {canAdminIntervene && (
        <>
          <ChangePriorityModal open={showChangePriority} onClose={() => setShowChangePriority(false)} ticket={ticket} />
          <ReassignTicketModal open={showReassign} onClose={() => setShowReassign(false)} ticket={ticket} />
          <RescheduleModal open={showReschedule} onClose={() => setShowReschedule(false)} ticket={ticket} />
        </>
      )}
    </div>
  )
}

function NotesTimeline({ ticketId, notes }: { ticketId: string; notes: Array<{ content: string; created_at: string }> }) {
  const addNote = useAddTicketNote()
  const push = useToastStore(s => s.push)
  const [content, setContent] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addNote.mutate({ id: ticketId, content }, {
      onSuccess: () => setContent(''),
      onError: (err) => push(getApiErrorMessage(err, 'Thêm ghi chú thất bại'), 'error'),
    })
  }

  return (
    <Card>
      <p className="label-caption mb-3">Lịch sử xử lý</p>
      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-sm text-warmGray">Chưa có ghi chú nào.</p>}
        {notes.map((note, i) => (
          <div key={i} className="rounded-xl bg-warmGray/5 px-3.5 py-2.5">
            <p className="text-sm text-charcoal">{note.content}</p>
            <p className="mt-1 text-xs text-warmGray">{formatDate(note.created_at)}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-warmGray/10 pt-4">
        <Textarea placeholder="Thêm ghi chú..." value={content} onChange={e => setContent(e.target.value)} />
        <Button type="submit" variant="secondary" size="sm" loading={addNote.isPending} className="self-end">
          Thêm ghi chú
        </Button>
      </form>
    </Card>
  )
}

function RatingCard({ ticketId, existingRating }: { ticketId: string; existingRating?: number }) {
  const rateTicket = useRateTicket()
  const push = useToastStore(s => s.push)
  const [rating, setRating] = useState(existingRating ?? 0)
  // Backend: POST /tickets/:id/rating chỉ cho FARM_OWNER, ADMIN
  const canRate = usePermission('FARM_OWNER', 'ADMIN')

  if (existingRating) {
    return (
      <Card>
        <p className="label-caption mb-2">Bạn đã đánh giá</p>
        <StarRating value={existingRating} readOnly />
      </Card>
    )
  }

  if (!canRate) return null

  return (
    <Card>
      <p className="label-caption mb-2">Đánh giá mức độ hài lòng</p>
      <div className="flex items-center gap-4">
        <StarRating value={rating} onChange={setRating} />
        <Button
          size="sm" disabled={rating === 0} loading={rateTicket.isPending}
          onClick={() => rateTicket.mutate({ id: ticketId, rating }, {
            onSuccess: () => push('Đã gửi đánh giá, cảm ơn bạn!'),
            onError: (err) => push(getApiErrorMessage(err, 'Gửi đánh giá thất bại'), 'error'),
          })}
        >
          Gửi
        </Button>
      </div>
    </Card>
  )
}

function CancelTicketModal({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const cancelTicket = useCancelTicket()
  const push = useToastStore(s => s.push)

  return (
    <NoteActionModal
      open={open}
      onClose={onClose}
      title="Hủy ticket"
      label="Lý do hủy"
      placeholder="VD: Đã tự khắc phục được, không cần lắp nữa..."
      submitLabel="Hủy ticket"
      required
      danger
      loading={cancelTicket.isPending}
      onSubmit={(reason) => {
        cancelTicket.mutate({ id: ticketId, reason }, {
          onSuccess: () => { push('Đã hủy ticket'); onClose() },
          onError: (err) => push(getApiErrorMessage(err, 'Hủy ticket thất bại'), 'error'),
        })
      }}
    />
  )
}
