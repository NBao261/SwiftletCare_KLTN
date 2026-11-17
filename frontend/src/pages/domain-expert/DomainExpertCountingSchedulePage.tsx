// VISION-FR-019, BR-13, BR-21 — Lịch đếm chim của nhà: hồ sơ theo mùa, khung tạm, khung đang áp hôm nay và lịch sử (G-12)
import { useState } from 'react'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import ScheduleWindowsFields from '@/components/features/domain-expert/counting-schedule/ScheduleWindowsFields'
import { Badge, Button, EmptyState, Input, LoadingSkeleton, SectionCard } from '@/components/ui'
import { countingScheduleDict, type CountingScheduleKey } from '@/constants/countingSchedule.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useCountingSchedule, useUpdateCountingSchedule } from '@/hooks/domain-expert/useCountingSchedule'
import { useToastStore } from '@/stores/toastStore'
import { useZoneStore } from '@/stores/zoneStore'
import type { CountingSchedule, DayWindows, TimeWindow } from '@/types/expert.types'
import {
  MAX_SCHEDULE_PROFILES, MAX_TEMPORARY_WINDOWS, PROFILE_NAME_MAX_LENGTH, validateCountingSchedule, type ScheduleError,
} from '@/validations/common/countingSchedule.validation'

// "05:30–07:00"
const span = (window: TimeWindow) => `${window.start}–${window.end}`

// Lỗi của 1 dòng, đặt ngay dưới dòng đó
function RowError({ error }: { error: ScheduleError | null }) {
  const { t } = useTranslation(countingScheduleDict)
  if (!error) return null
  return <p className="text-xs text-alertRed">{t(`error.${error}` as CountingScheduleKey)}</p>
}

export default function DomainExpertCountingSchedulePage() {
  const { t, date, dateTime } = useTranslation(countingScheduleDict)
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(state => state.push)
  const houseId = useZoneStore(state => state.selectedHouseId) || undefined
  const view = useCountingSchedule(houseId)
  const save = useUpdateCountingSchedule(houseId)
  // Bản đang sửa của nhà nào; null = chưa sửa, dùng lịch đã lưu
  const [draftState, setDraftState] = useState<{ houseId?: string; schedule: CountingSchedule } | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  if (!houseId) return <EmptyState icon={<CalendarClock className="h-8 w-8" />} title={t('page.pickHouse')} />
  if (view.isLoading) return <LoadingSkeleton count={4} className="h-24 w-full rounded-2xl" />
  if (view.isError || !view.data) {
    return (
      <EmptyState
        title={t('page.loadError')}
        description={apiErrorMessage(view.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void view.refetch()}>{t('page.retry')}</Button>}
      />
    )
  }

  const data = view.data
  const draft = draftState?.houseId === houseId ? draftState.schedule : null
  const schedule = draft ?? data.schedule
  const errors = validateCountingSchedule(schedule)
  const edit = (next: CountingSchedule) => setDraftState({ houseId, schedule: next })
  // Dòng mới lấy sẵn khung mặc định để chỉ cần sửa giờ khác
  const defaults: DayWindows = data.default_windows
  // Ngày hôm nay theo giờ VN do backend tính
  const today = data.today.date

  function submit() {
    setShowErrors(true)
    if ([...errors.profiles, ...errors.temporary].some(Boolean)) return
    save.mutate(schedule, {
      onSuccess: () => {
        push(t('save.done'))
        setDraftState(null)
        setShowErrors(false)
      },
      onError: saveError => push(apiErrorMessage(saveError), 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={t('page.title')} description={t('page.subtitle')}>
        {/* Khung đang áp hôm nay và khung mặc định */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-warmGray/15 bg-warmGray/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-charcoal">{t('today.title', { date: date(data.today.date) })}</span>
            <Badge tone={data.today.source === 'DEFAULT' ? 'neutral' : 'info'}>{t(`today.source.${data.today.source}`)}</Badge>
          </div>
          <p className="text-sm text-charcoal">{t('today.windows', { morning: span(data.today.morning), evening: span(data.today.evening) })}</p>
          <p className="text-xs text-warmGray">{t('today.default', { morning: span(defaults.morning), evening: span(defaults.evening) })}</p>
          {data.effective_from && <p className="text-xs text-warmGray">{t('today.effective', { date: date(data.effective_from) })}</p>}
        </div>

        {/* Hồ sơ theo mùa */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-h3 text-charcoal">{t('profiles.title')}</h3>
              <p className="text-xs text-warmGray">{t('profiles.hint', { max: MAX_SCHEDULE_PROFILES })}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={schedule.profiles.length >= MAX_SCHEDULE_PROFILES || save.isPending}
              onClick={() => edit({ ...schedule, profiles: [...schedule.profiles, { name: '', from: '01-01', to: '12-31', ...defaults }] })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('profiles.add')}
            </Button>
          </div>
          {schedule.profiles.length === 0 && <p className="text-sm italic text-warmGray">{t('profiles.empty')}</p>}
          {schedule.profiles.map((profile, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
                <Input
                  id={`profile-${index}-name`}
                  label={t('profiles.name')}
                  maxLength={PROFILE_NAME_MAX_LENGTH}
                  placeholder={t('profiles.namePlaceholder')}
                  value={profile.name}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, name: event.target.value } : item)) })}
                />
                <Input
                  id={`profile-${index}-from`}
                  label={t('profiles.from')}
                  placeholder="09-01"
                  maxLength={5}
                  value={profile.from}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, from: event.target.value } : item)) })}
                />
                <Input
                  id={`profile-${index}-to`}
                  label={t('profiles.to')}
                  placeholder="01-14"
                  maxLength={5}
                  value={profile.to}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, to: event.target.value } : item)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => edit({ ...schedule, profiles: schedule.profiles.filter((_, at) => at !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('row.remove')}
                </Button>
              </div>
              <ScheduleWindowsFields
                idPrefix={`profile-${index}`}
                value={profile}
                disabled={save.isPending}
                onChange={windows => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, ...windows } : item)) })}
              />
              {showErrors && <RowError error={errors.profiles[index]} />}
            </div>
          ))}
        </section>

        {/* Khung tạm */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-h3 text-charcoal">{t('temporary.title')}</h3>
              <p className="text-xs text-warmGray">{t('temporary.hint', { max: MAX_TEMPORARY_WINDOWS })}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={schedule.temporary.length >= MAX_TEMPORARY_WINDOWS || save.isPending}
              onClick={() => edit({ ...schedule, temporary: [...schedule.temporary, { from: today, to: today, ...defaults }] })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('temporary.add')}
            </Button>
          </div>
          {schedule.temporary.length === 0 && <p className="text-sm italic text-warmGray">{t('temporary.empty')}</p>}
          {schedule.temporary.map((window, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input
                  id={`temporary-${index}-from`}
                  type="date"
                  label={t('temporary.from')}
                  value={window.from}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, temporary: schedule.temporary.map((item, at) => (at === index ? { ...item, from: event.target.value } : item)) })}
                />
                <Input
                  id={`temporary-${index}-to`}
                  type="date"
                  label={t('temporary.to')}
                  value={window.to}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, temporary: schedule.temporary.map((item, at) => (at === index ? { ...item, to: event.target.value } : item)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => edit({ ...schedule, temporary: schedule.temporary.filter((_, at) => at !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('row.remove')}
                </Button>
              </div>
              <ScheduleWindowsFields
                idPrefix={`temporary-${index}`}
                value={window}
                disabled={save.isPending}
                onChange={windows => edit({ ...schedule, temporary: schedule.temporary.map((item, at) => (at === index ? { ...item, ...windows } : item)) })}
              />
              {showErrors && <RowError error={errors.temporary[index]} />}
            </div>
          ))}
        </section>

        {draft && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-warmGray/10 pt-4">
            <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => { setDraftState(null); setShowErrors(false) }}>
              {t('save.discard')}
            </Button>
            <Button size="sm" loading={save.isPending} onClick={submit}>{t('save.submit')}</Button>
          </div>
        )}
      </SectionCard>

      {/* Lịch sử các lần sửa, mới nhất trước */}
      <SectionCard title={t('history.title')}>
        {data.history.length === 0 && <p className="text-sm italic text-warmGray">{t('history.empty')}</p>}
        <ul className="flex flex-col divide-y divide-warmGray/10">
          {[...data.history].reverse().map(entry => (
            <li key={entry.changed_at} className="flex flex-col gap-0.5 py-2.5">
              <span className="text-sm text-charcoal">
                {t('history.row', { date: date(entry.effective_from), profiles: entry.schedule.profiles.length, temporary: entry.schedule.temporary.length })}
              </span>
              <span className="text-xs text-warmGray">
                {t('history.by', {
                  role: entry.changed_by_role === 'FARM_OWNER' ? t('role.FARM_OWNER') : t('role.DOMAIN_EXPERT'),
                  time: dateTime(entry.changed_at),
                })}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
