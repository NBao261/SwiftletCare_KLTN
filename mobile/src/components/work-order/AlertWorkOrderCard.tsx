import { router } from 'expo-router'
import { PlusIcon } from 'phosphor-react-native'
import { WorkOrderRow } from '@/components/work-order/WorkOrderRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { useWorkOrders } from '@/hooks/work-order/useWorkOrders'
import { t } from '@/utils/i18n.utils'

const ROW_SKELETON_HEIGHT = 72

interface AlertWorkOrderCardProps {
  alertId: string
  houseName: string
  // Chỉ tải khi sheet chi tiết đã mở xong
  enabled: boolean
  // Trước khi mở màn Work Order: sheet chi tiết cảnh báo (Modal) đóng trước, không thì màn mới nằm dưới modal
  onLeave?: () => void
  // Chủ trại mở phiếu bằng tay cho cảnh báo chưa có phiếu (OPS-FR-001): nhà và tiêu đề điền sẵn; không truyền thì không có nút
  createPrefill?: { houseId: string; title: string }
}

// Work Order của một cảnh báo trong chi tiết cảnh báo (BR-39, mỗi cảnh báo chỉ có một Work Order đang mở): chạm để mở chi tiết.
// Cảnh báo chưa có Work Order thì chỉ hiện nút "Mở phiếu công việc" cho chủ trại; lỗi tải cũng không chặn phần còn lại của chi tiết
export function AlertWorkOrderCard({ alertId, houseName, enabled, onLeave, createPrefill }: AlertWorkOrderCardProps) {
  const workOrdersQuery = useWorkOrders({ alertId }, enabled)
  const workOrders = workOrdersQuery.data?.pages.flatMap(page => page.data) ?? []

  if (workOrdersQuery.isLoading && enabled) return <Skeleton width="100%" height={ROW_SKELETON_HEIGHT} />
  if (workOrders.length === 0) {
    if (!createPrefill || workOrdersQuery.isError) return null
    return (
      // Sheet mở phiếu nằm ở màn danh sách phiếu: đóng sheet cảnh báo trước để màn mới không nằm dưới modal
      <Button
        label={t('Mở phiếu công việc')}
        variant="secondary"
        trailingIcon={PlusIcon}
        onPress={() => {
          onLeave?.()
          router.push({
            pathname: '/work-orders',
            params: { create: '1', houseId: createPrefill.houseId, alertId, title: createPrefill.title },
          })
        }}
      />
    )
  }

  return (
    <Card>
      <Text variant="body" weight="semiBold">
        {t('Phiếu công việc')}
      </Text>
      {workOrders.map((workOrder, index) => (
        <WorkOrderRow
          key={workOrder._id}
          workOrder={workOrder}
          houseName={houseName}
          hasDivider={index < workOrders.length - 1}
          onPress={() => {
            onLeave?.()
            router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: workOrder._id } })
          }}
        />
      ))}
    </Card>
  )
}
