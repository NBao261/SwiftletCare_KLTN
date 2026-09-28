import { useState, useEffect, FormEvent } from 'react'
import { useSlaHours, useUpdateSlaHours } from '@/hooks/admin/useSystem'
import { Button, Input, Modal } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
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

/** Popup trắng/đen (Modal chuẩn) sửa + lưu/khôi phục mặc định gốc — mở từ nút "Chỉnh sửa" trên SlaCard */
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
      onSuccess: () => { setShowResetConfirm(false); push('Đã khôi phục SLA về mặc định đề xuất'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Khôi phục SLA mặc định thất bại'), 'error'),
    })
  }

  return (
    <>
      <Modal open={open && !showResetConfirm} onClose={onClose} title="SLA xử lý ticket">
        {!form ? (
          <LoadingSkeleton className="h-48 w-full" />
        ) : (
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col divide-y divide-warmGray/10">
              {SLA_PRIORITIES.map(p => (
                <div key={p} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-bold text-charcoal">{p} · {PRIORITY_LABEL[p]}</span>
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
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-warmGray">Mọi thay đổi được ghi vào Nhật ký hệ thống (SYSTEM-FR-001).</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={updateSla.isPending}
                onClick={() => setShowResetConfirm(true)}
              >
                Khôi phục<br />mặc định gốc
              </Button>
              <Button type="submit" loading={updateSla.isPending && !showResetConfirm} className="flex-1">
                Lưu
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={open && showResetConfirm}
        title="Khôi phục SLA về mặc định đề xuất?"
        description={`Ghi đè cả 3 mức hiện tại về giá trị đề xuất trong SRS (P1 phản hồi ≤${FACTORY_DEFAULT_SLA.P1.response_hours}h/xử lý ≤${FACTORY_DEFAULT_SLA.P1.resolve_hours}h, P2 ≤${FACTORY_DEFAULT_SLA.P2.response_hours}h/≤${FACTORY_DEFAULT_SLA.P2.resolve_hours}h, P3 ≤${FACTORY_DEFAULT_SLA.P3.response_hours}h/≤${FACTORY_DEFAULT_SLA.P3.resolve_hours}h). Không thể hoàn tác.`}
        confirmLabel="Khôi phục"
        danger
        loading={updateSla.isPending && showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  )
}
