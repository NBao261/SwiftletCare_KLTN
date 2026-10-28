import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Farm Detail – FARM-FR-002, FARM-FR-003 */
export default function FarmDetailScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Chi tiết trang trại" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* TODO: M4
          - Đọc farmId qua useLocalSearchParams, lấy dữ liệu qua useFarmDetail (không hiện id lên giao diện)
          - Farm info header + map (react-native-maps)
          - House list → Zone list
          - Device status per zone
          - Member management
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: Spacing.lg },
})
