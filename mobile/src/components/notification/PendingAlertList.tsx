import { useCallback } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckCircleIcon } from 'phosphor-react-native'
import { ALERT_ROW_HEIGHT, AlertRow } from '@/components/alert/AlertRow'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { usePagedAlertList } from '@/hooks/alert/usePagedAlertList'
import { useRefetchInvalidatedAlertLists } from '@/hooks/alert/useRefetchInvalidatedAlertLists'
import { openAlertFromBell } from '@/hooks/notification/useOpenNotification'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import type { Alert } from '@/types'
import type { ServerAlertFilter } from '@/utils/alertList.utils'
import { t } from '@/utils/i18n.utils'

// Chỉ cảnh báo chưa xác nhận, của mọi farm — cùng số với badge tab Cảnh báo
const PENDING_STATUSES: Alert['status'][] = ['ACTIVE']
const ALL_FARMS_FILTER: ServerAlertFilter = { farmId: null, zoneId: null, type: null, verdict: null }
// Đồng hồ cho "3 phút trước"
const CLOCK_INTERVAL_MS = 30 * 1000
const SKELETON_ROW_COUNT = 4
const ROW_GAP = Spacing.sm

// Mục "Cảnh báo" của chuông: cảnh báo chưa xác nhận, mới nhất trước, phân trang ở server. Bấm một dòng là mở đúng cảnh báo đó
// ở tab Cảnh báo. Danh sách tự tải lại khi có cảnh báo mới, xác nhận hoặc phán quyết (invalidateAlertQueries) lúc màn đang hiện
export function PendingAlertList() {
  const palette = usePalette()
  // Màn chuông không có thanh tab: chừa vùng an toàn dưới đáy máy
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { locate } = useAlertLocations()
  const list = usePagedAlertList({
    statuses: PENDING_STATUSES,
    filter: ALL_FARMS_FILTER,
    level: null,
    enabled: true,
    refetchInterval: false,
  })
  useRefetchInvalidatedAlertLists(isFocused)
  const alerts = list.data?.pages.flatMap(page => page.items) ?? []
  // Hàm cố định cho mọi hàng để AlertRow (memo) không vẽ lại khi danh sách vẽ lại
  const openAlert = useCallback((alert: Alert) => openAlertFromBell(alert._id), [])

  if (list.isLoading) {
    return (
      <View style={[styles.content, styles.list]}>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} width="100%" height={ALERT_ROW_HEIGHT} delayMs={index * 75} />
        ))}
      </View>
    )
  }
  if (list.isError) {
    return (
      <View style={styles.content}>
        <EmptyState message={t('Không tải được cảnh báo')} actionLabel={t('Thử lại')} onAction={() => list.refetch()} />
      </View>
    )
  }
  return (
    <FlatList
      data={alerts}
      keyExtractor={alert => alert._id}
      renderItem={({ item }) => {
        const location = locate(item)
        return (
          <AlertRow
            alert={item}
            locationText={location.farmName ? `${location.farmName} › ${location.text}` : location.text}
            now={now}
            onPress={openAlert}
          />
        )
      }}
      getItemLayout={(_data, index) => ({
        length: ALERT_ROW_HEIGHT + ROW_GAP,
        offset: (ALERT_ROW_HEIGHT + ROW_GAP) * index,
        index,
      })}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={[styles.allClear, { backgroundColor: palette.surface }]}>
          <CheckCircleIcon size={32} color={palette.houseHealthy} weight="fill" />
          <Text variant="body" weight="semiBold" center>
            {t('Tuyệt vời! Không có cảnh báo nào chờ xử lý')}
          </Text>
        </View>
      }
      ListFooterComponent={
        list.hasNextPage ? (
          <Button label={t('Xem thêm')} variant="link" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} />
        ) : undefined
      }
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage()
      }}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg },
  list: { gap: ROW_GAP },
  separator: { height: ROW_GAP },
  allClear: { alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.xl },
})
