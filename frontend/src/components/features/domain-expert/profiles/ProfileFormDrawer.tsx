import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ConfigProfile, ConfigProfileInput, HouseStage } from '@/types/expert.types'
import { FACTORY_DEFAULT_THRESHOLDS, DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'

interface Props {
  open: boolean
  initial?: ConfigProfile | null
  onClose: () => void
  onSubmit: (input: ConfigProfileInput) => void
  isPending?: boolean
}

type GroupKey = 'thresholds' | 'fuzzy_tuning' | 'detection_tuning' | 'speaker_schedule'

const DEFAULT_DETECTION = {
  noise_margin_db: 15,
  noise_min_sec: 10,
  pump_dry_on_sec: 300,
  pump_dry_min_rise_pct: 2,
  speaker_drop_pct: 70,
}

const DEFAULT_SPEAKER = {
  enabled: true,
  windows: [{ start: '05:00', end: '07:00' }],
}

function numField(label: string, value: number | undefined, onChange: (v: number) => void, min: number, max: number, step = 0.1, unit = '') {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[#878380] font-medium">{label}{unit && ` (${unit})`}</span>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-[#27231F] bg-white outline-none focus:border-[#27231F] focus:ring-1 focus:ring-[#27231F]/20"
      />
    </label>
  )
}

export default function ProfileFormDrawer({ open, initial, onClose, onSubmit, isPending }: Props) {
  const [name, setName] = useState('')
  const [stage, setStage] = useState<HouseStage | ''>('')
  const [groups, setGroups] = useState<Partial<Record<GroupKey, boolean>>>({})
  const [thresholds, setThresholds] = useState({ ...FACTORY_DEFAULT_THRESHOLDS })
  const [fuzzy, setFuzzy] = useState({ ...DEFAULT_FUZZY_TUNING })
  const [detection, setDetection] = useState({ ...DEFAULT_DETECTION })
  const [speaker, setSpeaker] = useState({ ...DEFAULT_SPEAKER })
  const [expanded, setExpanded] = useState<Partial<Record<GroupKey, boolean>>>({})

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setStage((initial.stage as HouseStage | null | undefined) ?? '')
      setGroups({
        thresholds: !!initial.thresholds,
        fuzzy_tuning: !!initial.fuzzy_tuning,
        detection_tuning: !!initial.detection_tuning,
        speaker_schedule: !!initial.speaker_schedule,
      })
      if (initial.thresholds) setThresholds({ ...initial.thresholds })
      if (initial.fuzzy_tuning) setFuzzy({ ...initial.fuzzy_tuning })
      if (initial.detection_tuning) setDetection({ ...initial.detection_tuning })
      if (initial.speaker_schedule) setSpeaker({ ...initial.speaker_schedule })
    } else {
      setName(''); setStage(''); setGroups({}); setExpanded({})
      setThresholds({ ...FACTORY_DEFAULT_THRESHOLDS })
      setFuzzy({ ...DEFAULT_FUZZY_TUNING })
      setDetection({ ...DEFAULT_DETECTION })
      setSpeaker({ ...DEFAULT_SPEAKER })
    }
  }, [open, initial])

  function handleSubmit() {
    const input: ConfigProfileInput = {
      name,
      stage: stage || null,
      ...(groups.thresholds ? { thresholds } : {}),
      ...(groups.fuzzy_tuning ? { fuzzy_tuning: fuzzy } : {}),
      ...(groups.detection_tuning ? { detection_tuning: detection } : {}),
      ...(groups.speaker_schedule ? { speaker_schedule: speaker } : {}),
    }
    onSubmit(input)
  }

  const hasGroup = Object.values(groups).some(Boolean)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-neutral-100 shrink-0">
          <h2 className="text-sm font-bold text-[#27231F]">
            {initial ? 'Sửa hồ sơ' : 'Tạo hồ sơ cấu hình mới'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-[#27231F] transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Tên + Giai đoạn */}
          <div className="space-y-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] text-[#878380] font-medium">Tên hồ sơ <span className="text-red-400">*</span></span>
              <input
                type="text"
                value={name}
                maxLength={50}
                onChange={e => setName(e.target.value)}
                placeholder="vd. Nhà dẫn dụ — mùa hè"
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-[#27231F] bg-white outline-none focus:border-[#27231F] focus:ring-1 focus:ring-[#27231F]/20"
              />
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] text-[#878380] font-medium">Giai đoạn nhà (tuỳ chọn)</span>
              <select
                value={stage}
                onChange={e => setStage(e.target.value as HouseStage | '')}
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-[#27231F] bg-white outline-none focus:border-[#27231F] appearance-none"
              >
                <option value="">— Không chỉ định —</option>
                <option value="ATTRACTING">Dẫn dụ</option>
                <option value="OCCUPIED">Đang nuôi</option>
              </select>
            </label>
          </div>

          {/* Nhóm */}
          <p className="text-[11px] font-semibold text-[#878380]">Nhóm cấu hình (chọn ít nhất 1)</p>

          <GroupToggle
            label="Ngưỡng môi trường"
            active={!!groups.thresholds}
            expanded={!!expanded.thresholds}
            onToggle={() => setGroups(g => ({ ...g, thresholds: !g.thresholds }))}
            onExpand={() => setExpanded(e => ({ ...e, thresholds: !e.thresholds }))}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              {numField('Nhiệt độ min', thresholds.temp_min, v => setThresholds(t => ({ ...t, temp_min: v })), 10, 45, 0.1, '°C')}
              {numField('Nhiệt độ max', thresholds.temp_max, v => setThresholds(t => ({ ...t, temp_max: v })), 10, 45, 0.1, '°C')}
              {numField('Độ ẩm min', thresholds.humidity_min, v => setThresholds(t => ({ ...t, humidity_min: v })), 40, 95, 0.1, '%')}
              {numField('Độ ẩm max', thresholds.humidity_max, v => setThresholds(t => ({ ...t, humidity_max: v })), 40, 95, 0.1, '%')}
              {numField('Ánh sáng max', thresholds.light_max, v => setThresholds(t => ({ ...t, light_max: v })), 0, 10, 0.01, 'lux')}
              {numField('NH3 max', thresholds.nh3_max, v => setThresholds(t => ({ ...t, nh3_max: v })), 0, 100, 1, 'ppm')}
              {numField('CO2 max', thresholds.co2_max, v => setThresholds(t => ({ ...t, co2_max: v })), 0, 5000, 1, 'ppm')}
            </div>
          </GroupToggle>

          <GroupToggle
            label="Hệ số mờ"
            active={!!groups.fuzzy_tuning}
            expanded={!!expanded.fuzzy_tuning}
            onToggle={() => setGroups(g => ({ ...g, fuzzy_tuning: !g.fuzzy_tuning }))}
            onExpand={() => setExpanded(e => ({ ...e, fuzzy_tuning: !e.fuzzy_tuning }))}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              {numField('Dải độ ẩm', fuzzy.fuzzy_humidity_band, v => setFuzzy(f => ({ ...f, fuzzy_humidity_band: v })), 2, 20, 0.5, '%RH')}
              {numField('Dải nhiệt độ', fuzzy.fuzzy_temp_band, v => setFuzzy(f => ({ ...f, fuzzy_temp_band: v })), 1, 10, 0.5, '°C')}
              {numField('Quạt khô', fuzzy.fuzzy_fan_dry_level, v => setFuzzy(f => ({ ...f, fuzzy_fan_dry_level: v })), 0, 100, 1, '%')}
              {numField('Cửa sổ', fuzzy.fuzzy_window_sec, v => setFuzzy(f => ({ ...f, fuzzy_window_sec: v })), 60, 600, 10, 'giây')}
            </div>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={fuzzy.fuzzy_input_filter}
                onChange={e => setFuzzy(f => ({ ...f, fuzzy_input_filter: e.target.checked }))}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-[#27231F]">Lọc đầu vào (median + Kalman)</span>
            </label>
          </GroupToggle>

          <GroupToggle
            label="Tham số phát hiện"
            active={!!groups.detection_tuning}
            expanded={!!expanded.detection_tuning}
            onToggle={() => setGroups(g => ({ ...g, detection_tuning: !g.detection_tuning }))}
            onExpand={() => setExpanded(e => ({ ...e, detection_tuning: !e.detection_tuning }))}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              {numField('Biên độ ồn', detection.noise_margin_db, v => setDetection(d => ({ ...d, noise_margin_db: v })), 5, 30, 1, 'dB')}
              {numField('Thời gian ồn', detection.noise_min_sec, v => setDetection(d => ({ ...d, noise_min_sec: v })), 5, 15, 1, 'giây')}
              {numField('Giây bơm', detection.pump_dry_on_sec, v => setDetection(d => ({ ...d, pump_dry_on_sec: v })), 120, 900, 30, 'giây')}
              {numField('Độ ẩm tăng', detection.pump_dry_min_rise_pct, v => setDetection(d => ({ ...d, pump_dry_min_rise_pct: v })), 0.5, 10, 0.5, '%RH')}
              {numField('Mức âm giảm', detection.speaker_drop_pct, v => setDetection(d => ({ ...d, speaker_drop_pct: v })), 30, 90, 1, '%')}
            </div>
          </GroupToggle>

          <GroupToggle
            label="Lịch phát loa"
            active={!!groups.speaker_schedule}
            expanded={!!expanded.speaker_schedule}
            onToggle={() => setGroups(g => ({ ...g, speaker_schedule: !g.speaker_schedule }))}
            onExpand={() => setExpanded(e => ({ ...e, speaker_schedule: !e.speaker_schedule }))}
          >
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={speaker.enabled} onChange={e => setSpeaker(s => ({ ...s, enabled: e.target.checked }))} className="w-3.5 h-3.5 rounded" />
                <span className="text-xs text-[#27231F]">Bật lịch phát loa</span>
              </label>
              {speaker.windows.map((w, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-[#878380]">Khung {i + 1} — Từ</span>
                    <input type="time" step="3600" value={w.start} onChange={e => setSpeaker(s => ({ ...s, windows: s.windows.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-[#27231F]" />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-[#878380]">Đến</span>
                    <input type="time" step="3600" value={w.end} onChange={e => setSpeaker(s => ({ ...s, windows: s.windows.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-[#27231F]" />
                  </label>
                </div>
              ))}
              {speaker.windows.length < 2 && (
                <button type="button" onClick={() => setSpeaker(s => ({ ...s, windows: [...s.windows, { start: '17:00', end: '19:00' }] }))} className="text-[11px] text-blue-600 hover:underline">+ Thêm khung 2</button>
              )}
            </div>
          </GroupToggle>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-neutral-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-neutral-200 text-sm font-medium text-[#27231F] hover:bg-neutral-50 transition-colors">
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !hasGroup || isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#27231F] text-white hover:bg-[#3D3630] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang lưu...</>
              : initial ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupToggle({
  label,
  active,
  expanded,
  onToggle,
  onExpand,
  children,
}: {
  label: string
  active: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border transition-colors', active ? 'border-[#27231F]/20 bg-neutral-50/80' : 'border-neutral-200 bg-white')}>
      <div className="flex items-center gap-3 p-3">
        <input type="checkbox" checked={active} onChange={onToggle} className="w-4 h-4 rounded accent-[#27231F]" />
        <span className={cn('flex-1 text-xs font-medium', active ? 'text-[#27231F]' : 'text-[#878380]')}>{label}</span>
        {active && (
          <button type="button" onClick={onExpand} className="text-neutral-400 hover:text-[#27231F]">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {active && expanded && (
        <div className="px-3 pb-3">{children}</div>
      )}
    </div>
  )
}
