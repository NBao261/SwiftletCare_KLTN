// MaintenanceScheduleModal.tsx — TICKET-FR-013: tạo / sửa lịch bảo trì định kỳ theo Farm.
// Dựng từ primitive chung (Modal, Input, Textarea, SelectMenu field, DateTimePicker của Admin) để cùng hệ
// giao diện với các form khác. Sửa: farm cố định (BE không đổi farm), chỉ gửi trường đã thay đổi — nhờ vậy
// sửa mô tả của lịch có `next_due_at` đã trôi qua không bị BE từ chối vì "giờ hẹn phải ở tương lai".
import { useState, useEffect, useMemo, FormEvent } from 'react'
import { Button, Input, Modal, Textarea, SelectMenu } from '@/components/ui'
import DateTimePicker from '@/components/features/admin/tickets/DateTimePicker'
import { validateReschedule } from '@/validations/admin/ticket.validation'
import { useFarms, useFarmZones } from '@/hooks/shared/useFarms'
import { useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule } from '@/hooks/shared/useMaintenanceSchedules'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { MaintenanceSchedule, UpdateMaintenanceScheduleInput } from '@/types'

const MAX_DESCRIPTION = 500
const WHOLE_FARM = '' // option "Toàn trang trại" — không gắn zone

/** ISO (UTC) → giá trị DateTimePicker theo giờ máy người dùng */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

interface Props {
  open: boolean
  onClose: () => void
  /** Có = sửa, không = tạo mới */
  schedule?: MaintenanceSchedule
  /** Farm chọn sẵn khi tạo mới (đang lọc theo farm) */
  defaultFarmId?: string
}

export default function MaintenanceScheduleModal({ open, onClose, schedule, defaultFarmId }: Props) {
  const isEdit = Boolean(schedule)
  const push = useToastStore(s => s.push)
  const { data: farms } = useFarms()
  const create = useCreateMaintenanceSchedule()
  const update = useUpdateMaintenanceSchedule()

  const [farmId, setFarmId] = useState('')
  const [zoneId, setZoneId] = useState(WHOLE_FARM)
  const [description, setDescription] = useState('')
  const [interval, setIntervalDays] = useState('30')
  const [dueAt, setDueAt] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: zones } = useFarmZones(farmId || undefined)

  // Mỗi lần mở: nạp lại giá trị (modal không unmount giữa các lần mở)
  useEffect(() => {
    if (!open) return
    setSubmitted(false)
    if (schedule) {
      setFarmId(schedule.farm_id)
      setZoneId(schedule.zone_id ?? WHOLE_FARM)
      setDescription(schedule.description)
      setIntervalDays(String(schedule.interval_days))
      setDueAt(toLocalDateTimeInput(schedule.next_due_at))
    } else {
      setFarmId(defaultFarmId ?? farms?.[0]?._id ?? '')
      setZoneId(WHOLE_FARM)
      setDescription('')
      setIntervalDays('30')
      setDueAt('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?._id])

  // Tạo mới + farms tải xong sau khi mở → chọn farm đầu tiên
  useEffect(() => {
    if (open && !isEdit && !farmId && farms?.length) setFarmId(defaultFarmId ?? farms[0]._id)
  }, [open, isEdit, farmId, farms, defaultFarmId])

  const farmOptions = useMemo(
    () => (farms ?? []).map(f => ({ value: f._id, label: f.name })),
    [farms],
  )
  const zoneOptions = useMemo(
    () => [
      { value: WHOLE_FARM, label: 'Toàn trang trại' },
      ...(zones ?? []).map(z => ({ value: z._id, label: `${z.houseName} · ${z.name}` })),
    ],
    [zones],
  )

  // ── Validate (cùng luật với express-validator của BE) ──
  const intervalNum = Number(interval)
  const errors = {
    farm: !farmId ? 'Chưa chọn trang trại' : undefined,
    // BE không cho bỏ gắn Zone đã có — chặn hẳn thay vì lặng lẽ bỏ qua thay đổi
    zone: isEdit && Boolean(schedule?.zone_id) && zoneId === WHOLE_FARM
      ? 'Lịch đã gắn Zone thì chỉ đổi sang Zone khác, không bỏ gắn được' : undefined,
    description: !description.trim() ? 'Chưa nhập nội dung bảo trì'
      : description.trim().length > MAX_DESCRIPTION ? `Tối đa ${MAX_DESCRIPTION} ký tự` : undefined,
    interval: !Number.isInteger(intervalNum) || intervalNum < 1 || intervalNum > 365
      ? 'Chu kỳ là số nguyên từ 1 đến 365 ngày' : undefined,
    // Sửa mà không đổi giờ → không validate lại (BE cũng chỉ validate khi có gửi next_due_at)
    dueAt: isEdit && schedule && dueAt === toLocalDateTimeInput(schedule.next_due_at)
      ? undefined : validateReschedule(dueAt),
  }
  const hasError = Object.values(errors).some(Boolean)
  const pending = create.isPending || update.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (hasError) return

    if (isEdit && schedule) {
      // Chỉ gửi trường đã đổi
      const input: UpdateMaintenanceScheduleInput = {}
      if (description.trim() !== schedule.description) input.description = description.trim()
      if (intervalNum !== schedule.interval_days) input.interval_days = intervalNum
      if (dueAt !== toLocalDateTimeInput(schedule.next_due_at)) input.next_due_at = new Date(dueAt).toISOString()
      if (zoneId !== (schedule.zone_id ?? WHOLE_FARM)) input.zone_id = zoneId
      if (Object.keys(input).length === 0) { onClose(); return }
      update.mutate({ id: schedule._id, input }, {
        onSuccess: () => { push('Đã cập nhật lịch bảo trì'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Cập nhật lịch bảo trì thất bại'), 'error'),
      })
      return
    }

    create.mutate({
      farm_id: farmId,
      zone_id: zoneId || undefined,
      description: description.trim(),
      interval_days: intervalNum,
      next_due_at: new Date(dueAt).toISOString(),
    }, {
      onSuccess: () => { push('Đã tạo lịch bảo trì'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Tạo lịch bảo trì thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Sửa lịch bảo trì' : 'Tạo lịch bảo trì định kỳ'}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="label-caption">
            Trang trại<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <SelectMenu
            field
            ariaLabel="Trang trại"
            value={farmId}
            options={farmOptions.length ? farmOptions : [{ value: '', label: 'Chưa có trang trại' }]}
            onChange={v => { setFarmId(v); setZoneId(WHOLE_FARM) }}
            disabled={isEdit}
            invalid={submitted && !!errors.farm}
          />
          {submitted && errors.farm && <span className="text-xs text-alertRed">{errors.farm}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="label-caption">Khu vực (Zone)</label>
          <SelectMenu field ariaLabel="Khu vực" value={zoneId} options={zoneOptions} onChange={setZoneId} disabled={!farmId} invalid={submitted && !!errors.zone} />
          {submitted && errors.zone && <span className="text-xs text-alertRed">{errors.zone}</span>}
        </div>

        <Textarea
          id="maintenance-description"
          label="Nội dung bảo trì"
          required
          rows={3}
          maxLength={MAX_DESCRIPTION}
          placeholder="VD: Vệ sinh cảm biến, kiểm tra relay và đường ống phun sương..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          error={submitted ? errors.description : undefined}
        />

        <Input
          id="maintenance-interval"
          label="Chu kỳ (ngày)"
          required
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          value={interval}
          onChange={e => setIntervalDays(e.target.value)}
          error={submitted ? errors.interval : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="maintenance-due" className="label-caption">
            Lần bảo trì kế tiếp<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <DateTimePicker
            id="maintenance-due"
            ariaLabel="Lần bảo trì kế tiếp"
            min={new Date()}
            value={dueAt}
            onChange={setDueAt}
            invalid={submitted && !!errors.dueAt}
          />
          {submitted && errors.dueAt
            ? <span className="text-xs text-alertRed">{errors.dueAt}</span>
            : <span className="text-xs text-warmGray">Khung giờ 07:00–18:00 (giờ Việt Nam). Ticket được tạo sớm vài ngày trước hạn.</span>}
        </div>

        <Button type="submit" loading={pending} className="w-full">{isEdit ? 'Lưu thay đổi' : 'Tạo lịch'}</Button>
      </form>
    </Modal>
  )
}
