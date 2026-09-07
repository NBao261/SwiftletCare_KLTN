import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

/** Device Detail – FARM-FR-005 */
export default function DeviceDetailScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thiết bị {deviceId}</Text>
      {/* TODO: M4
        - Device info (firmware, RSSI, uptime, status)
        - Relay states (for sensor nodes)
        - RTSP stream player (for camera nodes)
        - Heartbeat history
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title:     { fontSize: 20, fontWeight: '600' },
})
