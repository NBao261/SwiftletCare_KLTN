import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Recommendation } from '@/types'
import { formatDate } from '@/utils/date.utils'
import { getRecommendationStatusLabel } from '@/utils/label.utils'
import { describeRecommendationAction, getRecommendationAction, getRecommendationRuleName } from '@/utils/recommendation.utils'
import { t } from '@/utils/i18n.utils'

interface RecommendationRowProps {
  recommendation: Recommendation
  // Tên nhà của khuyến nghị (tra từ danh sách nhà); không tìm thấy thì "_"
  houseName: string
  hasDivider: boolean
  onPress: () => void
}

// Một dòng khuyến nghị: tên luật, việc đề xuất, nhà, ngày luật thoả, trạng thái
export function RecommendationRow({ recommendation, houseName, hasDivider, onPress }: RecommendationRowProps) {
  const palette = usePalette()
  const ruleName = getRecommendationRuleName(recommendation)
  const actionText = describeRecommendationAction(getRecommendationAction(recommendation))
  const statusLabel = getRecommendationStatusLabel(recommendation.status)
  const detailText = `${houseName} · ${formatDate(recommendation.raised_for)} · ${statusLabel}`

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel={`${ruleName}, ${actionText}, ${detailText}`}
      accessibilityHint={t('Xem chi tiết khuyến nghị')}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={2}>
          {ruleName}
        </Text>
        <Text variant="small" numberOfLines={2}>
          {actionText}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
          {detailText}
        </Text>
      </View>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
