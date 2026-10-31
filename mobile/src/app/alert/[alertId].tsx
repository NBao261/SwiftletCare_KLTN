import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Alert Detail – ALERT-FR-009 (acknowledge) */
export default function AlertDetailScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Chi tiết cảnh báo" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* TODO: M4
          - Đọc alertId qua useLocalSearchParams, lấy dữ liệu qua hook (không hiện id lên giao diện)
          - Alert header (severity badge, type icon)
          - Alert message & metadata
          - Acknowledge button + note input
          - Related zone link
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: Spacing.lg },
})
