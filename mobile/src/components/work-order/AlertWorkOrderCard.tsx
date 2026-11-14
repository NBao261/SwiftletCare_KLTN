import { router } from 'expo-router'
import { WorkOrderRow } from '@/components/work-order/WorkOrderRow'
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
}

// Work Order của một cảnh báo trong chi tiết cảnh báo (BR-39, mỗi cảnh báo chỉ có một Work Order đang mở): chạm để mở chi tiết.
// Cảnh báo chưa có Work Order thì không hiện gì; lỗi tải cũng không chặn phần còn lại của chi tiết cảnh báo
export function AlertWorkOrderCard({ alertId, houseName, enabled }: AlertWorkOrderCardProps) {
  const workOrdersQuery = useWorkOrders({ alertId }, enabled)
  const workOrders = workOrdersQuery.data?.pages.flatMap(page => page.data) ?? []

  if (workOrdersQuery.isLoading && enabled) return <Skeleton width="100%" height={ROW_SKELETON_HEIGHT} />
  if (workOrders.length === 0) return null

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
          onPress={() => router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: workOrder._id } })}
        />
      ))}
    </Card>
  )
}
