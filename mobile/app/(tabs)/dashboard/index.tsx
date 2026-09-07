import { View, Text, StyleSheet, ScrollView } from 'react-native'

/** Dashboard Overview – SRS §9.1 Screen S01 */
export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      {/* TODO: M4
        - Farm selector dropdown
        - Zone cards with live telemetry (useLatestTelemetry)
        - Active alerts summary
        - Bird count today
        - Device status overview
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
