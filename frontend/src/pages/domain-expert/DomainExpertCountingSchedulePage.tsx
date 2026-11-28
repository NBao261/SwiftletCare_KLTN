// Lịch đếm chim của nhà: hồ sơ theo mùa, khung tạm, khung đang áp hôm nay và lịch sử
import { useState } from 'react'
import { CalendarClock, Moon, Sunrise } from 'lucide-react'
import { ArrowCounterClockwiseIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import StatusTabs from '@/components/common/StatusTabs'
import DatePicker from '@/components/ui/DatePicker'
import ScheduleHistoryList from '@/components/features/domain-expert/counting-schedule/ScheduleHistoryList'
import ScheduleWindowsFields from '@/components/features/domain-expert/counting-schedule/ScheduleWindowsFields'
import { Badge, Button, EmptyState, InfoTip, Input, LoadingSkeleton, SectionCard, type BadgeTone } from '@/components/ui'
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
import FieldError from '@/components/ui/FieldError'
import LoadError from '@/components/ui/LoadError'

// "05:30–07:00"
const span = (window: TimeWindow) => `${window.start}–${window.end}`
const sameWindows = (a: DayWindows, b: DayWindows) =>
  span(a.morning) === span(b.morning) && span(a.evening) === span(b.evening)
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

// Lỗi của 1 dòng, đặt ngay dưới dòng đó
function RowError({ error }: { error: ScheduleError | null }) {
  const { t } = useTranslation(countingScheduleDict)
  if (!error) return null
  return <FieldError>{t(`error.${error}` as CountingScheduleKey)}</FieldError>
}

export default function DomainExpertCountingSchedulePage() {
  // Farm Owner đặt được; farm có chuyên gia thì chuyên gia duyệt sau
  const { canEditParameters } = useExpertDecisionRights()
  const { t, date } = useTranslation(countingScheduleDict)
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(state => state.push)
  const houseId = useZoneStore(state => state.selectedHouseId) || undefined
  const view = useCountingSchedule(houseId)
  const save = useUpdateCountingSchedule(houseId)
  // Bản đang sửa của nhà nào; null = chưa sửa, dùng lịch đã lưu
  const [draftState, setDraftState] = useState<{ houseId?: string; schedule: CountingSchedule } | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // Hồ sơ theo mùa và khung tạm chung một thẻ, đổi bằng tab
  const [listTab, setListTab] = useState<'profiles' | 'temporary'>('profiles')

  if (!houseId) return <EmptyState icon={<CalendarClock className="h-8 w-8" />} title={t('page.pickHouse')} />
  if (view.isLoading) return <LoadingSkeleton count={4} className="h-24 w-full rounded-2xl" />
  if (view.isError || !view.data) {
    return (
      <LoadError title={t('page.loadError')} error={view.error} onRetry={() => void view.refetch()} />
    )
  }

  const data = view.data
  const draft = draftState?.houseId === houseId ? draftState.schedule : null
  const schedule = draft ?? data.schedule
  const errors = validateCountingSchedule(schedule)
  const edit = (next: CountingSchedule) => setDraftState({ houseId, schedule: next })
  // Dòng mới lấy sẵn khung mặc định đang sửa (của nhà, không thì hệ thống) để chỉ cần sửa giờ khác
  const defaults: DayWindows = schedule.default_windows ?? data.system_default_windows
  // Lịch mới áp từ ngày mai (giờ VN, backend tính hôm nay), nên khung tạm bắt đầu sớm nhất từ ngày mai
  const tomorrow = nextDay(data.today.date)

  function submit() {
    setShowErrors(true)
    if ([...errors.profiles, ...errors.temporary, errors.defaults].some(Boolean)) return
    save.mutate(schedule, {
      onSuccess: () => {
        push(t('save.done'))
        setDraftState(null)
        setShowErrors(false)
      },
      onError: saveError => push(apiErrorMessage(saveError), 'error'),
    })
  }

  // Nút xoá một dòng: chỉ biểu tượng thùng rác, có chú thích
  const removeButton = (onRemove: () => void) => (
    <Button variant="icon" size="sm" disabled={save.isPending} onClick={onRemove} aria-label={t('row.remove')} title={t('row.remove')}>
      <TrashIcon size={16} />
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Farm Owner sửa được; farm có chuyên gia thì chuyên gia duyệt sau */}
      <fieldset disabled={!canEditParameters} className="contents">
      {/* Khung đang áp (hôm nay, và ngày mai khi lịch đã lưu đổi khung) cùng khung mặc định của nhà */}
      <SectionCard description={t('page.subtitle')}>
        <div className="flex flex-col gap-2">
          {[data.today, ...(sameWindows(data.today, data.tomorrow) ? [] : [data.tomorrow])].map(day => (
            <div key={day.date} className="flex flex-wrap items-center gap-2 rounded-xl bg-warmGray/10 px-4 py-2.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-graphite" aria-hidden />
              <span className="text-sm font-semibold text-charcoal">
                {day === data.today ? t('today.title', { date: date(day.date) }) : t('tomorrow.title', { date: date(day.date) })}
              </span>
              <Badge tone={SOURCE_TONE[day.source]}>{t(`today.source.${day.source}`)}</Badge>
              <span className="hidden text-warmGray sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-charcoal">
                <Sunrise className="h-3.5 w-3.5 text-climateOrange" aria-hidden />
                {span(day.morning)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-charcoal">
                <Moon className="h-3.5 w-3.5 text-graphite" aria-hidden />
                {span(day.evening)}
              </span>
            </div>
          ))}
        </div>

        {/* Khung mặc định của nhà: áp cho ngày không có hồ sơ hay khung tạm */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1 text-h3 text-charcoal">
                {t('defaults.title')}
                <InfoTip>{t('defaults.hint')}</InfoTip>
              </h3>
              <p className="text-small text-warmGray">{schedule.default_windows ? t('defaults.custom') : t('defaults.system')}</p>
            </div>
            {schedule.default_windows && (
              <Button
                variant="secondary"
                size="sm"
                disabled={save.isPending}
                onClick={() => edit({ profiles: schedule.profiles, temporary: schedule.temporary })}
              >
                <ArrowCounterClockwiseIcon size={14} weight="bold" aria-hidden />
                {t('defaults.reset')}
              </Button>
            )}
          </div>
          <ScheduleWindowsFields
            idPrefix="defaults"
            value={schedule.default_windows ?? data.system_default_windows}
            disabled={save.isPending}
            onChange={windows => edit({ ...schedule, default_windows: windows })}
          />
          {showErrors && <RowError error={errors.defaults} />}
        </div>
      </SectionCard>

      {/* Hồ sơ theo mùa và khung tạm: một thẻ hai tab, nút Thêm theo tab đang mở, quy tắc dài nằm trong nút (i) */}
      <SectionCard
        description={listTab === 'profiles'
          ? t('profiles.count', { n: schedule.profiles.length, max: MAX_SCHEDULE_PROFILES })
          : t('temporary.count', { n: schedule.temporary.length, max: MAX_TEMPORARY_WINDOWS })}
        help={listTab === 'profiles' ? t('profiles.hint', { max: MAX_SCHEDULE_PROFILES }) : t('temporary.hint', { max: MAX_TEMPORARY_WINDOWS })}
        action={listTab === 'profiles' ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={schedule.profiles.length >= MAX_SCHEDULE_PROFILES || save.isPending}
            onClick={() => edit({ ...schedule, profiles: [...schedule.profiles, { name: '', from: '01-01', to: '12-31', ...defaults }] })}
          >
            <PlusIcon size={14} weight="bold" aria-hidden />
            {t('profiles.add')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={schedule.temporary.length >= MAX_TEMPORARY_WINDOWS || save.isPending}
            onClick={() => edit({ ...schedule, temporary: [...schedule.temporary, { from: tomorrow, to: tomorrow, ...defaults }] })}
          >
            <PlusIcon size={14} weight="bold" aria-hidden />
            {t('temporary.add')}
          </Button>
        )}
      >
        <StatusTabs
          variant="underline"
          ariaLabel={t('profiles.title')}
          value={listTab}
          onChange={setListTab}
          tabs={[
            { id: 'profiles', label: `${t('profiles.title')} (${schedule.profiles.length})` },
            { id: 'temporary', label: `${t('temporary.title')} (${schedule.temporary.length})` },
          ]}
        />

        {listTab === 'profiles' ? (
          <div className="flex flex-col divide-y divide-warmGray/10">
            {schedule.profiles.length === 0 && <p className="py-2 text-sm italic text-warmGray">{t('profiles.empty')}</p>}
            {schedule.profiles.map((profile, index) => (
              <div key={index} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
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
                  {removeButton(() => edit({ ...schedule, profiles: schedule.profiles.filter((_, at) => at !== index) }))}
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
        ) : (
          <div className="flex flex-col divide-y divide-warmGray/10">
            {schedule.temporary.length === 0 && <p className="py-2 text-sm italic text-warmGray">{t('temporary.empty')}</p>}
            {schedule.temporary.map((window, index) => (
              <div key={index} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
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
                  {removeButton(() => edit({ ...schedule, temporary: schedule.temporary.filter((_, at) => at !== index) }))}
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
        )}
      </SectionCard>

      {/* Một thanh lưu chung cho mọi khung, dính đáy, chỉ hiện khi có thay đổi */}
      {draft && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-warmGray/15 bg-white px-4 py-3 shadow-dock max-lg:bottom-24">
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
