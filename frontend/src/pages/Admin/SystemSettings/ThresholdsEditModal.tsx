import { useState, useEffect, FormEvent } from 'react'
import { useDefaultThresholds, useUpdateDefaultThresholds } from '@/hooks/useSystem'
import { Button, Input, Modal } from '@/components/ui'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmModal from '@/components/common/ConfirmModal'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import {
  THRESHOLD_KEYS, THRESHOLD_FIELDS, FACTORY_DEFAULT_THRESHOLDS, parseThresholdInput, validateThresholds,
} from '@/constants/thresholds'
import type { ThresholdKey } from './constants'
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

/** Popup trắng/đen (Modal chuẩn) sửa + lưu/khôi phục mặc định gốc — mở từ nút "Chỉnh sửa" trên ThresholdsCard */
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
      <Modal open={open && !showResetConfirm} onClose={onClose} title="Ngưỡng môi trường mặc định">
        {!form ? (
          <LoadingSkeleton className="h-64 w-full" />
        ) : (
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
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
                />
              ))}
            </div>
            <p className="text-xs text-warmGray">Mọi thay đổi được ghi vào Nhật ký hệ thống (SYSTEM-FR-001).</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={updateThresholds.isPending}
                onClick={() => setShowResetConfirm(true)}
              >
                Khôi phục<br />mặc định gốc
              </Button>
              <Button type="submit" loading={updateThresholds.isPending && !showResetConfirm} className="flex-1">
                Lưu
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={open && showResetConfirm}
        title="Khôi phục mặc định gốc?"
        description={`Ghi đè cả 7 giá trị hiện tại về mặc định kỹ thuật gốc (${FACTORY_DEFAULT_THRESHOLDS.temp_min}–${FACTORY_DEFAULT_THRESHOLDS.temp_max}°C, ${FACTORY_DEFAULT_THRESHOLDS.humidity_min}–${FACTORY_DEFAULT_THRESHOLDS.humidity_max}% độ ẩm, ánh sáng ≤${FACTORY_DEFAULT_THRESHOLDS.light_max} lux, NH3 ≤${FACTORY_DEFAULT_THRESHOLDS.nh3_max} ppm, CO2 ≤${FACTORY_DEFAULT_THRESHOLDS.co2_max} ppm). Không thể hoàn tác.`}
        confirmLabel="Khôi phục"
        danger
        loading={updateThresholds.isPending && showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  )
}
