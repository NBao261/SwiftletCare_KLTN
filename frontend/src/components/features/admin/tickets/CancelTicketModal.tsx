import { useCancelTicket } from '@/hooks/shared/useTickets'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'

/** PUT /tickets/:id/cancel (FARM_OWNER, ADMIN) — bắt buộc lý do, trên AdminTicketDetailPage */
export default function CancelTicketModal({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const cancelTicket = useCancelTicket()
  const push = useToastStore(s => s.push)

  return (
    <NoteActionModal
      open={open}
      onClose={onClose}
      title="Hủy ticket"
      label="Lý do hủy"
      placeholder="VD: Tạo trùng, sự cố đã được xử lý ở ticket khác..."
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
