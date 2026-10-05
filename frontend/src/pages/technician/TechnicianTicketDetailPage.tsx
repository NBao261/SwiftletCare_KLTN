// Ticket Detail Page – TICKET-FR-001..004b/006/007/009/010/011
// Trang này dùng chung cho tất cả role — mỗi role nhìn thấy các phần UI khác nhau:
//   - Farm Owner / Admin: xem thông tin, huỷ, đánh giá, Admin can thiệp
//   - Technician: xem + cập nhật trạng thái, ghi chú, SAT checklist, chat, SLA breach banner
import { useState, useEffect, FormEvent } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useTicket, useAddTicketNote, useCancelTicket, useRateTicket, useEscalateTicket } from '@/hooks/shared/useTickets'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/common/usePermission'
import { usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { Button, Badge, Card, Textarea } from '@/components/ui'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { IconMessage, IconUser, IconCalendar, IconAlert, IconCheck } from '@/components/ui/icons'
import StarRating from '@/components/ui/StarRating'
import NoteActionModal from '@/components/ui/NoteActionModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
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
import { SLABreachBanner } from '@/components/features/technician/tickets/SLABreachBanner'
import { StatusStepper } from '@/components/features/technician/tickets/StatusStepper'
import { TicketChat } from '@/components/features/technician/tickets/TicketChat'
import { RemoteCommandPanel } from '@/components/features/technician/tickets/RemoteCommandPanel'

function assigneeName(assigned: string | { full_name: string; email: string } | undefined): string | undefined {
  return typeof assigned === 'object' ? assigned.full_name : undefined
}

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

      <Card>
        <div className="flex flex-col gap-5">
          {/* Top Row: Title & Badges (Left) + Buttons (Right) */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
                <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                {ticket.is_sla_breached && <Badge tone="danger">Vượt SLA</Badge>}
                {ticket.escalated_at && <Badge tone="danger">Đã báo Admin</Badge>}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h1>
                <p className="mt-1 text-sm font-medium text-warmGray">Tạo lúc {formatDate(ticket.created_at)}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {canTechAct && (
                <>
                  <Button variant="secondary" onClick={() => setShowChat(true)}>
                    <IconMessage className="mr-1.5 h-4 w-4" />
                    Trao đổi
                  </Button>
                  <Button onClick={() => setShowUpdateStatus(true)}>
                    {ticket.status === 'NEW' ? 'Tiếp nhận' : 'Cập nhật trạng thái'}
                  </Button>
                </>
              )}
              
              {menuItems.length > 0 && (
                <div className="ml-1 flex items-center border-l border-warmGray/20 pl-3">
                  <ActionsMenu items={menuItems} />
                </div>
              )}
            </div>
          </div>
          
          {/* Bottom Row: Inline Metadata */}
          <div className="flex flex-col gap-3 border-t border-warmGray/10 pt-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center gap-1.5">
                <IconUser className="h-4 w-4 text-warmGray" />
                <span className="text-warmGray">Phụ trách:</span>
                <span className="font-medium text-charcoal">{assigneeName(ticket.assigned_to) ?? 'Chưa gán'}</span>
              </div>
              {ticket.scheduled_visit_at && (
                <div className="flex items-center gap-1.5">
                  <IconCalendar className="h-4 w-4 text-warmGray" />
                  <span className="text-warmGray">Lịch hẹn:</span>
                  <span className="font-medium text-charcoal">{formatDate(ticket.scheduled_visit_at)}</span>
                </div>
              )}
              {ticket.sla_resolve_due_at && (
                <div className="flex items-center gap-1.5">
                  <IconCalendar className="h-4 w-4 text-warmGray" />
                  <span className="text-warmGray">Hạn xử lý (SLA):</span>
                  <span className={ticket.is_sla_breached ? 'font-semibold text-alertRed' : 'font-medium text-charcoal'}>
                    {formatDate(ticket.sla_resolve_due_at)}
                  </span>
                </div>
              )}
              {ticket.is_sla_response_breached && (
                <div className="flex items-center gap-1.5">
                  <IconAlert className="h-4 w-4 text-alertRed" />
                  <span className="font-semibold text-alertRed">Phản hồi trễ</span>
                </div>
              )}
              {ticket.responded_at && (
                <div className="flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-warmGray" />
                  <span className="text-warmGray">Tiếp nhận lúc:</span>
                  <span className="font-medium text-charcoal">{formatDate(ticket.responded_at)}</span>
                </div>
              )}
            </div>
            {ticket.escalation_reason && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm ring-1 ring-inset ring-red-500/20">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-alertRed" />
                <span className="text-alertRed"><span className="font-bold">Lý do báo Admin:</span> {ticket.escalation_reason}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Technician: SLA Breach Banner */}
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

      {/* Technician: Status Stepper */}
      <StatusStepper current={ticket.status} />

      {/* Technician: Lệnh từ xa */}
      {canTechAct && <RemoteCommandPanel ticket={ticket} />}

      {fieldVisit && (
        <SATChecklist ticketId={ticket._id} checklist={ticket.sat_checklist} readOnly={!canTechAct} />
      )}

      <NotesTimeline ticketId={ticket._id} notes={ticket.notes} />

      {/* Chat realtime (socket + REST) — Drawer trượt từ cạnh phải */}
      <TicketChat
        ticketId={ticket._id}
        closed={ticket.status === 'CLOSED'}
        canSend={!isTechnician || isAssignee}
        open={showChat}
        onClose={() => setShowChat(false)}
      />

      {ticket.status === 'CLOSED' && (
        <RatingCard ticketId={ticket._id} existingRating={ticket.satisfaction_rating} />
      )}

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

function EscalateModal({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const escalate = useEscalateTicket()
  const push = useToastStore(s => s.push)
  return (
    <NoteActionModal
      open={open}
      onClose={onClose}
      title="Báo Admin hỗ trợ"
      label="Lý do cần Admin hỗ trợ"
      placeholder="VD: Cần vật tư, không liên lạc được chủ trại, vượt khả năng xử lý..."
      submitLabel="Gửi báo cáo"
      loading={escalate.isPending}
      onSubmit={(reason) => {
        escalate.mutate({ id: ticketId, reason: reason || undefined }, {
          onSuccess: () => { push('Đã báo Admin'); onClose() },
          onError: (err) => push(getApiErrorMessage(err, 'Báo Admin thất bại'), 'error'),
        })
      }}
    />
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
