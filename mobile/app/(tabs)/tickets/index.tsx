import { View, Text, StyleSheet } from 'react-native'

/** Ticket List – Module TICKET §5.9, D6 */
export default function TicketsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ticket hỗ trợ</Text>
      {/* TODO: M4
        - Filter theo status/priority
        - List ticket (type, priority badge, SLA countdown)
        - FAB "Tạo ticket báo lỗi"
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
