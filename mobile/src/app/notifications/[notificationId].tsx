import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HomeSection } from '@/components/home/HomeSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { ExpertDecisionList } from '@/components/profile/ExpertDecisionList'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useMarkNotificationRead } from '@/hooks/notification/useMarkNotificationRead'
import { useNotificationDetail } from '@/hooks/notification/useNotificationDetail'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { humanizeChangeText } from '@/utils/account.utils'
import { formatDateTime } from '@/utils/date.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const DETAIL_SKELETON_HEIGHT = 160

/** Chi tiết một thông báo không có màn riêng để mở (quyết định của chuyên gia, lệnh từ xa trên thiết bị…): đủ tiêu đề, nội
 * dung, thời gian; quyết định của chuyên gia kèm mục Hoạt động chuyên gia ngay bên dưới, không chuyển trang. Mở trang là
 * đánh dấu đã đọc. Màn riêng ở stack gốc, ngoài các tab nên thanh tab ẩn */
export default function NotificationDetailScreen() {
  const palette = usePalette()
  const goBack = useGoBackOrHome()
  const insets = useSafeAreaInsets()
  const { notificationId = '' } = useLocalSearchParams<{ notificationId?: string }>()
  const user = useAuthStore(state => state.user)
  const detail = useNotificationDetail(notificationId)
  // Farm đang chọn, như màn Hoạt động chuyên gia (thông báo không ghi farm)
  const { farm } = useCurrentFarm()
  const notification = detail.notification
  const markRead = useMarkNotificationRead()
  const markNotificationRead = markRead.mutate
  // Mỗi lần mở trang chỉ gửi đánh dấu đã đọc một lần
  const hasMarkedRead = useRef(false)

  useEffect(() => {
    if (!notification || notification.read_at || hasMarkedRead.current) return
    hasMarkedRead.current = true
    markNotificationRead(notification._id)
  }, [notification, markNotificationRead])

  if (!canPerform(user, 'viewBell')) return <Redirect href="/(tabs)/home" />

  const renderBody = () => {
    if (!notification) {
      if (detail.isLoading) return <Skeleton width="100%" height={DETAIL_SKELETON_HEIGHT} radius={Radius.md} />
      if (detail.isError) {
        return <EmptyState message={t('Không tải được thông báo')} actionLabel={t('Thử lại')} onAction={detail.retry} />
      }
      return (
        <EmptyState
          message={t('Không tìm thấy thông báo')}
          actionLabel={t('Về hộp thông báo')}
          onAction={() => router.navigate('/notifications')}
        />
      )
    }
    return (
      <>
        <Card style={styles.card}>
          {/* Tiêu đề gọn, cỡ tên khối — không dùng cỡ tiêu đề màn */}
          <Text variant="heading" weight="semiBold">
            {notification.title}
          </Text>
          {/* Thời gian; nơi xảy ra (khu vực, nhà) backend ghi sẵn trong nội dung nên không lặp lại ở đây */}
          <Text variant="small" color={palette.textSecondary}>
            {formatDateTime(notification.created_at)}
          </Text>
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          {/* Nội dung backend có thể ghi mã trường ("humidity_min 75 → 80"): đổi sang tên chỉ số kèm đơn vị */}
          <Text variant="body">{humanizeChangeText(notification.body)}</Text>
        </Card>
        {/* Quyết định của chuyên gia: lịch sử hoạt động hiện ngay bên dưới, dòng của thông báo này có nhãn riêng */}
        {notification.ref?.kind === 'expert_decision' && (
          <HomeSection isCompact title={t('Hoạt động chuyên gia')}>
            {farm ? (
              <ExpertDecisionList farmId={farm._id} enabled highlightedId={notification.ref.id} />
            ) : (
              <EmptyState message={t('Chưa có farm')} />
            )}
          </HomeSection>
        )}
      </>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Chi tiết thông báo')} onBack={goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + insets.bottom }]}
      >
        {renderBody()}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { gap: Spacing.sm },
  divider: { height: BorderWidth.hairline, marginVertical: Spacing.xs },
})
