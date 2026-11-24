import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CountingDayWindows, SeasonalCountingProfile, TemporaryCountingWindow } from '@/types'
import {
  PROFILE_NAME_MAX_LENGTH,
  validateProfile,
  validateTemporaryWindow,
} from '@/utils/countingSchedule.utils'
import { shiftDate } from '@/utils/healthDay.utils'
import { getVietnamDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Sheet nhập một hồ sơ theo mùa hoặc một khung tạm của lịch đếm (VISION-FR-019)
export type CountingWindowTarget =
  | { kind: 'profile'; initial: SeasonalCountingProfile | null }
  | { kind: 'temporary'; initial: TemporaryCountingWindow | null }

interface CountingWindowSheetProps {
  target: CountingWindowTarget
  // Khung mặc định điền sẵn cho mục mới (BR-13)
  defaultWindows: CountingDayWindows
  onSubmitProfile: (profile: SeasonalCountingProfile) => void
  onSubmitTemporary: (window: TemporaryCountingWindow) => void
  // Chỉ có khi sửa mục đã có
  onDelete?: () => void
  onClose: () => void
}

// Phần ô nhập cuộn được, để nút Xong luôn thấy khi bàn phím mở
const FORM_MAX_HEIGHT = 420

// Ngày YYYY-MM-DD thành dd/MM/yyyy
function formatFullDate(date: string): string {
  return date.split('-').reverse().join('/')
}

// Một dòng chọn ngày bằng ‹ › (chưa có thư viện chọn ngày, như ngày thu hoạch)
function DateStepper({ label, date, onChange }: { label: string; date: string; onChange: (date: string) => void }) {
  const palette = usePalette()
  return (
    <View style={styles.field}>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {label}
      </Text>
      <View style={[styles.dateRow, { backgroundColor: palette.surfaceStrong }]}>
        <IconButton icon={CaretLeftIcon} label={t('Ngày trước')} onPress={() => onChange(shiftDate(date, -1))} />
        <Text variant="body" weight="semiBold" center style={styles.flex} accessibilityLiveRegion="polite">
          {formatFullDate(date)}
        </Text>
        <IconButton icon={CaretRightIcon} label={t('Ngày sau')} onPress={() => onChange(shiftDate(date, 1))} />
      </View>
    </View>
  )
}

// Hai ô giờ của một khung: bắt đầu, kết thúc
function WindowFields({
  label,
  start,
  end,
  onChange,
}: {
  label: string
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const palette = usePalette()
  return (
    <View style={styles.field}>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {label}
      </Text>
      <View style={styles.row}>
        <TextField
          label={t('Bắt đầu (HH:mm)')}
          value={start}
          onChangeText={value => onChange(value, end)}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={styles.flex}
        />
        <TextField
          label={t('Kết thúc (HH:mm)')}
          value={end}
          onChangeText={value => onChange(start, value)}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={styles.flex}
        />
      </View>
    </View>
  )
}

// Hồ sơ theo mùa: tên, khoảng ngày trong năm MM-DD, khung sáng và chiều. Khung tạm: ngày bắt đầu và kết thúc, khung sáng và chiều.
// "Xong" chỉ đổi bản nháp của mục; lưu cả lịch ở nút Cập nhật của mục
export function CountingWindowSheet({
  target,
  defaultWindows,
  onSubmitProfile,
  onSubmitTemporary,
  onDelete,
  onClose,
}: CountingWindowSheetProps) {
  const today = getVietnamDate()
  const initialWindows = target.initial ?? defaultWindows
  const [windows, setWindows] = useState<CountingDayWindows>({
    morning: { ...initialWindows.morning },
    evening: { ...initialWindows.evening },
  })
  const [name, setName] = useState(target.kind === 'profile' ? (target.initial?.name ?? '') : '')
  const [monthFrom, setMonthFrom] = useState(target.kind === 'profile' ? (target.initial?.from ?? '') : '')
  const [monthTo, setMonthTo] = useState(target.kind === 'profile' ? (target.initial?.to ?? '') : '')
  const [dateFrom, setDateFrom] = useState(target.kind === 'temporary' ? (target.initial?.from ?? today) : today)
  const [dateTo, setDateTo] = useState(target.kind === 'temporary' ? (target.initial?.to ?? today) : today)
  const [error, setError] = useState<string | null>(null)
  const isProfile = target.kind === 'profile'

  const submit = () => {
    if (isProfile) {
      const profile: SeasonalCountingProfile = { name: name.trim(), from: monthFrom.trim(), to: monthTo.trim(), ...windows }
      const profileError = validateProfile(profile)
      if (profileError) {
        setError(profileError)
        return
      }
      onSubmitProfile(profile)
      return
    }
    const temporary: TemporaryCountingWindow = { from: dateFrom, to: dateTo, ...windows }
    const temporaryError = validateTemporaryWindow(temporary)
    if (temporaryError) {
      setError(temporaryError)
      return
    }
    onSubmitTemporary(temporary)
  }

  const title = isProfile
    ? target.initial
      ? t('Sửa hồ sơ theo mùa')
      : t('Thêm hồ sơ theo mùa')
    : target.initial
      ? t('Sửa khung tạm')
      : t('Thêm khung tạm')

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{title}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isProfile ? (
          <>
            <TextField label={t('Tên hồ sơ')} value={name} onChangeText={setName} maxLength={PROFILE_NAME_MAX_LENGTH} />
            <View style={styles.row}>
              <TextField
                label={t('Từ ngày (MM-DD)')}
                value={monthFrom}
                onChangeText={setMonthFrom}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.flex}
              />
              <TextField
                label={t('Đến ngày (MM-DD)')}
                value={monthTo}
                onChangeText={setMonthTo}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.flex}
              />
            </View>
          </>
        ) : (
          <>
            <DateStepper label={t('Từ ngày')} date={dateFrom} onChange={setDateFrom} />
            <DateStepper label={t('Đến ngày')} date={dateTo} onChange={setDateTo} />
          </>
        )}
        <WindowFields
          label={t('Khung sáng (chim ra)')}
          start={windows.morning.start}
          end={windows.morning.end}
          onChange={(start, end) => setWindows(current => ({ ...current, morning: { start, end } }))}
        />
        <WindowFields
          label={t('Khung chiều (chim về)')}
          start={windows.evening.start}
          end={windows.evening.end}
          onChange={(start, end) => setWindows(current => ({ ...current, evening: { start, end } }))}
        />
      </ScrollView>
      <FormMessage message={error} />
      <Button label={t('Xong')} onPress={submit} />
      {onDelete && <Button label={t('Xoá')} variant="link" onPress={onDelete} style={styles.center} />}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: FORM_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.md },
  field: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.xs },
  center: { alignSelf: 'center' },
})
