import { useCallback, useMemo } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { router, useIsFocused } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CaretRightIcon, CheckCircleIcon } from 'phosphor-react-native'
import { ALERT_ROW_HEIGHT, AlertRow } from '@/components/alert/AlertRow'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { getRoleTabs } from '@/constants/roleTabs'
import { Radius, Spacing } from '@/constants/theme'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { usePagedAlertList } from '@/hooks/alert/usePagedAlertList'
import { useRefetchInvalidatedAlertLists } from '@/hooks/alert/useRefetchInvalidatedAlertLists'
import { openAlertFromBell } from '@/hooks/notification/useOpenNotification'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import type { Alert } from '@/types'
import { buildBellAlertRows, type ServerAlertFilter } from '@/utils/alertList.utils'
import { t } from '@/utils/i18n.utils'

// Cảnh báo đang hiệu lực của mọi farm: chưa xác nhận (ACTIVE) trước, đã xác nhận (ACKNOWLEDGED) sau — như tab Cảnh báo.
// Số trên chip "Cảnh báo" của chuông vẫn chỉ đếm phần chưa xác nhận
const BELL_ALERT_STATUSES: Alert['status'][] = ['ACTIVE', 'ACKNOWLEDGED']
const ALL_FARMS_FILTER: ServerAlertFilter = { farmId: null, zoneId: null, type: null, verdict: null }
// Đồng hồ cho "3 phút trước"
const CLOCK_INTERVAL_MS = 30 * 1000
const SKELETON_ROW_COUNT = 4
const ROW_GAP = Spacing.sm

// Mục "Cảnh báo" của chuông: cảnh báo chưa xác nhận ở trên, cảnh báo đã xác nhận (vẫn hiệu lực) dưới tiêu đề riêng — xác nhận
// xong cảnh báo không mất khỏi chuông mà chuyển xuống nhóm dưới. Mỗi nhóm mới nhất trước, phân trang ở server. Bấm một dòng là
// mở trang chi tiết. Cùng hàng tiêu đề "Chưa xác nhận", bên phải, có nút "Xem tất cả" chuyển sang tab Cảnh báo — đủ bộ lọc,
// mục Đã đóng — như bấm tab đó trên thanh tab, nên không kèm nút ‹ (tab chính; về chuông bằng icon chuông ở tiêu đề tab Cảnh
// báo); chỉ role có tab Cảnh báo mới thấy. Danh sách tự tải lại khi có cảnh báo mới, xác nhận hoặc phán quyết (invalidateAlertQueries) lúc màn đang hiện
export function BellAlertList() {
  const palette = usePalette()
  // Màn chuông không có thanh tab: chừa vùng an toàn dưới đáy máy
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { locate } = useAlertLocations()
  const user = useAuthStore(state => state.user)
  const hasAlertsTab = user ? getRoleTabs(user.role).some(tab => tab.name === 'alerts') : false
  const list = usePagedAlertList({
    statuses: BELL_ALERT_STATUSES,
    filter: ALL_FARMS_FILTER,
    level: null,
    enabled: true,
    refetchInterval: false,
  })
  useRefetchInvalidatedAlertLists(isFocused)
  const pages = list.data?.pages
  const rows = useMemo(() => buildBellAlertRows(pages?.flatMap(page => page.items) ?? []), [pages])
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
      data={rows}
      keyExtractor={row => row.key}
      renderItem={({ item }) => {
        if (item.kind === 'header') {
          return (
            <View style={[styles.header, item.group === 'acknowledged' && styles.laterHeader]}>
              <Text variant="body" weight="semiBold" accessibilityRole="header">
                {item.group === 'pending' ? t('Chưa xác nhận') : t('Đã xác nhận')}
              </Text>
              {item.group === 'pending' && hasAlertsTab && (
                <Button
                  variant="link"
                  size="sm"
                  label={t('Xem tất cả')}
                  trailingIcon={CaretRightIcon}
                  accessibilityLabel={t('Mở tab Cảnh báo')}
                  onPress={() => router.navigate('/(tabs)/alerts')}
                  style={styles.viewAll}
                />
              )}
            </View>
          )
        }
        if (item.kind === 'allClear') {
          return (
            <View style={[styles.allClear, { backgroundColor: palette.surface }]}>
              <CheckCircleIcon size={32} color={palette.houseHealthy} weight="fill" />
              <Text variant="body" weight="semiBold" center>
                {t('Tuyệt vời! Không có cảnh báo nào chờ xử lý')}
              </Text>
            </View>
          )
        }
        const location = locate(item.alert)
        return (
          <AlertRow
            alert={item.alert}
            locationText={location.farmName ? `${location.farmName} › ${location.text}` : location.text}
            now={now}
            onPress={openAlert}
          />
        )
      }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  // Tiêu đề nhóm: cách nhóm trên rộng hơn khoảng giữa các dòng
  // Tiêu đề nhóm một hàng: chữ bên trái, nút "Xem tất cả" (nếu có) bên phải
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  // Tiêu đề nhóm dưới cách nhóm trên rộng hơn khoảng giữa các dòng
  laterHeader: { paddingTop: Spacing.sm },
  // Nút "Xem tất cả ›" giữ đủ rộng, không bị tiêu đề ép co
  viewAll: { flexShrink: 0 },
})
