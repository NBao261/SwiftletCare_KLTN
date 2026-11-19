import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Archive, Pencil } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/helpers'
import { Button } from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { ConfigProfile } from '@/types/expert.types'
import ProfileStatusBadge from './ProfileStatusBadge'
import { t, translated } from '@/i18n'

const STAGE_LABEL: Record<string, string> = translated({
  ATTRACTING: 'Dẫn dụ',
  OCCUPIED:   'Đang nuôi',
})

interface Props {
  profile: ConfigProfile
  onEdit?: () => void
  onApprove?: () => void
  onArchive?: () => void
  disabled?: boolean
  // Farm Owner xem hồ sơ, không soạn hay duyệt (Report 3 §2.4)
  readOnly?: boolean
}

export default function ProfileCard({ profile, onEdit, onApprove, onArchive, disabled, readOnly }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'approve' | 'archive' | null>(null)

  const groups = [
    profile.thresholds ? t('Ngưỡng môi trường') : null,
    profile.fuzzy_tuning ? t('Hệ số mờ') : null,
    profile.detection_tuning ? t('Tham số phát hiện') : null,
    profile.speaker_schedule ? t('Lịch phát loa') : null,
  ].filter(Boolean)

  return (
    <div className="rounded-2xl border border-warmGray/15 bg-white shadow-card overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`profile-detail-${profile._id}`}
        className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-warmGray/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) } }}
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
              <span>{t('Nhóm: {{groups}}', { groups: groups.join(', ') })}</span>
            )}
            {profile.applications.length > 0 && (
              <span>{t('Đã áp: {{n}} lần', { n: profile.applications.length })}</span>
            )}
            <span>{t('Tạo {{date}}', { date: formatDate(profile.created_at) })}</span>
          </div>
        </div>
        <div className="shrink-0 mt-0.5 text-warmGray">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div id={`profile-detail-${profile._id}`} className="border-t border-warmGray/10 px-4 py-3 space-y-3">
          {profile.thresholds && <ThresholdSection thresholds={profile.thresholds} />}
          {profile.fuzzy_tuning && <FuzzySection fuzzy={profile.fuzzy_tuning} />}
          {profile.detection_tuning && <DetectionSection detection={profile.detection_tuning} />}
          {profile.speaker_schedule && <SpeakerSection schedule={profile.speaker_schedule} />}

          {!readOnly && <div className={cn('flex flex-wrap gap-2 pt-1 border-t border-warmGray/10', disabled && 'opacity-50 pointer-events-none')}>
            {profile.status === 'DRAFT' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={e => { e.stopPropagation(); onEdit?.() }}
                >
                  <Pencil className="w-3.5 h-3.5" /> {t('Sửa')}
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={e => { e.stopPropagation(); setConfirmAction('approve') }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('Duyệt hồ sơ')}
                </Button>
              </>
            )}
            {profile.status === 'APPROVED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={e => { e.stopPropagation(); setConfirmAction('archive') }}
              >
                <Archive className="w-3.5 h-3.5" /> {t('Lưu trữ')}
              </Button>
            )}
          </div>}
        </div>
      )}

      <ConfirmModal
        open={confirmAction === 'approve'}
        title={t('Duyệt hồ sơ cấu hình')}
        description={t('Hồ sơ "{{name}}" sẽ chuyển sang trạng thái Đã duyệt và sẵn sàng để Chủ nhà yến áp dụng. Tiếp tục?', { name: profile.name })}
        confirmLabel={t('Duyệt')}
        loading={disabled}
        onConfirm={() => { setConfirmAction(null); onApprove?.() }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmModal
        open={confirmAction === 'archive'}
        title={t('Lưu trữ hồ sơ cấu hình')}
        description={t('Hồ sơ "{{name}}" sẽ bị lưu trữ và không còn áp dụng được. Thao tác này không thể hoàn tác.', { name: profile.name })}
        confirmLabel={t('Lưu trữ')}
        danger
        loading={disabled}
        onConfirm={() => { setConfirmAction(null); onArchive?.() }}
        onCancel={() => setConfirmAction(null)}
      />
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
    <GroupBox title={t('Ngưỡng môi trường')}>
      <FieldRow label={t('Nhiệt độ')} value={`${thresholds.temp_min}–${thresholds.temp_max} °C`} />
      <FieldRow label={t('Độ ẩm')} value={`${thresholds.humidity_min}–${thresholds.humidity_max} %`} />
      <FieldRow label={t('Ánh sáng max')} value={`${thresholds.light_max} lux`} />
      <FieldRow label="NH3 max" value={`${thresholds.nh3_max} ppm`} />
      <FieldRow label="CO2 max" value={`${thresholds.co2_max} ppm`} />
    </GroupBox>
  )
}

function FuzzySection({ fuzzy }: { fuzzy: NonNullable<ConfigProfile['fuzzy_tuning']> }) {
  return (
    <GroupBox title={t('Hệ số mờ')}>
      <FieldRow label={t('Dải độ ẩm')} value={`${fuzzy.fuzzy_humidity_band} %RH`} />
      <FieldRow label={t('Dải nhiệt độ')} value={`${fuzzy.fuzzy_temp_band} °C`} />
      <FieldRow label={t('Mức quạt khi nóng khô')} value={`${fuzzy.fuzzy_fan_dry_level} %`} />
      <FieldRow label={t('Cửa sổ điều khiển')} value={`${fuzzy.fuzzy_window_sec} ${t('giây')}`} />
      <FieldRow label={t('Lọc đầu vào')} value={fuzzy.fuzzy_input_filter ? t('Bật') : t('Tắt')} />
    </GroupBox>
  )
}

function DetectionSection({ detection }: { detection: NonNullable<ConfigProfile['detection_tuning']> }) {
  return (
    <GroupBox title={t('Tham số phát hiện')}>
      <FieldRow label={t('Biên độ ồn')} value={`${detection.noise_margin_db} dB`} />
      <FieldRow label={t('Thời gian ồn tối thiểu')} value={`${detection.noise_min_sec} ${t('giây')}`} />
      <FieldRow label={t('Giây bơm cộng dồn')} value={`${detection.pump_dry_on_sec} ${t('giây')}`} />
      <FieldRow label={t('Độ ẩm phải tăng')} value={`${detection.pump_dry_min_rise_pct} %RH`} />
      <FieldRow label={t('Mức âm giảm (loa)')} value={`${detection.speaker_drop_pct} %`} />
    </GroupBox>
  )
}

function SpeakerSection({ schedule }: { schedule: NonNullable<ConfigProfile['speaker_schedule']> }) {
  return (
    <GroupBox title={t('Lịch phát loa')}>
      <FieldRow label={t('Trạng thái')} value={schedule.enabled ? t('Bật') : t('Tắt')} />
      {schedule.windows.map((w, i) => (
        <FieldRow key={i} label={t('Khung {{n}}', { n: i + 1 })} value={`${w.start} – ${w.end}`} />
      ))}
    </GroupBox>
  )
}
