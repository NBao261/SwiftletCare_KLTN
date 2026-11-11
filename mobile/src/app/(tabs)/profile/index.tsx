import { useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowCounterClockwiseIcon,
  BellIcon,
  BellRingingIcon,
  ChartLineIcon,
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  GlobeIcon,
  IdentificationBadgeIcon,
  InfoIcon,
  KeyIcon,
  ListChecksIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  UsersThreeIcon,
} from 'phosphor-react-native'
import Constants from 'expo-constants'
import { NotificationSettingsSheet } from '@/components/alert/NotificationSettingsSheet'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { HomeSection } from '@/components/home/HomeSection'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { LanguageFlag } from '@/components/profile/LanguageFlag'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { ProfileBasicContent } from '@/components/profile/ProfileBasicContent'
import { PushDeviceRow } from '@/components/profile/PushDeviceRow'
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
import { usePendingExpertReviewCount } from '@/hooks/expert-activity/usePendingExpertReviewCount'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { usePendingHealthDays, HAS_PENDING_HEALTH_DAYS_API } from '@/hooks/health/usePendingHealthDays'
import { useSwitchLanguage } from '@/hooks/i18n/useSwitchLanguage'
import { useNow } from '@/hooks/time/useNow'
import { useBellCounts } from '@/hooks/notification/useBellCounts'
import { useUnreadNotificationCount } from '@/hooks/notification/useUnreadNotificationCount'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { Language } from '@/stores/languageStore'
import { getDaysLeft, getDeletionDeadline } from '@/utils/account.utils'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDate } from '@/utils/date.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t, translate } from '@/utils/i18n.utils'
import { RETURN_TO_PROFILE } from '@/utils/navigation.utils'

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
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollViewInstance>(null)
  // Mở từ ảnh/tên ở đầu Trang chủ: mỗi lần bấm có một mốc mới, tab vẫn giữ chỗ cuộn cũ nên cuộn về đầu trang
  const { scrollToTopAt } = useLocalSearchParams<{ scrollToTopAt?: string }>()

  useEffect(() => {
    if (scrollToTopAt) scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [scrollToTopAt])

  const unreadQuery = useUnreadNotificationCount()
  // Lối tắt Thông báo mở chuông nên hiện cùng số với chuông: thông báo chưa đọc + cảnh báo chưa xác nhận
  const bellCounts = useBellCounts()
  const pendingDaysQuery = usePendingHealthDays()
  const pendingReviewQuery = usePendingExpertReviewCount(farm?._id ?? '')
  const requestDeletion = useRequestAccountDeletion()
  const cancelDeletion = useCancelAccountDeletion()
  // Số ngày còn lại tới hạn xử lý yêu cầu xoá: cập nhật mỗi giờ là đủ
  const now = useNow(HOUR_MS)

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


  return (
    <>
      {/* Không có tiêu đề: chừa vùng an toàn trên cùng (giờ, pin, tai thỏ) để ảnh đại diện không bị che */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: bottomPadding }]}
      >
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

        <HomeSection isCompact title={t('Lối tắt')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
            <ProfileShortcutCard
              icon={BellIcon}
              title={t('Thông báo')}
              caption={unreadQuery.isLoading ? '_' : t('{count} mới', { count: bellCounts.total })}
              onPress={() => router.push('/notifications')}
            />
            <ProfileShortcutCard
              icon={ChartLineIcon}
              title={t('Báo cáo sức khỏe')}
              caption={t('Ngày, tuần, tháng')}
              onPress={() => router.navigate({ pathname: '/(tabs)/analytics', params: { tab: 'reports', returnTo: RETURN_TO_PROFILE } })}
            />
            <ProfileShortcutCard
              icon={ClipboardTextIcon}
              title={t('Chấm điểm ngày')}
              // Chưa có số (đang tải, lỗi) thì không hiện "0 ngày" giả
              caption={
                pendingDaysQuery.data ? t('{count} ngày chờ chấm', { count: pendingDaysQuery.data.length }) : '_'
              }
              onPress={() => router.navigate('/(tabs)/home')}
              isComingSoon={!HAS_PENDING_HEALTH_DAYS_API}
            />
            <ProfileShortcutCard
              icon={ListChecksIcon}
              title={t('Quyết định chuyên gia')}
              caption={
                pendingReviewQuery.data === undefined
                  ? '_'
                  : t('{count} mục chờ duyệt', { count: pendingReviewQuery.data })
              }
              onPress={() => router.push('/(tabs)/profile/expert-activity')}
            />
          </ScrollView>
        </HomeSection>

        <HomeSection isCompact title={t('Thông báo')}>
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
            <PushDeviceRow onMessage={toast.show} />
          </Card>
        </HomeSection>

        <HomeSection isCompact title={t('Quản lý')}>
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

        <HomeSection isCompact title={t('Bảo mật')}>
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

        <HomeSection isCompact title={t('Ứng dụng')}>
          <Card style={styles.listCard}>
            {/* Chạm để chuyển Việt ⇄ Anh, lưu theo tài khoản; bên phải là mã + cờ của ngôn ngữ đang dùng */}
            <ProfileRow
              icon={GlobeIcon}
              label={t('Ngôn ngữ')}
              onPress={isSwitching ? undefined : onSwitchLanguage}
              trailing={<LanguageFlag language={language} />}
              accessibilityLabel={language === 'vi' ? 'Ngôn ngữ: Tiếng Việt. Chạm để chuyển sang English' : 'Language: English. Tap to switch to Tiếng Việt'}
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

      <NotificationSettingsSheet visible={isChannelSheetOpen} onClose={() => setChannelSheetOpen(false)} />
      {toast.message && <Toast message={toast.message} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  identity: { alignItems: 'center', gap: Spacing.xs },
  listCard: { paddingVertical: Spacing.xs },
  shortcuts: { gap: Spacing.sm },
})
