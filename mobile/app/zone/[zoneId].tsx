import { useLocalSearchParams } from 'expo-router'
import { Text, StyleSheet, ScrollView } from 'react-native'

/** Zone Detail – ENV-FR-001..015, realtime telemetry */
export default function ZoneDetailScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>()

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Zone {zoneId}</Text>
      {/* TODO: M4
        - Live telemetry cards (temp, humidity, light, co2, sound)
        - Relay control panel (4 toggle switches)
        - Threshold config form
        - Bird count for this zone
        - Recent alerts
        - Telemetry history chart
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title:     { fontSize: 20, fontWeight: '600' },
})
