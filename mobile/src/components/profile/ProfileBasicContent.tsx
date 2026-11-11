import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import {
  ClockCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  GlobeIcon,
  IdentificationBadgeIcon,
  InfoIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from 'phosphor-react-native'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { HomeSection } from '@/components/home/HomeSection'
import { LanguageFlag } from '@/components/profile/LanguageFlag'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Language } from '@/stores/languageStore'
import type { User } from '@/types'
import { getRoleLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

interface ProfileBasicContentProps {
  user: User | null
  language: Language
  isSwitching: boolean
  onSwitchLanguage: () => void
  bottomPadding: number
}

// Trang Tài khoản của Chuyên gia (Domain Expert) — đồng bộ 100% thiết kế với OwnerProfileContent (ProfileAvatar, ProfileRow, LanguageFlag, Privacy)
export function ProfileBasicContent({ user, language, isSwitching, onSwitchLanguage, bottomPadding }: ProfileBasicContentProps) {
  const palette = usePalette()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isExpert = canPerform(user, 'writeConclusion')

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: bottomPadding },
      ]}
    >
      {/* Hồ sơ: ảnh đại diện, họ tên, vai trò — đồng bộ với OwnerProfileContent */}
      <View style={styles.identity}>
        <ProfileAvatar fullName={user?.full_name} avatarUrl={user?.avatar_url} />
        <Text variant="heading" weight="semiBold" center>
          {user?.full_name || '_'}
        </Text>
        <Text variant="small" color={palette.textSecondary} center>
          {user ? getRoleLabel(user.role) : '_'}
        </Text>
      </View>

      <Card style={styles.listCard}>
        <ProfileRow icon={EnvelopeSimpleIcon} label={t('Email')} value={user?.email || '_'} hasDivider />
        <ProfileRow icon={PhoneIcon} label={t('Điện thoại')} value={user?.phone || '_'} hasDivider />
        <ProfileRow icon={IdentificationBadgeIcon} label={t('Vai trò')} value={user ? getRoleLabel(user.role) : '_'} hasDivider />
        <ProfileRow icon={ShieldCheckIcon} label={t('Trạng thái tài khoản')} value={t('Đang hoạt động')} />
      </Card>

      {/* Lối tắt 1 chạm vào Nhật ký Hoạt động chuyên gia (EXPERT-FR-009, BZ-14) — dùng canPerform thay vì check role cứng */}
      {isExpert && (
        <HomeSection isCompact title={t('Chuyên môn')}>
          <Card style={styles.listCard}>
            <ProfileRow
              icon={ClockCounterClockwiseIcon}
              label={t('Nhật ký xử lý kỹ thuật')}
              caption={t('Lịch sử thẩm định cảnh báo, duyệt ngưỡng và đề xuất hệ số')}
              onPress={() => router.push('/expert/activity')}
            />
          </Card>
        </HomeSection>
      )}

      <HomeSection isCompact title={t('Ứng dụng')}>
        <Card style={styles.listCard}>
          <ProfileRow
            icon={GlobeIcon}
            label={t('Ngôn ngữ')}
            onPress={isSwitching ? undefined : onSwitchLanguage}
            trailing={<LanguageFlag language={language} />}
            accessibilityLabel={
              language === 'vi'
                ? 'Ngôn ngữ: Tiếng Việt. Chạm để chuyển sang English'
                : 'Language: English. Tap to switch to Tiếng Việt'
            }
            hasDivider
          />
          <ProfileRow
            icon={ShieldIcon}
            label={t('Chính sách quyền riêng tư')}
            onPress={() => router.push('/(tabs)/profile/privacy')}
            hasDivider
          />
          <ProfileRow icon={InfoIcon} label={t('Phiên bản ứng dụng')} value={Constants.expoConfig?.version ?? '_'} />
        </Card>
      </HomeSection>

      <LogoutButton />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },
  identity: { alignItems: 'center', gap: Spacing.xs },
  listCard: { paddingVertical: Spacing.xs },
})
