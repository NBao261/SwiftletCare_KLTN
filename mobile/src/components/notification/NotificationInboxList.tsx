import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BellIcon, ChartLineIcon, GavelIcon, WarningCircleIcon, type Icon } from 'phosphor-react-native'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useNotifications } from '@/hooks/notification/useNotifications'
import { useOpenNotification } from '@/hooks/notification/useOpenNotification'
import { usePalette } from '@/hooks/theme/usePalette'
import type { InAppNotification } from '@/types'
import { humanizeChangeText } from '@/utils/account.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const SKELETON_ROW_COUNT = 4
const UNREAD_DOT_SIZE = 8

// Icon theo đối tượng của thông báo
function getNotificationIcon(notification: InAppNotification): Icon {
  if (notification.ref?.kind === 'alert') return WarningCircleIcon
  if (notification.ref?.kind === 'health_report') return ChartLineIcon
  if (notification.ref?.kind === 'expert_decision') return GavelIcon
  return BellIcon
}

// Mục "Thông báo" của chuông (EXPERT-FR-007): mới nhất trước, chấm đỏ là chưa đọc, tải thêm khi cuộn. Tiêu đề một dòng, nội
// dung hai dòng — nội dung dài xem đủ ở trang chi tiết
export function NotificationInboxList() {
  const palette = usePalette()
  // Màn chuông không có thanh tab: chừa vùng an toàn dưới đáy máy
  const insets = useSafeAreaInsets()
  const query = useNotifications()
  const openNotification = useOpenNotification()
  const notifications = query.data?.pages.flatMap(page => page.data) ?? []

  if (query.isLoading) {
    return (
      <View style={styles.content} accessibilityLabel={t('Đang tải')}>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
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
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + insets.bottom }]}
      ListEmptyComponent={<EmptyState message={t('Bạn đã xem hết thông báo')} />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={palette.text} /> : undefined}
      renderItem={({ item: notification }) => (
        <Card style={styles.item}>
          <ProfileRow
            icon={getNotificationIcon(notification)}
            label={notification.title}
            caption={`${humanizeChangeText(notification.body)} · ${formatTimeAgo(notification.created_at)}`}
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

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.sm },
  item: { paddingVertical: Spacing.xs },
  unreadDot: { width: UNREAD_DOT_SIZE, height: UNREAD_DOT_SIZE, borderRadius: Radius.full },
})
