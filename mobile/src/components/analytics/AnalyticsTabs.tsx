import { StyleSheet, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AnalyticsTab } from '@/stores/farmPrefsStore'
import { t } from '@/utils/i18n.utils'

interface AnalyticsTabsProps {
  selected: AnalyticsTab
  onSelect: (tab: AnalyticsTab) => void
}

// Hàng tab nội bộ của màn Phân tích, dính đầu màn khi cuộn (đặc tả §3) — cùng kiểu chip tầng của màn Farm,
// nền Paper để khi dính không lộ nội dung cuộn phía sau
export function AnalyticsTabs({ selected, onSelect }: AnalyticsTabsProps) {
  const palette = usePalette()

  return (
    <View style={[styles.row, { backgroundColor: palette.background }]} accessibilityRole="tablist">
      <ChoiceChips
        options={[
          { id: 'birds', label: t('Đàn chim') },
          { id: 'env', label: t('Môi trường') },
          { id: 'control', label: t('Điều khiển') },
          { id: 'harvest', label: t('Sản lượng') },
          { id: 'reports', label: t('Báo cáo') },
        ]}
        selectedId={selected}
        onSelect={onSelect}
        accessibilityLabel={t('Nội dung phân tích')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
})
