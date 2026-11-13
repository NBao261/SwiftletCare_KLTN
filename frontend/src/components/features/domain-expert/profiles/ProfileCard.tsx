import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Archive, Pencil } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/helpers'
import { Button } from '@/components/ui/Button'
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
    <div className="rounded-2xl border border-warmGray/15 bg-white shadow-card overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-warmGray/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-charcoal truncate">{profile.name}</span>
            <ProfileStatusBadge status={profile.status} />
            {profile.stage && (
              <span className="text-xs text-warmGray bg-warmGray/10 px-2 py-0.5 rounded-full border border-warmGray/15">
                {STAGE_LABEL[profile.stage] ?? profile.stage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-warmGray">
            {groups.length > 0 && (
              <span>Nhóm: {groups.join(', ')}</span>
            )}
            {profile.applications.length > 0 && (
              <span>Đã áp: {profile.applications.length} lần</span>
            )}
            <span>Tạo {formatDate(profile.created_at)}</span>
          </div>
        </div>
        <div className="shrink-0 mt-0.5 text-warmGray">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-warmGray/10 px-4 py-3 space-y-3">
          {profile.thresholds && <ThresholdSection thresholds={profile.thresholds} />}
          {profile.fuzzy_tuning && <FuzzySection fuzzy={profile.fuzzy_tuning} />}
          {profile.detection_tuning && <DetectionSection detection={profile.detection_tuning} />}
          {profile.speaker_schedule && <SpeakerSection schedule={profile.speaker_schedule} />}

          <div className={cn('flex flex-wrap gap-2 pt-1 border-t border-warmGray/10', disabled && 'opacity-50 pointer-events-none')}>
            {profile.status === 'DRAFT' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={e => { e.stopPropagation(); onEdit?.() }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Sửa
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={e => { e.stopPropagation(); onApprove?.() }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt hồ sơ
                </Button>
              </>
            )}
            {profile.status === 'APPROVED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={e => { e.stopPropagation(); onArchive?.() }}
              >
                <Archive className="w-3.5 h-3.5" /> Lưu trữ
              </Button>
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
      <span className="text-xs text-warmGray">{label}</span>
      <span className="text-sm font-medium text-charcoal">{String(value)}</span>
    </div>
  )
}

function GroupBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-warmGray/5 border border-warmGray/10 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-warmGray uppercase tracking-wide">{title}</p>
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
