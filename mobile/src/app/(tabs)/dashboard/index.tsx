import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Dashboard Overview – SRS §9.1 Screen S01 */
export default function DashboardScreen() {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Tổng quan" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* TODO: M4
          - Farm selector dropdown
          - Zone cards with live telemetry (useLatestTelemetry)
          - Active alerts summary
          - Bird count today
          - Device status overview
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: Spacing.lg },
})
