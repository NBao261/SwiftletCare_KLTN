import { useState } from 'react'
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { CheckCircleIcon, CircleIcon } from 'phosphor-react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useRateHealthDay } from '@/hooks/health/useRateHealthDay'
import { useSkipHealthDay } from '@/hooks/health/useSkipHealthDay'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HealthRatingValue, HouseHealthDay } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import {
  HEALTH_RATINGS,
  OBSERVATION_GUIDE,
  formatHealthDate,
  formatLastRatingDay,
  getHealthRatingHint,
  getHealthStatusLabel,
} from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

// Ghi chú tối đa 1000 ký tự (api-spec POST /health-reports/days/{dayId}/rating)
const NOTE_MAX_LENGTH = 1000
const NOTE_INPUT_HEIGHT = 96

interface HealthRatingFormProps {
  // Ngày người dùng còn PENDING
  day: HouseHealthDay
  // Chấm hoặc bỏ qua xong; ngày đầy đủ backend trả đã nằm trong cache nên màn tự chuyển sang chi tiết
  onRevealed: (message: string) => void
  // Ngày đã chốt ở nơi khác (409): màn tải lại ngày
  onClosed: (message: string) => void
}

// EXPERT-FR-012, BR-31, BR-37 — hỏi đánh giá của người dùng trước, chỉ hiện trạng thái hệ thống sau khi lưu hoặc bỏ qua
export function HealthRatingForm({ day, onRevealed, onClosed }: HealthRatingFormProps) {
  const palette = usePalette()
  const rate = useRateHealthDay()
  const skip = useSkipHealthDay()
  const [rating, setRating] = useState<HealthRatingValue | null>(null)
  const [note, setNote] = useState('')
  const [isPickError, setPickError] = useState(false)
  const isBusy = rate.isPending || skip.isPending
  const error = rate.error ?? skip.error

  // 409 RATING_CLOSED: đã chấm, đã bỏ qua ở thiết bị khác, hoặc vừa quá hạn — báo và để màn tải lại ngày
  const handleError = (mutationError: unknown) => {
    if (readApiError(mutationError).status === 409) onClosed(t('Ngày này đã được đánh giá hoặc đã hết hạn'))
  }

  const handleSave = () => {
    if (!rating) {
      setPickError(true)
      return
    }
    const trimmedNote = note.trim()
    rate.mutate(
      { dayId: day._id, rating, note: trimmedNote || undefined },
      { onSuccess: () => onRevealed(t('Đã lưu đánh giá')), onError: handleError },
    )
  }

  const confirmSkip = () => {
    Alert.alert(
      t('Bỏ qua ngày này?'),
      t(
        'Không thể hoàn tác. Trạng thái của hệ thống sẽ hiện ra ngay và bạn sẽ không đánh giá được ngày này nữa. Ngày bỏ qua không được tính vào độ khớp giữa bạn và hệ thống.',
      ),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Bỏ qua ngày này'),
          style: 'destructive',
          onPress: () =>
            skip.mutate(day._id, {
              onSuccess: () => onRevealed(t('Đã bỏ qua ngày này')),
              onError: handleError,
            }),
        },
      ],
    )
  }

  return (
    <View style={styles.form}>
      <View style={styles.header}>
        <Text variant="heading">{t('Đánh giá ngày {date} · {house}', { date: formatHealthDate(day.date), house: day.house_name })}</Text>
        <Text variant="body" color={palette.textSecondary}>
          {t('Đánh giá trước khi xem biểu đồ. Trạng thái hiện sau khi lưu; đã lưu thì không đổi được.')}
        </Text>
        <Text variant="small" color={palette.textSecondary}>
          {t('Hạn đánh giá {date}', { date: formatLastRatingDay(day.rating_deadline) })}
        </Text>
      </View>

      {/* Hướng dẫn quan sát BR-37, hiện trước khi chọn mức để mọi người đánh giá cùng một thước đo */}
      <Card accessibilityLabel={t('Quan sát tại nhà yến')}>
        <Text variant="body" weight="semiBold">
          {t('Quan sát tại nhà yến')}
        </Text>
        {OBSERVATION_GUIDE.map(item => (
          <View key={item.title} style={styles.guideRow}>
            <Text variant="small" weight="semiBold" color={item.isSevere ? palette.alert : palette.text} style={styles.guideTitle}>
              {t(item.title)}
            </Text>
            <Text variant="small" color={palette.textSecondary} style={styles.flex}>
              {t(item.text)}
            </Text>
          </View>
        ))}
      </Card>

      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('Đánh giá của bạn')}>
        {HEALTH_RATINGS.map(value => {
          const isSelected = rating === value
          const RadioIcon = isSelected ? CheckCircleIcon : CircleIcon
          return (
            <Pressable
              key={value}
              onPress={() => {
                setRating(value)
                setPickError(false)
              }}
              disabled={isBusy}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: isBusy }}
              accessibilityLabel={`${getHealthStatusLabel(value)}: ${getHealthRatingHint(value)}`}
              style={[
                styles.option,
                {
                  backgroundColor: palette.surface,
                  borderColor: isSelected ? palette.text : palette.border,
                  borderWidth: isSelected ? BorderWidth.strong : BorderWidth.regular,
                },
              ]}
            >
              <RadioIcon size={20} color={isSelected ? palette.text : palette.textSecondary} weight={isSelected ? 'fill' : 'regular'} />
              <View style={styles.optionTexts}>
                <HealthStatusBadge status={value} />
                <Text variant="small" color={palette.textSecondary}>
                  {getHealthRatingHint(value)}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
      <FormMessage message={isPickError ? t('Chọn một mức trước khi lưu') : null} />

      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        editable={!isBusy}
        placeholder={t('Ghi chú (không bắt buộc), VD: chim về muộn, có mưa chiều...')}
        placeholderTextColor={palette.textSecondary}
        accessibilityLabel={t('Ghi chú (không bắt buộc)')}
        style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        textAlignVertical="top"
      />

      <FormMessage
        message={error && readApiError(error).status !== 409 ? getSettingsErrorMessage(error, { 403: t('Bạn không phải người đánh giá ngày này') }) : null}
      />
      <Button label={t('Lưu đánh giá')} onPress={handleSave} loading={rate.isPending} disabled={isBusy} />
      <Text variant="small" color={palette.textSecondary} center>
        {t('Hôm đó không ra nhà yến? Hãy bỏ qua, đừng đoán.')}
      </Text>
      <Button label={t('Bỏ qua ngày này')} variant="secondary" onPress={confirmSkip} loading={skip.isPending} disabled={isBusy} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  header: { gap: Spacing.xs },
  flex: { flex: 1 },
  guideRow: { flexDirection: 'row', gap: Spacing.md },
  guideTitle: { width: 96 },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  optionTexts: { flex: 1, gap: Spacing.xs },
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
