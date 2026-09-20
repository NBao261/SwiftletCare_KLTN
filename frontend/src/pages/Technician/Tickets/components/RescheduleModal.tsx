// RescheduleModal.tsx — B3: Sửa ngày hẹn khảo sát
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Button, Modal } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import type { Ticket } from '@/types'

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function RescheduleModal({ ticket, onClose }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const [newDate, setNewDate] = useState('')

  const today = new Date().toISOString().slice(0, 16)

  const autoNote = newDate
    ? `Technician đổi lịch từ ${
        ticket.scheduled_visit_at ? formatDate(ticket.scheduled_visit_at) : 'chưa đặt'
      } → ${formatDate(new Date(newDate).toISOString())}`
    : ''

  const mut = useMutation({
    mutationFn: () =>
      // Gọi song song: cập nhật ngày thật + thêm audit log ghi chú
      // updateScheduledDate cần BE endpoint PUT /tickets/:id/scheduled-date (xem tickets.ts)
      Promise.all([
        ticketApi.updateScheduledDate(ticket._id, newDate),
        ticketApi.addNote(ticket._id, autoNote),
      ]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Đã cập nhật ngày hẹn thành công')
      onClose()
    },
    onError: (err) => push(getApiErrorMessage(err, 'Đổi lịch thất bại'), 'error'),
  })

  return (
    <Modal open onClose={onClose} title="Sửa ngày hẹn khảo sát">
      <div className="flex flex-col gap-4">
        {ticket.scheduled_visit_at && (
          <div className="rounded-xl bg-warmGray/8 px-4 py-3">
            <p className="text-sm text-warmGray">Ngày hẹn hiện tại:</p>
            <p className="font-semibold text-charcoal line-through opacity-50">
              {formatDate(ticket.scheduled_visit_at)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="label-caption">Ngày hẹn mới</label>
          <input
            type="datetime-local"
            min={today}
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="input"
          />
        </div>

        {autoNote && (
          <div className="rounded-xl bg-limeMist/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">Ghi chú tự động</p>
            <p className="mt-1 text-sm text-charcoal">{autoNote}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={!newDate}
            className="flex-1"
          >
            Xác nhận đổi lịch
          </Button>
        </div>
      </div>
    </Modal>
  )
}
