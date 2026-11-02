/**
 * ThresholdColumn — Cột 1: Ngưỡng vi khí hậu & khí độc (7 trường)
 * validate min<max, nút Khôi phục mặc định + Lưu ngưỡng môi trường
 * SRS v2.1.4: EXPERT-FR-004
 */
import { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TuningStepperInput from './TuningStepperInput'
import type { ExpertThresholds } from '@/types/expert.types'

interface Props {
  data: ExpertThresholds | undefined
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (v: Partial<ExpertThresholds>) => void
  onReset: () => void
}

export default function ThresholdColumn({ data, isLoading, isSaving, isResetting, onSave, onReset }: Props) {
  const [form, setForm] = useState<ExpertThresholds>({
    temp_min: 27, temp_max: 31, humidity_min: 75, humidity_max: 85, light_max: 0.2, nh3_max: 25, co2_max: 1500,
  })
  const [resetOpen, setResetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (data) setForm(data) }, [data])

  const set = (key: keyof ExpertThresholds) => (v: number) => {
    setForm(f => ({ ...f, [key]: v }))
    setError(null)
  }

  const handleSave = () => {
    if (form.temp_min >= form.temp_max) { setError('Nhiệt độ tối thiểu phải nhỏ hơn tối đa.'); return }
    if (form.humidity_min >= form.humidity_max) { setError('Độ ẩm tối thiểu phải nhỏ hơn tối đa.'); return }
    setError(null)
    onSave(form)
  }

  if (isLoading) return (
    <div className="bg-white rounded-[24px] border border-stone-200/80 shadow-sm p-5 animate-pulse space-y-4 h-full">
      {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-xl" />)}
    </div>
  )

  return (
    <>
      <div className="h-full flex flex-col justify-between bg-white rounded-[24px] p-5 border border-stone-200/80 shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-bold text-[#27231F]">2. Ngưỡng vi khí hậu &amp; khí độc</h3>
            <p className="text-[11px] text-[#878380] mt-0.5">Tiêu chuẩn vi khí hậu môi trường nuôi</p>
          </div>
          <button type="button" onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-[#27231F] whitespace-nowrap shrink-0 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 py-1 divide-y divide-stone-100">
          <TuningStepperInput label="Nhiệt độ tối thiểu" value={form.temp_min} onChange={set('temp_min')} min={20} max={35} step={0.5} decimals={1} unit="°C" rangeHint="Phạm vi: 20–35 °C" />
          <TuningStepperInput label="Nhiệt độ tối đa" value={form.temp_max} onChange={set('temp_max')} min={20} max={35} step={0.5} decimals={1} unit="°C" rangeHint="Phạm vi: 20–35 °C" />
          <TuningStepperInput label="Độ ẩm tối thiểu" value={form.humidity_min} onChange={set('humidity_min')} min={50} max={95} step={0.5} decimals={1} unit="%RH" rangeHint="Phạm vi: 50–95 %RH" />
          <TuningStepperInput label="Độ ẩm tối đa" value={form.humidity_max} onChange={set('humidity_max')} min={50} max={100} step={0.5} decimals={1} unit="%RH" rangeHint="Phạm vi: 50–100 %RH" />
          <TuningStepperInput label="Ánh sáng tối đa" subLabel="Chuẩn tối yến tổ" value={form.light_max} onChange={set('light_max')} min={0} max={5} step={0.1} decimals={1} unit="lux" rangeHint="Phạm vi: 0–5 lux" />
          <TuningStepperInput label="Ngưỡng cảnh báo khí NH3" subLabel="Chỉ cảnh báo" value={form.nh3_max} onChange={set('nh3_max')} min={1} max={100} step={1} unit="ppm" rangeHint="Phạm vi: 1–100 ppm" />
          <TuningStepperInput label="Ngưỡng cảnh báo khí CO2" subLabel="Chỉ cảnh báo" value={form.co2_max} onChange={set('co2_max')} min={400} max={5000} step={50} unit="ppm" rangeHint="Phạm vi: 400–5000 ppm" />
        </div>

        {/* Error */}
        {error && <p className="pt-2 text-xs text-red-600">{error}</p>}

        {/* Save button */}
        <div className="mt-auto pt-4 border-t border-stone-100">
          <button type="button" onClick={handleSave} disabled={isSaving}
            className={cn(
              'w-full py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150',
              isSaving ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-sm',
            )}>
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            Lưu ngưỡng môi trường
          </button>
        </div>
      </div>

      <ConfirmModal
        open={resetOpen}
        title="Khôi phục ngưỡng mặc định?"
        description="Thao tác sẽ ghi đè toàn bộ cấu hình ngưỡng hiện tại về giá trị gốc của nhà máy. Không thể hoàn tác."
        confirmLabel="Xác nhận khôi phục"
        danger
        loading={isResetting}
        onConfirm={() => { onReset(); setResetOpen(false) }}
        onCancel={() => setResetOpen(false)}
      />
    </>
  )
}
