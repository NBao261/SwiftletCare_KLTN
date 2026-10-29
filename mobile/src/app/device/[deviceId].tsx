import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Device Detail – FARM-FR-005 */
export default function DeviceDetailScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      <AppHeader title="Chi tiết thiết bị" onBack={() => router.back()} />
      <View style={styles.content}>
        {/* TODO: M4
          - Đọc deviceId qua useLocalSearchParams, lấy dữ liệu qua hook (không hiện id lên giao diện)
          - Device info (firmware, RSSI, uptime, status)
          - Relay states (for sensor nodes)
          - RTSP stream player (for camera nodes)
          - Heartbeat history
        */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
})
