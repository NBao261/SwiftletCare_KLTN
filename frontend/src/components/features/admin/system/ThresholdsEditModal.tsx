import { useState, useEffect, FormEvent } from 'react'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useDefaultThresholds, useUpdateDefaultThresholds } from '@/hooks/admin/useSystem'
import { Button, Input, Modal, ModalHeader, ModalSection, ModalSummaryRow } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import { THRESHOLD_KEYS, THRESHOLD_FIELDS, FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { hasMinMaxOrderError, parseThresholdInput, validateThresholds, validateThresholdSource } from '@/validations/common/threshold.validation'
import type { ThresholdKey } from '@/components/features/admin/system/system.constants'
import type { SystemDefaultThresholds } from '@/types'

// Form giữ CHUỖI người dùng gõ (cho phép ô trống/"-"/"1." giữa chừng), chỉ parse khi submit.
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

// Popup ngang sửa + lưu/khôi phục mặc định gốc: mở từ nút "Chỉnh sửa" trên ThresholdsCard
export default function ThresholdsEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useDefaultThresholds()
  const updateThresholds = useUpdateDefaultThresholds()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [form, setForm] = useState<ThresholdFormState | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  // mỗi lần đổi ngưỡng mặc định (kể cả khôi phục gốc) ghi nguồn có mã REF-5
  const [source, setSource] = useState('')

  // Seed lại form mỗi lần mở để lần sửa bỏ dở không rò sang lần sau
  useEffect(() => {
    if (open && data) { setForm(toThresholdForm(data)); setSource(''); setSubmitted(false); setShowResetConfirm(false) }
  }, [open, data])

  const parsedForm = form ? parseThresholdForm(form) : undefined
  const errors = parsedForm ? validateThresholds(parsedForm) : {}
  // Cặp tối thiểu, tối đa bị đảo thì báo ngay khi gõ; lỗi chưa nhập hoặc ngoài khoảng đợi bấm Lưu
  const isOrderError = (key: ThresholdKey) => Boolean(parsedForm && hasMinMaxOrderError(parsedForm, key))
  const sourceError = validateThresholdSource(source)
  const isValid = Object.keys(errors).length === 0 && !sourceError

  function setField(key: ThresholdKey, raw: string) {
    setForm(f => (f ? { ...f, [key]: raw } : f))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form || !isValid) return
    updateThresholds.mutate({ ...parseThresholdForm(form), source: source.trim() }, {
      onSuccess: () => { push('Đã lưu ngưỡng mặc định hệ thống'); onClose() },
      // Lỗi từng ô do validateThresholds báo trước khi gửi; ở đây chỉ còn lỗi mạng, quyền hoặc máy chủ
      onError: (err) => push(apiErrorMessage(err, t('Lưu ngưỡng mặc định thất bại')), 'error'),
    })
  }

  // Không có endpoint reset: PUT đúng 7 giá trị gốc
  function handleReset() {
    updateThresholds.mutate({ ...FACTORY_DEFAULT_THRESHOLDS, source: source.trim() }, {
      onSuccess: () => { setShowResetConfirm(false); push('Đã khôi phục về mặc định gốc'); onClose() },
      onError: (err) => push(apiErrorMessage(err, t('Khôi phục mặc định gốc thất bại')), 'error'),
    })
  }

  return (
    <>
      {/* Lỗi cùng hàng nhãn để popup không cao thêm */}
      <Modal open={open && !showResetConfirm} onClose={onClose} size="xl" ariaLabel="Ngưỡng môi trường mặc định">
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          <ModalHeader title="Ngưỡng môi trường mặc định" description="Dùng cho Zone mới tạo và khi chủ nhà yến đặt lại ngưỡng mặc định" />

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
                onClick={() => { setSubmitted(true); if (!sourceError) setShowResetConfirm(true) }}
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
                        error={submitted || isOrderError(key) ? errors[key] : undefined}
                      />
                    ))}
                  </div>
                </ModalSection>
              )}
              <ModalSection title="Nguồn của lần đổi">
                <Input
                  label="Nguồn (mã mục REF-5)"
                  placeholder="VD: TL-003, tài liệu nuôi yến, chương 4"
                  required
                  maxLength={500}
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  error={submitted ? sourceError : undefined}
                  errorInLabel
                />
                {data?.source && (
                  <p className="mt-2 text-xs text-gray-500">{t('Nguồn hiện tại: {{source}}', { source: data.source })}</p>
                )}
              </ModalSection>
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
        description={t('Ngưỡng trở về mặc định. Nhiệt độ {{tMin}}–{{tMax}} °C · Độ ẩm {{hMin}}–{{hMax}} % · Ánh sáng ≤ {{light}} lux · NH3 ≤ {{nh3}} ppm · CO2 ≤ {{co2}} ppm. Không thể hoàn tác.', {
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
