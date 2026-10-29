import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Analytics Dashboard – ANALYTICS-FR-001..005 */
export default function AnalyticsScreen() {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Phân tích dữ liệu" />
      <ScrollView contentContainerStyle={styles.content}>
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
