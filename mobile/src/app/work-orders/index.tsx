import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { PlusIcon } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { WorkOrderCreateSheet, type WorkOrderCreatePrefill } from '@/components/work-order/WorkOrderCreateSheet'
import { WorkOrderRow } from '@/components/work-order/WorkOrderRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useWorkOrders } from '@/hooks/work-order/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Bộ lọc: việc giao cho tôi (kỹ thuật viên), chờ chủ trại duyệt, đang mở, đã đóng hoặc huỷ
type WorkOrderFilter = 'mine' | 'awaiting' | 'open' | 'closed'
const SKELETON_ROWS = 4
const ROW_SKELETON_HEIGHT = 72

/** Danh sách Work Order sửa chữa (OPS-FR-001…004, G-21): kỹ thuật viên thấy việc của nhà được giao, mặc định việc giao cho mình;
 * chủ trại, chuyên gia thấy cả farm; chủ trại có lọc "Chờ duyệt" và nút + mở phiếu bằng tay (mở từ cảnh báo thì có tham số
 * create, houseId, alertId, title để mở sẵn sheet). Màn riêng ở stack gốc, ngoài các tab */
export default function WorkOrdersScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const user = useAuthStore(state => state.user)
  const params = useLocalSearchParams<{ create?: string; houseId?: string; alertId?: string; title?: string }>()
  const isTechnician = canPerform(user, 'viewAssignedWorkOrdersOnly')
  const canCreate = canPerform(user, 'createWorkOrder')
  const canDecide = canPerform(user, 'decideWorkOrder')
  const [filter, setFilter] = useState<WorkOrderFilter>(isTechnician ? 'mine' : 'open')
  // Mỗi lần mở sheet một key mới để form bắt đầu trống; mở từ cảnh báo thì sheet mở sẵn với dữ liệu điền trước
  const [createSheet, setCreateSheet] = useState<{ key: number; prefill: WorkOrderCreatePrefill } | null>(() =>
    params.create === '1' && canCreate
      ? { key: 1, prefill: { houseId: params.houseId, alertId: params.alertId, title: params.title } }
      : null,
  )
  const [isRefreshing, setRefreshing] = useState(false)
  const { houseById } = useZoneDirectory()
  const workOrdersQuery = useWorkOrders(
    {
      assigneeId: filter === 'mine' ? 'me' : undefined,
      status: filter === 'awaiting' ? 'AWAITING_APPROVAL' : undefined,
      open: filter === 'awaiting' ? undefined : filter === 'closed' ? 'false' : 'true',
    },
    canPerform(user, 'viewWorkOrders'),
  )
  const workOrders = workOrdersQuery.data?.pages.flatMap(page => page.data) ?? []

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
          message={t('Không tải được phiếu công việc')}
          actionLabel={t('Thử lại')}
          onAction={() => workOrdersQuery.refetch()}
        />
      )
    }
    if (workOrders.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {filter === 'closed'
            ? t('Chưa có phiếu công việc đã đóng')
            : filter === 'awaiting'
              ? t('Không có phiếu công việc nào chờ duyệt')
              : t('Không có phiếu công việc nào đang mở')}
        </Text>
      )
    }
    return workOrders.map((workOrder, index) => (
      <WorkOrderRow
        key={workOrder._id}
        workOrder={workOrder}
        houseName={houseById.get(workOrder.house_id)?.name ?? '_'}
        hasDivider={index < workOrders.length - 1}
        onPress={() => router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: workOrder._id } })}
      />
    ))
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        title={t('Phiếu công việc')}
        onBack={goBack}
        right={
          canCreate ? (
            <IconButton
              icon={PlusIcon}
              label={t('Mở phiếu công việc')}
              onPress={() => setCreateSheet(current => ({ key: (current?.key ?? 0) + 1, prefill: {} }))}
            />
          ) : undefined
        }
      />
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
            ...(canDecide ? [{ id: 'awaiting' as const, label: t('Chờ duyệt') }] : []),
            { id: 'open', label: t('Đang mở') },
            { id: 'closed', label: t('Đã đóng') },
          ]}
          selectedId={filter}
          onSelect={setFilter}
          accessibilityLabel={t('Lọc phiếu công việc')}
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
            'Phiếu công việc mở tự động từ cảnh báo thiết bị hoặc khi chuyên gia xác nhận cần tới nhà; chủ trại cũng mở được bằng tay. Làm xong, sự cố có dữ liệu để kiểm thì hệ thống kiểm dữ liệu phục hồi trước, rồi chủ trại duyệt.',
          )}
        </Text>
      </ScrollView>
      {createSheet && (
        <WorkOrderCreateSheet
          key={createSheet.key}
          visible
          prefill={createSheet.prefill}
          onClose={() => setCreateSheet(null)}
          onCreated={workOrder => {
            setCreateSheet(null)
            router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: workOrder._id } })
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  more: { alignSelf: 'center' },
})
