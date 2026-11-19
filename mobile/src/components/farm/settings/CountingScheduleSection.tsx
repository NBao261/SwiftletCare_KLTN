import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CalendarBlankIcon } from 'phosphor-react-native'
import { CountingWindowSheet, type CountingWindowTarget } from '@/components/farm/settings/CountingWindowSheet'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable, type SettingsTableRow } from '@/components/farm/settings/SettingsTable'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useCountingSchedule } from '@/hooks/farm/useCountingSchedule'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useUpdateCountingSchedule } from '@/hooks/farm/useUpdateCountingSchedule'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { CountingSchedule, CountingScheduleView, House } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  formatDateRange,
  formatDayWindows,
  formatMonthDayRange,
  MAX_SCHEDULE_PROFILES,
  MAX_TEMPORARY_WINDOWS,
  validateCountingSchedule,
} from '@/utils/countingSchedule.utils'
import { getCountingWindowSourceLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, getViewOnlyNote } from '@/utils/settingsSection.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 72

interface CountingScheduleSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Bảng hồ sơ theo mùa và bảng khung tạm; onPress chỉ có khi đang sửa
function ScheduleTables({
  schedule,
  onPressProfile,
  onPressTemporary,
}: {
  schedule: CountingSchedule
  onPressProfile?: (index: number) => void
  onPressTemporary?: (index: number) => void
}) {
  const palette = usePalette()
  const profileRows: SettingsTableRow[] = schedule.profiles.map((profile, index) => ({
    id: `profile-${index}`,
    cells: [
      { text: profile.name },
      { text: formatMonthDayRange(profile.from, profile.to) },
      { text: formatDayWindows(profile) },
    ],
    onPress: onPressProfile ? () => onPressProfile(index) : undefined,
  }))
  const temporaryRows: SettingsTableRow[] = schedule.temporary.map((window, index) => ({
    id: `temporary-${index}`,
    cells: [{ text: formatDateRange(window.from, window.to) }, { text: formatDayWindows(window) }],
    onPress: onPressTemporary ? () => onPressTemporary(index) : undefined,
  }))

  return (
    <>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Hồ sơ theo mùa (lặp lại mỗi năm)')}
      </Text>
      <SettingsTable
        columns={[
          { label: t('Tên'), flex: 1.2 },
          { label: t('Ngày'), flex: 1.2 },
          { label: t('Khung'), align: 'right', flex: 2 },
        ]}
        rows={profileRows}
        emptyText={t('Chưa có hồ sơ, dùng khung mặc định')}
      />
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Khung tạm (ưu tiên hơn hồ sơ, ví dụ những ngày mưa bão)')}
      </Text>
      <SettingsTable
        columns={[
          { label: t('Ngày'), flex: 1.5 },
          { label: t('Khung'), align: 'right', flex: 2 },
        ]}
        rows={temporaryRows}
        emptyText={t('Chưa có khung tạm')}
      />
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
  const isChanged = JSON.stringify(schedule) !== JSON.stringify(view.schedule)

  const applySchedule = (next: CountingSchedule) => {
    setSchedule(next)
    editor.setDirty(JSON.stringify(next) !== JSON.stringify(view.schedule))
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
          defaultWindows={view.default_windows}
          onSubmitProfile={profile => applySchedule({ ...schedule, profiles: replaceAt(schedule.profiles, target.index, profile) })}
          onSubmitTemporary={window =>
            applySchedule({ ...schedule, temporary: replaceAt(schedule.temporary, target.index, window) })
          }
          onDelete={
            target.index === null
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
// ngày không có hồ sơ dùng khung mặc định. Chuyên gia sửa; farm chưa có chuyên gia thì chủ trại sửa thay (BR-22); kỹ thuật viên xem
export function CountingScheduleSection({ house, editor, onSaved }: CountingScheduleSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(house.farm_id)
  const canEdit = canPerform(user, 'editCountingSchedule', { farmHasExpert: hasExpert })
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
      subtitle={formatDayWindows(view.today)}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
      footerNote={canEdit ? t('Lịch mới áp từ ngày mai; các phiên hôm nay giữ khung cũ') : undefined}
    >
      {isEditing ? (
        <CountingScheduleEditor house={house} view={view} editor={editor} onSaved={onSaved} startWith={startWith} />
      ) : (
        <>
          {/* Khung đang áp hôm nay ở dòng phụ của mục; thanh này nói khung đó lấy từ đâu */}
          <SettingsActionBar label={t('Hôm nay dùng')} value={getCountingWindowSourceLabel(view.today.source)} />
          <ScheduleTables schedule={view.schedule} />
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
              {getViewOnlyNote(canPerform(user, 'editCountingSchedule'), hasExpert)}
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
