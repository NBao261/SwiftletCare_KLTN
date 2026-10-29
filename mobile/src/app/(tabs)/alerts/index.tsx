import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Alert Center – ALERT-FR-007 */
export default function AlertsScreen() {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Cảnh báo" />
      <View style={styles.content}>
        {/* TODO: M4
          - Severity filter tabs (ALL | CRITICAL | HIGH | MEDIUM | LOW)
          - Alert list with snapshot thumbnails
          - Swipe-to-acknowledge gesture
        */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
})
