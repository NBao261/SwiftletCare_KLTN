import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
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

function NumField({ label, value, onChange, min, max, step = 0.1, unit = '' }: {
  label: string; value: number | undefined; onChange: (v: number) => void
  min: number; max: number; step?: number; unit?: string
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs text-warmGray font-medium">{label}{unit && ` (${unit})`}</span>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-warmGray/15 px-2.5 py-1.5 text-sm text-charcoal bg-white outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal/20"
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

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'Sửa hồ sơ' : 'Tạo hồ sơ cấu hình mới'}>
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Tên + Giai đoạn */}
        <div className="space-y-3">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-warmGray font-medium">Tên hồ sơ <span className="text-alertRed">*</span></span>
            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={e => setName(e.target.value)}
              placeholder="vd. Nhà dẫn dụ — mùa hè"
              className="w-full rounded-lg border border-warmGray/15 px-2.5 py-1.5 text-sm text-charcoal bg-white outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal/20"
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-warmGray font-medium">Giai đoạn nhà (tuỳ chọn)</span>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as HouseStage | '')}
              className="w-full rounded-lg border border-warmGray/15 px-2.5 py-1.5 text-sm text-charcoal bg-white outline-none focus:border-charcoal appearance-none"
            >
              <option value="">— Không chỉ định —</option>
              <option value="ATTRACTING">Dẫn dụ</option>
              <option value="OCCUPIED">Đang nuôi</option>
            </select>
          </label>
        </div>

        <p className="text-xs font-semibold text-warmGray">Nhóm cấu hình (chọn ít nhất 1)</p>

        <GroupToggle
          label="Ngưỡng môi trường"
          active={!!groups.thresholds}
          expanded={!!expanded.thresholds}
          onToggle={() => setGroups(g => ({ ...g, thresholds: !g.thresholds }))}
          onExpand={() => setExpanded(e => ({ ...e, thresholds: !e.thresholds }))}
        >
          <div className="grid grid-cols-2 gap-2 mt-2">
            <NumField label="Nhiệt độ min" value={thresholds.temp_min} onChange={v => setThresholds(t => ({ ...t, temp_min: v }))} min={10} max={45} unit="°C" />
            <NumField label="Nhiệt độ max" value={thresholds.temp_max} onChange={v => setThresholds(t => ({ ...t, temp_max: v }))} min={10} max={45} unit="°C" />
            <NumField label="Độ ẩm min" value={thresholds.humidity_min} onChange={v => setThresholds(t => ({ ...t, humidity_min: v }))} min={40} max={95} unit="%" />
            <NumField label="Độ ẩm max" value={thresholds.humidity_max} onChange={v => setThresholds(t => ({ ...t, humidity_max: v }))} min={40} max={95} unit="%" />
            <NumField label="Ánh sáng max" value={thresholds.light_max} onChange={v => setThresholds(t => ({ ...t, light_max: v }))} min={0} max={10} step={0.01} unit="lux" />
            <NumField label="NH3 max" value={thresholds.nh3_max} onChange={v => setThresholds(t => ({ ...t, nh3_max: v }))} min={0} max={100} step={1} unit="ppm" />
            <NumField label="CO2 max" value={thresholds.co2_max} onChange={v => setThresholds(t => ({ ...t, co2_max: v }))} min={0} max={5000} step={1} unit="ppm" />
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
            <NumField label="Dải độ ẩm" value={fuzzy.fuzzy_humidity_band} onChange={v => setFuzzy(f => ({ ...f, fuzzy_humidity_band: v }))} min={2} max={20} step={0.5} unit="%RH" />
            <NumField label="Dải nhiệt độ" value={fuzzy.fuzzy_temp_band} onChange={v => setFuzzy(f => ({ ...f, fuzzy_temp_band: v }))} min={1} max={10} step={0.5} unit="°C" />
            <NumField label="Quạt khô" value={fuzzy.fuzzy_fan_dry_level} onChange={v => setFuzzy(f => ({ ...f, fuzzy_fan_dry_level: v }))} min={0} max={100} step={1} unit="%" />
            <NumField label="Cửa sổ" value={fuzzy.fuzzy_window_sec} onChange={v => setFuzzy(f => ({ ...f, fuzzy_window_sec: v }))} min={60} max={600} step={10} unit="giây" />
          </div>
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={fuzzy.fuzzy_input_filter}
              onChange={e => setFuzzy(f => ({ ...f, fuzzy_input_filter: e.target.checked }))}
              className="w-4 h-4 rounded accent-charcoal"
            />
            <span className="text-sm text-charcoal">Lọc đầu vào (median + Kalman)</span>
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
            <NumField label="Biên độ ồn" value={detection.noise_margin_db} onChange={v => setDetection(d => ({ ...d, noise_margin_db: v }))} min={5} max={30} step={1} unit="dB" />
            <NumField label="Thời gian ồn" value={detection.noise_min_sec} onChange={v => setDetection(d => ({ ...d, noise_min_sec: v }))} min={5} max={15} step={1} unit="giây" />
            <NumField label="Giây bơm" value={detection.pump_dry_on_sec} onChange={v => setDetection(d => ({ ...d, pump_dry_on_sec: v }))} min={120} max={900} step={30} unit="giây" />
            <NumField label="Độ ẩm tăng" value={detection.pump_dry_min_rise_pct} onChange={v => setDetection(d => ({ ...d, pump_dry_min_rise_pct: v }))} min={0.5} max={10} step={0.5} unit="%RH" />
            <NumField label="Mức âm giảm" value={detection.speaker_drop_pct} onChange={v => setDetection(d => ({ ...d, speaker_drop_pct: v }))} min={30} max={90} step={1} unit="%" />
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
              <input type="checkbox" checked={speaker.enabled} onChange={e => setSpeaker(s => ({ ...s, enabled: e.target.checked }))} className="w-4 h-4 rounded accent-charcoal" />
              <span className="text-sm text-charcoal">Bật lịch phát loa</span>
            </label>
            {speaker.windows.map((w, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-warmGray">Khung {i + 1} — Từ</span>
                  <input type="time" step="3600" value={w.start} onChange={e => setSpeaker(s => ({ ...s, windows: s.windows.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))} className="rounded-lg border border-warmGray/15 px-2 py-1.5 text-sm text-charcoal" />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-warmGray">Đến</span>
                  <input type="time" step="3600" value={w.end} onChange={e => setSpeaker(s => ({ ...s, windows: s.windows.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))} className="rounded-lg border border-warmGray/15 px-2 py-1.5 text-sm text-charcoal" />
                </label>
              </div>
            ))}
            {speaker.windows.length < 2 && (
              <button type="button" onClick={() => setSpeaker(s => ({ ...s, windows: [...s.windows, { start: '17:00', end: '19:00' }] }))} className="text-xs text-blue-600 hover:underline">+ Thêm khung 2</button>
            )}
          </div>
        </GroupToggle>
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-4 border-t border-warmGray/10 flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Huỷ</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim() || !hasGroup}
          loading={isPending}
        >
          {initial ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
        </Button>
      </div>
    </Drawer>
  )
}

function GroupToggle({
  label, active, expanded, onToggle, onExpand, children,
}: {
  label: string; active: boolean; expanded: boolean
  onToggle: () => void; onExpand: () => void; children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border transition-colors', active ? 'border-charcoal/20 bg-warmGray/5' : 'border-warmGray/15 bg-white')}>
      <div className="flex items-center gap-3 p-3">
        <input type="checkbox" checked={active} onChange={onToggle} className="w-4 h-4 rounded accent-charcoal" />
        <span className={cn('flex-1 text-sm font-medium', active ? 'text-charcoal' : 'text-warmGray')}>{label}</span>
        {active && (
          <button type="button" onClick={onExpand} className="text-warmGray hover:text-charcoal">
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
