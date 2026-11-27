import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CalendarBlankIcon } from 'phosphor-react-native'
import { CountingWindowSheet, type CountingWindowTarget } from '@/components/farm/settings/CountingWindowSheet'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsList, SettingsListRow } from '@/components/farm/settings/SettingsListRow'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useCountingSchedule } from '@/hooks/farm/useCountingSchedule'
import { useExpertReviewNote } from '@/hooks/farm/useExpertReviewNote'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateCountingSchedule } from '@/hooks/farm/useUpdateCountingSchedule'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { CountingDayWindows, CountingSchedule, CountingScheduleView, House } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  countDays,
  formatDateRange,
  formatDayWindowsInline,
  formatMonthDayRange,
  MAX_SCHEDULE_PROFILES,
  MAX_TEMPORARY_WINDOWS,
  validateCountingSchedule,
} from '@/utils/countingSchedule.utils'
import { getCountingWindowSourceLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, joinFooterNotes, withExpertReviewMessage } from '@/utils/settingsSection.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 72

interface CountingScheduleSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Khung đang áp cho ngày không thuộc hồ sơ hay khung tạm: khung riêng của nhà trong bản nháp, không có thì khung hệ thống
function getEffectiveDefault(schedule: CountingSchedule, view: CountingScheduleView): CountingDayWindows {
  if (schedule.default_windows) return schedule.default_windows
  return view.system_default_windows ?? view.default_windows
}

// Bản nháp có khác lịch đang lưu không; chưa đặt và đã bỏ khung mặc định riêng (undefined, null) coi là như nhau
function isScheduleChanged(draft: CountingSchedule, saved: CountingSchedule): boolean {
  const normalize = (schedule: CountingSchedule) =>
    JSON.stringify({ ...schedule, default_windows: schedule.default_windows ?? null })
  return normalize(draft) !== normalize(saved)
}

// Khung mặc định, danh sách hồ sơ theo mùa và khung tạm; onPress chỉ có khi đang sửa
function ScheduleTables({
  schedule,
  view,
  onPressDefault,
  onPressProfile,
  onPressTemporary,
}: {
  schedule: CountingSchedule
  view: CountingScheduleView
  onPressDefault?: () => void
  onPressProfile?: (index: number) => void
  onPressTemporary?: (index: number) => void
}) {
  const palette = usePalette()

  return (
    <>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Khung mặc định (ngày không thuộc hồ sơ hay khung tạm)')}
      </Text>
      <SettingsList isEmpty={false} emptyText="">
        <SettingsListRow
          title={schedule.default_windows ? t('Khung riêng của nhà') : t('Khung hệ thống')}
          caption={formatDayWindowsInline(getEffectiveDefault(schedule, view))}
          hasDivider={false}
          onPress={onPressDefault}
        />
      </SettingsList>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Hồ sơ theo mùa (lặp lại mỗi năm)')}
      </Text>
      <SettingsList isEmpty={schedule.profiles.length === 0} emptyText={t('Chưa có hồ sơ, dùng khung mặc định')}>
        {schedule.profiles.map((profile, index) => (
          <SettingsListRow
            key={`profile-${index}`}
            title={formatMonthDayRange(profile.from, profile.to)}
            trailing={profile.name}
            isTrailingMuted
            caption={formatDayWindowsInline(profile)}
            hasDivider={index > 0}
            onPress={onPressProfile ? () => onPressProfile(index) : undefined}
          />
        ))}
      </SettingsList>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Khung tạm (ưu tiên hơn hồ sơ, ví dụ những ngày mưa bão)')}
      </Text>
      <SettingsList isEmpty={schedule.temporary.length === 0} emptyText={t('Chưa có khung tạm')}>
        {schedule.temporary.map((window, index) => (
          <SettingsListRow
            key={`temporary-${index}`}
            title={formatDateRange(window.from, window.to)}
            trailing={t('{days} ngày', { days: countDays(window.from, window.to) })}
            isTrailingMuted
            caption={formatDayWindowsInline(window)}
            hasDivider={index > 0}
            onPress={onPressTemporary ? () => onPressTemporary(index) : undefined}
          />
        ))}
      </SettingsList>
    </>
  )
}

// Phần đang sửa: bản nháp lịch, chạm một dòng để sửa hoặc xoá, thêm hồ sơ hay khung tạm; Cập nhật kiểm chồng ngày rồi gửi cả lịch (backend áp từ ngày mai)
function CountingScheduleEditor({
  house,
  view,
  editor,
  onSaved,
  startWith,
}: CountingScheduleSectionProps & { view: CountingScheduleView; startWith: 'profile' | 'temporary' | null }) {
  const [schedule, setSchedule] = useState<CountingSchedule>(view.schedule)
  // Bấm "Thêm…" khi đang xem: vào chế độ sửa và mở sẵn sheet thêm
  const [target, setTarget] = useState<{ value: CountingWindowTarget; index: number | null } | null>(() =>
    startWith ? { value: { kind: startWith, initial: null }, index: null } : null,
  )
  const [error, setError] = useState<string | null>(null)
  const updateCountingSchedule = useUpdateCountingSchedule()
  const isChanged = isScheduleChanged(schedule, view.schedule)

  const applySchedule = (next: CountingSchedule) => {
    setSchedule(next)
    editor.setDirty(isScheduleChanged(next, view.schedule))
    setTarget(null)
    setError(null)
  }

  // Thay mục ở vị trí index, không có index thì thêm vào cuối
  const replaceAt = <Item,>(items: Item[], index: number | null, item: Item): Item[] =>
    index === null ? [...items, item] : items.map((current, position) => (position === index ? item : current))

  const submit = () => {
    const scheduleError = validateCountingSchedule(schedule)
    if (scheduleError) {
      setError(scheduleError)
      return
    }
    setError(null)
    updateCountingSchedule.mutate(
      { houseId: house._id, schedule },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu lịch đếm chim, áp từ ngày mai'))
        },
        onError: saveError => setError(getSettingsErrorMessage(saveError)),
      },
    )
  }

  return (
    <>
      <ScheduleTables
        schedule={schedule}
        view={view}
        onPressDefault={() => setTarget({ value: { kind: 'default', initial: getEffectiveDefault(schedule, view) }, index: null })}
        onPressProfile={index => setTarget({ value: { kind: 'profile', initial: schedule.profiles[index] }, index })}
        onPressTemporary={index => setTarget({ value: { kind: 'temporary', initial: schedule.temporary[index] }, index })}
      />
      <View style={styles.addRow}>
        <Button
          label={t('Thêm hồ sơ')}
          variant="outline"
          size="md"
          onPress={() => setTarget({ value: { kind: 'profile', initial: null }, index: null })}
          disabled={schedule.profiles.length >= MAX_SCHEDULE_PROFILES}
          style={styles.flex}
        />
        <Button
          label={t('Thêm khung tạm')}
          variant="outline"
          size="md"
          onPress={() => setTarget({ value: { kind: 'temporary', initial: null }, index: null })}
          disabled={schedule.temporary.length >= MAX_TEMPORARY_WINDOWS}
          style={styles.flex}
        />
      </View>
      <SettingsEditActions
        onSave={submit}
        onCancel={editor.cancelEditing}
        isSaving={updateCountingSchedule.isPending}
        isSaveDisabled={!isChanged}
        error={error}
      />
      {target && (
        <CountingWindowSheet
          target={target.value}
          defaultWindows={getEffectiveDefault(schedule, view)}
          onSubmitProfile={profile => applySchedule({ ...schedule, profiles: replaceAt(schedule.profiles, target.index, profile) })}
          onSubmitTemporary={window =>
            applySchedule({ ...schedule, temporary: replaceAt(schedule.temporary, target.index, window) })
          }
          onSubmitDefault={windows => applySchedule({ ...schedule, default_windows: windows })}
          onDelete={
            target.value.kind === 'default'
              ? schedule.default_windows
                ? () => applySchedule({ ...schedule, default_windows: null })
                : undefined
              : target.index === null
                ? undefined
                : () =>
                  applySchedule(
                    target.value.kind === 'profile'
                      ? { ...schedule, profiles: schedule.profiles.filter((_, position) => position !== target.index) }
                      : { ...schedule, temporary: schedule.temporary.filter((_, position) => position !== target.index) },
                  )
          }
          onClose={() => setTarget(null)}
        />
      )}
    </>
  )
}

// Mục "Lịch đếm chim" của nhà (VISION-FR-019, BR-13): hồ sơ theo mùa và khung tạm của phiên sáng (chim ra) và chiều (chim về);
// ngày không có hồ sơ dùng khung mặc định. Chuyên gia và chủ trại sửa, farm có chuyên gia thì lịch của chủ trại áp ngay và mở mục
// duyệt (BR-22 nhóm A); kỹ thuật viên chỉ xem
export function CountingScheduleSection({ house, editor, onSaved }: CountingScheduleSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const canEdit = canPerform(user, 'editCountingSchedule')
  const reviewNote = useExpertReviewNote(house.farm_id)
  const showSaved = (message: string) => onSaved(withExpertReviewMessage(message, reviewNote))
  const scheduleQuery = useCountingSchedule(house._id)
  const id = getSettingsSectionId('counting-schedule')
  const isEditing = editor.isEditing(id)
  const [startWith, setStartWith] = useState<'profile' | 'temporary' | null>(null)

  // Thêm ngay từ chế độ xem: mở chế độ sửa rồi mở sheet thêm
  const startAdding = (kind: 'profile' | 'temporary') => {
    setStartWith(kind)
    editor.startEditing(id)
  }

  if (scheduleQuery.isLoading) return <Skeleton width="100%" height={SECTION_SKELETON_HEIGHT} />
  if (scheduleQuery.isError || !scheduleQuery.data) {
    return (
      <EmptyState message={t('Không tải được lịch đếm chim')} actionLabel={t('Thử lại')} onAction={() => scheduleQuery.refetch()} />
    )
  }
  const view = scheduleQuery.data

  return (
    <SettingsSection
      icon={CalendarBlankIcon}
      title={t('Lịch đếm chim')}
      subtitle={`${formatDayWindowsInline(view.today)}\n${t('Hôm nay dùng: {source}', { source: getCountingWindowSourceLabel(view.today.source) })}`}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
      footerNote={canEdit ? joinFooterNotes(t('Lịch mới áp từ ngày mai; các phiên hôm nay giữ khung cũ'), reviewNote) : undefined}
    >
      {isEditing ? (
        <CountingScheduleEditor house={house} view={view} editor={editor} onSaved={showSaved} startWith={startWith} />
      ) : (
        <>
          <ScheduleTables schedule={view.schedule} view={view} />
          {canEdit ? (
            <View style={styles.addRow}>
              <Button label={t('Thêm hồ sơ')} variant="outline" size="md" onPress={() => startAdding('profile')} style={styles.flex} />
              <Button
                label={t('Thêm khung tạm')}
                variant="outline"
                size="md"
                onPress={() => startAdding('temporary')}
                style={styles.flex}
              />
            </View>
          ) : (
            <Text variant="small" color={palette.textSecondary}>
              {t('Bạn chỉ xem mục này')}
            </Text>
          )}
        </>
      )}
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
})
