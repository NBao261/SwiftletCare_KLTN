import { useLocalSearchParams } from 'expo-router'
import { Text, StyleSheet, ScrollView } from 'react-native'

/** Ticket Detail – TICKET-FR-007..011 */
export default function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>()

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ticket {ticketId}</Text>
      {/* TODO: M4
        - Header (type, priority, status badge, SLA countdown)
        - Timeline ghi chú (notes)
        - SAT checklist (Technician)
        - Đánh giá 1-5 sao khi CLOSED (Farm Owner)
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title:     { fontSize: 20, fontWeight: '600' },
})
