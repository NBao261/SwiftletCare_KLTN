import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'

/** Profile – AUTH-FR-004, AUTH-FR-006 */
export default function ProfileScreen() {
  const palette = usePalette()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Tài khoản" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* TODO: M4
          - Profile section (avatar, name, email)
          - Notification preferences (push, Telegram, quiet_hours) — SRS v2 bỏ Zalo/SMS
          - Change password
          - Language selector
          - About & version
          - Logout button
        */}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg },
})
