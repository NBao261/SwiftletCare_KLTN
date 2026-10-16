import { useState, useEffect, FormEvent } from 'react'
import { useAdminOverrideTicket } from '@/hooks/shared/useTickets'
import { useTechniciansList } from '@/hooks/admin/useUsers'
import { useFarm } from '@/hooks/shared/useFarms'
import { SelectMenu } from '@/components/ui'
import Field from '@/components/features/admin/tickets/SelectField'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { OverrideModalLayout, REASON_EMPTY, type OverrideModalProps } from '@/components/features/admin/tickets/OverrideReasonField'
import type { User } from '@/types'

/** Backend từ chối gán ngoài vùng bằng 400 + câu gợi ý cố định "Gửi kèm force=true..." (ticket.service.ts) */
function isOutOfRegionError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 400 && getApiErrorMessage(err, '').includes('force=true')
}

function coversRegion(technician: User, farmRegion: string | undefined): boolean | undefined {
  if (!farmRegion) return undefined // farm chưa đặt region → không biết, để backend quyết
  return (technician.assigned_regions ?? []).includes(farmRegion)
}

/** TICKET-FR-005b — Admin gán lại kỹ thuật viên; ngoài vùng phụ trách thì hỏi lại rồi gửi force=true */
export default function ReassignTicketModal({ open, onClose, ticket }: OverrideModalProps) {
  const { records: technicians, truncated, total, isLoading } = useTechniciansList()
  const { data: farm } = useFarm(ticket.farm_id)
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [technicianId, setTechnicianId] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  /** Thông điệp cảnh báo ngoài vùng đang chờ Admin xác nhận "Vẫn gán" (force=true) */
  const [forceConfirm, setForceConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setTechnicianId(''); setReason(''); setSubmitted(false); setForceConfirm(null) }
  }, [open])

  const currentAssigneeId = typeof ticket.assigned_to === 'object' ? ticket.assigned_to._id : ticket.assigned_to
  const selected = technicians.find(t => t._id === technicianId)
  const reasonError = submitted && !reason.trim() ? REASON_EMPTY : undefined

  function send(force: boolean) {
    override.mutate({ id: ticket._id, assigned_to: technicianId, reason: reason.trim(), force: force || undefined }, {
      onSuccess: () => { push('Đã gán lại kỹ thuật viên'); onClose() },
      onError: (err) => {
        // Chưa force mà backend chặn vì ngoài vùng → hỏi lại thay vì chỉ báo lỗi
        if (!force && isOutOfRegionError(err)) setForceConfirm(t('{{name}} không phụ trách khu vực của farm (hoặc farm chưa được gán khu vực). Nếu vẫn gán, kỹ thuật viên này sẽ không tự mở được ticket cho đến khi được thêm vùng phụ trách.', { name: selected?.full_name ?? t('Kỹ thuật viên này') }))
        else push(getApiErrorMessage(err, 'Gán lại kỹ thuật viên thất bại'), 'error')
      },
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!selected || !reason.trim()) return
    // Biết trước là ngoài vùng (đã có region của farm) thì hỏi luôn, khỏi mất 1 vòng 400
    if (coversRegion(selected, farm?.region) === false) {
      const regions = selected.assigned_regions?.join(', ') || t('chưa gán vùng nào')
      setForceConfirm(t('{{name}} phụ trách {{regions}}, không khớp khu vực "{{region}}" của farm. Nếu vẫn gán, kỹ thuật viên này sẽ không tự mở được ticket cho đến khi được thêm vùng phụ trách.', { name: selected.full_name, regions, region: farm?.region }))
      return
    }
    send(false)
  }

  return (
    <>
      <OverrideModalLayout
        open={open && !forceConfirm}
        onClose={onClose}
        ticket={ticket}
        title="Gán lại kỹ thuật viên"
        description={farm?.region ? t('Khu vực của farm: {{region}}', { region: farm.region }) : 'Farm chưa được gán khu vực'}
        onSubmit={handleSubmit}
        submitLabel="Gán lại"
        loading={override.isPending}
        reason={{ value: reason, onChange: setReason, error: reasonError }}
      >
        {/* SelectMenu không có option disabled nên người đang phụ trách bị loại khỏi danh sách (tên ở cột Hiện tại) */}
        <Field label="Kỹ thuật viên mới" required errorInLabel error={submitted && !technicianId ? 'Chưa chọn kỹ thuật viên' : undefined}>
          <SelectMenu
            field
            ariaLabel="Kỹ thuật viên mới"
            disabled={isLoading}
            invalid={submitted && !technicianId}
            value={technicianId}
            onChange={setTechnicianId}
            options={[
              { value: '', label: isLoading ? 'Đang tải...' : '-- Chọn kỹ thuật viên --' },
              ...technicians
                .filter(u => u._id !== currentAssigneeId)
                .map(u => {
                  const outOfRegion = coversRegion(u, farm?.region) === false
                  const regions = u.assigned_regions?.length ? ` (${u.assigned_regions.join(', ')})` : ''
                  return { value: u._id, label: `${u.full_name}${regions}${outOfRegion ? ` — ${t('ngoài vùng')}` : ''}` }
                }),
            ]}
          />
        </Field>
        {truncated && (
          <p className="mt-2 text-small text-warmGray">
            {t('Chỉ liệt kê {{shown}}/{{total}} kỹ thuật viên đầu tiên.', { shown: technicians.length, total })}
          </p>
        )}
      </OverrideModalLayout>

      <ConfirmModal
        open={open && !!forceConfirm}
        title="Kỹ thuật viên ngoài vùng phụ trách"
        description={forceConfirm ?? undefined}
        confirmLabel="Vẫn gán"
        danger
        loading={override.isPending}
        onConfirm={() => send(true)}
        onCancel={() => setForceConfirm(null)}
      />
    </>
  )
}
