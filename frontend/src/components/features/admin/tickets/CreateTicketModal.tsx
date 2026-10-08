import { useState, useEffect, FormEvent } from 'react'
import { useCreateTicket } from '@/hooks/shared/useTickets'
import { useFarms, useFarmZones } from '@/hooks/shared/useFarms'
import { Button, Modal, SelectMenu, Textarea } from '@/components/ui'
import Field from '@/components/features/admin/tickets/SelectField'
import DateTimePicker from '@/components/common/DateTimePicker'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { TICKET_TYPE_LABEL } from '@/constants/tickets'
import { SCHEDULED_TYPES, validateNewTicket, type NewTicketForm } from '@/validations/common/schedule.validation'
import type { TicketType } from '@/types'

/**
 * POST /tickets cho Admin (backend cho FARM_OWNER + ADMIN) — mở từ bảng AdminTicketsPage.
 * Tự dựng 2 ô Trang trại → Phòng thay vì dùng ZonePicker chung: giao diện Admin gọi Zone
 * là "phòng", ZonePicker (dùng cho mọi role) vẫn ghi "Zone". `defaultFarmId` = farm đang
 * lọc trên bảng, để tạo ticket cho đúng farm đang xem khỏi chọn lại.
 */
export default function CreateTicketModal({ open, onClose, defaultFarmId }: { open: boolean; onClose: () => void; defaultFarmId?: string }) {
  const createTicket = useCreateTicket()
  const push = useToastStore(s => s.push)
  const { data: farms, isLoading: loadingFarms } = useFarms()
  const [form, setForm] = useState<NewTicketForm>({ farmId: '', type: 'OTHER', scheduledAt: '' })
  const [zoneId, setZoneId] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { data: rooms, isLoading: loadingRooms } = useFarmZones(form.farmId || undefined)

  // Modal không unmount giữa các lần mở — reset mỗi lần mở lại, lấy farm đang lọc làm mặc định
  useEffect(() => {
    if (!open) return
    setForm({ farmId: defaultFarmId ?? '', type: 'OTHER', scheduledAt: '' })
    setZoneId('')
    setDescription('')
    setSubmitted(false)
  }, [open, defaultFarmId])

  const errors = validateNewTicket(form)
  const needsSchedule = SCHEDULED_TYPES.includes(form.type)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    createTicket.mutate(
      {
        farm_id: form.farmId,
        zone_id: zoneId || undefined,
        type: form.type,
        description: description.trim() || undefined,
        scheduled_visit_at: needsSchedule ? new Date(form.scheduledAt).toISOString() : undefined,
      },
      {
        onSuccess: () => { push('Đã tạo ticket'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Tạo ticket thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo ticket">
      {/* noValidate: lỗi hiện tiếng Việt dưới ô qua validateNewTicket, không dùng tooltip native */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* SelectMenu thay <select> native: danh sách native do hệ điều hành vẽ (hover xám), không tô được LIME MIST */}
        <Field label="Loại ticket">
          <SelectMenu
            field
            ariaLabel="Loại ticket"
            value={form.type}
            onChange={type => setForm(f => ({ ...f, type }))}
            // MAINTENANCE chỉ sinh từ lịch bảo trì — backend (CREATABLE_TICKET_TYPES) trả 400 nếu tạo tay
            options={(Object.keys(TICKET_TYPE_LABEL) as TicketType[]).filter(t => t !== 'MAINTENANCE').map(t => ({ value: t, label: TICKET_TYPE_LABEL[t] }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Trang trại" required error={submitted ? errors.farmId : undefined}>
            <SelectMenu
              field
              ariaLabel="Trang trại"
              disabled={loadingFarms}
              invalid={submitted && !!errors.farmId}
              value={form.farmId}
              onChange={farmId => { setForm(f => ({ ...f, farmId })); setZoneId('') }}
              options={[{ value: '', label: '-- Chọn trang trại --' }, ...(farms ?? []).map(f => ({ value: f._id, label: f.name }))]}
            />
          </Field>
          <Field label="Phòng (tùy chọn)">
            <SelectMenu
              field
              ariaLabel="Phòng"
              disabled={!form.farmId || loadingRooms}
              value={zoneId}
              onChange={setZoneId}
              options={[
                { value: '', label: form.farmId ? 'Toàn farm' : 'Chọn trang trại trước' },
                ...(rooms ?? []).map(r => ({ value: r._id, label: `${r.houseName} / ${r.name}` })),
              ]}
            />
          </Field>
        </div>

        {needsSchedule && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ticket-scheduled-at" className="label-caption">
              Ngày giờ hẹn<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
            </label>
            <DateTimePicker
              id="ticket-scheduled-at"
              ariaLabel="Ngày giờ hẹn"
              min={new Date()}
              value={form.scheduledAt}
              onChange={scheduledAt => setForm(f => ({ ...f, scheduledAt }))}
              invalid={submitted && !!errors.scheduledAt}
            />
            {submitted && errors.scheduledAt && <span className="text-xs text-alertRed">{errors.scheduledAt}</span>}
          </div>
        )}

        <Textarea
          label="Mô tả (tùy chọn)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Mô tả tình trạng sự cố hoặc yêu cầu cụ thể..."
        />

        <Button type="submit" loading={createTicket.isPending} className="w-full">Tạo ticket</Button>
      </form>
    </Modal>
  )
}
