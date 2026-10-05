// ScheduleVisitModal.tsx — TICKET-FR-004b + Flow 9 bước 6b: Technician được gán hẹn/dời giờ đến hiện trường.
// Cùng khuôn UI với admin/tickets/RescheduleModal (Modal + DateTimePicker + Textarea + nút "Lưu") để hai
// role nhìn giống nhau; khác ở endpoint (PUT /tickets/:id/scheduled-date) và nhãn lý do.
import { useState, useEffect, FormEvent } from 'react'
import { useScheduleVisit } from '@/hooks/shared/useTickets'
import { Button, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import DateTimePicker from '@/components/features/admin/tickets/DateTimePicker'
import { validateReschedule } from '@/validations/admin/ticket.validation'
import type { Ticket } from '@/types'

/** ISO (UTC) → giá trị cho DateTimePicker theo giờ máy người dùng */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

interface Props { open: boolean; onClose: () => void; ticket: Ticket }

export function ScheduleVisitModal({ open, onClose, ticket }: Props) {
  const schedule = useScheduleVisit()
  const push = useToastStore(s => s.push)
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isReschedule = Boolean(ticket.scheduled_visit_at)

  useEffect(() => {
    if (open) {
      setScheduledAt(ticket.scheduled_visit_at ? toLocalDateTimeInput(ticket.scheduled_visit_at) : '')
      setReason(''); setSubmitted(false)
    }
  }, [open, ticket.scheduled_visit_at])

  const scheduleError = submitted ? validateReschedule(scheduledAt) : undefined
  const reasonError = submitted && !reason.trim()
    ? 'Chưa nhập lý do — Farm Owner được báo kèm lý do này'
    : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (validateReschedule(scheduledAt) || !reason.trim()) return
    schedule.mutate(
      { id: ticket._id, scheduledVisitAt: new Date(scheduledAt).toISOString(), reason: reason.trim() },
      {
        onSuccess: () => { push(isReschedule ? 'Đã dời lịch hẹn' : 'Đã hẹn lịch đến hiện trường'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Cập nhật lịch hẹn thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={isReschedule ? 'Dời lịch hẹn' : 'Hẹn lịch đến hiện trường'}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="visit-at" className="label-caption">
            Ngày giờ hẹn{isReschedule ? ' mới' : ''}<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <DateTimePicker
            id="visit-at"
            ariaLabel="Ngày giờ hẹn"
            min={new Date()}
            value={scheduledAt}
            onChange={setScheduledAt}
            invalid={!!scheduleError}
          />
          {scheduleError
            ? <span className="text-xs text-alertRed">{scheduleError}</span>
            : <span className="text-xs text-warmGray">Khung giờ hẹn 07:00–18:00 (giờ Việt Nam).</span>}
        </div>
        <Textarea
          id="visit-reason"
          label="Lý do"
          required
          rows={2}
          placeholder="VD: Chủ trại vắng buổi sáng, hẹn lại buổi chiều..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          error={reasonError}
        />
        <Button type="submit" loading={schedule.isPending} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
