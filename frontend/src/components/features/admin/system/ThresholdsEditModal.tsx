import { useState, useEffect, FormEvent } from 'react'
import { useDefaultThresholds, useUpdateDefaultThresholds } from '@/hooks/admin/useSystem'
import { Button, Input, Modal, ModalHeader, ModalSection, ModalSummaryRow } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { THRESHOLD_KEYS, THRESHOLD_FIELDS, FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { parseThresholdInput, validateThresholds } from '@/validations/common/threshold.validation'
import type { ThresholdKey } from '@/components/features/admin/system/system.constants'
import type { SystemDefaultThresholds } from '@/types'

/** Form giữ CHUỖI người dùng gõ (cho phép ô trống/"-"/"1." giữa chừng), chỉ parse khi submit. */
type ThresholdFormState = Record<ThresholdKey, string>

function toThresholdForm(values: SystemDefaultThresholds): ThresholdFormState {
  const form = {} as ThresholdFormState
  for (const key of THRESHOLD_KEYS) form[key] = String(values[key])
  return form
}

function parseThresholdForm(form: ThresholdFormState): SystemDefaultThresholds {
  const values = {} as SystemDefaultThresholds
  for (const key of THRESHOLD_KEYS) values[key] = parseThresholdInput(form[key])
  return values
}

/** Popup ngang sửa + lưu/khôi phục mặc định gốc — mở từ nút "Chỉnh sửa" trên ThresholdsCard */
export default function ThresholdsEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useDefaultThresholds()
  const updateThresholds = useUpdateDefaultThresholds()
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<ThresholdFormState | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Modal cha không unmount giữa các lần mở (chỉ đổi `open`) — seed lại form đúng
  // giá trị server mỗi lần MỞ, không chỉ lúc mount, để bỏ dở lần sửa trước không rò sang lần sau.
  useEffect(() => {
    if (open && data) { setForm(toThresholdForm(data)); setSubmitted(false); setShowResetConfirm(false) }
  }, [open, data])

  const errors = form ? validateThresholds(parseThresholdForm(form)) : {}
  const isValid = Object.keys(errors).length === 0

  function setField(key: ThresholdKey, raw: string) {
    setForm(f => (f ? { ...f, [key]: raw } : f))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form || !isValid) return
    updateThresholds.mutate(parseThresholdForm(form), {
      onSuccess: () => { push('Đã lưu ngưỡng mặc định hệ thống'); onClose() },
      // 400 từ assertValidThresholds (min ≥ max, ngoài khoảng đo...) — backend trả message tiếng Việt sẵn
      onError: (err) => push(getApiErrorMessage(err, 'Lưu ngưỡng mặc định thất bại'), 'error'),
    })
  }

  /** Backend không có endpoint reset — ghi đè bằng đúng 7 giá trị gốc qua PUT như một lần lưu bình thường */
  function handleReset() {
    updateThresholds.mutate(FACTORY_DEFAULT_THRESHOLDS, {
      onSuccess: () => { setShowResetConfirm(false); push('Đã khôi phục về mặc định gốc'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Khôi phục mặc định gốc thất bại'), 'error'),
    })
  }

  return (
    <>
      {/* Popup ngang: tiêu đề + thanh ngăn; trái = mặc định gốc để so + nút khôi phục, phải = 7 ô nhập + Lưu.
          Lỗi cùng hàng nhãn (errorInLabel) — hiện lỗi không làm popup cao thêm */}
      <Modal open={open && !showResetConfirm} onClose={onClose} size="xl" ariaLabel="Ngưỡng môi trường mặc định">
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          <ModalHeader title="Ngưỡng môi trường mặc định" description="Áp dụng khi tạo phòng mới và khi Farm Owner đặt lại về mặc định" />

          <div className="flex gap-6">
            <div className="flex w-60 shrink-0 flex-col gap-4 border-r border-gray-200 pr-5">
              <ModalSection title="Mặc định gốc" padded={false}>
                <dl className="divide-y divide-gray-200">
                  <ModalSummaryRow label="Nhiệt độ">{FACTORY_DEFAULT_THRESHOLDS.temp_min} – {FACTORY_DEFAULT_THRESHOLDS.temp_max} °C</ModalSummaryRow>
                  <ModalSummaryRow label="Độ ẩm">{FACTORY_DEFAULT_THRESHOLDS.humidity_min} – {FACTORY_DEFAULT_THRESHOLDS.humidity_max} %</ModalSummaryRow>
                  <ModalSummaryRow label="Ánh sáng">≤ {FACTORY_DEFAULT_THRESHOLDS.light_max} lux</ModalSummaryRow>
                  <ModalSummaryRow label="NH3">≤ {FACTORY_DEFAULT_THRESHOLDS.nh3_max} ppm</ModalSummaryRow>
                  <ModalSummaryRow label="CO2">≤ {FACTORY_DEFAULT_THRESHOLDS.co2_max} ppm</ModalSummaryRow>
                </dl>
              </ModalSection>
              <Button
                type="button"
                variant="secondary"
                disabled={!form || updateThresholds.isPending}
                onClick={() => setShowResetConfirm(true)}
              >
                Khôi phục mặc định gốc
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-5">
              {!form ? (
                <LoadingSkeleton className="h-72 w-full" />
              ) : (
                <ModalSection title="Giá trị áp dụng">
                  <div className="grid grid-cols-2 gap-3">
                    {THRESHOLD_FIELDS.map(({ key, label, step }) => (
                      <Input
                        key={key}
                        label={label}
                        type="number"
                        step={step}
                        inputMode="decimal"
                        required
                        value={form[key]}
                        onChange={e => setField(key, e.target.value)}
                        error={submitted ? errors[key] : undefined}
                        errorInLabel
                      />
                    ))}
                  </div>
                </ModalSection>
              )}
              <div className="mt-auto flex justify-end">
                <Button type="submit" disabled={!form} loading={updateThresholds.isPending && !showResetConfirm}>Lưu</Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={open && showResetConfirm}
        title="Khôi phục mặc định gốc?"
        description={t('Ngưỡng trở về mặc định — Nhiệt độ {{tMin}}–{{tMax}} °C · Độ ẩm {{hMin}}–{{hMax}} % · Ánh sáng ≤ {{light}} lux · NH3 ≤ {{nh3}} ppm · CO2 ≤ {{co2}} ppm. Không thể hoàn tác.', {
          tMin: FACTORY_DEFAULT_THRESHOLDS.temp_min, tMax: FACTORY_DEFAULT_THRESHOLDS.temp_max,
          hMin: FACTORY_DEFAULT_THRESHOLDS.humidity_min, hMax: FACTORY_DEFAULT_THRESHOLDS.humidity_max,
          light: FACTORY_DEFAULT_THRESHOLDS.light_max, nh3: FACTORY_DEFAULT_THRESHOLDS.nh3_max, co2: FACTORY_DEFAULT_THRESHOLDS.co2_max,
        })}
        confirmLabel="Khôi phục"
        danger
        loading={updateThresholds.isPending && showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  )
}
