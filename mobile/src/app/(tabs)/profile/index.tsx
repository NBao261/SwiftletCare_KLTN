import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore, type Language } from '@/stores/languageStore'
import { t, translate } from '@/utils/i18n.utils'

// Cho lớp chờ kịp hiện rồi mới đổi ngôn ngữ (dựng lại cả màn)
const OVERLAY_APPEAR_MS = 50
// Giữ lớp chờ thêm 500 ms sau khi đổi để các khối dựng lại xong
const LANGUAGE_SWITCH_MS = 500
const TOAST_DURATION_MS = 2500

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
  const language = useLanguage()
  const setLanguage = useLanguageStore(state => state.setLanguage)
  // Ngôn ngữ đang đổi sang — có giá trị thì hiện lớp chờ và chặn thao tác
  const [switchingTo, setSwitchingTo] = useState<Language | null>(null)
  // Ngôn ngữ vừa đổi xong — có giá trị thì hiện toast
  const [switchedTo, setSwitchedTo] = useState<Language | null>(null)
  // Chừa phần thanh tab đè lên đáy màn (MOBILE_GUIDE 3.5) cộng lề dưới; vùng an toàn dưới đã nằm trong thanh tab
  const bottomPadding = Spacing.lg + TAB_BAR_OVERLAP

  // Lớp chờ hiện → đổi ngôn ngữ → giữ thêm 500 ms → ẩn lớp chờ, hiện toast
  useEffect(() => {
    if (!switchingTo || !user) return
    const applyTimer = setTimeout(() => setLanguage(switchingTo, user._id), OVERLAY_APPEAR_MS)
    const doneTimer = setTimeout(() => {
      setSwitchingTo(null)
      setSwitchedTo(switchingTo)
    }, OVERLAY_APPEAR_MS + LANGUAGE_SWITCH_MS)
    return () => {
      clearTimeout(applyTimer)
      clearTimeout(doneTimer)
    }
  }, [switchingTo, user, setLanguage])

  // Toast tự ẩn sau vài giây
  useEffect(() => {
    if (!switchedTo) return
    const timer = setTimeout(() => setSwitchedTo(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [switchedTo])

  const handleSwitchLanguage = () => {
    if (!user || switchingTo) return
    setSwitchedTo(null)
    setSwitchingTo(language === 'vi' ? 'en' : 'vi')
  }

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
            onPress={handleSwitchLanguage}
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
