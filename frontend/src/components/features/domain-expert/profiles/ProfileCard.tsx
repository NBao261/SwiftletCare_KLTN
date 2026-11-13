import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Archive, Pencil } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/helpers'
import type { ConfigProfile } from '@/types/expert.types'
import ProfileStatusBadge from './ProfileStatusBadge'

const STAGE_LABEL: Record<string, string> = {
  ATTRACTING: 'Dẫn dụ',
  OCCUPIED:   'Đang nuôi',
}

interface Props {
  profile: ConfigProfile
  onEdit?: () => void
  onApprove?: () => void
  onArchive?: () => void
  disabled?: boolean
}

export default function ProfileCard({ profile, onEdit, onApprove, onArchive, disabled }: Props) {
  const [expanded, setExpanded] = useState(false)

  const groups = [
    profile.thresholds ? 'Ngưỡng môi trường' : null,
    profile.fuzzy_tuning ? 'Hệ số mờ' : null,
    profile.detection_tuning ? 'Tham số phát hiện' : null,
    profile.speaker_schedule ? 'Lịch phát loa' : null,
  ].filter(Boolean)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-neutral-50/60 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-[#27231F] truncate">{profile.name}</span>
            <ProfileStatusBadge status={profile.status} />
            {profile.stage && (
              <span className="text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                {STAGE_LABEL[profile.stage] ?? profile.stage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#878380]">
            {groups.length > 0 && (
              <span>Nhóm: {groups.join(', ')}</span>
            )}
            {profile.applications.length > 0 && (
              <span>Đã áp: {profile.applications.length} lần</span>
            )}
            <span>Tạo {formatDate(profile.created_at)}</span>
          </div>
        </div>
        <div className="shrink-0 mt-0.5 text-neutral-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-3">
          {profile.thresholds && (
            <ThresholdSection thresholds={profile.thresholds} />
          )}
          {profile.fuzzy_tuning && (
            <FuzzySection fuzzy={profile.fuzzy_tuning} />
          )}
          {profile.detection_tuning && (
            <DetectionSection detection={profile.detection_tuning} />
          )}
          {profile.speaker_schedule && (
            <SpeakerSection schedule={profile.speaker_schedule} />
          )}

          {/* Actions */}
          <div className={cn('flex flex-wrap gap-2 pt-1 border-t border-neutral-100', disabled && 'opacity-50 pointer-events-none')}>
            {profile.status === 'DRAFT' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onEdit?.() }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-[#27231F] hover:bg-neutral-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Sửa
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onApprove?.() }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt hồ sơ
                </button>
              </>
            )}
            {profile.status === 'APPROVED' && (
              <button
                onClick={e => { e.stopPropagation(); onArchive?.() }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-[#878380] hover:bg-neutral-50 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" /> Lưu trữ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-[#878380]">{label}</span>
      <span className="text-xs font-medium text-[#27231F]">{String(value)}</span>
    </div>
  )
}

function GroupBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-[#878380] uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

function ThresholdSection({ thresholds }: { thresholds: NonNullable<ConfigProfile['thresholds']> }) {
  return (
    <GroupBox title="Ngưỡng môi trường">
      <FieldRow label="Nhiệt độ" value={`${thresholds.temp_min}–${thresholds.temp_max} °C`} />
      <FieldRow label="Độ ẩm" value={`${thresholds.humidity_min}–${thresholds.humidity_max} %`} />
      <FieldRow label="Ánh sáng max" value={`${thresholds.light_max} lux`} />
      <FieldRow label="NH3 max" value={`${thresholds.nh3_max} ppm`} />
      <FieldRow label="CO2 max" value={`${thresholds.co2_max} ppm`} />
    </GroupBox>
  )
}

function FuzzySection({ fuzzy }: { fuzzy: NonNullable<ConfigProfile['fuzzy_tuning']> }) {
  return (
    <GroupBox title="Hệ số mờ">
      <FieldRow label="Dải độ ẩm" value={`${fuzzy.fuzzy_humidity_band} %RH`} />
      <FieldRow label="Dải nhiệt độ" value={`${fuzzy.fuzzy_temp_band} °C`} />
      <FieldRow label="Mức quạt khi nóng khô" value={`${fuzzy.fuzzy_fan_dry_level} %`} />
      <FieldRow label="Cửa sổ điều khiển" value={`${fuzzy.fuzzy_window_sec} giây`} />
      <FieldRow label="Lọc đầu vào" value={fuzzy.fuzzy_input_filter ? 'Bật' : 'Tắt'} />
    </GroupBox>
  )
}

function DetectionSection({ detection }: { detection: NonNullable<ConfigProfile['detection_tuning']> }) {
  return (
    <GroupBox title="Tham số phát hiện">
      <FieldRow label="Biên độ ồn" value={`${detection.noise_margin_db} dB`} />
      <FieldRow label="Thời gian ồn tối thiểu" value={`${detection.noise_min_sec} giây`} />
      <FieldRow label="Giây bơm cộng dồn" value={`${detection.pump_dry_on_sec} giây`} />
      <FieldRow label="Độ ẩm phải tăng" value={`${detection.pump_dry_min_rise_pct} %RH`} />
      <FieldRow label="Mức âm giảm (loa)" value={`${detection.speaker_drop_pct} %`} />
    </GroupBox>
  )
}

function SpeakerSection({ schedule }: { schedule: NonNullable<ConfigProfile['speaker_schedule']> }) {
  return (
    <GroupBox title="Lịch phát loa">
      <FieldRow label="Trạng thái" value={schedule.enabled ? 'Bật' : 'Tắt'} />
      {schedule.windows.map((w, i) => (
        <FieldRow key={i} label={`Khung ${i + 1}`} value={`${w.start} – ${w.end}`} />
      ))}
    </GroupBox>
  )
}
