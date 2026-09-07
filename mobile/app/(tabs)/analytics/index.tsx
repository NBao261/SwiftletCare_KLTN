import { View, Text, StyleSheet, ScrollView } from 'react-native'

/** Analytics Dashboard – ANALYTICS-FR-001..005 */
export default function AnalyticsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Phân tích dữ liệu</Text>
      {/* TODO: M4
        - Date range picker
        - Bird count trend chart (Victory Native)
        - Return rate line chart
        - Environment correlation scatter plot
        - Export CSV button
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
