import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { StatRow } from '@/components/analytics/StatRow'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useControlSuggestion } from '@/hooks/analytics/useControlSuggestion'
import { useUpdateFuzzyTuning } from '@/hooks/farm/useUpdateFuzzyTuning'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Farm, SuggestedTuning } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { getFuzzyTuningLabel } from '@/utils/label.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { canPerform } from '@/utils/permission.utils'
import { formatStoredNumber } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const SUGGESTED_KEYS: (keyof SuggestedTuning)[] = ['fuzzy_humidity_band', 'fuzzy_temp_band', 'fuzzy_fan_dry_level']
const SKELETON_HEIGHT = 72

interface SuggestionCardProps {
  zoneId: string
  zoneName: string
  farm: Farm | null
}

// Giá trị hệ số kèm đơn vị; thiếu thì "_"
function formatTuning(key: keyof SuggestedTuning, value: number | undefined): string {
  return value === undefined ? '_' : `${formatStoredNumber(value)}${getFuzzyTuningLabel(key).unit}`
}

// Thẻ gợi ý hệ số (ANALYTICS-FR-010): có gợi ý thì nói tăng thời gian trong ngưỡng bao nhiêu, không thì lý do backend trả.
// "Áp dụng" khi có quyền (chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia — BR-22, EXPERT-FR-011);
// gửi chuyên gia duyệt (PROPOSED) backend chưa có
export function SuggestionCard({ zoneId, zoneName, farm }: SuggestionCardProps) {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const suggestionQuery = useControlSuggestion(zoneId, true)
  const updateFuzzyTuning = useUpdateFuzzyTuning()
  const [isSheetOpen, setSheetOpen] = useState(false)
  const data = suggestionQuery.data
  const suggestion = data?.suggestion ?? null
  const hasExpert = farm ? farmHasExpert(farm) : undefined
  const canApply = canPerform(user, 'applyCoefficientSuggestion', { farmHasExpert: hasExpert })
  // Chủ trại ở farm có chuyên gia: sửa được hệ số nhưng không tự áp dụng gợi ý
  const isOwnerWithExpert = !canApply && hasExpert === true && canPerform(user, 'editFuzzyTuning')

  const confirmApply = () => {
    if (!suggestion) return
    NativeAlert.alert(
      t('Áp dụng gợi ý?'),
      t('Hệ số mới của {zone} sẽ gửi xuống controller ngay.', { zone: zoneName }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Áp dụng'),
          onPress: () =>
            updateFuzzyTuning.mutate(
              { zoneId, tuning: suggestion },
              {
                onSuccess: () => {
                  setSheetOpen(false)
                  queryClient.invalidateQueries({ queryKey: ['analytics'] })
                },
              },
            ),
        },
      ],
    )
  }

  const renderBody = () => {
    if (suggestionQuery.isLoading) return <Skeleton width="100%" height={SKELETON_HEIGHT} />
    if (suggestionQuery.isError || !data) {
      return (
        <Text variant="small" color={palette.textSecondary} onPress={() => suggestionQuery.refetch()}>
          {t('Không tải được. Chạm để thử lại')}
        </Text>
      )
    }
    if (!suggestion) {
      // Lý do do backend viết (tiếng Việt)
      return (
        <Text variant="small" color={palette.textSecondary}>
          {data.reason ?? t('Chưa có gợi ý')}
        </Text>
      )
    }
    return (
      <>
        <Text variant="body">
          {data.predicted
            ? t('Có gợi ý giúp thời gian độ ẩm trong ngưỡng từ {now} lên {suggested}', {
                now: formatPercentValue(data.predicted.inRangeNow),
                suggested: formatPercentValue(data.predicted.inRangeSuggested),
              })
            : t('Có gợi ý hệ số mới')}
        </Text>
        <Button label={t('Xem gợi ý')} size="md" onPress={() => setSheetOpen(true)} />
      </>
    )
  }

  return (
    <Card>
      <Text variant="body" weight="semiBold">
        {t('Gợi ý hệ số')}
      </Text>
      {renderBody()}

      <BottomSheet visible={isSheetOpen} onClose={() => setSheetOpen(false)}>
        <Text variant="heading">{t('Gợi ý hệ số · {zone}', { zone: zoneName })}</Text>
        <View style={styles.compare}>
          {SUGGESTED_KEYS.map(key => (
            <StatRow
              key={key}
              label={getFuzzyTuningLabel(key).label}
              value={`${formatTuning(key, data?.current[key])} → ${formatTuning(key, suggestion?.[key])}`}
            />
          ))}
          {data?.predicted && (
            <>
              <StatRow
                label={t('Độ ẩm trong ngưỡng (dự kiến)')}
                value={`${formatPercentValue(data.predicted.inRangeNow)} → ${formatPercentValue(data.predicted.inRangeSuggested)}`}
              />
              <StatRow
                label={t('Công suất phun sương TB (dự kiến)')}
                value={`${formatPercentValue(data.predicted.mistingNow, 0)} → ${formatPercentValue(data.predicted.mistingSuggested, 0)}`}
              />
            </>
          )}
          {data?.model && (
            <Text variant="small" color={palette.textSecondary}>
              {t('Mô hình từ {days} ngày, {samples} mẫu, R² {r2}', {
                days: formatStoredNumber(data.model.days),
                samples: data.model.samples,
                r2: formatStoredNumber(data.model.r2),
              })}
            </Text>
          )}
        </View>
        <FormMessage message={updateFuzzyTuning.error ? getSettingsErrorMessage(updateFuzzyTuning.error) : null} />
        {canApply && <Button label={t('Áp dụng')} onPress={confirmApply} loading={updateFuzzyTuning.isPending} />}
        {/* EXPERT-FR-011: farm có chuyên gia thì chủ trại gửi gợi ý để chuyên gia duyệt — backend chưa có trạng thái PROPOSED */}
        {isOwnerWithExpert && <ComingSoonAction label={t('Gửi chuyên gia duyệt')} />}
      </BottomSheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  compare: { gap: Spacing.sm },
})
