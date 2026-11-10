import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { BellIcon, ChartLineIcon, WarningCircleIcon } from 'phosphor-react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing, Radius } from '@/constants/theme'
import { useMarkAllNotificationsRead } from '@/hooks/notification/useMarkAllNotificationsRead'
import { useMarkNotificationRead } from '@/hooks/notification/useMarkNotificationRead'
import { useNotifications } from '@/hooks/notification/useNotifications'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { InAppNotification } from '@/types'
import { formatTimeAgo } from '@/utils/date.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { RETURN_TO_NOTIFICATIONS } from '@/utils/navigation.utils'

/** Hộp thông báo trong app (EXPERT-FR-007): mới nhất trước, chạm để đánh dấu đã đọc và mở cảnh báo hoặc báo cáo */
export default function NotificationsScreen() {
  const palette = usePalette()
  // Mở từ chuông ở Trang chủ thì ‹ về Trang chủ, không thì về trang Tài khoản
  const returnBack = useReturnBack()
  const user = useAuthStore(state => state.user)
  const query = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications = query.data?.pages.flatMap(page => page.data) ?? []
  const unreadCount = query.data?.pages[0]?.meta?.unreadCount ?? 0

  if (!canPerform(user, 'viewOwnerProfile')) return <Redirect href="/(tabs)/profile" />

  // Mở đúng đối tượng của thông báo; thông báo không gắn đối tượng thì chỉ đánh dấu đã đọc
  const openNotification = (notification: InAppNotification) => {
    if (!notification.read_at) markRead.mutate(notification._id)
    if (notification.ref?.kind === 'alert') {
      router.push({ pathname: '/alert/[alertId]', params: { alertId: notification.ref.id } })
    } else if (notification.ref?.kind === 'health_report') {
      router.navigate({
        pathname: '/(tabs)/analytics',
        params: { tab: 'reports', reportId: notification.ref.id, returnTo: RETURN_TO_NOTIFICATIONS },
      })
    }
  }

  const renderBody = () => {
    if (query.isLoading) {
      return (
        <View style={styles.content} accessibilityLabel={t('Đang tải')}>
          {[0, 1, 2, 3].map(index => (
            <Skeleton key={index} width="100%" height={64} radius={Radius.md} />
          ))}
        </View>
      )
    }
    if (query.isError) {
      return (
        <View style={styles.content}>
          <EmptyState message={t('Không tải được thông báo')} actionLabel={t('Thử lại')} onAction={() => query.refetch()} />
        </View>
      )
    }
    return (
      <FlatList
        data={notifications}
        keyExtractor={notification => notification._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
        ListEmptyComponent={<EmptyState message={t('Chưa có thông báo nào')} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={palette.text} /> : undefined}
        renderItem={({ item: notification }) => (
          <Card style={styles.item}>
            <ProfileRow
              icon={
                notification.ref?.kind === 'alert'
                  ? WarningCircleIcon
                  : notification.ref?.kind === 'health_report'
                    ? ChartLineIcon
                    : BellIcon
              }
              label={notification.title}
              caption={`${notification.body} · ${formatTimeAgo(notification.created_at)}`}
              onPress={() => openNotification(notification)}
              trailing={
                notification.read_at ? undefined : (
                  <View
                    style={[styles.unreadDot, { backgroundColor: palette.notificationBadge }]}
                    accessibilityLabel={t('Chưa đọc')}
                  />
                )
              }
            />
          </Card>
        )}
      />
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        title={t('Thông báo')}
        onBack={returnBack ?? (() => router.back())}
        right={
          unreadCount > 0 ? (
            <Button
              variant="link"
              size="sm"
              label={t('Đọc hết')}
              onPress={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
            />
          ) : undefined
        }
      />
      {renderBody()}
    </View>
  )
}

const UNREAD_DOT_SIZE = 8

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  item: { paddingVertical: Spacing.xs },
  unreadDot: { width: UNREAD_DOT_SIZE, height: UNREAD_DOT_SIZE, borderRadius: Radius.full },
})
