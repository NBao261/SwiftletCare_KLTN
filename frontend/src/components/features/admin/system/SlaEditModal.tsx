import { useState, useEffect, FormEvent } from 'react'
import { useSlaHours, useUpdateSlaHours } from '@/hooks/admin/useSystem'
import { Button, Input, Modal, ModalHeader, ModalSection, ModalSummaryRow } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { SLA_PRIORITIES, PRIORITY_LABEL, FACTORY_DEFAULT_SLA, parseSlaInput, validateSla } from '@/constants/sla'
import type { SlaConfig, TicketPriority } from '@/types'

type SlaFormState = Record<TicketPriority, { response_hours: string; resolve_hours: string }>

function toSlaForm(values: SlaConfig): SlaFormState {
  const form = {} as SlaFormState
  for (const p of SLA_PRIORITIES) {
    form[p] = { response_hours: String(values[p].response_hours), resolve_hours: String(values[p].resolve_hours) }
  }
  return form
}

function parseSlaForm(form: SlaFormState): SlaConfig {
  const values = {} as SlaConfig
  for (const p of SLA_PRIORITIES) {
    values[p] = { response_hours: parseSlaInput(form[p].response_hours), resolve_hours: parseSlaInput(form[p].resolve_hours) }
  }
  return values
}

/** Popup ngang sửa + lưu/khôi phục mặc định gốc — mở từ nút "Chỉnh sửa" trên SlaCard */
export default function SlaEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useSlaHours()
  const updateSla = useUpdateSlaHours()
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<SlaFormState | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Modal cha không unmount giữa các lần mở (chỉ đổi `open`) — seed lại form đúng
  // giá trị server mỗi lần MỞ, không chỉ lúc mount, để bỏ dở lần sửa trước không rò sang lần sau.
  useEffect(() => {
    if (open && data) { setForm(toSlaForm(data)); setSubmitted(false); setShowResetConfirm(false) }
  }, [open, data])

  const errors = form ? validateSla(parseSlaForm(form)) : {}
  const isValid = Object.keys(errors).length === 0

  function setField(p: TicketPriority, field: 'response_hours' | 'resolve_hours', raw: string) {
    setForm(f => (f ? { ...f, [p]: { ...f[p], [field]: raw } } : f))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form || !isValid) return
    updateSla.mutate(parseSlaForm(form), {
      onSuccess: () => { push('Đã lưu cấu hình SLA'); onClose() },
      // 400 từ assertValidSla (giờ ≤0, hạn phản hồi muộn hơn hạn xử lý...) — backend trả message tiếng Việt sẵn
      onError: (err) => push(getApiErrorMessage(err, 'Lưu cấu hình SLA thất bại'), 'error'),
    })
  }

  /** Backend không có endpoint reset — ghi đè bằng đúng 6 giá trị gốc qua PUT như một lần lưu bình thường */
  function handleReset() {
    updateSla.mutate(FACTORY_DEFAULT_SLA, {
      onSuccess: () => { setShowResetConfirm(false); push('Đã khôi phục SLA về mặc định gốc'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Khôi phục SLA mặc định thất bại'), 'error'),
    })
  }

  return (
    <>
      {/* Popup ngang: tiêu đề + thanh ngăn; trái = mặc định đề xuất để so + nút khôi phục, phải = mỗi mức ưu tiên
          1 nhóm 2 ô + Lưu. Lỗi cùng hàng nhãn (errorInLabel) — hiện lỗi không làm popup cao thêm */}
      <Modal open={open && !showResetConfirm} onClose={onClose} size="xl" ariaLabel="SLA xử lý ticket">
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          <ModalHeader title="SLA xử lý ticket" description="Hạn phản hồi và xử lý theo mức ưu tiên — áp dụng cho ticket tạo mới hoặc đổi ưu tiên" />

          <div className="flex gap-6">
            <div className="flex w-60 shrink-0 flex-col gap-4 border-r border-gray-200 pr-5">
              <ModalSection title="Mặc định đề xuất" padded={false}>
                <dl className="divide-y divide-gray-200">
                  {SLA_PRIORITIES.map(p => (
                    <ModalSummaryRow key={p} label={PRIORITY_LABEL[p]}>
                      {t('Phản hồi {{response}} giờ · xử lý {{resolve}} giờ', { response: FACTORY_DEFAULT_SLA[p].response_hours, resolve: FACTORY_DEFAULT_SLA[p].resolve_hours })}
                    </ModalSummaryRow>
                  ))}
                </dl>
              </ModalSection>
              <Button
                type="button"
                variant="secondary"
                disabled={!form || updateSla.isPending}
                onClick={() => setShowResetConfirm(true)}
              >
                Khôi phục mặc định gốc
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-5">
              {!form ? (
                <LoadingSkeleton className="h-72 w-full" />
              ) : (
                SLA_PRIORITIES.map(p => (
                  <ModalSection key={p} title={PRIORITY_LABEL[p]}>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Hạn phản hồi (giờ)"
                        type="number"
                        step="0.1"
                        min={0}
                        inputMode="decimal"
                        required
                        value={form[p].response_hours}
                        onChange={e => setField(p, 'response_hours', e.target.value)}
                        error={submitted ? errors[`${p}.response_hours`] : undefined}
                        errorInLabel
                      />
                      <Input
                        label="Hạn xử lý (giờ)"
                        type="number"
                        step="0.1"
                        min={0}
                        inputMode="decimal"
                        required
                        value={form[p].resolve_hours}
                        onChange={e => setField(p, 'resolve_hours', e.target.value)}
                        error={submitted ? errors[`${p}.resolve_hours`] : undefined}
                        errorInLabel
                      />
                    </div>
                  </ModalSection>
                ))
              )}
              <div className="mt-auto flex justify-end">
                <Button type="submit" disabled={!form} loading={updateSla.isPending && !showResetConfirm}>Lưu</Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={open && showResetConfirm}
        title="Khôi phục mặc định gốc?"
        description={t('Hạn SLA trở về mặc định — Khẩn cấp: phản hồi {{p1r}} giờ, xử lý {{p1x}} giờ · Cao: {{p2r}} giờ, {{p2x}} giờ · Thường: {{p3r}} giờ, {{p3x}} giờ. Không thể hoàn tác.', {
          p1r: FACTORY_DEFAULT_SLA.P1.response_hours, p1x: FACTORY_DEFAULT_SLA.P1.resolve_hours,
          p2r: FACTORY_DEFAULT_SLA.P2.response_hours, p2x: FACTORY_DEFAULT_SLA.P2.resolve_hours,
          p3r: FACTORY_DEFAULT_SLA.P3.response_hours, p3x: FACTORY_DEFAULT_SLA.P3.resolve_hours,
        })}
        confirmLabel="Khôi phục"
        danger
        loading={updateSla.isPending && showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  )
}
