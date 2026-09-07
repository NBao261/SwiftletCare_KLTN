import { View, Text, StyleSheet } from 'react-native'

/** Alert Center – ALERT-FR-007 */
export default function AlertsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cảnh báo</Text>
      {/* TODO: M4
        - Severity filter tabs (ALL | CRITICAL | HIGH | MEDIUM | LOW)
        - Alert list with snapshot thumbnails
        - Swipe-to-acknowledge gesture
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
