// VISION-FR-019, BR-13, BR-21 — Lịch đếm chim của nhà: hồ sơ theo mùa, khung tạm, khung đang áp hôm nay và lịch sử (G-12)
import { useState } from 'react'
import { CalendarClock, Moon, Plus, Sunrise, Trash2 } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import ScheduleHistoryList from '@/components/features/domain-expert/counting-schedule/ScheduleHistoryList'
import ScheduleWindowsFields from '@/components/features/domain-expert/counting-schedule/ScheduleWindowsFields'
import { Badge, Button, EmptyState, Input, LoadingSkeleton, SectionCard, type BadgeTone } from '@/components/ui'
import { countingScheduleDict, type CountingScheduleKey } from '@/constants/countingSchedule.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useCountingSchedule, useUpdateCountingSchedule } from '@/hooks/domain-expert/useCountingSchedule'
import { useToastStore } from '@/stores/toastStore'
import { useZoneStore } from '@/stores/zoneStore'
import type { CountingSchedule, CountingWindowSource, DayWindows, TimeWindow } from '@/types/expert.types'
import {
  MAX_SCHEDULE_PROFILES, MAX_TEMPORARY_WINDOWS, PROFILE_NAME_MAX_LENGTH, validateCountingSchedule, type ScheduleError,
} from '@/validations/domain-expert/countingSchedule.validation'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'

// "05:30–07:00"
const span = (window: TimeWindow) => `${window.start}–${window.end}`
// Hồ sơ theo mùa lặp lại hằng năm nên chỉ lưu 'MM-DD'; lịch ẩn năm, chọn trong năm nhuận 2024 để có 29/02
const LEAP_YEAR_FIRST = '2024-01-01'
const LEAP_YEAR_LAST = '2024-12-31'
const toLeapDate = (monthDay: string) => (/^\d{2}-\d{2}$/.test(monthDay) ? `2024-${monthDay}` : '')
// Khung tạm không có giới hạn ngày cuối (backend không đặt); DatePicker cần max nên dùng một ngày rất xa
const NO_LAST_DATE = '9999-12-31'
// 'YYYY-MM-DD' + 1 ngày
const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
// Nhãn nguồn của khung hôm nay: khung tạm cam (ngày đặc biệt), hồ sơ mùa xanh dương, mặc định xám
const SOURCE_TONE: Record<CountingWindowSource, BadgeTone> = { TEMPORARY: 'warning', PROFILE: 'info', DEFAULT: 'neutral' }
// Nút xoá dòng: tông đỏ như nút Hủy lọc của Farm Owner (ClearFiltersButton tone danger)
const REMOVE_BUTTON_CLASS = 'border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/15'

// Lỗi của 1 dòng, đặt ngay dưới dòng đó
function RowError({ error }: { error: ScheduleError | null }) {
  const { t } = useTranslation(countingScheduleDict)
  if (!error) return null
  return <p className="text-xs text-alertRed">{t(`error.${error}` as CountingScheduleKey)}</p>
}

export default function DomainExpertCountingSchedulePage() {
  const { canDecide } = useExpertDecisionRights()
  const { t, date } = useTranslation(countingScheduleDict)
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
  // Lịch mới áp từ ngày mai (giờ VN, backend tính hôm nay), nên khung tạm bắt đầu sớm nhất từ ngày mai
  const tomorrow = nextDay(data.today.date)

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
      {/* BR-22 — Farm Owner chỉ sửa khi farm chưa có chuyên gia */}
      <fieldset disabled={!canDecide} className="contents">
      <SectionCard title={t('page.title')} description={t('page.subtitle')}>
        {/* DE-07: Khung đang áp hôm nay — 1 dòng gọn trên đầu */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5">
          <CalendarClock className="h-4 w-4 text-accent-600 shrink-0" aria-hidden />
          <span className="text-sm font-semibold text-charcoal">{t('today.title', { date: date(data.today.date) })}</span>
          <Badge tone={SOURCE_TONE[data.today.source]}>{t(`today.source.${data.today.source}`)}</Badge>
          <span className="hidden sm:inline text-warmGray">·</span>
          <span className="inline-flex items-center gap-1.5 text-sm text-accent-800">
            <Sunrise className="h-3.5 w-3.5 text-climateOrange" aria-hidden />
            {span(data.today.morning)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-accent-800">
            <Moon className="h-3.5 w-3.5 text-graphite" aria-hidden />
            {span(data.today.evening)}
          </span>
        </div>
      </SectionCard>

      {/* DE-07: Hồ sơ theo mùa — khung riêng, nút Thêm ở tiêu đề, quy tắc dài nằm trong nút (i) */}
      <SectionCard
        title={t('profiles.title')}
        description={t('profiles.count', { n: schedule.profiles.length, max: MAX_SCHEDULE_PROFILES })}
        help={t('profiles.hint', { max: MAX_SCHEDULE_PROFILES })}
        action={(
          <Button
            variant="secondary"
            size="sm"
            disabled={schedule.profiles.length >= MAX_SCHEDULE_PROFILES || save.isPending}
            onClick={() => edit({ ...schedule, profiles: [...schedule.profiles, { name: '', from: '01-01', to: '12-31', ...defaults }] })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('profiles.add')}
          </Button>
        )}
      >
        <div className="flex flex-col gap-3">
          {schedule.profiles.length === 0 && <p className="text-sm italic text-warmGray">{t('profiles.empty')}</p>}
          {schedule.profiles.map((profile, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end">
                <Input
                  id={`profile-${index}-name`}
                  label={t('profiles.name')}
                  maxLength={PROFILE_NAME_MAX_LENGTH}
                  placeholder={t('profiles.namePlaceholder')}
                  value={profile.name}
                  disabled={save.isPending}
                  onChange={event => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, name: event.target.value } : item)) })}
                />
                <DatePicker
                  id={`profile-${index}-from`}
                  label={t('profiles.from')}
                  value={toLeapDate(profile.from)}
                  min={LEAP_YEAR_FIRST}
                  max={LEAP_YEAR_LAST}
                  hideYear
                  onChange={value => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, from: value.slice(5) } : item)) })}
                />
                <DatePicker
                  id={`profile-${index}-to`}
                  label={t('profiles.to')}
                  value={toLeapDate(profile.to)}
                  min={LEAP_YEAR_FIRST}
                  max={LEAP_YEAR_LAST}
                  hideYear
                  onChange={value => edit({ ...schedule, profiles: schedule.profiles.map((item, at) => (at === index ? { ...item, to: value.slice(5) } : item)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className={REMOVE_BUTTON_CLASS}
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
        </div>
      </SectionCard>

      {/* DE-07: Khung tạm — khung riêng, nút Thêm ở tiêu đề */}
      <SectionCard
        title={t('temporary.title')}
        description={t('temporary.count', { n: schedule.temporary.length, max: MAX_TEMPORARY_WINDOWS })}
        help={t('temporary.hint', { max: MAX_TEMPORARY_WINDOWS })}
        action={(
          <Button
            variant="secondary"
            size="sm"
            disabled={schedule.temporary.length >= MAX_TEMPORARY_WINDOWS || save.isPending}
            onClick={() => edit({ ...schedule, temporary: [...schedule.temporary, { from: tomorrow, to: tomorrow, ...defaults }] })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('temporary.add')}
          </Button>
        )}
      >
        <div className="flex flex-col gap-3">
          {schedule.temporary.length === 0 && <p className="text-sm italic text-warmGray">{t('temporary.empty')}</p>}
          {schedule.temporary.map((window, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <DatePicker
                  id={`temporary-${index}-from`}
                  label={t('temporary.from')}
                  value={window.from}
                  min={tomorrow}
                  max={NO_LAST_DATE}
                  onChange={value => edit({ ...schedule, temporary: schedule.temporary.map((item, at) => (at === index ? { ...item, from: value } : item)) })}
                />
                <DatePicker
                  id={`temporary-${index}-to`}
                  label={t('temporary.to')}
                  value={window.to}
                  min={tomorrow}
                  max={NO_LAST_DATE}
                  onChange={value => edit({ ...schedule, temporary: schedule.temporary.map((item, at) => (at === index ? { ...item, to: value } : item)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className={REMOVE_BUTTON_CLASS}
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
        </div>
      </SectionCard>

      {/* Một thanh lưu chung cho cả hai khung, chỉ hiện khi có thay đổi */}
      {draft && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-warmGray/15 bg-white px-5 py-4 shadow-card">
          <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => { setDraftState(null); setShowErrors(false) }}>
            {t('save.discard')}
          </Button>
          <Button size="sm" loading={save.isPending} onClick={submit}>{t('save.submit')}</Button>
        </div>
      )}
      </fieldset>

      {/* Lịch sử các lần sửa, mới nhất trước */}
      <SectionCard title={t('history.title')}>
        <ScheduleHistoryList history={data.history} />
      </SectionCard>
    </div>
  )
}
