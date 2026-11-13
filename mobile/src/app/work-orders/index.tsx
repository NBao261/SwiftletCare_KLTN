import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { WorkOrderRow } from '@/components/work-order/WorkOrderRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useWorkOrders } from '@/hooks/work-order/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Bộ lọc: việc giao cho tôi (kỹ thuật viên), đang mở, đã đóng hoặc huỷ
type WorkOrderFilter = 'mine' | 'open' | 'closed'
const SKELETON_ROWS = 4
const ROW_SKELETON_HEIGHT = 72

/** Danh sách Work Order sửa chữa (OPS-FR-001…004, G-21): kỹ thuật viên thấy việc của nhà được giao, mặc định việc giao cho mình;
 * chủ trại, chuyên gia thấy cả farm. Màn riêng ở stack gốc, ngoài các tab */
export default function WorkOrdersScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const user = useAuthStore(state => state.user)
  const isTechnician = canPerform(user, 'viewAssignedWorkOrdersOnly')
  const [filter, setFilter] = useState<WorkOrderFilter>(isTechnician ? 'mine' : 'open')
  const [isRefreshing, setRefreshing] = useState(false)
  const allHouses = useAllHouses()
  const workOrdersQuery = useWorkOrders(
    {
      assigneeId: filter === 'mine' ? 'me' : undefined,
      open: filter === 'closed' ? 'false' : 'true',
    },
    canPerform(user, 'viewWorkOrders'),
  )
  const workOrders = workOrdersQuery.data?.pages.flatMap(page => page.data) ?? []
  const houseNameById = new Map(allHouses.houses.map(house => [house._id, house.name]))

  if (!canPerform(user, 'viewWorkOrders')) return <Redirect href="/(tabs)/home" />

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await workOrdersQuery.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const renderList = () => {
    if (workOrdersQuery.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton
          key={index}
          width="100%"
          height={ROW_SKELETON_HEIGHT}
          radius={Radius.md}
          color={palette.surfaceStrong}
          delayMs={index * 75}
        />
      ))
    }
    if (workOrdersQuery.isError) {
      return (
        <EmptyState
          message={t('Không tải được Work Order')}
          actionLabel={t('Thử lại')}
          onAction={() => workOrdersQuery.refetch()}
        />
      )
    }
    if (workOrders.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {filter === 'closed' ? t('Chưa có Work Order đã đóng') : t('Không có Work Order nào đang mở')}
        </Text>
      )
    }
    return workOrders.map((workOrder, index) => (
      <WorkOrderRow
        key={workOrder._id}
        workOrder={workOrder}
        houseName={houseNameById.get(workOrder.house_id) ?? '_'}
        hasDivider={index < workOrders.length - 1}
        onPress={() => router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: workOrder._id } })}
      />
    ))
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Work Order')} onBack={goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        <ChoiceChips
          options={[
            ...(isTechnician ? [{ id: 'mine' as const, label: t('Giao cho tôi') }] : []),
            { id: 'open', label: t('Đang mở') },
            { id: 'closed', label: t('Đã đóng') },
          ]}
          selectedId={filter}
          onSelect={setFilter}
          accessibilityLabel={t('Lọc Work Order')}
        />
        <Card>{renderList()}</Card>
        {workOrdersQuery.hasNextPage && (
          <Button
            variant="link"
            label={t('Xem thêm')}
            onPress={() => workOrdersQuery.fetchNextPage()}
            loading={workOrdersQuery.isFetchingNextPage}
            style={styles.more}
          />
        )}
        <Text variant="small" color={palette.textSecondary}>
          {t(
            'Work Order mở tự động từ cảnh báo thiết bị hoặc khi chuyên gia xác nhận cần tới nhà. Làm xong, hệ thống kiểm dữ liệu phục hồi rồi chủ trại duyệt trên web.',
          )}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  more: { alignSelf: 'center' },
})
