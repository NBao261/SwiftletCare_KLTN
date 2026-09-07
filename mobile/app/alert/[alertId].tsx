import { useLocalSearchParams } from 'expo-router'
import { Text, StyleSheet, ScrollView } from 'react-native'

/** Alert Detail – ALERT-FR-009 (acknowledge) */
export default function AlertDetailScreen() {
  const { alertId } = useLocalSearchParams<{ alertId: string }>()

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Cảnh báo {alertId}</Text>
      {/* TODO: M4
        - Alert header (severity badge, type icon)
        - Snapshot image (if predator)
        - Alert message & metadata
        - Acknowledge button + note input
        - Related zone link
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title:     { fontSize: 20, fontWeight: '600' },
})
