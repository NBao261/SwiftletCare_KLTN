import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CountingDayWindows, CountingTimeWindow, SeasonalCountingProfile, TemporaryCountingWindow } from '@/types'
import {
  COUNTING_SESSION_LIMITS,
  type CountingSession,
  getSessionLimitError,
  PROFILE_NAME_MAX_LENGTH,
  validateDayWindows,
  validateProfile,
  validateTemporaryWindow,
} from '@/utils/countingSchedule.utils'
import { shiftDate } from '@/utils/healthDay.utils'
import {
  formatMonthDayInput,
  formatTimeInput,
  getMonthDayInputError,
  getTimeInputError,
  getTimeRangeError,
} from '@/utils/timeInput.utils'
import { getVietnamDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Sheet nhập một hồ sơ theo mùa, một khung tạm hoặc khung mặc định của nhà trong lịch đếm (VISION-FR-019)
export type CountingWindowTarget =
  | { kind: 'profile'; initial: SeasonalCountingProfile | null }
  | { kind: 'temporary'; initial: TemporaryCountingWindow | null }
  | { kind: 'default'; initial: CountingDayWindows | null }

interface CountingWindowSheetProps {
  target: CountingWindowTarget
  // Khung mặc định điền sẵn cho mục mới (BR-13)
  defaultWindows: CountingDayWindows
  onSubmitProfile: (profile: SeasonalCountingProfile) => void
  onSubmitTemporary: (window: TemporaryCountingWindow) => void
  onSubmitDefault: (windows: CountingDayWindows) => void
  // Chỉ có khi sửa mục đã có; khung mặc định thì là "Dùng khung hệ thống"
  onDelete?: () => void
  onClose: () => void
}


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

// Lỗi của từng ô giờ trong một khung, báo ngay khi gõ: giờ, phút sai; ngoài khoảng của phiên (sáng 05:00–07:00, chiều
// 17:00–19:00); kết thúc không sau bắt đầu
function getWindowFieldErrors(window: CountingTimeWindow, session: CountingSession) {
  return {
    start: getTimeInputError(window.start) ?? getSessionLimitError(window.start, session),
    end:
      getTimeInputError(window.end) ??
      getSessionLimitError(window.end, session) ??
      getTimeRangeError(window.start, window.end),
  }
}

// Hai ô giờ của một khung: bắt đầu, kết thúc. Gõ số là tự chèn ":"; nhãn ghi sẵn khoảng được phép của phiên
function WindowFields({
  label,
  session,
  start,
  end,
  onChange,
}: {
  label: string
  session: CountingSession
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const palette = usePalette()
  const limit = COUNTING_SESSION_LIMITS[session]
  const errors = getWindowFieldErrors({ start, end }, session)
  return (
    <View style={styles.field}>
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('{label} · trong khoảng {from}–{to}', { label, from: limit.start, to: limit.end })}
      </Text>
      <View style={styles.fieldRow}>
        <TextField
          label={t('Bắt đầu (HH:mm)')}
          value={start}
          onChangeText={value => onChange(formatTimeInput(value), end)}
          keyboardType="number-pad"
          maxLength={5}
          error={errors.start}
          style={styles.flex}
        />
        <TextField
          label={t('Kết thúc (HH:mm)')}
          value={end}
          onChangeText={value => onChange(start, formatTimeInput(value))}
          keyboardType="number-pad"
          maxLength={5}
          error={errors.end}
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
  onSubmitDefault,
  onDelete,
  onClose,
}: CountingWindowSheetProps) {
  const palette = usePalette()
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
  const isDefault = target.kind === 'default'
  // Hai khoảng phiên không chồng nhau (sáng xong 07:00, chiều từ 17:00) nên khung chiều luôn sau khung sáng khi cả hai đúng khoảng
  const monthFromError = isProfile ? getMonthDayInputError(monthFrom) : null
  const monthToError = isProfile ? getMonthDayInputError(monthTo) : null
  const morningErrors = getWindowFieldErrors(windows.morning, 'morning')
  const eveningErrors = getWindowFieldErrors(windows.evening, 'evening')
  const hasLiveError = Boolean(
    monthFromError ||
      monthToError ||
      morningErrors.start ||
      morningErrors.end ||
      eveningErrors.start ||
      eveningErrors.end,
  )

  const submit = () => {
    if (isDefault) {
      const defaultError = validateDayWindows(windows)
      if (defaultError) {
        setError(defaultError)
        return
      }
      onSubmitDefault(windows)
      return
    }
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

  const titles = {
    profile: target.initial ? t('Sửa hồ sơ theo mùa') : t('Thêm hồ sơ theo mùa'),
    temporary: target.initial ? t('Sửa khung tạm') : t('Thêm khung tạm'),
    default: t('Khung mặc định của nhà'),
  }

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{titles[target.kind]}</Text>
      {isDefault && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Dùng cho mọi ngày không thuộc hồ sơ theo mùa hay khung tạm.')}
        </Text>
      )}
      <View style={styles.body}>
        {isDefault ? null : isProfile ? (
          <>
            <TextField label={t('Tên hồ sơ')} value={name} onChangeText={setName} maxLength={PROFILE_NAME_MAX_LENGTH} />
            <View style={styles.fieldRow}>
              <TextField
                label={t('Từ ngày (MM-DD)')}
                value={monthFrom}
                onChangeText={value => setMonthFrom(formatMonthDayInput(value))}
                keyboardType="number-pad"
                maxLength={5}
                error={monthFromError}
                style={styles.flex}
              />
              <TextField
                label={t('Đến ngày (MM-DD)')}
                value={monthTo}
                onChangeText={value => setMonthTo(formatMonthDayInput(value))}
                keyboardType="number-pad"
                maxLength={5}
                error={monthToError}
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
          session="morning"
          start={windows.morning.start}
          end={windows.morning.end}
          onChange={(start, end) => setWindows(current => ({ ...current, morning: { start, end } }))}
        />
        <WindowFields
          label={t('Khung chiều (chim về)')}
          session="evening"
          start={windows.evening.start}
          end={windows.evening.end}
          onChange={(start, end) => setWindows(current => ({ ...current, evening: { start, end } }))}
        />
      </View>
      <FormMessage message={error} />
      <Button label={t('Xong')} onPress={submit} disabled={hasLiveError} />
      {onDelete && (
        <Button
          label={isDefault ? t('Dùng khung hệ thống') : t('Xoá')}
          variant="link"
          onPress={onDelete}
          style={styles.center}
        />
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  field: { gap: Spacing.sm },
  // Hai ô cạnh nhau, ô có câu lỗi cao hơn thì ô kia vẫn thẳng mép trên
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.xs },
  center: { alignSelf: 'center' },
})
