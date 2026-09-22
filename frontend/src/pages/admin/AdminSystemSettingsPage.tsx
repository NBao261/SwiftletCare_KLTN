// ADMIN — Cấu hình ngưỡng môi trường mặc định (SYSTEM-FR-002), nguồn cho ENV-FR-020.
import { useState, useEffect, FormEvent } from 'react'
import { useDefaultThresholds, useUpdateDefaultThresholds } from '@/hooks/admin/useSystem'
import { Button, Input } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { IconAlert } from '@/components/ui/icons'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { THRESHOLD_KEYS, THRESHOLD_FIELDS, FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { parseThresholdInput, validateThresholds } from '@/validations/common/threshold.validation'
import type { SystemDefaultThresholds } from '@/types'

type ThresholdKey = keyof SystemDefaultThresholds
/** Form giữ CHUỖI người dùng gõ (cho phép ô trống/"-"/"1." giữa chừng), chỉ parse khi submit. */
type FormState = Record<ThresholdKey, string>

function toForm(values: SystemDefaultThresholds): FormState {
  const form = {} as FormState
  for (const key of THRESHOLD_KEYS) form[key] = String(values[key])
  return form
}

function parseForm(form: FormState): SystemDefaultThresholds {
  const values = {} as SystemDefaultThresholds
  for (const key of THRESHOLD_KEYS) values[key] = parseThresholdInput(form[key])
  return values
}

export default function AdminSystemSettingsPage() {
  const { data, isLoading, error } = useDefaultThresholds()
  const updateThresholds = useUpdateDefaultThresholds()
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<FormState | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    if (data) { setForm(toForm(data)); setSubmitted(false) }
  }, [data])

  const errors = form ? validateThresholds(parseForm(form)) : {}
  const isValid = Object.keys(errors).length === 0

  function setField(key: ThresholdKey, raw: string) {
    setForm(f => (f ? { ...f, [key]: raw } : f))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form || !isValid) return
    updateThresholds.mutate(parseForm(form), {
      onSuccess: () => { setSubmitted(false); push('Đã lưu ngưỡng mặc định hệ thống') },
      // 400 từ assertValidThresholds (min ≥ max, ngoài khoảng đo...) — backend trả message tiếng Việt sẵn
      onError: (err) => push(getApiErrorMessage(err, 'Lưu ngưỡng mặc định thất bại'), 'error'),
    })
  }

  /** Backend không có endpoint reset — ghi đè bằng đúng 7 giá trị gốc qua PUT như một lần lưu bình thường */
  function handleReset() {
    updateThresholds.mutate(FACTORY_DEFAULT_THRESHOLDS, {
      onSuccess: () => { setShowResetConfirm(false); push('Đã khôi phục về mặc định gốc') },
      onError: (err) => push(getApiErrorMessage(err, 'Khôi phục mặc định gốc thất bại'), 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caption">Quản trị hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Cấu hình ngưỡng mặc định</h1>
      </div>

      {isLoading && <LoadingSkeleton className="h-64 w-full" />}

      {!isLoading && error && (
        <EmptyState
          icon={<IconAlert width={28} height={28} />}
          title="Không tải được ngưỡng mặc định"
          description={getApiErrorMessage(error, 'Thử tải lại trang.')}
        />
      )}

      {form && (
        <form onSubmit={handleSave} noValidate className="flex max-w-2xl flex-col gap-4">
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
          <p className="text-xs text-warmGray">
            Giá trị này là nguồn cho hành động "Reset về mặc định" của Farm Owner ở cấp Zone (ENV-FR-020) và là ngưỡng khởi tạo cho zone mới.
            Mọi thay đổi được ghi vào Nhật ký hệ thống (SYSTEM-FR-001).
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={updateThresholds.isPending}
              onClick={() => setShowResetConfirm(true)}
            >
              Khôi phục mặc định gốc
            </Button>
            <Button type="submit" loading={updateThresholds.isPending && !showResetConfirm} className="flex-1">
              Lưu
            </Button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={showResetConfirm}
        title="Khôi phục mặc định gốc?"
        description={`Ghi đè cả 7 giá trị hiện tại về mặc định kỹ thuật gốc (${FACTORY_DEFAULT_THRESHOLDS.temp_min}–${FACTORY_DEFAULT_THRESHOLDS.temp_max}°C, ${FACTORY_DEFAULT_THRESHOLDS.humidity_min}–${FACTORY_DEFAULT_THRESHOLDS.humidity_max}% độ ẩm, ánh sáng ≤${FACTORY_DEFAULT_THRESHOLDS.light_max} lux, NH3 ≤${FACTORY_DEFAULT_THRESHOLDS.nh3_max} ppm, CO2 ≤${FACTORY_DEFAULT_THRESHOLDS.co2_max} ppm). Không thể hoàn tác.`}
        confirmLabel="Khôi phục"
        danger
        loading={updateThresholds.isPending && showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
