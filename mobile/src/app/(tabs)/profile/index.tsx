import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'

/** Tài khoản – AUTH-FR-004, AUTH-FR-006; một màn cho Farm Owner và Domain Expert */
export default function ProfileScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const user = useAuthStore(state => state.user)
  // Chừa chỗ cho thanh tab đè lên đáy màn (MOBILE_GUIDE 3.5)
  const bottomPadding = Spacing.lg + TAB_BAR_OVERLAP + insets.bottom

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title="Tài khoản" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <View style={[styles.profileCard, { backgroundColor: palette.surface }]}>
          <Text variant="heading">{user?.full_name || '_'}</Text>
          <Text variant="small" color={palette.textSecondary}>
            {user?.email || '_'}
          </Text>
        </View>

        {/* TODO: đổi mật khẩu (profile/change-password, dùng chung form với (auth)/reset-password),
          kênh thông báo push + Telegram chỉ cho Farm Owner (không có Zalo/SMS — Report 3 §8),
          thông báo trong app, phiên bản app */}

        <LogoutButton />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  profileCard: { padding: Spacing.lg, gap: Spacing.xs, borderRadius: Radius.none },
})
