import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'
import { t } from '@/utils/i18n.utils'
import { useLanguage } from '@/hooks/i18n/useLanguage'

/** Analytics Dashboard – ANALYTICS-FR-001..005 */
export default function AnalyticsScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Phân tích dữ liệu')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* TODO: M4
          - Date range picker
          - Bird count trend chart (Victory Native)
          - Return rate line chart
          - Environment correlation scatter plot
          - Export CSV button
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: Spacing.lg },
})
