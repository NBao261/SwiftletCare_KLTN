// RescheduleModal.tsx — B3: Sửa ngày hẹn khảo sát
// Fix: Promise.all → sequential (addNote CHỈ gọi sau khi updateScheduledDate thành công)
// Fix: bg-warmGray/8 → bg-warmGray/[0.08] (Tailwind v3.4 không có /8 trong opacity scale)
// TODO [BE-GAP]: PUT /tickets/:id/scheduled-date chưa có ở backend (grep tickets.route.ts: không có route này).
// Fix: disable nút submit + banner giải thích để Technician không điền form rồi nhận lỗi 404.
import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { formatDate } from '@/lib/helpers'
import type { Ticket } from '@/types'

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function RescheduleModal({ ticket, onClose }: Props) {
  const [newDate, setNewDate] = useState('')

  const today = new Date().toISOString().slice(0, 16)

  const autoNote = newDate
    ? `Technician đổi lịch từ ${
        ticket.scheduled_visit_at ? formatDate(ticket.scheduled_visit_at) : 'chưa đặt'
      } → ${formatDate(new Date(newDate).toISOString())}`
    : ''

  return (
    <Modal open onClose={onClose} title="Sửa ngày hẹn khảo sát">
      <div className="flex flex-col gap-4">
        {/* TODO [BE-GAP]: Banner thay thế nút submit — xoá khi có PUT /tickets/:id/scheduled-date */}
        <div className="flex items-start gap-3 rounded-xl border border-climateOrange/40 bg-climateOrange/[0.08] px-4 py-3">
          <span className="mt-0.5 shrink-0 text-climateOrange" aria-hidden="true">🔧</span>
          <div>
            <p className="text-sm font-semibold text-climateOrange">Tính năng đang phát triển</p>
            <p className="mt-0.5 text-xs text-climateOrange/80">
              Đổi ngày hẹn trực tiếp chưa khả dụng. Để thay đổi lịch khảo sát, liên hệ Admin
              — Admin có thể dùng chức năng <strong>Admin Override</strong> để cập nhật{' '}
              <code className="rounded bg-climateOrange/10 px-1 font-mono text-[11px]">scheduled_visit_at</code>.
            </p>
          </div>
        </div>

        {ticket.scheduled_visit_at && (
          <div className="rounded-xl bg-warmGray/[0.08] px-4 py-3">
            <p className="text-sm text-warmGray">Ngày hẹn hiện tại:</p>
            <p className="font-semibold text-charcoal">
              {formatDate(ticket.scheduled_visit_at)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="label-caption">Ngày hẹn mới (xem trước)</label>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">Ghi chú sẽ được tạo</p>
            <p className="mt-1 text-sm text-charcoal">{autoNote}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Đóng</Button>
          <Button
            disabled
            title="Tính năng đổi lịch đang phát triển — liên hệ Admin"
            className="flex-1 cursor-not-allowed opacity-40"
          >
            Xác nhận đổi lịch
          </Button>
        </div>
      </div>
    </Modal>
  )
}
