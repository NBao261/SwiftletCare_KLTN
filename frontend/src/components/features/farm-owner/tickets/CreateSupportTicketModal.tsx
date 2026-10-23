import { useEffect, useState, FormEvent, ReactNode } from 'react'
import { CheckCircleIcon, HouseLineIcon, WarningCircleIcon, WrenchIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, SelectMenu, Textarea } from '@/components/ui'
import DateTimePicker from '@/components/common/DateTimePicker'
import { useCreateTicket } from '@/hooks/shared/useTickets'
import { useAllZones, useFarms, useFarmZones } from '@/hooks/shared/useFarms'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { cn } from '@/lib/cn'
import { supportDict, type SupportKey } from '@/constants/support.i18n'
import { VISIT_END_HOUR, VISIT_START_HOUR, validateNewTicket, type NewTicketForm } from '@/validations/common/schedule.validation'
import type { TicketType } from '@/types'
import { DESCRIPTION_MAX, FAULT_TYPES, SUPPORT_PATH, type SupportKind as Kind } from '@/components/features/farm-owner/tickets/tickets.constants'

// Giá trị chọn sẵn khi mở form từ màn Cấu trúc Farm hoặc từ cảnh báo lỗi thiết bị
export interface CreateSupportDefaults {
  kind?: Kind
  farmId?: string
  zoneId?: string
  type?: TicketType
  description?: string
  // Cảnh báo gốc của yêu cầu, job tự sinh ticket bỏ qua cảnh báo đã có ticket
  alertId?: string
}

const KIND_OPTIONS: Array<{ value: Kind; title: SupportKey; description: SupportKey; icon: typeof WrenchIcon }> = [
  { value: 'fault', title: 'form.kindFault', description: 'form.kindFaultDesc', icon: WrenchIcon },
  { value: 'install', title: 'form.kindInstall', description: 'form.kindInstallDesc', icon: HouseLineIcon },
]

// Khoá câu lỗi ô giờ hẹn theo ngôn ngữ đang chọn
function visitErrorKey(scheduledAt: string): SupportKey {
  if (!scheduledAt) return 'form.errVisitRequired'
  if (new Date(scheduledAt).getTime() <= Date.now()) return 'form.errVisitPast'
  return 'form.errVisitHours'
}

// Kết quả lần gửi: null = đang ở form
type SubmitResult = { isSuccess: true } | { isSuccess: false; message: string } | null

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caption">
        {label}{required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span className="text-small text-alertRed">{error}</span>}
    </div>
  )
}

interface CreateSupportTicketModalProps {
  open: boolean
  onClose: () => void
  defaults?: CreateSupportDefaults
}

// Form Farm Owner tạo yêu cầu báo sự cố hoặc lắp đặt
export default function CreateSupportTicketModal({ open, onClose, defaults }: CreateSupportTicketModalProps) {
  const { t } = useTranslation(supportDict)
  const createTicket = useCreateTicket()
  const apiErrorMessage = useApiErrorMessage()
  const navigate = useNavigate()
  const { data: farms, isLoading: loadingFarms } = useFarms()
  // Chỉ cần khi được chọn sẵn zone mà thiếu farm (mở từ thiết bị) — suy farm của zone đó
  const { data: allZones } = useAllZones()
  const [kind, setKind] = useState<Kind>('fault')
  const [form, setForm] = useState<NewTicketForm>({ farmId: '', type: 'SENSOR_FAULT', scheduledAt: '' })
  const [zoneId, setZoneId] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [farmTouched, setFarmTouched] = useState(false)
  const [result, setResult] = useState<SubmitResult>(null)
  const { data: zones, isLoading: loadingZones } = useFarmZones(form.farmId || undefined)

  // Modal không unmount giữa các lần mở — reset mỗi lần mở, áp giá trị chọn sẵn nếu có
  useEffect(() => {
    if (!open) return
    const nextKind = defaults?.kind ?? 'fault'
    setKind(nextKind)
    setForm({
      farmId: defaults?.farmId ?? '',
      type: nextKind === 'install' ? 'INSTALLATION' : defaults?.type ?? 'SENSOR_FAULT',
      scheduledAt: '',
    })
    setZoneId(defaults?.zoneId ?? '')
    setDescription(defaults?.description?.slice(0, DESCRIPTION_MAX) ?? '')
    setSubmitted(false)
    setFarmTouched(false)
    setResult(null)
  }, [open, defaults])

  // Farm mặc định: suy từ zone chọn sẵn, hoặc farm duy nhất của người dùng
  const fallbackFarmId = (defaults?.zoneId ? allZones?.find(zone => zone._id === defaults.zoneId)?.farmId : undefined)
    ?? (farms?.length === 1 ? farms[0]._id : undefined)
  useEffect(() => {
    if (open && !farmTouched && !form.farmId && fallbackFarmId) setForm(current => ({ ...current, farmId: fallbackFarmId }))
  }, [open, farmTouched, form.farmId, fallbackFarmId])

  const errors = validateNewTicket(form)
  const isInstall = kind === 'install'
  // Mở từ thiết bị / cảnh báo / Zone cụ thể: yêu cầu thuộc đúng nhà, Zone đó — không đổi sang farm, nhà khác
  const isLocationLocked = Boolean(defaults?.zoneId)
  const hours = { start: VISIT_START_HOUR, end: VISIT_END_HOUR }
  const farmError = submitted && errors.farmId ? t('form.errFarm') : undefined
  const visitError = submitted && errors.scheduledAt ? t(visitErrorKey(form.scheduledAt), hours) : undefined

  function chooseKind(next: Kind) {
    setKind(next)
    setForm(current => ({ ...current, type: next === 'install' ? 'INSTALLATION' : 'SENSOR_FAULT', scheduledAt: '' }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    createTicket.mutate(
      {
        farm_id: form.farmId,
        zone_id: zoneId || undefined,
        type: form.type,
        description: description.trim() || undefined,
        scheduled_visit_at: isInstall ? new Date(form.scheduledAt).toISOString() : undefined,
        alert_id: !isInstall ? defaults?.alertId : undefined,
      },
      {
        onSuccess: () => setResult({ isSuccess: true }),
        onError: error => setResult({ isSuccess: false, message: apiErrorMessage(error, t('form.sendFailed')) }),
      },
    )
  }

  // Màn kết quả sau khi gửi: thành công thì đóng hoặc xem danh sách yêu cầu; thất bại thì quay lại form (giữ dữ liệu đã nhập) để gửi lại
  if (result) {
    let title = isInstall ? t('result.installFail') : t('result.faultFail')
    if (result.isSuccess) title = isInstall ? t('result.installOk') : t('result.faultOk')
    return (
      <Modal open={open} onClose={onClose} title={t('form.title')} className="max-w-md">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className={cn('flex h-14 w-14 items-center justify-center rounded-full', result.isSuccess ? 'bg-warmGray/10 text-charcoal' : 'bg-alertRed/10 text-alertRed')}>
            {result.isSuccess ? <CheckCircleIcon size={30} weight="fill" /> : <WarningCircleIcon size={30} weight="fill" />}
          </span>
          <p className="text-h3 text-charcoal">{title}</p>
          <p className="text-sm text-warmGray">
            {result.isSuccess ? (isInstall ? t('form.sentInstall') : t('form.sentFault')) : result.message}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          {result.isSuccess ? (
            <>
              <Button type="button" variant="secondary" onClick={() => { onClose(); navigate(SUPPORT_PATH) }}>{t('result.viewTickets')}</Button>
              <Button type="button" onClick={onClose}>{t('result.close')}</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>{t('result.close')}</Button>
              <Button type="button" onClick={() => setResult(null)}>{t('result.retry')}</Button>
            </>
          )}
        </div>
      </Modal>
    )
  }

  return (
    // Popup ngang: cột trái chọn loại yêu cầu + ghi chú tự giao việc, cột phải các ô nhập, chân popup Huỷ / Gửi
    <Modal open={open} onClose={onClose} title={t('form.title')} className="max-w-3xl">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[15rem_1fr]">
          {/* Cột trái: loại yêu cầu */}
          <div className="flex flex-col gap-3">
            <span className="label-caption">{t('form.kindAria')}</span>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('form.kindAria')}>
              {KIND_OPTIONS.map(option => {
                const isActive = kind === option.value
                const KindIcon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => chooseKind(option.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                      isActive ? 'border-accent-600 bg-accent-600' : 'border-warmGray/15 bg-white hover:bg-warmGray/5',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        isActive ? 'bg-charcoal text-accent-600' : 'bg-warmGray/10 text-graphite',
                      )}
                    >
                      <KindIcon size={16} weight="bold" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-charcoal">{t(option.title)}</span>
                      <span className="block text-small text-warmGray">{t(option.description)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-auto rounded-2xl bg-warmGray/5 px-3.5 py-3 text-small text-graphite">{t('form.autoAssign')}</p>
          </div>

          {/* Cột phải: thông tin yêu cầu */}
          <div className="flex min-w-0 flex-col gap-4">
            {!isInstall && (
              <Field label={t('form.faultType')} required>
                <SelectMenu
                  field
                  ariaLabel={t('form.faultType')}
                  value={form.type}
                  onChange={type => setForm(current => ({ ...current, type }))}
                  options={FAULT_TYPES.map(type => ({ value: type, label: t(`type.${type}`) }))}
                />
              </Field>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('form.farm')} required error={farmError}>
                <SelectMenu
                  field
                  ariaLabel={t('form.farm')}
                  disabled={loadingFarms || isLocationLocked}
                  invalid={!!farmError}
                  value={form.farmId}
                  onChange={farmId => { setFarmTouched(true); setForm(current => ({ ...current, farmId })); setZoneId('') }}
                  options={[{ value: '', label: t('form.farmPlaceholder') }, ...(farms ?? []).map(farm => ({ value: farm._id, label: farm.name }))]}
                />
              </Field>
              <Field label={t('form.zone')}>
                <SelectMenu
                  field
                  ariaLabel="Zone"
                  disabled={!form.farmId || loadingZones || isLocationLocked}
                  value={zoneId}
                  onChange={setZoneId}
                  options={[
                    { value: '', label: form.farmId ? t('cell.wholeFarm') : t('form.zonePickFarm') },
                    ...(zones ?? []).map(zone => ({ value: zone._id, label: `${zone.houseName} / ${zone.name}` })),
                  ]}
                />
              </Field>
            </div>

            {isInstall && (
              <Field label={t('form.visit')} required error={visitError}>
                <DateTimePicker
                  id="support-ticket-visit"
                  ariaLabel={t('form.visit')}
                  placeholder={t('form.visitPlaceholder')}
                  min={new Date()}
                  value={form.scheduledAt}
                  onChange={scheduledAt => setForm(current => ({ ...current, scheduledAt }))}
                  invalid={!!visitError}
                />
                <span className="text-small text-warmGray">{t('form.visitHint', hours)}</span>
              </Field>
            )}

            <Textarea
              id="support-ticket-description"
              label={isInstall ? t('form.descInstall') : t('form.descFault')}
              value={description}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              onChange={event => setDescription(event.target.value)}
              placeholder={isInstall ? t('form.phInstall') : t('form.phFault')}
            />

            {defaults?.alertId && !isInstall && (
              <p className="rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-small text-graphite">
                {t('form.fromAlert')}
              </p>
            )}
          </div>
        </div>

        {/* Chân popup: Huỷ (phụ) bên trái nút Gửi (chính), canh phải */}
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>{t('form.cancel')}</Button>
          <Button type="submit" loading={createTicket.isPending}>
            {isInstall ? t('form.submitInstall') : t('form.submitFault')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
