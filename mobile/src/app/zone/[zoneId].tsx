import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Zone Detail – ENV-FR-001..015, realtime telemetry */
export default function ZoneDetailScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Chi tiết Zone" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* TODO: M4
          - Đọc zoneId qua useLocalSearchParams, lấy dữ liệu qua hook (không hiện id lên giao diện)
          - Live telemetry cards (temp, humidity, light, co2, sound)
          - Relay control panel (phun sương, quạt, loa — SRS v2 bỏ sưởi)
          - Threshold config form
          - Recent alerts
          - Telemetry history chart
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: Spacing.lg },
})
