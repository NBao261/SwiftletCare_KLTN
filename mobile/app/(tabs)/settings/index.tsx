import { View, Text, StyleSheet, ScrollView } from 'react-native'

/** Settings – AUTH-FR-004, AUTH-FR-006 */
export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Cài đặt</Text>
      {/* TODO: M4
        - Profile section (avatar, name, email)
        - Notification preferences (push, zalo, sms, quiet_hours)
        - Change password
        - Language selector
        - About & version
        - Logout button
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
