import { StyleSheet, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Redirect, router } from 'expo-router'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

/** Đổi mật khẩu khi đang đăng nhập (AUTH-FR-005c): backend giữ phiên này, thu hồi phiên ở các máy khác */
export default function ChangePasswordScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)

  if (!canPerform(user, 'viewOwnerProfile')) return <Redirect href="/(tabs)/profile" />

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Đổi mật khẩu')} onBack={() => router.back()} />
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <Text variant="small" color={palette.textSecondary}>
          {t('Đổi xong, các máy khác đang đăng nhập tài khoản này sẽ bị đăng xuất.')}
        </Text>
        <Card style={styles.form}>
          <ChangePasswordForm currentPasswordLabel={t('Mật khẩu hiện tại')} onSuccess={() => router.back()} />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  form: { gap: Spacing.lg },
})
