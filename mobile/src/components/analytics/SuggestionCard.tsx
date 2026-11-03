import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { StatRow } from '@/components/analytics/StatRow'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useControlSuggestion } from '@/hooks/analytics/useControlSuggestion'
import { useSubmitProposal } from '@/hooks/expert-activity/useSubmitProposal'
import { useApplySuggestion } from '@/hooks/farm/useApplySuggestion'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Farm, SuggestedTuning } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
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
// "Áp dụng" khi có quyền (chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia — BR-22, EXPERT-FR-011) gọi
// POST …/apply-suggestion: server tự tính lại gợi ý, không gửi số đang hiện. Chủ trại ở farm có chuyên gia thì gửi gợi ý
// cho chuyên gia duyệt (POST /expert-activity/proposals)
export function SuggestionCard({ zoneId, zoneName, farm }: SuggestionCardProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const suggestionQuery = useControlSuggestion(zoneId, true)
  const applySuggestion = useApplySuggestion()
  const submitProposal = useSubmitProposal()
  const [isSheetOpen, setSheetOpen] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
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
            applySuggestion.mutate(zoneId, {
              onSuccess: () => setSheetOpen(false),
              // 409: server không còn thấy gợi ý (dữ liệu đã đổi) — tải lại để thẻ hiện lý do mới
              onError: error => {
                if (readApiError(error).status === 409) void suggestionQuery.refetch()
              },
            }),
        },
      ],
    )
  }

  const confirmSubmit = () => {
    NativeAlert.alert(
      t('Gửi chuyên gia duyệt?'),
      t('Chuyên gia của farm sẽ xem gợi ý cho {zone} và quyết định áp dụng hay không.', { zone: zoneName }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Gửi'),
          onPress: () =>
            submitProposal.mutate(zoneId, {
              onSuccess: () => setSentMessage(t('Đã gửi gợi ý cho chuyên gia')),
              onError: error => {
                if (readApiError(error).status === 409) void suggestionQuery.refetch()
              },
            }),
        },
      ],
    )
  }
  const actionError = applySuggestion.error ?? submitProposal.error

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
        <FormMessage
          message={
            actionError
              ? getSettingsErrorMessage(actionError, { 409: t('Gợi ý không còn phù hợp với dữ liệu mới, đã tải lại') })
              : null
          }
        />
        <FormMessage message={sentMessage} tone="success" />
        {canApply && <Button label={t('Áp dụng')} onPress={confirmApply} loading={applySuggestion.isPending} />}
        {/* EXPERT-FR-011: farm có chuyên gia thì chủ trại gửi gợi ý để chuyên gia duyệt */}
        {isOwnerWithExpert && !sentMessage && (
          <Button
            label={t('Gửi chuyên gia duyệt')}
            variant="secondary"
            onPress={confirmSubmit}
            loading={submitProposal.isPending}
          />
        )}
      </BottomSheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  compare: { gap: Spacing.sm },
})
