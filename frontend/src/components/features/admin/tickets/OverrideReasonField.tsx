// TICKET-FR-005b — phần dùng chung của 3 modal can thiệp (ChangePriorityModal, ReassignTicketModal,
// RescheduleModal), cùng gọi PUT /tickets/:id/admin-override. Mỗi modal bắt buộc "Lý do":
// backend ghi thành note "Admin can thiệp: ..." + audit TICKET_ADMIN_OVERRIDE.
import { Textarea } from '@/components/ui'
import type { Ticket } from '@/types'

/** Props chung của 3 modal can thiệp */
export interface OverrideModalProps { open: boolean; onClose: () => void; ticket: Ticket }

export const REASON_EMPTY = 'Chưa nhập lý do — lý do được ghi vào lịch sử ticket và nhật ký hệ thống'

const REASON_PLACEHOLDER = 'VD: Farm Owner báo mất điện toàn khu, cần xử lý trong hôm nay...'

/** Ô lý do dùng chung 3 modal — required + báo lỗi sau khi bấm submit */
export default function OverrideReasonField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Textarea
      label="Lý do can thiệp"
      required
      rows={2}
      placeholder={REASON_PLACEHOLDER}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error}
    />
  )
}
