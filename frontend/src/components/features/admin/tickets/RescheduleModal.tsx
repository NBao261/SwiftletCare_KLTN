import { useState, useEffect, FormEvent } from 'react'
import { useAdminOverrideTicket } from '@/hooks/shared/useTickets'
import { Button, Modal } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage, toLocalDateTimeInput } from '@/lib/helpers'
import DateTimePicker from '@/components/common/DateTimePicker'
import { validateReschedule } from '@/validations/common/schedule.validation'
import OverrideReasonField, { REASON_EMPTY, type OverrideModalProps } from '@/components/features/admin/tickets/OverrideReasonField'

/**
 * ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ máy người dùng.
 * `iso.slice(0, 16)` cắt thẳng chuỗi UTC nên lệch 7 tiếng ở VN.
 */

/** TICKET-FR-005b — Admin đổi ngày giờ hẹn của ticket */
export default function RescheduleModal({ open, onClose, ticket }: OverrideModalProps) {
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setScheduledAt(ticket.scheduled_visit_at ? toLocalDateTimeInput(ticket.scheduled_visit_at) : '')
      setReason(''); setSubmitted(false)
    }
  }, [open, ticket.scheduled_visit_at])

  const reasonError = submitted && !reason.trim() ? REASON_EMPTY : undefined
  const scheduleError = submitted ? validateReschedule(scheduledAt) : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (validateReschedule(scheduledAt) || !reason.trim()) return
    override.mutate({ id: ticket._id, scheduled_visit_at: new Date(scheduledAt).toISOString(), reason: reason.trim() }, {
      onSuccess: () => { push('Đã đổi lịch hẹn'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Đổi lịch hẹn thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Đổi lịch hẹn">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reschedule-at" className="label-caption">
            Ngày giờ hẹn mới<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          {/* min: bảng chọn làm mờ mốc đã qua; popup mở lâu thì "bây giờ" trôi đi nên validateReschedule chặn lần nữa khi lưu */}
          <DateTimePicker
            id="reschedule-at"
            ariaLabel="Ngày giờ hẹn mới"
            min={new Date()}
            value={scheduledAt}
            onChange={setScheduledAt}
            invalid={!!scheduleError}
          />
          {scheduleError && <span className="text-xs text-alertRed">{scheduleError}</span>}
        </div>
        <OverrideReasonField value={reason} onChange={setReason} error={reasonError} />
        <Button type="submit" loading={override.isPending} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
