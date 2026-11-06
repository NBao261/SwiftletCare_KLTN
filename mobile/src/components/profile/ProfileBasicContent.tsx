import { ScrollView, StyleSheet, View } from 'react-native'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Language } from '@/stores/languageStore'
import type { User } from '@/types'
import { t } from '@/utils/i18n.utils'

interface ProfileBasicContentProps {
  user: User | null
  language: Language
  isSwitching: boolean
  onSwitchLanguage: () => void
  bottomPadding: number
}

// Trang Tài khoản cơ bản (tên, email, đổi ngôn ngữ, đăng xuất) — giữ nguyên cho role chưa làm trang đầy đủ (Domain Expert)
export function ProfileBasicContent({ user, language, isSwitching, onSwitchLanguage, bottomPadding }: ProfileBasicContentProps) {
  const palette = usePalette()

  return (
    <>
      <AppHeader title={t('Tài khoản')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <View style={[styles.profileCard, { backgroundColor: palette.surface }]}>
          <Text variant="heading">{user?.full_name || '_'}</Text>
          <Text variant="small" color={palette.textSecondary}>
            {user?.email || '_'}
          </Text>
        </View>

        {/* Chuyển ngữ Việt ⇄ Anh, lưu theo tài khoản; nhãn viết bằng ngôn ngữ đích để ai cũng đọc được */}
        <Button
          variant="secondary"
          label={language === 'vi' ? 'Chuyển sang English' : 'Switch to Tiếng Việt'}
          onPress={onSwitchLanguage}
          disabled={isSwitching}
        />
        <LogoutButton />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl },
  profileCard: { padding: Spacing.lg, gap: Spacing.xs, borderRadius: Radius.lg },
})
