import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { StatRow } from '@/components/analytics/StatRow'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useUpdateRatingNote } from '@/hooks/health/useUpdateRatingNote'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { HealthDayRating, HouseHealthDay } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDateTime } from '@/utils/date.utils'
import {
  HEALTH_SOURCES,
  formatHealthDate,
  formatHealthReason,
  formatIndicatorValue,
  getHealthSourceLabel,
  getHealthStatusLabel,
  getIndicatorLevelLabel,
  getRatingStateLabel,
} from '@/utils/healthDay.utils'
import { formatDecimal } from '@/utils/number.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Ghi chú tối đa 1000 ký tự (api-spec PATCH /health-reports/days/{dayId}/rating/note)
const NOTE_MAX_LENGTH = 1000
const NOTE_INPUT_HEIGHT = 120

interface HealthDayDetailProps {
  // Ngày đã mở cho người dùng (đã chấm, đã bỏ qua, hết hạn, hoặc người không chấm)
  day: HouseHealthDay
  onMessage: (message: string) => void
}

// Số có đơn vị hoặc "_"
function valueOrBlank(value: number | null | undefined, unit: string, decimals = 1): string {
  return value === null || value === undefined ? '_' : `${formatDecimal(value, decimals)} ${unit}`
}

// Chi tiết một ngày (ANALYTICS-FR-012): trạng thái, lý do, 4 chỉ số, thời tiết, các đánh giá
export function HealthDayDetail({ day, onMessage }: HealthDayDetailProps) {
  const palette = usePalette()
  const userId = useAuthStore(state => state.user?._id)
  const updateNote = useUpdateRatingNote()
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const ratings = day.ratings ?? []
  const myRating = ratings.find(item => item.by._id === userId && item.outcome === 'RATED')
  const canEditNote = day.my_rating_state === 'RATED' && Boolean(myRating)
  const weather = day.weather

  const saveNote = () => {
    if (noteDraft === null) return
    updateNote.mutate(
      { dayId: day._id, note: noteDraft.trim() },
      {
        onSuccess: () => {
          setNoteDraft(null)
          onMessage(t('Đã lưu ghi chú'))
        },
      },
    )
  }

  const renderRating = (item: HealthDayRating, index: number) => {
    const isMine = item.by._id === userId
    const name = `${item.by.full_name ?? '_'}${isMine ? ` ${t('(bạn)')}` : ''}`
    // Ảnh chụp lúc chấm khác trạng thái hiện tại: hệ thống đã tính lại sau đó (SM-17)
    const snapshotStatus = item.snapshot?.status
    const isRecomputed = snapshotStatus !== undefined && snapshotStatus !== day.current_status
    return (
      <View
        key={item._id}
        style={[styles.rating, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
      >
        <View style={styles.ratingHeader}>
          <View style={styles.flex}>
            <Text variant="body" weight="semiBold" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {`${getRoleLabel(item.role)} · ${formatDateTime(item.at)}`}
            </Text>
          </View>
          {item.outcome === 'RATED' && item.rating ? (
            <HealthStatusBadge status={item.rating} />
          ) : (
            <Text variant="small" color={palette.textSecondary}>
              {t('Bỏ qua')}
            </Text>
          )}
        </View>
        {item.outcome === 'RATED' && (
          <Text variant="small" color={item.note ? palette.text : palette.textSecondary}>
            {item.note ?? t('Không có ghi chú')}
          </Text>
        )}
        {isRecomputed && snapshotStatus && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Lúc đánh giá, hệ thống đang báo {status}, sau đó đã tính lại', { status: getHealthStatusLabel(snapshotStatus) })}
          </Text>
        )}
      </View>
    )
  }

  return (
    <View style={styles.detail}>
      <Card>
        <Text variant="small" color={palette.textSecondary}>
          {t('Ngày {date} · {house}', { date: formatHealthDate(day.date), house: day.house_name })}
        </Text>
        <View style={styles.statusRow}>
          <Text variant="body" weight="semiBold" style={styles.flex}>
            {t('Trạng thái của hệ thống')}
          </Text>
          {day.current_status && <HealthStatusBadge status={day.current_status} />}
        </View>
        {day.computed_at && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Tính lúc {time}', { time: formatDateTime(day.computed_at) })}
          </Text>
        )}
        {day.my_rating_state && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Bạn: {state}', { state: getRatingStateLabel(day.my_rating_state) })}
          </Text>
        )}
        <Text variant="small" color={palette.textSecondary}>
          {t('Trạng thái là chỉ báo từ dữ liệu, không phải chẩn đoán.')}
        </Text>
      </Card>

      <Card>
        <Text variant="body" weight="semiBold">
          {t('Lý do')}
        </Text>
        {(day.current_reasons ?? []).length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            _
          </Text>
        ) : (
          (day.current_reasons ?? []).map((reason, index) => (
            <Text key={`${reason.code}-${reason.source ?? 'none'}-${index}`} variant="small">
              {`• ${formatHealthReason(reason)}`}
            </Text>
          ))
        )}
      </Card>

      <Card>
        <Text variant="body" weight="semiBold">
          {t('Các chỉ số')}
        </Text>
        {HEALTH_SOURCES.map(source => {
          const indicator = day.indicators?.[source]
          const isComplete = day.completeness?.[source] !== false
          const levelText = isComplete ? getIndicatorLevelLabel(indicator?.level ?? null) : t('Thiếu dữ liệu')
          return (
            <StatRow
              key={source}
              label={getHealthSourceLabel(source)}
              value={`${formatIndicatorValue(source, indicator?.value ?? null)} · ${levelText}`}
              isWarning={indicator?.level === 'CLEAR'}
            />
          )
        })}
      </Card>

      <Card>
        <Text variant="body" weight="semiBold">
          {t('Thời tiết')}
        </Text>
        {weather ? (
          <>
            <StatRow
              label={t('Nhiệt độ')}
              value={
                weather.temperature_min === null || weather.temperature_max === null
                  ? '_'
                  : `${formatDecimal(weather.temperature_min, 1)} – ${formatDecimal(weather.temperature_max, 1)} °C`
              }
            />
            <StatRow label={t('Độ ẩm TB')} value={valueOrBlank(weather.humidity_avg, '%', 0)} />
            <StatRow label={t('Lượng mưa')} value={valueOrBlank(weather.precipitation_mm, 'mm')} />
          </>
        ) : (
          <Text variant="small" color={palette.textSecondary}>
            {t('Không có dữ liệu thời tiết')}
          </Text>
        )}
      </Card>

      <Card>
        <View style={styles.statusRow}>
          <Text variant="body" weight="semiBold" style={styles.flex}>
            {t('Các đánh giá')}
          </Text>
          {canEditNote && (
            <Button
              label={myRating?.note ? t('Sửa ghi chú') : t('Thêm ghi chú')}
              variant="link"
              onPress={() => setNoteDraft(myRating?.note ?? '')}
            />
          )}
        </View>
        {ratings.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Chưa ai đánh giá ngày này')}
          </Text>
        ) : (
          ratings.map(renderRating)
        )}
      </Card>

      {/* Chỉ thêm, sửa ghi chú — mức đã chấm không đổi được (SM-18 RATED → RATED) */}
      <BottomSheet visible={noteDraft !== null} onClose={() => setNoteDraft(null)}>
        <Text variant="heading">{myRating?.note ? t('Sửa ghi chú') : t('Thêm ghi chú')}</Text>
        <TextInput
          value={noteDraft ?? ''}
          onChangeText={setNoteDraft}
          multiline
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('VD: chim về muộn, có mưa chiều...')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('Ghi chú')}
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          textAlignVertical="top"
        />
        <FormMessage message={updateNote.error ? getSettingsErrorMessage(updateNote.error) : null} />
        <Button
          label={t('Lưu ghi chú')}
          onPress={saveNote}
          disabled={noteDraft === null || noteDraft.trim() === ''}
          loading={updateNote.isPending}
        />
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  detail: { gap: Spacing.md },
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rating: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
