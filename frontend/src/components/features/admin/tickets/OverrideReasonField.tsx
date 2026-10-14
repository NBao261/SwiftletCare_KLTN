// TICKET-FR-005b — phần dùng chung của 3 modal can thiệp (ChangePriorityModal, ReassignTicketModal,
// RescheduleModal), cùng gọi PUT /tickets/:id/admin-override. Mỗi modal bắt buộc "Lý do":
// backend ghi thành note "Admin can thiệp: ..." + audit TICKET_ADMIN_OVERRIDE.
import type { FormEvent, ReactNode } from 'react'
import { Button, Modal, ModalHeader, MODAL_SECTION_TITLE, ModalSummaryRow, Textarea } from '@/components/ui'
import { formatDayTime } from '@/lib/helpers'
import { t } from '@/i18n'
import { TICKET_TYPE_LABEL } from '@/constants/tickets'
import { PRIORITY_LABEL } from '@/constants/sla'
import { technicianName } from '@/components/features/admin/tickets/ticketColumns'
import type { Ticket } from '@/types'

/** Props chung của 3 modal can thiệp */
export interface OverrideModalProps { open: boolean; onClose: () => void; ticket: Ticket }

export const REASON_EMPTY = 'Chưa nhập lý do'

const REASON_PLACEHOLDER = 'VD: Farm Owner báo mất điện toàn khu, cần xử lý trong hôm nay...'

/** Ô lý do dùng chung 3 modal — required, lỗi hiện cùng hàng nhãn (không làm popup cao thêm) */
export default function OverrideReasonField({ value, onChange, error, rows = 3 }: { value: string; onChange: (v: string) => void; error?: string; rows?: number }) {
  return (
    <Textarea
      label="Lý do can thiệp"
      required
      rows={rows}
      placeholder={REASON_PLACEHOLDER}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error}
      errorInLabel
    />
  )
}

/**
 * Khung ngang chung 3 popup can thiệp — cùng bố cục popup Tạo ticket: tiêu đề + thanh ngăn trải ngang, dưới là
 * 2 cột: trái = tình trạng HIỆN TẠI của ticket (để so trước khi đổi), phải = phần thay đổi (`children`) + lý do + nút.
 */
export function OverrideModalLayout({
  open, onClose, ticket, title, description, onSubmit, submitLabel, loading, disabled, reason, reasonRows,
  children,
}: OverrideModalProps & {
  title: string
  description: string
  onSubmit: (e: FormEvent) => void
  submitLabel: string
  loading?: boolean
  disabled?: boolean
  reason: { value: string; onChange: (v: string) => void; error?: string }
  /** Số dòng ô lý do (mặc định 3) — popup có bảng chọn ngày giờ nổi đè tăng lên để bảng nằm gọn, không sát đáy */
  reasonRows?: number
  children: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} size="xl" ariaLabel={title}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title={title} description={description} />

        <div className="flex gap-6">
          {/* Trái: tình trạng hiện tại */}
          <div className="w-60 shrink-0 border-r border-gray-200 pr-5">
            <h3 className={MODAL_SECTION_TITLE}>{t('Hiện tại')}</h3>
            <dl className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <ModalSummaryRow label="Ticket">{TICKET_TYPE_LABEL[ticket.type]}</ModalSummaryRow>
              <ModalSummaryRow label="Độ ưu tiên">{PRIORITY_LABEL[ticket.priority]}</ModalSummaryRow>
              <ModalSummaryRow label="Kỹ thuật viên">{technicianName(ticket) ?? 'Chưa phân công'}</ModalSummaryRow>
              <ModalSummaryRow label="Lịch hẹn">{ticket.scheduled_visit_at ? formatDayTime(ticket.scheduled_visit_at) : 'Chưa hẹn'}</ModalSummaryRow>
            </dl>
          </div>

          {/* Phải: thay đổi + lý do, nút ở đáy */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <section>
              <h3 className={MODAL_SECTION_TITLE}>{t('Thay đổi')}</h3>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">{children}</div>
            </section>
            <section>
              <h3 className={MODAL_SECTION_TITLE}>{t('Lý do')}</h3>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <OverrideReasonField {...reason} rows={reasonRows} />
              </div>
            </section>
            <div className="mt-auto flex justify-end">
              <Button type="submit" loading={loading} disabled={disabled}>{submitLabel}</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
