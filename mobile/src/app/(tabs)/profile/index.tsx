import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import {
  ArrowCounterClockwiseIcon,
  BellIcon,
  BellRingingIcon,
  ChartLineIcon,
  ClipboardTextIcon,
  DeviceMobileIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  InfoIcon,
  KeyIcon,
  ListChecksIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TranslateIcon,
  TrashIcon,
  UsersThreeIcon,
} from 'phosphor-react-native'
import Constants from 'expo-constants'
import { NotificationSettingsSheet } from '@/components/alert/NotificationSettingsSheet'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { MockDataBadge } from '@/components/common/MockDataBadge'
import { HomeSection } from '@/components/home/HomeSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { ProfileBasicContent } from '@/components/profile/ProfileBasicContent'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { ProfileShortcutCard } from '@/components/profile/ProfileShortcutCard'
import { Card } from '@/components/ui/card'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { Spacing } from '@/constants/theme'
import { useCancelAccountDeletion } from '@/hooks/auth/useCancelAccountDeletion'
import { useRequestAccountDeletion } from '@/hooks/auth/useRequestAccountDeletion'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { usePendingHealthDays, HAS_PENDING_HEALTH_DAYS_API } from '@/hooks/health/usePendingHealthDays'
import { useSwitchLanguage } from '@/hooks/i18n/useSwitchLanguage'
import { useNow } from '@/hooks/time/useNow'
import { useUnreadNotificationCount } from '@/hooks/notification/useUnreadNotificationCount'
import { useMyReviewItems } from '@/hooks/profile/useMyReviewItems'
import { usePushRegistration } from '@/hooks/profile/usePushRegistration'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { Language } from '@/stores/languageStore'
import { getDaysLeft, getDeletionDeadline, isReviewPending } from '@/utils/account.utils'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDate } from '@/utils/date.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t, translate } from '@/utils/i18n.utils'

const HOUR_MS = 60 * 60 * 1000

// Câu báo xong, viết bằng chính ngôn ngữ vừa chọn
const SWITCHED_MESSAGES: Record<Language, string> = {
  vi: 'Đã đổi sang Tiếng Việt',
  en: 'Switched to English',
}

/**
 * Tài khoản – trang đầy đủ cho Farm Owner theo ảnh mẫu: hồ sơ, lối tắt, thông báo, quản lý thành viên, bảo mật
 * (AUTH-FR-002/005/005c/006/012, ALERT-FR-002/005/006/013, EXPERT-FR-001/007/009/010/012).
 * Domain Expert giữ trang cơ bản (ProfileBasicContent). Mục Report 3 có mà backend chưa có route dùng dữ liệu mẫu, có nhãn
 */
export default function ProfileScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  // Đổi ngôn ngữ thì dựng lại phần nội dung (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const { language, switchingTo, switchedTo, switchLanguage } = useSwitchLanguage()
  // Chừa phần thanh tab đè lên đáy màn (MOBILE_GUIDE 3.5) cộng lề dưới; vùng an toàn dưới đã nằm trong thanh tab
  const bottomPadding = Spacing.lg + TAB_BAR_OVERLAP
  const isOwnerProfile = canPerform(user, 'viewOwnerProfile')

  return (
    // Lớp chờ và toast nằm ngoài phần được dựng lại để không mất khi đổi ngôn ngữ
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        {isOwnerProfile ? (
          <OwnerProfileContent
            language={language}
            isSwitching={switchingTo !== null}
            onSwitchLanguage={switchLanguage}
            bottomPadding={bottomPadding}
          />
        ) : (
          <ProfileBasicContent
            user={user}
            language={language}
            isSwitching={switchingTo !== null}
            onSwitchLanguage={switchLanguage}
            bottomPadding={bottomPadding}
          />
        )}
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

interface OwnerProfileContentProps {
  language: Language
  isSwitching: boolean
  onSwitchLanguage: () => void
  bottomPadding: number
}

// Nội dung trang Tài khoản của Farm Owner
function OwnerProfileContent({ language, isSwitching, onSwitchLanguage, bottomPadding }: OwnerProfileContentProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const { farm } = useCurrentFarm()
  const toast = useToastMessage()
  const [isChannelSheetOpen, setChannelSheetOpen] = useState(false)

  const unreadQuery = useUnreadNotificationCount()
  const pendingDaysQuery = usePendingHealthDays()
  const reviewItemsQuery = useMyReviewItems(farm?._id ?? '')
  const requestDeletion = useRequestAccountDeletion()
  const cancelDeletion = useCancelAccountDeletion()
  const push = usePushRegistration()
  // Số ngày còn lại tới hạn xử lý yêu cầu xoá: cập nhật mỗi giờ là đủ
  const now = useNow(HOUR_MS)

  const pendingReviewCount = (reviewItemsQuery.data ?? []).filter(item => isReviewPending(item.status)).length
  // Trạng thái yêu cầu xoá lấy từ User của phiên (deletion_requested_at, AUTH-FR-012, §6.14)
  const deletionRequestedAt = user?.deletion_requested_at ?? null
  const memberCount = farm?.members.length

  const confirmDeletionRequest = () => {
    Alert.alert(
      t('Yêu cầu xoá tài khoản'),
      t('Quản trị viên sẽ xoá tài khoản và dữ liệu cá nhân của bạn trong 30 ngày. Farm bạn là chủ chính sẽ chuyển cho đồng sở hữu vào sớm nhất, không có thì bị xoá. Gửi yêu cầu?'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Gửi yêu cầu'),
          style: 'destructive',
          onPress: () =>
            requestDeletion.mutate(undefined, {
              onSuccess: () => toast.show(t('Đã gửi yêu cầu xoá tài khoản')),
              onError: error =>
                toast.show(getSettingsErrorMessage(error, { 409: t('Bạn đã có yêu cầu xoá đang chờ xử lý') })),
            }),
        },
      ],
    )
  }

  const confirmCancelDeletion = () => {
    Alert.alert(t('Huỷ yêu cầu xoá tài khoản'), t('Tài khoản sẽ tiếp tục hoạt động như bình thường. Huỷ yêu cầu?'), [
      { text: t('Không'), style: 'cancel' },
      {
        text: t('Huỷ yêu cầu'),
        onPress: () =>
          cancelDeletion.mutate(undefined, {
            onSuccess: () => toast.show(t('Đã huỷ yêu cầu xoá tài khoản')),
            onError: error => toast.show(getSettingsErrorMessage(error, { 409: t('Không có yêu cầu xoá nào đang chờ') })),
          }),
      },
    ])
  }

  const enablePush = () =>
    push.enable.mutate(undefined, {
      onSuccess: isEnabled =>
        toast.show(isEnabled ? t('Đã bật thông báo trên máy này') : t('Chưa được cấp quyền thông báo')),
    })

  return (
    <>
      <AppHeader title={t('Tài khoản')} titleAlign="center" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        {/* Hồ sơ: ảnh, tên, vai trò — Report 3 không có yêu cầu sửa hồ sơ nên chỉ đọc */}
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
          <ProfileRow
            icon={ShieldCheckIcon}
            label={t('Trạng thái tài khoản')}
            value={
              deletionRequestedAt
                ? t('Đang chờ xoá · còn {days} ngày', { days: getDaysLeft(getDeletionDeadline(deletionRequestedAt), now) })
                : t('Đang hoạt động')
            }
          />
        </Card>

        <HomeSection title={t('Lối tắt')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
            <ProfileShortcutCard
              icon={BellIcon}
              title={t('Thông báo')}
              caption={unreadQuery.isLoading ? '_' : t('{count} chưa đọc', { count: unreadQuery.data ?? 0 })}
              onPress={() => router.push('/(tabs)/profile/notifications')}
            />
            <ProfileShortcutCard
              icon={ChartLineIcon}
              title={t('Báo cáo sức khỏe')}
              caption={t('Ngày, tuần, tháng')}
              onPress={() => router.navigate({ pathname: '/(tabs)/analytics', params: { tab: 'reports' } })}
            />
            <ProfileShortcutCard
              icon={ClipboardTextIcon}
              title={t('Chấm điểm ngày')}
              caption={t('{count} ngày chờ chấm', { count: pendingDaysQuery.data?.length ?? 0 })}
              onPress={() => router.navigate('/(tabs)/home')}
              isComingSoon={!HAS_PENDING_HEALTH_DAYS_API}
            />
            <ProfileShortcutCard
              icon={ListChecksIcon}
              title={t('Quyết định chuyên gia')}
              caption={t('{count} mục chờ duyệt', { count: pendingReviewCount })}
              onPress={() => router.push('/(tabs)/profile/expert-activity')}
              isComingSoon={!IS_MOCK_API_ENABLED}
            />
          </ScrollView>
        </HomeSection>

        <HomeSection title={t('Thông báo')}>
          <Card style={styles.listCard}>
            <ProfileRow
              icon={BellRingingIcon}
              label={t('Kênh nhận cảnh báo')}
              caption={t('Push, Telegram, giờ yên lặng')}
              onPress={() => setChannelSheetOpen(true)}
              hasDivider
            />
            <ProfileRow
              icon={SlidersHorizontalIcon}
              label={t('Kênh theo loại cảnh báo')}
              caption={IS_MOCK_API_ENABLED ? t('Chọn kênh cho từng loại') : t('Sắp có')}
              onPress={IS_MOCK_API_ENABLED ? () => router.push('/(tabs)/profile/notification-channels') : undefined}
              hasDivider
            />
            <ProfileRow
              icon={DeviceMobileIcon}
              label={t('Nhận push trên máy này')}
              caption={
                push.isLoading ? '_' : push.isGranted ? t('Đã cho phép thông báo') : t('Chưa cho phép, chạm để bật')
              }
              onPress={push.isGranted || push.enable.isPending ? undefined : enablePush}
              trailing={<MockDataBadge />}
            />
          </Card>
        </HomeSection>

        <HomeSection title={t('Quản lý')}>
          <Card style={styles.listCard}>
            <ProfileRow
              icon={UsersThreeIcon}
              label={t('Thành viên farm')}
              caption={
                farm
                  ? t('{farm} · {count} thành viên', { farm: farm.name, count: memberCount ?? 0 })
                  : t('Chưa có farm')
              }
              onPress={farm ? () => router.push('/(tabs)/profile/members') : undefined}
            />
          </Card>
        </HomeSection>

        <HomeSection title={t('Bảo mật')}>
          <Card style={styles.listCard}>
            <ProfileRow
              icon={KeyIcon}
              label={t('Đổi mật khẩu')}
              onPress={() => router.push('/(tabs)/profile/change-password')}
              hasDivider
            />
            {/* Đang chờ xoá thì hàng này thành "Huỷ yêu cầu" (DELETE /auth/delete-request); nút khoá khi đang gửi */}
            {deletionRequestedAt ? (
              <ProfileRow
                icon={ArrowCounterClockwiseIcon}
                label={t('Huỷ yêu cầu xoá tài khoản')}
                caption={t('Đã gửi ngày {date}, chờ quản trị viên xử lý', { date: formatDate(deletionRequestedAt) })}
                onPress={cancelDeletion.isPending ? undefined : confirmCancelDeletion}
              />
            ) : (
              <ProfileRow
                icon={TrashIcon}
                label={t('Yêu cầu xoá tài khoản')}
                caption={t('Xoá tài khoản và dữ liệu cá nhân trong 30 ngày')}
                onPress={requestDeletion.isPending ? undefined : confirmDeletionRequest}
                isDestructive
              />
            )}
          </Card>
        </HomeSection>

        <HomeSection title={t('Ứng dụng')}>
          <Card style={styles.listCard}>
            {/* Nhãn viết bằng ngôn ngữ đích để ai cũng đọc được; lưu theo tài khoản */}
            <ProfileRow
              icon={TranslateIcon}
              label={t('Ngôn ngữ')}
              value={language === 'vi' ? 'Tiếng Việt' : 'English'}
              caption={language === 'vi' ? 'Chạm để chuyển sang English' : 'Tap to switch to Tiếng Việt'}
              onPress={isSwitching ? undefined : onSwitchLanguage}
              hasDivider
            />
            <ProfileRow icon={InfoIcon} label={t('Phiên bản ứng dụng')} value={Constants.expoConfig?.version ?? '_'} />
          </Card>
        </HomeSection>

        <LogoutButton />
      </ScrollView>

      <NotificationSettingsSheet visible={isChannelSheetOpen} onClose={() => setChannelSheetOpen(false)} />
      {toast.message && <Toast message={toast.message} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  identity: { alignItems: 'center', gap: Spacing.xs },
  listCard: { paddingVertical: Spacing.xs },
  shortcuts: { gap: Spacing.sm },
})
