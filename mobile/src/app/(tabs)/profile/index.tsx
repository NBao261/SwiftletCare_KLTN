import { ScrollView, StyleSheet, View } from 'react-native'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useSwitchLanguage } from '@/hooks/i18n/useSwitchLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Language } from '@/stores/languageStore'
import { t, translate } from '@/utils/i18n.utils'

// Câu báo xong, viết bằng chính ngôn ngữ vừa chọn
const SWITCHED_MESSAGES: Record<Language, string> = {
  vi: 'Đã đổi sang Tiếng Việt',
  en: 'Switched to English',
}

/** Tài khoản – AUTH-FR-004, AUTH-FR-006; một màn cho Farm Owner và Domain Expert */
export default function ProfileScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  // Đổi ngôn ngữ thì dựng lại phần nội dung (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const { language, switchingTo, switchedTo, switchLanguage } = useSwitchLanguage()
  // Chừa phần thanh tab đè lên đáy màn (MOBILE_GUIDE 3.5) cộng lề dưới; vùng an toàn dưới đã nằm trong thanh tab
  const bottomPadding = Spacing.lg + TAB_BAR_OVERLAP

  return (
    // Lớp chờ và toast nằm ngoài phần được dựng lại để không mất khi đổi ngôn ngữ
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Tài khoản')} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        >
          <View style={[styles.profileCard, { backgroundColor: palette.surface }]}>
            <Text variant="heading">{user?.full_name || '_'}</Text>
            <Text variant="small" color={palette.textSecondary}>
              {user?.email || '_'}
            </Text>
          </View>

          {/* TODO: đổi mật khẩu (profile/change-password, dùng chung form với (auth)/reset-password),
            kênh thông báo push + Telegram chỉ cho Farm Owner (không có Zalo/SMS — Report 3 §8),
            thông báo trong app, phiên bản app */}

          {/* Chuyển ngữ Việt ⇄ Anh, lưu theo tài khoản; nhãn viết bằng ngôn ngữ đích để ai cũng đọc được */}
          <Button
            variant="secondary"
            label={language === 'vi' ? 'Chuyển sang English' : 'Switch to Tiếng Việt'}
            onPress={switchLanguage}
            disabled={switchingTo !== null}
          />
          <LogoutButton />
        </ScrollView>
      </View>

      {/* Câu chờ viết bằng ngôn ngữ đang đổi sang */}
      <LoadingOverlay
        visible={switchingTo !== null}
        message={translate('Đang đổi ngôn ngữ...', switchingTo ?? language)}
      />
      {switchedTo && <Toast message={SWITCHED_MESSAGES[switchedTo]} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  profileCard: { padding: Spacing.lg, gap: Spacing.xs, borderRadius: Radius.lg },
})
