import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Farm List – FARM-FR-001 */
export default function FarmsScreen() {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Trang trại của bạn" />
      <View style={styles.content}>
        {/* TODO: M4
          - FlatList of farm cards
          - FAB button to create new farm
          - Pull-to-refresh
        */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
})
