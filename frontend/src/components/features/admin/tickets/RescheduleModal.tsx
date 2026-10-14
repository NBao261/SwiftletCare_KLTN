import { useState, useEffect, FormEvent } from 'react'
import { useAdminOverrideTicket } from '@/hooks/shared/useTickets'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage, toLocalDateTimeInput } from '@/lib/helpers'
import DateTimePicker from '@/components/common/DateTimePicker'
import { t } from '@/i18n'
import { validateReschedule } from '@/validations/common/schedule.validation'
import { OverrideModalLayout, REASON_EMPTY, type OverrideModalProps } from '@/components/features/admin/tickets/OverrideReasonField'

/** TICKET-FR-005b — Admin đổi ngày giờ hẹn của ticket */
export default function RescheduleModal({ open, onClose, ticket }: OverrideModalProps) {
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      // ISO (UTC) → giá trị datetime-local theo giờ máy người dùng (cắt thẳng chuỗi UTC sẽ lệch 7 tiếng ở VN)
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
    <OverrideModalLayout
      open={open}
      onClose={onClose}
      ticket={ticket}
      title="Đổi lịch hẹn"
      description="Giờ hẹn trong khung 7:00–18:00 (giờ Việt Nam)"
      onSubmit={handleSubmit}
      submitLabel="Lưu"
      loading={override.isPending}
      reason={{ value: reason, onChange: setReason, error: reasonError }}
    >
      <div className="flex flex-col gap-1.5">
        {/* Lỗi cùng hàng nhãn — hiện lỗi không làm popup cao thêm */}
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="reschedule-at" className="label-caption shrink-0">
            {t('Ngày giờ hẹn mới')}<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          {scheduleError && <span className="min-w-0 truncate text-xs text-alertRed" title={t(scheduleError)}>{t(scheduleError)}</span>}
        </div>
        {/* min: bảng chọn làm mờ mốc đã qua; popup mở lâu thì "bây giờ" trôi đi nên validateReschedule chặn lần nữa khi lưu */}
        <DateTimePicker
          id="reschedule-at"
          ariaLabel={t('Ngày giờ hẹn mới')}
          min={new Date()}
          value={scheduledAt}
          onChange={setScheduledAt}
          invalid={!!scheduleError}
        />
      </div>
    </OverrideModalLayout>
  )
}
