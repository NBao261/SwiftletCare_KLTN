import { useState, useEffect, FormEvent } from 'react'
import { useCreateTicket } from '@/hooks/shared/useTickets'
import { useFarms, useFarmZones } from '@/hooks/shared/useFarms'
import { Button, Modal, ModalHeader, MODAL_SECTION_TITLE, SelectMenu, Textarea } from '@/components/ui'
import Field from '@/components/features/admin/tickets/SelectField'
import DateTimePicker from '@/components/common/DateTimePicker'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { TICKET_TYPE_LABEL } from '@/constants/tickets'
import { SCHEDULED_TYPES, validateNewTicket, type NewTicketForm } from '@/validations/common/schedule.validation'
import type { TicketType } from '@/types'

/** Loại tạo tay được — MAINTENANCE chỉ sinh từ lịch bảo trì (backend CREATABLE_TICKET_TYPES trả 400 nếu tạo tay) */
const TYPE_OPTIONS =(Object.keys(TICKET_TYPE_LABEL) as TicketType[]).filter(t => t !== 'MAINTENANCE')

/**
 * POST /tickets cho Admin (backend cho FARM_OWNER + ADMIN) — mở từ bảng AdminTicketsPage.
 * Tự dựng 2 ô Trang trại → Phòng thay vì dùng ZonePicker chung: giao diện Admin gọi Zone
 * là "phòng", ZonePicker (dùng cho mọi role) vẫn ghi "Zone". `defaultFarmId` = farm đang
 * lọc trên bảng, để tạo ticket cho đúng farm đang xem khỏi chọn lại; `defaultZoneId` = phòng chọn sẵn (mở từ
 * chi tiết thiết bị).
 */
export default function CreateTicketModal({ open, onClose, defaultFarmId, defaultZoneId }: {
  open: boolean; onClose: () => void; defaultFarmId?: string; defaultZoneId?: string
}) {
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
    setZoneId(defaultZoneId ?? '')
    setDescription('')
    setSubmitted(false)
  }, [open, defaultFarmId, defaultZoneId])

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
    // Bố cục: tiêu đề trải ngang + thanh ngăn, dưới là 2 cột (trái = loại ticket, phải = các nhóm nền xám + nút).
    // Thân cao cố định, cột phải cuộn trong khung: lỗi hiện dưới ô, lịch chọn giờ chèn vào form — popup không co giãn.
    <Modal open={open} onClose={onClose} size="xl" ariaLabel="Tạo ticket">
      {/* noValidate: lỗi tiếng Việt qua validateNewTicket, không dùng tooltip native */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title="Tạo ticket" description="Chọn loại ticket và điền thông tin" />

        {/* Thân cao cố định: mở lịch / hiện lỗi không làm popup giãn — cột phải cuộn trong khung */}
        <div className="flex h-[31rem] gap-6">
          {/* Trái: loại ticket. MAINTENANCE chỉ sinh từ lịch bảo trì — backend (CREATABLE_TICKET_TYPES) trả 400 nếu tạo tay */}
          <div className="flex w-56 shrink-0 flex-col border-r border-gray-200 pr-5">
            <h3 className={MODAL_SECTION_TITLE}>{t('Loại ticket')}</h3>
            <div className="flex flex-col gap-0.5" role="radiogroup" aria-label={t('Loại ticket')}>
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={cn(
                    'rounded-xl px-3 py-2 text-left text-body transition-colors duration-150',
                    form.type === t ? 'bg-charcoal font-semibold text-white' : 'text-graphite hover:bg-gray-100',
                  )}
                >
                  {TICKET_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Phải: Vị trí → Lịch hẹn → Mô tả cuộn trong khung (pr-4: thanh cuộn cách khối nội dung), nút Tạo cố định ở đáy */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-4">
            <section>
              <h3 className={MODAL_SECTION_TITLE}>{t('Vị trí')}</h3>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
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
                <Field label="Phòng">
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
            </section>

            {/* Lịch hẹn: lắp đặt mới chọn giờ ngay (TICKET-FR-001); ticket báo lỗi chỉ 1 dòng ghi chú gọn — kỹ thuật viên
                hẹn sau khi tiếp nhận (TICKET-FR-004b). Cột phải cuộn trong khung nên khối co giãn theo nội dung cũng được */}
            <section>
              <h3 className={MODAL_SECTION_TITLE}>{t('Lịch hẹn')}</h3>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                {needsSchedule ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ticket-scheduled-at" className="label-caption">
                      {t('Ngày giờ hẹn')}<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
                    </label>
                    <DateTimePicker
                      id="ticket-scheduled-at"
                      ariaLabel={t('Ngày giờ hẹn')}
                      min={new Date()}
                      value={form.scheduledAt}
                      onChange={scheduledAt => setForm(f => ({ ...f, scheduledAt }))}
                      invalid={submitted && !!errors.scheduledAt}
                      inline
                    />
                    {/* Lỗi dưới ô — cùng kiểu Input/SelectField */}
                    {submitted && errors.scheduledAt && <span className="text-xs text-alertRed">{t(errors.scheduledAt)}</span>}
                  </div>
                ) : (
                  <p className="text-small text-warmGray">{t('Không cần chọn — kỹ thuật viên hẹn giờ sau khi tiếp nhận ticket.')}</p>
                )}
              </div>
            </section>

            <section>
              <h3 className={MODAL_SECTION_TITLE}>{t('Mô tả')}</h3>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Textarea
                  aria-label={t('Mô tả')}
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mô tả tình trạng sự cố hoặc yêu cầu cụ thể..."
                />
              </div>
            </section>
          </div>

            <div className="flex shrink-0 justify-end">
              <Button type="submit" loading={createTicket.isPending}>Tạo ticket</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
