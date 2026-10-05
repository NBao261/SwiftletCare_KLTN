// ReassignModal.tsx — B2: Yêu cầu gán lại Ticket (Flow 9 case 4a, TICKET-FR-005)
// Fix: Disable khi ticket CLOSED
// Gọi POST /tickets/:id/reassign-request — router chọn Technician khác trong vùng (loại người xin và những
// người đã từng bị chuyển khỏi ticket), ticket về NEW; không còn ai phù hợp thì vào hàng đợi chung
// và Admin được báo. KHÁC `escalate` (chỉ báo Admin, vẫn giữ ticket, không tính vi phạm SLA).
// Dùng chung: TechnicianTicketsPage + TechnicianTicketDetailPage
import { useState } from 'react'
import { useRequestReassign } from '@/hooks/shared/useTickets'
import { Button, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { Ticket } from '@/types'

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function ReassignModal({ ticket, onClose }: Props) {
  const push = useToastStore(s => s.push)
  const [reason, setReason] = useState('')

  const isClosed = ticket.status === 'CLOSED'

  const mut = useRequestReassign()

  function handleSubmit() {
    mut.mutate(
      { id: ticket._id, reason: reason.trim() },
      {
        onSuccess: () => {
          push('Đã gửi yêu cầu — ticket được chuyển cho Technician khác hoặc vào hàng đợi chung')
          onClose()
        },
        onError: (err) => push(getApiErrorMessage(err, 'Gửi yêu cầu gán lại thất bại'), 'error'),
      },
    )
  }

  const isValid = reason.trim().length >= 10

  return (
    <Modal open onClose={onClose} title="Yêu cầu gán lại Ticket">
      <div className="flex flex-col gap-4">
        {/* Cảnh báo nếu ticket đã CLOSED */}
        {isClosed && (
          <div className="rounded-xl border border-alertRed/20 bg-alertRed/[0.08] px-4 py-3">
            <p className="text-sm font-semibold text-alertRed">
              ⚠️ Ticket đã đóng — không thể yêu cầu gán lại
            </p>
          </div>
        )}

        <Textarea
          label="Lý do yêu cầu gán lại"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Mô tả lý do bạn không thể xử lý ticket này (tối thiểu 10 ký tự)..."
          rows={4}
          disabled={isClosed}
        />
        <p className={`-mt-2 text-right text-xs ${reason.trim().length < 10 ? 'text-climateOrange' : 'text-warmGray'}`}>
          {reason.trim().length < 10 ? `Còn thiếu ${10 - reason.trim().length} ký tự (tối thiểu 10)` : 'Sẵn sàng gửi'}
        </p>

        {!isClosed && (
          <div className="rounded-xl border border-limeMist/40 bg-limeMist/10 px-4 py-3">
            <p className="text-sm font-semibold text-charcoal">
              ℹ️ Điều gì sẽ xảy ra sau khi gửi
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-charcoal/80">
              <li>• Hệ thống tự chọn một Technician khác trong khu vực; bạn không còn phụ trách ticket này</li>
              <li>• Ticket quay về trạng thái “Mới” — người nhận phải tiếp nhận lại từ đầu</li>
              <li>• Không còn ai phù hợp: ticket vào hàng đợi chung và Admin được báo để điều phối</li>
              <li>• Không tính là vi phạm SLA. Nếu chỉ cần Admin hỗ trợ mà vẫn giữ ticket, hãy dùng “Báo Admin (Escalate)”</li>
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button
            onClick={handleSubmit}
            loading={mut.isPending}
            disabled={!isValid || isClosed}
            className="flex-1"
          >
            Gửi yêu cầu gán lại
          </Button>
        </div>
      </div>
    </Modal>
  )
}
