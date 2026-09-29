import { useState, FormEvent } from 'react'
import { useUpdateFuzzyTuning } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { Button, Input, Modal, Toggle } from '@/components/ui'
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'
import { parseThresholdInput } from '@/validations/common/threshold.validation'
import { FUZZY_TUNING_LIMITS, validateFuzzyTuning } from '@/validations/common/fuzzyTuning.validation'
import type { FuzzyNumericKey, FuzzyTuning } from '@/types'

const FIELDS: Array<{ key: FuzzyNumericKey; label: string; step: string; hint: string }> = [
  {
    key: 'fuzzy_humidity_band', label: 'Độ rộng vùng độ ẩm (%RH)', step: '0.5',
    hint: 'Lớn hơn → bắt đầu phun sớm hơn và giảm dần mềm hơn quanh ngưỡng ẩm min.',
  },
  {
    key: 'fuzzy_temp_band', label: 'Độ rộng vùng nóng (°C)', step: '0.5',
    hint: 'Lớn hơn → quạt/phun làm mát phản ứng từ sớm hơn khi nhiệt độ tiến gần ngưỡng max.',
  },
  {
    key: 'fuzzy_fan_dry_level', label: 'Mức quạt khi nóng mà khô (%)', step: '5',
    hint: 'Thấp hơn → giữ hơi ẩm trong nhà, để phun sương làm mát. NH3/CO2 vượt ngưỡng vẫn luôn chạy quạt 100%.',
  },
  {
    key: 'fuzzy_window_sec', label: 'Chu kỳ bật/tắt relay (giây)', step: '10',
    hint: 'Dài hơn → relay/bơm ít đóng cắt hơn nhưng dao động độ ẩm lớn hơn. Độ mịn điều khiển ≈ 10 giây.',
  },
]

type Form = Record<FuzzyNumericKey, string> & { fuzzy_input_filter: boolean }
const toForm = (t: FuzzyTuning): Form => ({
  ...(Object.fromEntries(FIELDS.map(f => [f.key, String(t[f.key])])) as Record<FuzzyNumericKey, string>),
  fuzzy_input_filter: t.fuzzy_input_filter,
})

/** ENV-FR-021/022 — chỉnh 4 hệ số + cờ lọc đầu vào của bộ điều khiển mờ; lưu xong backend đẩy config/update xuống ESP32 ngay */
export default function FuzzyTuningModal({
  zoneId, zoneName, current, onClose,
}: {
  zoneId: string
  zoneName: string
  current: FuzzyTuning
  onClose: () => void
}) {
  const update = useUpdateFuzzyTuning(zoneId)
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<Form>(() => toForm(current))
  const [errors, setErrors] = useState<Partial<Record<FuzzyNumericKey, string>>>({})

  function handleSave(e: FormEvent) {
    e.preventDefault()
    const values: FuzzyTuning = { ...current, fuzzy_input_filter: form.fuzzy_input_filter }
    for (const f of FIELDS) values[f.key] = parseThresholdInput(form[f.key])
    const found = validateFuzzyTuning(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    // Chỉ gửi hệ số đã đổi để lịch sử chỉnh (vạch mốc trên biểu đồ) ghi đúng cái đã thay đổi
    const changed: Partial<FuzzyTuning> = Object.fromEntries(FIELDS.filter(f => values[f.key] !== current[f.key]).map(f => [f.key, values[f.key]]))
    if (values.fuzzy_input_filter !== current.fuzzy_input_filter) changed.fuzzy_input_filter = values.fuzzy_input_filter
    if (Object.keys(changed).length === 0) {
      onClose()
      return
    }
    update.mutate(changed, {
      onSuccess: () => {
        push('Đã lưu hệ số — thiết bị đang online áp dụng ngay')
        onClose()
      },
      onError: err => push(getApiErrorMessage(err, 'Lưu hệ số thất bại'), 'error'),
    })
  }

  return (
    <Modal open onClose={onClose} title={`Hệ số logic mờ — ${zoneName}`}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {FIELDS.map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <Input
              label={f.label}
              type="number"
              step={f.step}
              min={FUZZY_TUNING_LIMITS[f.key].min}
              max={FUZZY_TUNING_LIMITS[f.key].max}
              value={form[f.key]}
              error={errors[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
            <p className="text-xs text-warmGray">
              {f.hint} Mặc định {DEFAULT_FUZZY_TUNING[f.key]}, khoảng {FUZZY_TUNING_LIMITS[f.key].min}–{FUZZY_TUNING_LIMITS[f.key].max}.
            </p>
          </div>
        ))}
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-warmGray/15 p-3">
          <div>
            <p className="label-caption">Lọc nhiễu đầu vào (median + Kalman)</p>
            <p className="mt-1 text-xs text-warmGray">
              Làm mượt nhiệt độ/độ ẩm/khí trước khi đưa vào bộ mờ để relay ít đóng cắt vì nhiễu. Tắt tạm để so sánh
              "đóng cắt/giờ" trên biểu đồ. An toàn NH3/CO2 luôn xét theo giá trị đo thô. Cần firmware ≥ 1.2.0.
            </p>
          </div>
          <Toggle
            checked={form.fuzzy_input_filter}
            onChange={checked => setForm(prev => ({ ...prev, fuzzy_input_filter: checked }))}
            aria-label="Lọc nhiễu đầu vào"
          />
        </div>
        <p className="text-xs text-warmGray">
          Chỉnh từng chút một rồi theo dõi biểu đồ "Hiệu quả điều khiển" vài giờ trước khi chỉnh tiếp.
          Thiết bị firmware cũ hơn 1.1.0 bỏ qua các hệ số này.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => { setForm(toForm(DEFAULT_FUZZY_TUNING)); setErrors({}) }}>
            Về mặc định
          </Button>
          <Button type="submit" loading={update.isPending} className="flex-1">
            Lưu & áp dụng
          </Button>
        </div>
      </form>
    </Modal>
  )
}
